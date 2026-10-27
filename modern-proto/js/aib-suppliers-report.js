/* =========================================================================
   PERFECTO · État mensuel des retenues d’AIB sur les fournisseurs
   Paramétrage annuel fourni par l’utilisateur; seuls les sous-comptes 4478
   sont admis. L’analyse provisoire distingue base théorique et mouvements
   comptabilisés; elle ne constitue pas encore le fichier Excel déclaratif.
   ========================================================================= */
(function (root) {
  'use strict';

  var Fflate = root.fflate;
  if (!Fflate && typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    Fflate = require('../vendor/fflate-0.8.2.js');
  }
  var TEMPLATE_URL = 'assets/aib-suppliers-template.xlsx';
  var TEMPLATE_SHA256 = 'f3f341831c99bc791cbf1e6c1673277b49d93db3c6fcd144dec220f7d9690837';

  var CATEGORIES = [
    { key: 'purchases', label: 'AIB SUR ACHATS' },
    { key: 'honoraires', label: 'AIB SUR HONORAIRES' }
  ];

  function cleanAccounts(value) {
    var entries = Array.isArray(value) ? value : String(value == null ? '' : value).split(/[\s,;]+/);
    var seen = Object.create(null);
    return entries.map(function (entry) { return String(entry == null ? '' : entry).trim(); }).filter(function (code) {
      if (!code || !/^\d+\*?$/.test(code) || seen[code]) return false;
      seen[code] = true;
      return true;
    });
  }

  function isAibSubaccountToken(code) {
    return /^4478(?:\*|\d+\*?)$/.test(String(code == null ? '' : code).trim());
  }

  function blankLine(categoryKey, id) {
    return { id: String(id || categoryKey + '-1'), rate: '', accounts: [] };
  }

  function defaults(year) {
    return {
      schemaVersion: 2,
      year: Number(year) || null,
      categories: CATEGORIES.map(function (category) {
        return { key: category.key, label: category.label, lines: [blankLine(category.key)] };
      })
    };
  }

  function normalise(configuration, year) {
    var source = configuration && typeof configuration === 'object' ? configuration : {};
    var supplied = Array.isArray(source.categories) ? source.categories : [];
    var usedIds = Object.create(null);
    return {
      schemaVersion: 2,
      year: Number(year) || Number(source.year) || null,
      categories: CATEGORIES.map(function (category) {
        var row = supplied.find(function (candidate) { return candidate && candidate.key === category.key; }) || {};
        var rawLines = Array.isArray(row.lines) ? row.lines : null;
        if (!rawLines) rawLines = [{ id: category.key + '-1', rate: row.rate, accounts: row.accounts }];
        var lines = rawLines.map(function (line, index) {
          line = line && typeof line === 'object' ? line : {};
          var id = String(line.id || category.key + '-' + (index + 1)).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
          if (!id || usedIds[id]) id = category.key + '-' + (index + 1);
          while (usedIds[id]) id += '-x';
          usedIds[id] = true;
          return {
            id: id,
            rate: String(line.rate == null ? '' : line.rate).trim().replace(',', '.').replace(/\s*%$/, '').trim().slice(0, 24),
            accounts: cleanAccounts(line.accounts)
          };
        });
        if (!lines.length) lines = [blankLine(category.key, category.key + '-1')];
        return { key: category.key, label: category.label, lines: lines };
      })
    };
  }

  function nextLineId(configuration, categoryKey) {
    var category = configuration.categories.find(function (row) { return row.key === categoryKey; });
    var max = 0;
    (category ? category.lines : []).forEach(function (line) {
      var id = String(line.id || '');
      var prefix = categoryKey + '-';
      var suffix = id.indexOf(prefix) === 0 ? id.slice(prefix.length) : '';
      if (/^\d+$/.test(suffix)) max = Math.max(max, Number(suffix));
    });
    return categoryKey + '-' + (max + 1);
  }

  function addLine(configuration, categoryKey) {
    var result = normalise(configuration, configuration && configuration.year);
    var category = result.categories.find(function (row) { return row.key === categoryKey; });
    if (!category) throw new Error('Rubrique AIB inconnue.');
    category.lines.push(blankLine(categoryKey, nextLineId(result, categoryKey)));
    return result;
  }

  function removeLine(configuration, categoryKey, lineId) {
    var result = normalise(configuration, configuration && configuration.year);
    var category = result.categories.find(function (row) { return row.key === categoryKey; });
    if (!category) throw new Error('Rubrique AIB inconnue.');
    if (category.lines.length <= 1) throw new Error('Chaque rubrique doit conserver au moins une ligne.');
    category.lines = category.lines.filter(function (line) { return line.id !== lineId; });
    if (!category.lines.length) category.lines = [blankLine(categoryKey, categoryKey + '-1')];
    return result;
  }

  function validateDefinition(configuration, year) {
    var normalized = normalise(configuration, year);
    var errors = [];
    normalized.categories.forEach(function (category) {
      category.lines.forEach(function (line, index) {
        var prefix = 'Ligne ' + (index + 1) + ' de « ' + category.label + ' » : ';
        if (!line.rate || !/^\d+(?:\.\d+)?$/.test(line.rate) || !isFinite(Number(line.rate)) || Number(line.rate) < 0) {
          errors.push(prefix + 'saisissez un taux numérique positif ou nul.');
        }
        if (!line.accounts.length) errors.push(prefix + 'sélectionnez au moins un sous-compte 4478.');
        line.accounts.forEach(function (code) {
          if (!isAibSubaccountToken(code)) errors.push(prefix + 'le compte « ' + code + ' » n’est pas un sous-compte de 4478; seuls les mouvements de la famille 4478 sont admis.');
        });
      });
    });
    return { ok: errors.length === 0, errors: errors, configuration: normalized };
  }

  function accountMatchesToken(token, accountCode) {
    token = String(token || '');
    accountCode = String(accountCode || '');
    return token.slice(-1) === '*' ? accountCode.indexOf(token.slice(0, -1)) === 0 : token === accountCode;
  }

  function roundAmount(value, decimalPlaces) {
    var places = Number(decimalPlaces);
    if (!isFinite(places) || places < 0 || places > 4) places = 0;
    var factor = Math.pow(10, places);
    return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
  }

  function analyseMonth(options) {
    options = options || {};
    var period = String(options.period || '');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return { ok: false, errors: ['Choisissez un mois de référence valide.'], categories: [], gaps: [] };
    var validation = validateDefinition(options.configuration, Number(period.slice(0, 4)));
    if (!validation.ok) return { ok: false, errors: validation.errors, categories: [], gaps: [] };
    var entries = Array.isArray(options.entries) ? options.entries : [];
    var precision = Number(options.decimalPlaces);
    if (!isFinite(precision) || precision < 0 || precision > 4) precision = 0;
    var configuredCategories = validation.configuration.categories;
    var summaries = configuredCategories.map(function (category) {
      return {
        key: category.key,
        label: category.label,
        lines: category.lines.map(function (line) {
          return {
            id: line.id, rate: line.rate, accounts: line.accounts.slice(),
            base: null, theoreticalAmount: null, recordedAmount: null,
            matchedEntryCount: 0, missingMovementCount: 0, variance: null,
            actualComplete: true
          };
        })
      };
    });
    var gaps = [];

    function addGap(entry, code, message, categoryKey) {
      gaps.push({
        entryId: String(entry && entry.id || ''),
        reference: String(entry && entry.reference || ''),
        date: String(entry && entry.date || ''),
        account: String(code || ''),
        category: String(categoryKey || ''),
        message: message
      });
    }

    function configuredMatches(accountCode) {
      var matches = [];
      configuredCategories.forEach(function (category) {
        category.lines.forEach(function (line) {
          if (line.accounts.some(function (token) { return accountMatchesToken(token, accountCode); })) {
            matches.push({ categoryKey: category.key, lineId: line.id });
          }
        });
      });
      return matches;
    }

    entries.forEach(function (entry) {
      if (!entry || entry.status !== 'posted' || String(entry.date || '').slice(0, 7) !== period) return;
      var lines = Array.isArray(entry.lines) ? entry.lines : [];
      var supplierLines = lines.filter(function (line) {
        return line && /^40\d/.test(String(line.account || line.accountCode || '')) &&
          (Number(line.debit) > 0 || Number(line.credit) > 0);
      });
      var baseByCategory = { purchases: 0, honoraires: 0 };
      lines.forEach(function (line) {
        if (!line) return;
        var code = String(line.account || line.accountCode || '');
        var debit = Number(line.debit) || 0;
        var credit = Number(line.credit) || 0;
        if (code.indexOf('60') === 0) baseByCategory.purchases += debit - credit;
        else if (/^6[123]/.test(code)) baseByCategory.honoraires += debit - credit;
      });
      var activeCategories = Object.keys(baseByCategory).filter(function (key) { return baseByCategory[key] !== 0; });
      var aibMovements = Object.create(null);
      lines.forEach(function (line) {
        if (!line) return;
        var code = String(line.account || line.accountCode || '');
        if (code.indexOf('4478') !== 0 || code.length <= 4) return;
        var net = (Number(line.credit) || 0) - (Number(line.debit) || 0);
        if (!net) return;
        aibMovements[code] = (aibMovements[code] || 0) + net;
      });

      if (!supplierLines.length) {
        if (Object.keys(aibMovements).length && activeCategories.length) {
          addGap(entry, '', 'La contrepartie fournisseur de classe 40 n’est pas identifiable dans cette écriture.');
        }
        return;
      }
      if (!activeCategories.length) {
        if (Object.keys(aibMovements).length) addGap(entry, '', 'Le mouvement 4478 est lié à un fournisseur mais aucune contrepartie de classe 60 ou 61–63 ne permet de classer la base.');
        return;
      }

      var mappedMovements = [];
      Object.keys(aibMovements).forEach(function (accountCode) {
        var matches = configuredMatches(accountCode);
        if (matches.length !== 1) {
          addGap(entry, accountCode, matches.length ? 'Le sous-compte 4478 est associé à plusieurs lignes de taux; le mouvement ne peut pas être ventilé.' : 'Le mouvement 4478 n’est associé à aucune ligne de la configuration annuelle.');
          return;
        }
        mappedMovements.push({
          account: accountCode,
          amount: aibMovements[accountCode],
          categoryKey: matches[0].categoryKey,
          lineId: matches[0].lineId
        });
      });

      activeCategories.forEach(function (categoryKey) {
        var categorySummary = summaries.find(function (item) { return item.key === categoryKey; });
        var categoryLines = categorySummary ? categorySummary.lines : [];
        var categoryMovements = mappedMovements.filter(function (item) { return item.categoryKey === categoryKey; });
        var targetLineIds = Array.from(new Set(categoryMovements.map(function (item) { return item.lineId; })));
        var targetLineId = targetLineIds.length === 1 ? targetLineIds[0] : '';
        if (!targetLineId && categoryLines.length === 1) targetLineId = categoryLines[0].id;
        if (!targetLineId) {
          addGap(entry, '', 'La base de ' + (categorySummary ? categorySummary.label : categoryKey) + ' est identifiable, mais aucune ligne de taux unique ne peut lui être attribuée.', categoryKey);
          return;
        }
        var target = categoryLines.find(function (line) { return line.id === targetLineId; });
        if (!target) return;
        var rate = Number(target.rate);
        var base = roundAmount(baseByCategory[categoryKey], precision);
        var theoretical = roundAmount(base * rate / 100, precision);
        target.base = (target.base == null ? 0 : target.base) + base;
        target.theoreticalAmount = (target.theoreticalAmount == null ? 0 : target.theoreticalAmount) + theoretical;
        target.matchedEntryCount += 1;
        if (categoryMovements.length) {
          var recorded = categoryMovements.filter(function (item) { return item.lineId === targetLineId; }).reduce(function (sum, item) { return sum + item.amount; }, 0);
          target.recordedAmount = (target.recordedAmount == null ? 0 : target.recordedAmount) + roundAmount(recorded, precision);
        } else {
          target.missingMovementCount += 1;
          target.actualComplete = false;
          addGap(entry, '', 'Base trouvée, mais aucun mouvement créditeur net dans le sous-compte 4478 configuré; le montant comptabilisé reste vide.', categoryKey);
        }
      });

      mappedMovements.forEach(function (movement) {
        if (activeCategories.indexOf(movement.categoryKey) === -1) {
          addGap(entry, movement.account, 'Mouvement 4478 configuré détecté, mais aucune contrepartie de charge de la rubrique correspondante n’est présente.', movement.categoryKey);
        }
      });
    });

    summaries.forEach(function (category) {
      category.lines.forEach(function (line) {
        if (line.actualComplete && line.recordedAmount != null && line.theoreticalAmount != null) {
          line.variance = roundAmount(line.recordedAmount - line.theoreticalAmount, precision);
          if (line.variance !== 0) gaps.push({
            entryId: '', reference: '', date: '', account: line.accounts.join(', '), category: category.key,
            message: 'Écart global entre le montant théorique (' + line.theoreticalAmount + ') et les mouvements créditeurs nets 4478 (' + line.recordedAmount + ') pour la ligne ' + line.id + '.'
          });
        }
        if (line.base == null) line.actualComplete = false;
      });
    });

    return {
      ok: true,
      period: period,
      categories: summaries,
      gaps: gaps,
      sourceEntryCount: entries.filter(function (entry) {
        return entry && entry.status === 'posted' && String(entry.date || '').slice(0, 7) === period;
      }).length,
      generatedDeclarationAmount: null
    };
  }

  function xmlEscape(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  function xmlUnescape(value) {
    return String(value || '').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<').replace(/&amp;/g, '&');
  }

  function encode(text) { return new TextEncoder().encode(String(text)); }
  function decode(bytes) { return new TextDecoder('utf-8').decode(bytes); }

  function setDefinedName(xml, name, value, numeric) {
    var escapedName = String(name).replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
    var expression = new RegExp('(<definedName\\b(?=[^>]*\\bname="' + escapedName + '")[^>]*>)([\\s\\S]*?)(<\\/definedName>)');
    var found = false;
    var text = numeric && Number.isFinite(Number(value)) ? String(value) : '"' + xmlEscape(String(value == null ? '' : value).replace(/"/g, '""')) + '"';
    var result = xml.replace(expression, function (_all, open, _old, close) {
      found = true;
      return open + text + close;
    });
    if (!found) throw new Error('Le nom défini « ' + name + ' » est absent du modèle AIB.');
    return result;
  }

  function setFormulaCache(xml, cellReference, value, numeric) {
    var escapedReference = String(cellReference).replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
    var expression = new RegExp('(<c\\b(?=[^>]*\\br="' + escapedReference + '")[^>]*>)([\\s\\S]*?)(<\\/c>)');
    var found = false;
    var result = xml.replace(expression, function (_all, open, body, close) {
      if (!/<f(?:\s[^>]*)?>[\s\S]*?<\/f>/.test(body)) return open + body + close;
      found = true;
      var isNumeric = numeric && value != null && value !== '' && Number.isFinite(Number(value));
      var nextOpen = open.replace(/\s+t="[^"]*"/g, '');
      if (!isNumeric && !/\s+t=/.test(nextOpen)) nextOpen = nextOpen.replace(/>$/, ' t="str">');
      var cached = isNumeric ? String(value) : xmlEscape(value == null ? '' : value);
      var nextBody = /<v(?:\s[^>]*)?>[\s\S]*?<\/v>/.test(body)
        ? body.replace(/<v(?:\s[^>]*)?>[\s\S]*?<\/v>/, '<v>' + cached + '</v>')
        : body.replace(/<\/f>/, '</f><v>' + cached + '</v>');
      return nextOpen + nextBody + close;
    });
    return { xml: result, found: found };
  }

  function formatFormDate(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    return match ? match[3] + '/' + match[2] + '/' + match[1] : '';
  }

  function periodBoundaries(period) {
    var parts = String(period || '').split('-');
    var year = Number(parts[0]);
    var month = Number(parts[1]);
    if (!year || !month) return { start: '', end: '' };
    var lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return {
      start: year + '-' + String(month).padStart(2, '0') + '-01',
      end: year + '-' + String(month).padStart(2, '0') + '-' + String(lastDay).padStart(2, '0')
    };
  }

  function monthLabel(period) {
    var parts = String(period || '').split('-');
    var year = Number(parts[0]);
    var month = Number(parts[1]);
    if (!year || !month) return '';
    var label = new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)));
    return label.charAt(0).toLocaleUpperCase('fr-FR') + label.slice(1);
  }

  function commonValues(rows) {
    var result = Object.create(null);
    (Array.isArray(rows) ? rows : []).forEach(function (row) {
      if (row && row.id && !row.separator) result[row.id] = String(row.value == null ? '' : row.value).trim();
    });
    return result;
  }

  function buildWorkbookValues(preparation, options) {
    options = options || {};
    var period = String(preparation.period || '');
    var boundary = periodBoundaries(period);
    var common = commonValues(options.printedInformationRows);
    var values = Object.create(null);
    var numericNames = Object.create(null);
    var analysis = preparation.movementAnalysis;
    if (!analysis || !analysis.ok) throw new Error('Analyse mensuelle AIB indisponible; aucun classeur n’a été créé.');

    function put(name, value, numeric) {
      values[name] = value == null ? '' : value;
      numericNames[name] = !!numeric;
    }

    put('eAn', ' ' + period.slice(0, 4));
    put('eMois', ' ' + monthLabel(period));
    put('eDeb', ' ' + formatFormDate(boundary.start));
    put('eFin', ' ' + formatFormDate(boundary.end));
    put('soNom', common['company-name']);
    put('soAct', common['main-activity']);
    put('soAdr', common['head-office-address']);
    put('soTel', common.phone);
    put('numINSAE', common['insae-number']);
    put('numIFU', common['ifu-number']);
    put('nSign', preparation.declarant.signer);
    put('Ville', preparation.declarant.city);
    put('dSign', formatFormDate(preparation.declarant.signatureDate));
    put('IndEsp', preparation.payment.method === 'cash' ? 'X' : '');
    put('IndChq', preparation.payment.method === 'cheque' ? 'X' : '');
    put('IndVir', preparation.payment.method === 'transfer' ? 'X' : '');
    put('bqChq', preparation.payment.method === 'cheque' ? preparation.payment.bank : '');
    put('numChq', preparation.payment.method === 'cheque' ? preparation.payment.cheque : '');
    put('bqVir', preparation.payment.method === 'transfer' ? preparation.payment.transferBank : '');
    put('refVir', preparation.payment.method === 'transfer' ? preparation.payment.transferReference : '');
    put('mLettres', '');

    var total = 0;
    var hasAmount = false;
    var templateLines = 0;
    configuredCategoriesForWorkbook(preparation.configuration).forEach(function (category, categoryIndex) {
      if (category.lines.length > 4) throw new Error('La rubrique « ' + category.label + ' » comporte ' + category.lines.length + ' lignes, mais le modèle officiel en prévoit quatre. Aucun classeur n’a été généré afin de ne pas supprimer de lignes.');
      var categoryAnalysis = analysis.categories.find(function (row) { return row.key === category.key; });
      category.lines.forEach(function (line, index) {
        var slot = categoryIndex * 4 + index + 1;
        var movementLine = categoryAnalysis && categoryAnalysis.lines.find(function (row) { return row.id === line.id; });
        var rateName = 'nAIB' + slot;
        var baseName = 'mBase' + slot;
        var amountName = '_mDu' + slot;
        put(rateName, 'AIB de ' + String(line.rate).replace('.', ',') + '%');
        if (movementLine && movementLine.base != null) {
          put(baseName, movementLine.base, true);
          put(amountName, movementLine.theoreticalAmount, movementLine.theoreticalAmount != null);
          if (movementLine.theoreticalAmount != null) {
            total += Number(movementLine.theoreticalAmount);
            hasAmount = true;
          }
        } else {
          put(baseName, '');
          put(amountName, '');
        }
        templateLines += 1;
      });
    });
    for (var slot = 1; slot <= 8; slot += 1) {
      if (values['nAIB' + slot] == null) put('nAIB' + slot, '');
      if (values['mBase' + slot] == null) put('mBase' + slot, '');
      if (values['_mDu' + slot] == null) put('_mDu' + slot, '');
    }
    return { values: values, numericNames: numericNames, total: hasAmount ? roundAmount(total, Number(options.decimalPlaces) || 0) : null, templateLines: templateLines };
  }

  function configuredCategoriesForWorkbook(configuration) {
    return CATEGORIES.map(function (definition) {
      return (configuration.categories || []).find(function (candidate) { return candidate.key === definition.key; }) || { key: definition.key, label: definition.label, lines: [] };
    });
  }

  function countFormulas(sheetXml) {
    var matches = sheetXml.match(/<f(?:\s[^>]*)?>/g);
    return matches ? matches.length : 0;
  }

  function generateWorkbook(templateBytes, preparation, options) {
    options = options || {};
    if (!Fflate || typeof Fflate.unzipSync !== 'function' || typeof Fflate.zipSync !== 'function') throw new Error('Le module local de création Excel n’est pas disponible.');
    var bytes = templateBytes instanceof Uint8Array ? templateBytes : new Uint8Array(templateBytes || []);
    if (!bytes.length) throw new Error('Le modèle AIB intégré est vide ou inaccessible.');
    if (preparation.configuration.categories.some(function (category) { return category.lines.length > 4; })) {
      throw new Error('Le modèle officiel n’accepte que quatre lignes par rubrique. Réduisez ou regroupez le paramétrage avant génération.');
    }
    var files = Fflate.unzipSync(bytes);
    var workbookPath = 'xl/workbook.xml';
    var sheetPath = 'xl/worksheets/sheet1.xml';
    if (!files[workbookPath] || !files[sheetPath]) throw new Error('La structure du modèle officiel AIB est incomplète.');
    var workbookXml = decode(files[workbookPath]);
    var sheetXml = decode(files[sheetPath]);
    var originalFormulaCount = countFormulas(sheetXml);
    var population = buildWorkbookValues(preparation, options);
    Object.keys(population.values).forEach(function (name) {
      workbookXml = setDefinedName(workbookXml, name, population.values[name], population.numericNames[name]);
    });
    var formulaCacheValues = Object.create(null);
    Object.keys(population.values).forEach(function (name) { formulaCacheValues[name] = { value: population.values[name], numeric: population.numericNames[name] }; });
    sheetXml = sheetXml.replace(/<c\b[^>]*\/>|<c\b[^>]*>[\s\S]*?<\/c>/g, function (cell) {
      var formula = /<f(?:\s[^>]*)?>([\s\S]*?)<\/f>/.exec(cell);
      if (!formula) return cell;
      var name = xmlUnescape(formula[1]).trim();
      if (!Object.prototype.hasOwnProperty.call(formulaCacheValues, name)) return cell;
      var referenceMatch = /\br="([^"]+)"/.exec(/^<c\b[^>]*>/.exec(cell)[0]);
      if (!referenceMatch) return cell;
      var cached = setFormulaCache(cell, referenceMatch[1], formulaCacheValues[name].value, formulaCacheValues[name].numeric);
      return cached.found ? cached.xml : cell;
    });
    var totalCache = setFormulaCache(sheetXml, 'N31', population.total == null ? '' : population.total, population.total != null);
    if (!totalCache.found) throw new Error('La cellule total du modèle officiel AIB est absente.');
    sheetXml = totalCache.xml;
    workbookXml = setCalculationOnOpen(workbookXml);
    files[workbookPath] = encode(workbookXml);
    files[sheetPath] = encode(sheetXml);
    var formulaCount = countFormulas(sheetXml);
    if (formulaCount !== originalFormulaCount) throw new Error('La génération AIB a modifié le nombre de formules du modèle.');
    var gaps = (preparation.movementAnalysis.gaps || []).slice();
    function addFieldGap(label, value) {
      if (!String(value == null ? '' : value).trim()) gaps.push({ entryId: '', reference: '', date: '', account: '', category: '', message: 'Le champ « ' + label + ' » n’est pas renseigné; il est resté vierge dans le classeur.' });
    }
    var common = commonValues(options.printedInformationRows);
    [
      ['Raison sociale', common['company-name']], ['Activité', common['main-activity']],
      ['Adresse', common['head-office-address']], ['Téléphone', common.phone],
      ['N° INSAE', common['insae-number']], ['N° IFU', common['ifu-number']]
    ].forEach(function (field) { addFieldGap(field[0], field[1]); });
    addFieldGap('Montant du versement en lettres', '');
    addFieldGap('Nom du signataire', preparation.declarant.signer);
    addFieldGap('Ville de signature', preparation.declarant.city);
    addFieldGap('Date de signature', preparation.declarant.signatureDate);
    if (!preparation.payment.method) addFieldGap('Mode de paiement', '');
    if (preparation.payment.method === 'cheque') {
      addFieldGap('Numéro de chèque', preparation.payment.cheque);
      addFieldGap('Banque du chèque', preparation.payment.bank);
    }
    if (preparation.payment.method === 'transfer') {
      addFieldGap('Banque du virement', preparation.payment.transferBank);
      addFieldGap('Référence du virement', preparation.payment.transferReference);
    }
    if (!preparation.movementAnalysis.sourceEntryCount) gaps.push({ entryId: '', reference: '', date: '', account: '', category: '', message: 'Aucune écriture validée n’est disponible pour le mois sélectionné; les bases et montants restent vierges.' });
    return {
      bytes: Fflate.zipSync(files, { level: 6 }),
      gaps: gaps,
      totalTheoreticalAmount: population.total,
      formulaCount: formulaCount,
      summary: { period: preparation.period, sourceEntryCount: preparation.movementAnalysis.sourceEntryCount, templateLineCount: population.templateLines }
    };
  }

  function setCalculationOnOpen(workbookXml) {
    if (/<calcPr\b/.test(workbookXml)) {
      return workbookXml.replace(/<calcPr\b([^>]*?)(?:\s*\/>|>([\s\S]*?)<\/calcPr>)/, function (_all, attrs) {
        attrs = attrs.replace(/\s(?:calcMode|fullCalcOnLoad|forceFullCalc)="[^"]*"/g, '');
        return '<calcPr' + attrs + ' calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>';
      });
    }
    return workbookXml.replace('</workbook>', '<calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>');
  }

  function buildGapReport(gaps) {
    var rows = [['Date', 'Référence', 'Catégorie', 'Compte 4478', 'Constat', 'Action proposée']];
    (Array.isArray(gaps) ? gaps : []).forEach(function (gap) {
      rows.push([
        gap.date || '', gap.reference || '', gap.category || '', gap.account || '', gap.message || '',
        'Vérifier la pièce, la contrepartie, le sous-compte 4478 et le paramétrage annuel; corriger avant dépôt.'
      ]);
    });
    if (rows.length === 1) rows.push(['', '', '', '', 'Aucun écart automatique détecté.', 'Contrôler les informations avant dépôt.']);
    return '\uFEFF' + rows.map(function (row) {
      return row.map(function (cell) {
        var value = String(cell == null ? '' : cell);
        return /[";\r\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
      }).join(';');
    }).join('\r\n');
  }

  function loadTemplate(fetchFunction) {
    var fetcher = fetchFunction || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    if (!fetcher) return Promise.reject(new Error('Le chargement du modèle AIB local n’est pas disponible.'));
    return fetcher(TEMPLATE_URL, { cache: 'no-store' }).then(function (response) {
      if (!response || !response.ok) throw new Error('Le modèle officiel AIB intégré n’a pas pu être chargé.');
      return response.arrayBuffer();
    }).then(function (buffer) {
      var bytes = new Uint8Array(buffer);
      return verifyTemplateBytes(bytes).then(function (valid) {
        if (!valid) throw new Error('Le modèle officiel AIB intégré ne correspond pas à la ressource de référence.');
        return bytes;
      });
    });
  }

  function verifyTemplateBytes(bytes) {
    if (typeof crypto !== 'undefined' && crypto.subtle) return crypto.subtle.digest('SHA-256', bytes).then(function (digest) {
      var actual = Array.prototype.map.call(new Uint8Array(digest), function (value) { return value.toString(16).padStart(2, '0'); }).join('');
      return actual === TEMPLATE_SHA256;
    });
    if (typeof require === 'function') {
      try {
        var cryptoModule = require('crypto');
        return Promise.resolve(cryptoModule.createHash('sha256').update(Buffer.from(bytes)).digest('hex') === TEMPLATE_SHA256);
      } catch (_error) { return Promise.resolve(false); }
    }
    return Promise.resolve(false);
  }

  function prepare(options) {
    options = options || {};
    var period = String(options.period || '');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('Choisissez un mois de référence valide.');
    var validation = validateDefinition(options.configuration, Number(period.slice(0, 4)));
    if (!validation.ok) throw new Error(validation.errors.join(' '));
    var payment = options.payment || {};
    var method = ['cash', 'cheque', 'transfer'].indexOf(payment.method) !== -1 ? payment.method : '';
    return {
      period: period,
      year: Number(period.slice(0, 4)),
      configuration: validation.configuration,
      payment: {
        method: method,
        cheque: String(payment.cheque || '').trim(),
        bank: String(payment.bank || '').trim(),
        transferBank: String(payment.transferBank || '').trim(),
        transferReference: String(payment.transferReference || '').trim()
      },
      declarant: {
        signer: String(options.signer || '').trim(),
        city: String(options.city || '').trim(),
        signatureDate: String(options.signatureDate || '').trim()
      },
      excelTable: null,
      movementAnalysis: Array.isArray(options.entries) ? analyseMonth({
        period: period,
        configuration: validation.configuration,
        entries: options.entries,
        decimalPlaces: options.decimalPlaces
      }) : null,
      generatedWithholdingLines: 0
    };
  }

  root.PerfectoAibSuppliersReport = {
    CATEGORIES: CATEGORIES,
    TEMPLATE_URL: TEMPLATE_URL,
    TEMPLATE_SHA256: TEMPLATE_SHA256,
    defaults: defaults,
    cleanAccounts: cleanAccounts,
    isAibSubaccountToken: isAibSubaccountToken,
    normalise: normalise,
    addLine: addLine,
    removeLine: removeLine,
    validateDefinition: validateDefinition,
    analyseMonth: analyseMonth,
    prepare: prepare,
    generateWorkbook: generateWorkbook,
    buildGapReport: buildGapReport,
    loadTemplate: loadTemplate,
    verifyTemplateBytes: verifyTemplateBytes
  };
}(typeof window !== 'undefined' ? window : globalThis));
