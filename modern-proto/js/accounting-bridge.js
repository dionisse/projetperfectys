/* PERFECTO · Correspondances configurées pour les opérations internes de centralisation.
   Stockage de démonstration local ; aucune pièce comptable n’est créée ou modifiée ici. */
(function (root) {
  'use strict';

  var STORAGE_PREFIX = 'perfecto.accounting-bridge.v2.';

  function cleanId(value) {
    return String(value == null ? '' : value).trim();
  }

  function storageKey(targetDossierId, sourceModuleId) {
    return STORAGE_PREFIX + encodeURIComponent(cleanId(targetDossierId)) + '.' + encodeURIComponent(cleanId(sourceModuleId));
  }

  function normalizedMappings(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(function (mapping) {
      return mapping && typeof mapping === 'object' && !Array.isArray(mapping);
    }).map(function (mapping) {
      return {
        sourceCode: String(mapping.sourceCode == null ? '' : mapping.sourceCode).trim(),
        targetCode: String(mapping.targetCode == null ? '' : mapping.targetCode).trim()
      };
    }).filter(function (mapping) { return !!mapping.sourceCode && !!mapping.targetCode; });
  }

  function storedMappingsAreValid(mappings) {
    if (!Array.isArray(mappings) || mappings.length > 2000) return false;
    var seenSources = Object.create(null);
    return mappings.every(function (mapping) {
      if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping) ||
          typeof mapping.sourceCode !== 'string' || typeof mapping.targetCode !== 'string') return false;
      var sourceCode = mapping.sourceCode.trim();
      var targetCode = mapping.targetCode.trim();
      if (!sourceCode || !targetCode || seenSources[sourceCode]) return false;
      seenSources[sourceCode] = true;
      return true;
    });
  }

  function accountLookup(accounts) {
    var lookup = Object.create(null);
    (Array.isArray(accounts) ? accounts : []).forEach(function (account) {
      if (account && account.code != null) lookup[String(account.code)] = account;
    });
    return lookup;
  }

  function validateMappings(mappings, sourceAccounts, targetAccounts) {
    var errors = [];
    var rows = normalizedMappings(mappings);
    var sourceLookup = accountLookup(sourceAccounts);
    var targetLookup = accountLookup(targetAccounts);
    var seenSources = Object.create(null);

    if (!Array.isArray(mappings)) errors.push('Le tableau de passage doit être une liste de correspondances.');
    if (Array.isArray(mappings) && mappings.length > 2000) errors.push('Le tableau dépasse la limite de 2 000 correspondances.');

    (Array.isArray(mappings) ? mappings : []).forEach(function (mapping, index) {
      if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
        errors.push('La correspondance ' + (index + 1) + ' n’est pas valide.');
        return;
      }
      var sourceCode = String(mapping.sourceCode == null ? '' : mapping.sourceCode).trim();
      var targetCode = String(mapping.targetCode == null ? '' : mapping.targetCode).trim();
      if (!sourceCode || !targetCode) {
        errors.push('La correspondance ' + (index + 1) + ' doit désigner un compte source et un compte cible.');
        return;
      }
      if (seenSources[sourceCode]) {
        errors.push('Le compte source « ' + sourceCode + ' » apparaît plusieurs fois dans le tableau.');
        return;
      }
      seenSources[sourceCode] = true;
      var source = sourceLookup[sourceCode];
      if (!source || source.postable === false) {
        errors.push('Le compte source « ' + sourceCode + ' » est absent ou non imputable dans le plan de l’opération source.');
      }
      var target = targetLookup[targetCode];
      if (!target || target.postable === false || target.active === false) {
        errors.push('Le compte cible « ' + targetCode + ' » est absent, inactif ou non imputable dans le plan comptable du dossier cible.');
      }
    });

    return { ok: errors.length === 0, errors: errors, mappings: rows };
  }

  function get(targetDossierId, sourceModuleId) {
    var targetId = cleanId(targetDossierId);
    var sourceId = cleanId(sourceModuleId);
    if (!targetId || !sourceId) {
      return { ok: false, errors: ['Sélectionnez un dossier cible et une opération source pour consulter le tableau de passage.'], mappings: [], updatedAt: '' };
    }
    var raw;
    try {
      if (!root.localStorage) return { ok: false, errors: ['Stockage local indisponible ; le tableau de passage ne peut pas être lu.'], mappings: [], updatedAt: '' };
      raw = root.localStorage.getItem(storageKey(targetId, sourceId));
    } catch (error) {
      return { ok: false, errors: ['Lecture du tableau de passage impossible dans le stockage local.'], mappings: [], updatedAt: '' };
    }
    if (!raw) return { ok: true, errors: [], mappings: [], updatedAt: '' };
    var parsed;
    try { parsed = JSON.parse(raw); }
    catch (error) {
      return { ok: false, errors: ['Le tableau de passage enregistré est illisible. Il n’a pas été remplacé.'], mappings: [], updatedAt: '' };
    }
    if (!parsed || parsed.version !== 2 || parsed.targetDossierId !== targetId || parsed.sourceModuleId !== sourceId || !storedMappingsAreValid(parsed.mappings)) {
      return { ok: false, errors: ['Le tableau de passage enregistré est illisible ou incohérent. Il n’a pas été remplacé.'], mappings: [], updatedAt: '' };
    }
    return {
      ok: true,
      errors: [],
      mappings: normalizedMappings(parsed.mappings),
      updatedAt: String(parsed.updatedAt || '')
    };
  }

  function save(targetDossierId, sourceModuleId, mappings, sourceAccounts, targetAccounts) {
    var targetId = cleanId(targetDossierId);
    var sourceId = cleanId(sourceModuleId);
    if (!targetId || !sourceId) {
      return { ok: false, errors: ['Sélectionnez un dossier cible et une opération source.'] };
    }
    var validation = validateMappings(mappings, sourceAccounts, targetAccounts);
    if (!validation.ok) return validation;
    var payload = {
      version: 2,
      targetDossierId: targetId,
      sourceModuleId: sourceId,
      updatedAt: new Date().toISOString(),
      mappings: validation.mappings
    };
    try {
      if (!root.localStorage) return { ok: false, errors: ['Stockage local indisponible ; le tableau n’a pas été enregistré.'] };
      root.localStorage.setItem(storageKey(targetId, sourceId), JSON.stringify(payload));
      return { ok: true, errors: [], mappings: validation.mappings, updatedAt: payload.updatedAt };
    } catch (error) {
      return { ok: false, errors: ['Enregistrement du tableau de passage impossible ; les correspondances précédentes sont conservées.'] };
    }
  }

  var api = Object.freeze({
    get: get,
    save: save,
    validateMappings: validateMappings
  });
  root.PerfectoAccountingBridge = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
}(typeof window === 'object' ? window : globalThis));
