/* PERFECTO · Rapports Tiers et Plan des journaux — consultation seule. */
(function (root, factory) {
  'use strict';
  var api = factory();
  root.PerfectoDefinitionsPlansEditionReports = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var THIRD_PARTY_ID = 'edition-third-parties';
  var JOURNAL_ID = 'edition-journal-plan';
  var NATURES = Object.freeze([
    Object.freeze({ key: 'suppliers', label: 'Fournisseurs' }),
    Object.freeze({ key: 'clients', label: 'Clients' }),
    Object.freeze({ key: 'personnel', label: 'Personnel' }),
    Object.freeze({ key: 'otherParties', label: 'Tiers Divers' })
  ]);
  var THIRD_PARTY_COLUMNS = Object.freeze([
    Object.freeze({ key: 'code', label: 'Code du tiers', defaultSelected: true }),
    Object.freeze({ key: 'label', label: 'Intitulé', defaultSelected: true }),
    Object.freeze({ key: 'address', label: 'Adresse', defaultSelected: true }),
    Object.freeze({ key: 'otherInformation', label: 'Autres informations', defaultSelected: true })
  ]);
  var JOURNAL_COLUMNS = Object.freeze([
    Object.freeze({ key: 'code', label: 'Code', defaultSelected: true }),
    Object.freeze({ key: 'label', label: 'Intitulé', defaultSelected: true }),
    Object.freeze({ key: 'closure', label: 'Clôture', defaultSelected: true })
  ]);

  function selectedColumns(definitions, selection) {
    return definitions.filter(function (column) { return selection[column.key] !== false; });
  }

  function matchesFilter(code, expression) {
    var value = String(expression == null ? '*' : expression).trim().toLocaleUpperCase();
    if (!value) return false;
    if (value === '*') return true;
    return value.split(',').some(function (token) {
      token = token.trim();
      if (!token) return false;
      var escaped = token.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
      return new RegExp('^' + escaped + '$').test(String(code || '').toLocaleUpperCase());
    });
  }

  function informationParts(record, nature) {
    var parts = [];
    function add(label, value) {
      if (value !== undefined && value !== null && String(value).trim() !== '') parts.push(label + ' : ' + String(value).trim());
    }
    if (nature === 'suppliers' || nature === 'clients') {
      add('Contact', record.contactName);
      add('Téléphone', record.phone);
      add('E-mail', record.email);
      add('IFU', record.ifu);
      add('RCCM', record.rccm);
      add('Compte auxiliaire', record.auxiliaryAccountCode);
      add('Délai de paiement', record.paymentTermDays == null ? '' : record.paymentTermDays + ' jour(s)');
    } else if (nature === 'personnel') {
      add('Fonction', record.jobTitle);
      add('Service', record.department);
      add('Téléphone', record.phone);
      add('E-mail', record.email);
      add('Compte auxiliaire', record.accountCode);
    } else {
      add('Nature', record.type === 'creditor' ? 'Créditeur divers' : 'Débiteur divers');
      add('Contact', record.contactName);
      add('Téléphone', record.phone);
      add('E-mail', record.email);
      add('IFU', record.ifu);
      add('RCCM', record.rccm);
      add('Compte auxiliaire', record.auxiliaryAccountCode);
    }
    return parts.join(' · ');
  }

  function buildThirdPartiesReport(options) {
    options = options || {};
    var nature = NATURES.some(function (item) { return item.key === options.nature; }) ? options.nature : 'suppliers';
    var collections = options.collections || {};
    var records = Array.isArray(options.records) ? options.records : (Array.isArray(collections[nature]) ? collections[nature] : []);
    var filter = options.filter == null ? '*' : String(options.filter);
    var columns = selectedColumns(THIRD_PARTY_COLUMNS, options.columns || {});
    var rows = records.filter(function (record) { return record && matchesFilter(record.code, filter); }).map(function (record) {
      return {
        code: String(record.code == null ? '' : record.code),
        label: String(record.name == null ? '' : record.name),
        address: String(record.address == null ? '' : record.address),
        otherInformation: informationParts(record, nature)
      };
    });
    return {
      ok: true, reportId: THIRD_PARTY_ID, title: 'Liste des tiers', nature: nature,
      natureLabel: NATURES.find(function (item) { return item.key === nature; }).label,
      filter: filter, columns: columns, rows: rows,
      generatedLineCount: rows.length ? rows.length + 1 : 0,
      noAccountingMutation: true
    };
  }

  function buildJournalsReport(options) {
    options = options || {};
    var records = Array.isArray(options.records) ? options.records : [];
    var filter = options.filter == null ? '*' : String(options.filter);
    var columns = selectedColumns(JOURNAL_COLUMNS, options.columns || {});
    var rows = records.filter(function (record) { return record && !record.retired && matchesFilter(record.code, filter); }).map(function (record) {
      return {
        code: String(record.code == null ? '' : record.code),
        label: String(record.label == null ? '' : record.label),
        // La clôture est gérée au niveau des périodes, pas des journaux. Ne pas en déduire une.
        closure: typeof record.closed === 'boolean' ? (record.closed ? 'Clôturé' : 'Ouvert') : ''
      };
    });
    return {
      ok: true, reportId: JOURNAL_ID, title: 'Plan des journaux',
      filter: filter, columns: columns, rows: rows,
      generatedLineCount: rows.length ? rows.length + 1 : 0,
      noAccountingMutation: true,
      closureSourceAvailable: records.some(function (record) { return record && typeof record.closed === 'boolean'; })
    };
  }

  return Object.freeze({
    THIRD_PARTY_ID: THIRD_PARTY_ID,
    JOURNAL_ID: JOURNAL_ID,
    NATURES: NATURES,
    THIRD_PARTY_COLUMNS: THIRD_PARTY_COLUMNS,
    JOURNAL_COLUMNS: JOURNAL_COLUMNS,
    matchesFilter: matchesFilter,
    informationParts: informationParts,
    buildThirdPartiesReport: buildThirdPartiesReport,
    buildJournalsReport: buildJournalsReport
  });
});
