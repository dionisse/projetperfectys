/* =========================================================================
   PERFECTO · Formats communs d’échange comptable (v1)
   CSV UTF-8 à séparateur point-virgule et classeur OOXML .xlsx.
   Aucun envoi réseau : le fichier est lu et généré dans le navigateur.
   ========================================================================= */
(function (root) {
  'use strict';

  var FORMAT = 'PERFECTO-ECHANGE';
  var VERSION = '1';
  var BALANCE_FORMAT = 'PERFECTO-BALANCE';
  var BALANCE_VERSION = '1';
  var BALANCE_HEADERS = [
    'FORMAT', 'VERSION', 'SYSTEME_SOURCE', 'REFERENCE_DOSSIER', 'EXERCICE', 'DATE_BALANCE',
    'REFERENCE_BALANCE', 'CODE_COMPTE', 'LIBELLE_COMPTE', 'SOLDE_DEBITEUR_XOF',
    'SOLDE_CREDITEUR_XOF', 'ID_SOURCE'
  ];
  var BALANCE_TEXT_HEADERS = [
    'SYSTEME_SOURCE', 'REFERENCE_DOSSIER', 'DATE_BALANCE', 'REFERENCE_BALANCE',
    'CODE_COMPTE', 'LIBELLE_COMPTE', 'ID_SOURCE'
  ];
  var AUXILIARY_FORMAT = 'PERFECTO-AUXILIAIRE';
  var AUXILIARY_VERSION = '1';
  var AUXILIARY_HEADERS = [
    'FORMAT', 'VERSION', 'SYSTEME_SOURCE', 'REFERENCE_DOSSIER', 'EXERCICE', 'REFERENCE_LOT',
    'CODE_JOURNAL_SOURCE', 'DATE_SOURCE', 'REFERENCE_PIECE_SOURCE', 'LIBELLE_PIECE_SOURCE',
    'CODE_COMPTE_GENERAL', 'LIBELLE_COMPTE_GENERAL', 'CODE_AUXILIAIRE', 'LIBELLE_AUXILIAIRE',
    'LIBELLE_MOUVEMENT', 'DEBIT_XOF', 'CREDIT_XOF', 'ID_SOURCE'
  ];
  var AUXILIARY_TEXT_HEADERS = [
    'SYSTEME_SOURCE', 'REFERENCE_DOSSIER', 'REFERENCE_LOT', 'CODE_JOURNAL_SOURCE',
    'DATE_SOURCE', 'REFERENCE_PIECE_SOURCE', 'LIBELLE_PIECE_SOURCE', 'CODE_COMPTE_GENERAL',
    'LIBELLE_COMPTE_GENERAL', 'CODE_AUXILIAIRE', 'LIBELLE_AUXILIAIRE', 'LIBELLE_MOUVEMENT', 'ID_SOURCE'
  ];
  var AUXILIARY_REPORT_FORMAT = 'PERFECTO-AUXILIAIRE-INTERNE';
  var AUXILIARY_REPORT_VERSION = '1';
  var AUXILIARY_REPORT_HEADERS = [
    'FORMAT', 'VERSION', 'TYPE_LIGNE', 'REFERENCE_DOSSIER', 'EXERCICE',
    'DATE_ECRITURE', 'CODE_JOURNAL_ECRITURE', 'REFERENCE_ECRITURE', 'LIBELLE_ECRITURE',
    'DATE_SOURCE', 'CODE_JOURNAL_SOURCE', 'REFERENCE_PIECE_SOURCE', 'LIBELLE_SOURCE',
    'NUM_LIGNE_DANS_ECRITURE', 'NO_LIGNE_ORIGINALE', 'CODE_COMPTE_COLLECTIF',
    'LIBELLE_COMPTE_COLLECTIF', 'CODE_AUXILIAIRE', 'LIBELLE_AUXILIAIRE_SOURCE',
    'LIBELLE_MOUVEMENT_SOURCE', 'DEBIT_XOF', 'CREDIT_XOF', 'ID_ECRITURE_SOURCE',
    'ID_ECRITURE_ORIGINALE_LIEE', 'ID_SOURCE', 'SYSTEME_SOURCE', 'ID_FICHIER_SOURCE',
    'NB_MOUVEMENTS', 'NB_AUXILIAIRES'
  ];
  var AUXILIARY_REPORT_TEXT_HEADERS = [
    'FORMAT', 'VERSION', 'TYPE_LIGNE', 'REFERENCE_DOSSIER', 'DATE_ECRITURE',
    'CODE_JOURNAL_ECRITURE', 'REFERENCE_ECRITURE', 'LIBELLE_ECRITURE', 'DATE_SOURCE',
    'CODE_JOURNAL_SOURCE', 'REFERENCE_PIECE_SOURCE', 'LIBELLE_SOURCE', 'NO_LIGNE_ORIGINALE',
    'CODE_COMPTE_COLLECTIF', 'LIBELLE_COMPTE_COLLECTIF', 'CODE_AUXILIAIRE',
    'LIBELLE_AUXILIAIRE_SOURCE', 'LIBELLE_MOUVEMENT_SOURCE', 'ID_ECRITURE_SOURCE',
    'ID_ECRITURE_ORIGINALE_LIEE', 'ID_SOURCE', 'SYSTEME_SOURCE', 'ID_FICHIER_SOURCE'
  ];
  var HEADERS = [
    'FORMAT', 'VERSION', 'SYSTEME_SOURCE', 'REFERENCE_DOSSIER', 'EXERCICE',
    'CODE_JOURNAL', 'LIBELLE_JOURNAL', 'DATE', 'REFERENCE_PIECE', 'LIBELLE_PIECE',
    'CODE_COMPTE', 'LIBELLE_COMPTE', 'CLASSE_COMPTE', 'NATURE_COMPTE',
    'DEBIT_XOF', 'CREDIT_XOF', 'STATUT_SOURCE', 'ID_SOURCE'
  ];
  var TEXT_HEADERS = [
    'SYSTEME_SOURCE', 'REFERENCE_DOSSIER', 'CODE_JOURNAL', 'LIBELLE_JOURNAL',
    'DATE', 'REFERENCE_PIECE', 'LIBELLE_PIECE', 'CODE_COMPTE', 'LIBELLE_COMPTE',
    'NATURE_COMPTE', 'STATUT_SOURCE', 'ID_SOURCE'
  ];
  var MAX_DATA_ROWS = 20000;
  var MAX_TEXT_LENGTH = 10000;
  var MAX_WORKBOOK_BYTES = 5 * 1024 * 1024;
  var MAX_WORKBOOK_UNCOMPRESSED_BYTES = 20 * 1024 * 1024;

  function normalizeToken(value) {
    return String(value == null ? '' : value).trim().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').toUpperCase();
  }

  function protectSpreadsheetText(value) {
    var text = String(value == null ? '' : value);
    return /^[\t\r ]*[=+\-@]/.test(text) ? "'" + text : text;
  }

  function unprotectSpreadsheetText(value) {
    return String(value == null ? '' : value).replace(/^'(?=[\t\r ]*[=+\-@])/, '');
  }

  function csvCell(value, header) {
    var text = value == null ? '' : String(value);
    if (TEXT_HEADERS.indexOf(header) !== -1 || AUXILIARY_REPORT_TEXT_HEADERS.indexOf(header) !== -1) text = protectSpreadsheetText(text);
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function toDelimited(rows, headers, delimiter) {
    var separator = delimiter || ';';
    var lines = [headers.map(function (header) { return '"' + header.replace(/"/g, '""') + '"'; }).join(separator)];
    rows.forEach(function (row) {
      lines.push(headers.map(function (header) { return csvCell(row[header], header); }).join(separator));
    });
    return '\uFEFF' + lines.join('\r\n') + '\r\n';
  }

  function toCsv(rows, headers) {
    return toDelimited(rows, headers, ';');
  }

  function detectDelimiter(text) {
    var counts = { ';': 0, ',': 0, '\t': 0 };
    var quoted = false;
    var sampledLines = 0;
    for (var i = 0; i < text.length; i += 1) {
      var ch = text.charAt(i);
      if (ch === '"') {
        if (quoted && text.charAt(i + 1) === '"') { i += 1; continue; }
        quoted = !quoted;
      } else if (!quoted && (ch === '\r' || ch === '\n')) {
        sampledLines += 1;
        if (ch === '\r' && text.charAt(i + 1) === '\n') i += 1;
        if (sampledLines >= 10) break;
      } else if (!quoted && Object.prototype.hasOwnProperty.call(counts, ch)) {
        counts[ch] += 1;
      }
    }
    if (counts[';'] >= counts[','] && counts[';'] >= counts['\t'] && counts[';'] > 0) return ';';
    if (counts['\t'] > counts[','] && counts['\t'] > 0) return '\t';
    return ',';
  }

  function parseRows(text) {
    var source = String(text == null ? '' : text).replace(/^\uFEFF/, '');
    var delimiter = detectDelimiter(source);
    var rows = [];
    var row = [];
    var field = '';
    var quoted = false;
    var endedRow = false;

    for (var i = 0; i < source.length; i += 1) {
      var ch = source.charAt(i);
      if (quoted) {
        if (ch === '"' && source.charAt(i + 1) === '"') {
          field += '"';
          i += 1;
        } else if (ch === '"') {
          quoted = false;
        } else if (ch === '\r') {
          field += '\n';
          if (source.charAt(i + 1) === '\n') i += 1;
        } else {
          field += ch;
        }
        continue;
      }

      if (ch === '"') {
        if (field.length) return { ok: false, errors: ['Guillemet inattendu dans le fichier CSV.'] };
        quoted = true;
        endedRow = false;
      } else if (ch === delimiter) {
        row.push(field);
        field = '';
        endedRow = false;
      } else if (ch === '\r' || ch === '\n') {
        row.push(field);
        field = '';
        if (row.some(function (cell) { return String(cell).trim() !== ''; })) rows.push(row);
        row = [];
        if (ch === '\r' && source.charAt(i + 1) === '\n') i += 1;
        endedRow = true;
        if (rows.length > MAX_DATA_ROWS + 20) {
          return { ok: false, errors: ['Le fichier dépasse la limite de ' + MAX_DATA_ROWS + ' lignes.'] };
        }
      } else {
        field += ch;
        endedRow = false;
      }
    }

    if (quoted) return { ok: false, errors: ['Le fichier CSV contient un champ entre guillemets qui n’est pas refermé.'] };
    if (!endedRow || field.length || row.length) {
      row.push(field);
      if (row.some(function (cell) { return String(cell).trim() !== ''; })) rows.push(row);
    }
    if (rows.length > MAX_DATA_ROWS + 20) {
      return { ok: false, errors: ['Le fichier dépasse la limite de ' + MAX_DATA_ROWS + ' lignes.'] };
    }
    return { ok: true, rows: rows, delimiter: delimiter };
  }

  function parseAmount(value, rowNumber, fieldName, errors) {
    var raw = String(value == null ? '' : value).trim().replace(/[\u00a0\u202f ]/g, '');
    if (!raw) return 0;
    if (!/^\d+$/.test(raw)) {
      errors.push('Ligne ' + rowNumber + ' : ' + fieldName + ' doit être un montant XOF entier, sans séparateur de milliers ni décimales.');
      return 0;
    }
    var amount = Number(raw);
    if (!Number.isSafeInteger(amount)) {
      errors.push('Ligne ' + rowNumber + ' : ' + fieldName + ' dépasse la capacité numérique sûre.');
      return 0;
    }
    return amount;
  }

  function validIsoDate(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
    if (!match) return false;
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function parse(text) {
    var parsedRows = parseRows(text);
    if (!parsedRows.ok) return { ok: false, errors: parsedRows.errors, entries: [], metadata: null };
    var rows = parsedRows.rows;
    if (!rows.length) return { ok: false, errors: ['Le fichier est vide.'], entries: [], metadata: null };

    var headers = rows[0].map(function (header) { return String(header || '').trim().toUpperCase(); });
    var duplicateHeaders = headers.filter(function (header, index) { return headers.indexOf(header) !== index; });
    if (duplicateHeaders.length) {
      return { ok: false, errors: ['Le fichier contient des colonnes répétées : ' + duplicateHeaders.join(', ') + '.'], entries: [], metadata: null };
    }
    var missingHeaders = HEADERS.filter(function (header) { return headers.indexOf(header) === -1; });
    var extraHeaders = headers.filter(function (header) { return HEADERS.indexOf(header) === -1; });
    if (missingHeaders.length || extraHeaders.length) {
      var schemaMessage = 'Colonnes attendues : ' + HEADERS.join(' ; ') + '.';
      if (missingHeaders.length) schemaMessage += ' Manquantes : ' + missingHeaders.join(', ') + '.';
      if (extraHeaders.length) schemaMessage += ' Non reconnues : ' + extraHeaders.join(', ') + '.';
      return { ok: false, errors: [schemaMessage], entries: [], metadata: null };
    }

    var columnIndex = {};
    headers.forEach(function (header, index) { columnIndex[header] = index; });
    var errors = [];
    var grouped = {};
    var entryOrder = [];
    var metadata = null;

    rows.slice(1).forEach(function (cells, index) {
      var rowNumber = index + 2;
      if (cells.length > headers.length && cells.slice(headers.length).some(function (value) { return String(value).trim() !== ''; })) {
        errors.push('Ligne ' + rowNumber + ' : nombre de colonnes supérieur à l’en-tête.');
        return;
      }
      while (cells.length < headers.length) cells.push('');
      var record = {};
      HEADERS.forEach(function (header) {
        var value = String(cells[columnIndex[header]] == null ? '' : cells[columnIndex[header]]);
        record[header] = TEXT_HEADERS.indexOf(header) !== -1 ? unprotectSpreadsheetText(value).trim() : value.trim();
      });
      if (HEADERS.every(function (header) { return record[header] === ''; })) return;

      if (record.FORMAT !== FORMAT) errors.push('Ligne ' + rowNumber + ' : format attendu « ' + FORMAT + ' ».');
      if (record.VERSION !== VERSION) errors.push('Ligne ' + rowNumber + ' : version d’échange non prise en charge (attendu : ' + VERSION + ').');
      if (!record.SYSTEME_SOURCE || record.SYSTEME_SOURCE.length > 40) errors.push('Ligne ' + rowNumber + ' : système source obligatoire (40 caractères maximum).');
      if (!record.REFERENCE_DOSSIER || record.REFERENCE_DOSSIER.length > 100) errors.push('Ligne ' + rowNumber + ' : référence du dossier source obligatoire (100 caractères maximum).');
      if (!/^\d{4}$/.test(record.EXERCICE)) errors.push('Ligne ' + rowNumber + ' : exercice attendu sur quatre chiffres.');
      if (!record.CODE_JOURNAL) errors.push('Ligne ' + rowNumber + ' : code journal obligatoire.');
      if (!record.REFERENCE_PIECE) errors.push('Ligne ' + rowNumber + ' : référence de pièce obligatoire.');
      if (record.LIBELLE_PIECE.length > MAX_TEXT_LENGTH) errors.push('Ligne ' + rowNumber + ' : libellé de pièce trop long.');
      if (!record.CODE_COMPTE) errors.push('Ligne ' + rowNumber + ' : code compte obligatoire.');
      if (!validIsoDate(record.DATE)) errors.push('Ligne ' + rowNumber + ' : date invalide ; format attendu AAAA-MM-JJ.');

      var debit = parseAmount(record.DEBIT_XOF, rowNumber, 'DEBIT_XOF', errors);
      var credit = parseAmount(record.CREDIT_XOF, rowNumber, 'CREDIT_XOF', errors);
      if (debit === 0 && credit === 0 && record.CODE_COMPTE) errors.push('Ligne ' + rowNumber + ' : une ligne comptable doit avoir un débit ou un crédit positif.');
      if (debit > 0 && credit > 0) errors.push('Ligne ' + rowNumber + ' : débit et crédit ne peuvent pas être renseignés simultanément.');
      if (record.STATUT_SOURCE && ['VALIDEE', 'BROUILLON'].indexOf(normalizeToken(record.STATUT_SOURCE)) === -1) {
        errors.push('Ligne ' + rowNumber + ' : STATUT_SOURCE doit être « VALIDEE » ou « BROUILLON ».');
      }
      if (record.CODE_JOURNAL.length > 30 || record.CODE_COMPTE.length > 30 || record.REFERENCE_PIECE.length > 100) {
        errors.push('Ligne ' + rowNumber + ' : un code ou une référence dépasse la longueur autorisée.');
      }

      var rowMetadata = {
        format: record.FORMAT,
        version: record.VERSION,
        sourceSystem: record.SYSTEME_SOURCE,
        dossierReference: record.REFERENCE_DOSSIER,
        exercise: Number(record.EXERCICE)
      };
      if (!metadata) metadata = rowMetadata;
      else if (metadata.format !== rowMetadata.format || metadata.version !== rowMetadata.version ||
          metadata.sourceSystem !== rowMetadata.sourceSystem || metadata.dossierReference !== rowMetadata.dossierReference ||
          metadata.exercise !== rowMetadata.exercise) {
        errors.push('Ligne ' + rowNumber + ' : les métadonnées doivent être identiques dans tout le fichier.');
      }

      var normalizedStatus = normalizeToken(record.STATUT_SOURCE);
      var sourceStatus = normalizedStatus === 'VALIDEE' ? 'posted' : (normalizedStatus === 'BROUILLON' ? 'draft' : '');
      var key = JSON.stringify([record.CODE_JOURNAL, record.DATE, record.REFERENCE_PIECE]);
      var sourceId = record.ID_SOURCE || [record.SYSTEME_SOURCE, record.CODE_JOURNAL, record.DATE, record.REFERENCE_PIECE].join(':');
      var current = grouped[key];
      if (!current) {
        current = {
          reference: record.REFERENCE_PIECE,
          journal: record.CODE_JOURNAL,
          journalLabel: record.LIBELLE_JOURNAL,
          date: record.DATE,
          description: record.LIBELLE_PIECE,
          sourceSystem: record.SYSTEME_SOURCE,
          sourceId: sourceId,
          sourceStatus: sourceStatus,
          sourceRow: rowNumber,
          lines: []
        };
        grouped[key] = current;
        entryOrder.push(key);
      } else {
        if (current.description !== record.LIBELLE_PIECE) errors.push('Ligne ' + rowNumber + ' : le libellé diffère des autres lignes de la même pièce.');
        if (current.journalLabel !== record.LIBELLE_JOURNAL) errors.push('Ligne ' + rowNumber + ' : le libellé du journal diffère des autres lignes de la même pièce.');
        if (current.sourceId !== sourceId) errors.push('Ligne ' + rowNumber + ' : ID_SOURCE diffère des autres lignes de la même pièce.');
        if (current.sourceStatus !== sourceStatus) errors.push('Ligne ' + rowNumber + ' : STATUT_SOURCE diffère des autres lignes de la même pièce.');
      }
      current.lines.push({
        account: record.CODE_COMPTE,
        accountLabel: record.LIBELLE_COMPTE,
        accountClass: record.CLASSE_COMPTE,
        accountNature: record.NATURE_COMPTE,
        debit: debit,
        credit: credit,
        sourceRow: rowNumber
      });
    });

    var entries = entryOrder.map(function (key) { return grouped[key]; });
    if (!entries.length) errors.push('Le fichier ne contient aucune ligne comptable à importer.');
    return {
      ok: errors.length === 0,
      errors: errors,
      entries: entries,
      metadata: metadata,
      lineCount: entries.reduce(function (total, entry) { return total + entry.lines.length; }, 0),
      delimiter: parsedRows.delimiter
    };
  }

  function parseBalance(text) {
    var parsedRows = parseRows(text);
    if (!parsedRows.ok) return { ok: false, errors: parsedRows.errors, rows: [], metadata: null, totalDebit: 0, totalCredit: 0 };
    var rows = parsedRows.rows;
    if (!rows.length) return { ok: false, errors: ['Le fichier de balance est vide.'], rows: [], metadata: null, totalDebit: 0, totalCredit: 0 };

    var headers = rows[0].map(function (header) { return String(header || '').trim().toUpperCase(); });
    var duplicateHeaders = headers.filter(function (header, index) { return headers.indexOf(header) !== index; });
    if (duplicateHeaders.length) {
      return { ok: false, errors: ['Le fichier de balance contient des colonnes répétées : ' + duplicateHeaders.join(', ') + '.'], rows: [], metadata: null, totalDebit: 0, totalCredit: 0 };
    }
    var missingHeaders = BALANCE_HEADERS.filter(function (header) { return headers.indexOf(header) === -1; });
    var extraHeaders = headers.filter(function (header) { return BALANCE_HEADERS.indexOf(header) === -1; });
    if (missingHeaders.length || extraHeaders.length) {
      var schemaMessage = 'Colonnes attendues pour une balance nette : ' + BALANCE_HEADERS.join(' ; ') + '.';
      if (missingHeaders.length) schemaMessage += ' Manquantes : ' + missingHeaders.join(', ') + '.';
      if (extraHeaders.length) schemaMessage += ' Non reconnues : ' + extraHeaders.join(', ') + '.';
      return { ok: false, errors: [schemaMessage], rows: [], metadata: null, totalDebit: 0, totalCredit: 0 };
    }

    var columnIndex = {};
    headers.forEach(function (header, index) { columnIndex[header] = index; });
    var errors = [];
    var parsedAccounts = [];
    var seenAccounts = Object.create(null);
    var metadata = null;
    var totalDebit = 0;
    var totalCredit = 0;

    rows.slice(1).forEach(function (cells, index) {
      var rowNumber = index + 2;
      if (cells.length > headers.length && cells.slice(headers.length).some(function (value) { return String(value).trim() !== ''; })) {
        errors.push('Ligne ' + rowNumber + ' : nombre de colonnes supérieur à l’en-tête de balance.');
        return;
      }
      while (cells.length < headers.length) cells.push('');
      var record = {};
      BALANCE_HEADERS.forEach(function (header) {
        var value = String(cells[columnIndex[header]] == null ? '' : cells[columnIndex[header]]).trim();
        record[header] = BALANCE_TEXT_HEADERS.indexOf(header) !== -1 ? unprotectSpreadsheetText(value).trim() : value;
      });
      if (BALANCE_HEADERS.every(function (header) { return record[header] === ''; })) return;

      if (record.FORMAT !== BALANCE_FORMAT) errors.push('Ligne ' + rowNumber + ' : format attendu « ' + BALANCE_FORMAT + ' ».');
      if (record.VERSION !== BALANCE_VERSION) errors.push('Ligne ' + rowNumber + ' : version de balance non prise en charge (attendu : ' + BALANCE_VERSION + ').');
      if (!record.SYSTEME_SOURCE || record.SYSTEME_SOURCE.length > 40) errors.push('Ligne ' + rowNumber + ' : système source obligatoire (40 caractères maximum).');
      if (!record.REFERENCE_DOSSIER || record.REFERENCE_DOSSIER.length > 100) errors.push('Ligne ' + rowNumber + ' : référence du dossier source obligatoire (100 caractères maximum).');
      if (!/^\d{4}$/.test(record.EXERCICE)) errors.push('Ligne ' + rowNumber + ' : exercice source attendu sur quatre chiffres.');
      if (!validIsoDate(record.DATE_BALANCE)) errors.push('Ligne ' + rowNumber + ' : date de balance invalide ; format attendu AAAA-MM-JJ.');
      if (!record.REFERENCE_BALANCE || record.REFERENCE_BALANCE.length > 100) errors.push('Ligne ' + rowNumber + ' : référence de balance obligatoire (100 caractères maximum).');
      if (!record.CODE_COMPTE || record.CODE_COMPTE.length > 30) errors.push('Ligne ' + rowNumber + ' : code compte obligatoire (30 caractères maximum).');
      if (record.LIBELLE_COMPTE.length > MAX_TEXT_LENGTH) errors.push('Ligne ' + rowNumber + ' : libellé de compte trop long.');
      if (record.ID_SOURCE.length > 100) errors.push('Ligne ' + rowNumber + ' : ID_SOURCE ne peut pas dépasser 100 caractères.');

      var debit = parseAmount(record.SOLDE_DEBITEUR_XOF, rowNumber, 'SOLDE_DEBITEUR_XOF', errors);
      var credit = parseAmount(record.SOLDE_CREDITEUR_XOF, rowNumber, 'SOLDE_CREDITEUR_XOF', errors);
      if (debit === 0 && credit === 0 && record.CODE_COMPTE) errors.push('Ligne ' + rowNumber + ' : le solde net doit être débiteur ou créditeur ; les soldes nuls sont à omettre.');
      if (debit > 0 && credit > 0) errors.push('Ligne ' + rowNumber + ' : un solde net ne peut pas être débiteur et créditeur simultanément.');

      var accountKey = normalizeToken(record.CODE_COMPTE).replace(/\s+/g, '');
      if (record.CODE_COMPTE && seenAccounts[accountKey]) errors.push('Ligne ' + rowNumber + ' : compte source « ' + record.CODE_COMPTE + ' » répété dans la balance.');
      else if (record.CODE_COMPTE) seenAccounts[accountKey] = true;

      var rowMetadata = {
        format: record.FORMAT,
        version: record.VERSION,
        sourceSystem: record.SYSTEME_SOURCE,
        dossierReference: record.REFERENCE_DOSSIER,
        exercise: Number(record.EXERCICE),
        balanceDate: record.DATE_BALANCE,
        balanceReference: record.REFERENCE_BALANCE,
        sourceId: record.ID_SOURCE
      };
      if (!metadata) metadata = rowMetadata;
      else {
        if (metadata.format !== rowMetadata.format || metadata.version !== rowMetadata.version ||
            metadata.sourceSystem !== rowMetadata.sourceSystem || metadata.dossierReference !== rowMetadata.dossierReference ||
            metadata.exercise !== rowMetadata.exercise || metadata.balanceDate !== rowMetadata.balanceDate ||
            metadata.balanceReference !== rowMetadata.balanceReference) {
          errors.push('Ligne ' + rowNumber + ' : les métadonnées de balance doivent être identiques dans tout le fichier.');
        }
        if (metadata.sourceId !== rowMetadata.sourceId) {
          errors.push('Ligne ' + rowNumber + ' : ID_SOURCE doit être identique sur toutes les lignes ou rester vide partout.');
          if (!metadata.sourceId && rowMetadata.sourceId) metadata.sourceId = rowMetadata.sourceId;
        }
      }

      totalDebit += debit;
      totalCredit += credit;
      if (!Number.isSafeInteger(totalDebit) || !Number.isSafeInteger(totalCredit)) errors.push('Ligne ' + rowNumber + ' : le total de la balance dépasse la capacité numérique sûre.');
      parsedAccounts.push({
        account: record.CODE_COMPTE,
        accountLabel: record.LIBELLE_COMPTE,
        debit: debit,
        credit: credit,
        sourceRow: rowNumber
      });
    });

    if (!parsedAccounts.length) errors.push('Le fichier ne contient aucun solde de compte à importer.');
    if (parsedAccounts.length && totalDebit !== totalCredit) {
      errors.push('Balance déséquilibrée : total débiteur ' + totalDebit + ' XOF, total créditeur ' + totalCredit + ' XOF. Aucun import ne sera effectué.');
    }
    return {
      ok: errors.length === 0,
      errors: errors,
      rows: parsedAccounts,
      metadata: metadata,
      lineCount: parsedAccounts.length,
      totalDebit: totalDebit,
      totalCredit: totalCredit,
      delimiter: parsedRows.delimiter
    };
  }

  function templateBalance() {
    return toCsv([], BALANCE_HEADERS);
  }

  function parseAuxiliary(text) {
    var parsedRows = parseRows(text);
    if (!parsedRows.ok) return { ok: false, errors: parsedRows.errors, rows: [], metadata: null, documentCount: 0, totalDebit: 0, totalCredit: 0 };
    var rows = parsedRows.rows;
    if (!rows.length) return { ok: false, errors: ['Le fichier auxiliaire est vide.'], rows: [], metadata: null, documentCount: 0, totalDebit: 0, totalCredit: 0 };

    var headers = rows[0].map(function (header) { return String(header || '').trim().toUpperCase(); });
    var duplicateHeaders = headers.filter(function (header, index) { return headers.indexOf(header) !== index; });
    if (duplicateHeaders.length) {
      return { ok: false, errors: ['Le fichier auxiliaire contient des colonnes répétées : ' + duplicateHeaders.join(', ') + '.'], rows: [], metadata: null, documentCount: 0, totalDebit: 0, totalCredit: 0 };
    }
    var missingHeaders = AUXILIARY_HEADERS.filter(function (header) { return headers.indexOf(header) === -1; });
    var extraHeaders = headers.filter(function (header) { return AUXILIARY_HEADERS.indexOf(header) === -1; });
    if (missingHeaders.length || extraHeaders.length) {
      var schemaMessage = 'Colonnes attendues pour les mouvements auxiliaires : ' + AUXILIARY_HEADERS.join(' ; ') + '.';
      if (missingHeaders.length) schemaMessage += ' Manquantes : ' + missingHeaders.join(', ') + '.';
      if (extraHeaders.length) schemaMessage += ' Non reconnues : ' + extraHeaders.join(', ') + '.';
      return { ok: false, errors: [schemaMessage], rows: [], metadata: null, documentCount: 0, totalDebit: 0, totalCredit: 0 };
    }

    var columnIndex = Object.create(null);
    headers.forEach(function (header, index) { columnIndex[header] = index; });
    var errors = [];
    var parsedMovements = [];
    var metadata = null;
    var documents = Object.create(null);
    var documentKeys = [];
    var seenSourceIds = Object.create(null);
    var totalDebit = 0;
    var totalCredit = 0;
    var auxiliaryMovementCount = 0;

    rows.slice(1).forEach(function (cells, index) {
      var rowNumber = index + 2;
      if (cells.length > headers.length && cells.slice(headers.length).some(function (value) { return String(value).trim() !== ''; })) {
        errors.push('Ligne ' + rowNumber + ' : nombre de colonnes supérieur à l’en-tête auxiliaire.');
        return;
      }
      while (cells.length < headers.length) cells.push('');
      var record = Object.create(null);
      AUXILIARY_HEADERS.forEach(function (header) {
        var value = String(cells[columnIndex[header]] == null ? '' : cells[columnIndex[header]]).trim();
        record[header] = AUXILIARY_TEXT_HEADERS.indexOf(header) !== -1 ? unprotectSpreadsheetText(value).trim() : value;
      });
      if (AUXILIARY_HEADERS.every(function (header) { return record[header] === ''; })) return;

      if (record.FORMAT !== AUXILIARY_FORMAT) errors.push('Ligne ' + rowNumber + ' : format attendu « ' + AUXILIARY_FORMAT + ' ».');
      if (record.VERSION !== AUXILIARY_VERSION) errors.push('Ligne ' + rowNumber + ' : version auxiliaire non prise en charge (attendu : ' + AUXILIARY_VERSION + ').');
      if (!record.SYSTEME_SOURCE || record.SYSTEME_SOURCE.length > 40) errors.push('Ligne ' + rowNumber + ' : système source obligatoire (40 caractères maximum).');
      if (!record.REFERENCE_DOSSIER || record.REFERENCE_DOSSIER.length > 100) errors.push('Ligne ' + rowNumber + ' : référence du dossier source obligatoire (100 caractères maximum).');
      if (!/^\d{4}$/.test(record.EXERCICE)) errors.push('Ligne ' + rowNumber + ' : exercice source attendu sur quatre chiffres.');
      if (!record.REFERENCE_LOT || record.REFERENCE_LOT.length > 100) errors.push('Ligne ' + rowNumber + ' : référence de lot obligatoire (100 caractères maximum).');
      if (!record.CODE_JOURNAL_SOURCE || record.CODE_JOURNAL_SOURCE.length > 30) errors.push('Ligne ' + rowNumber + ' : code du journal source obligatoire (30 caractères maximum).');
      if (!validIsoDate(record.DATE_SOURCE)) errors.push('Ligne ' + rowNumber + ' : date source invalide ; format attendu AAAA-MM-JJ.');
      if (!record.REFERENCE_PIECE_SOURCE || record.REFERENCE_PIECE_SOURCE.length > 100) errors.push('Ligne ' + rowNumber + ' : référence de pièce source obligatoire (100 caractères maximum).');
      if (record.LIBELLE_PIECE_SOURCE.length > MAX_TEXT_LENGTH) errors.push('Ligne ' + rowNumber + ' : libellé de pièce source trop long.');
      if (!record.CODE_COMPTE_GENERAL || record.CODE_COMPTE_GENERAL.length > 30) errors.push('Ligne ' + rowNumber + ' : code de compte général obligatoire (30 caractères maximum).');
      if (!record.LIBELLE_COMPTE_GENERAL) errors.push('Ligne ' + rowNumber + ' : libellé de compte général obligatoire.');
      if (record.LIBELLE_COMPTE_GENERAL.length > MAX_TEXT_LENGTH) errors.push('Ligne ' + rowNumber + ' : libellé de compte général trop long.');
      if (record.CODE_AUXILIAIRE.length > 100 || record.LIBELLE_AUXILIAIRE.length > MAX_TEXT_LENGTH) errors.push('Ligne ' + rowNumber + ' : code ou libellé auxiliaire trop long.');
      if (!!record.CODE_AUXILIAIRE !== !!record.LIBELLE_AUXILIAIRE) errors.push('Ligne ' + rowNumber + ' : renseignez ensemble le code et le libellé auxiliaires, ou laissez les deux vides.');
      if (record.LIBELLE_MOUVEMENT.length > MAX_TEXT_LENGTH) errors.push('Ligne ' + rowNumber + ' : libellé de mouvement trop long.');
      if (!record.ID_SOURCE || record.ID_SOURCE.length > 100) errors.push('Ligne ' + rowNumber + ' : ID_SOURCE obligatoire (100 caractères maximum).');

      var debit = parseAmount(record.DEBIT_XOF, rowNumber, 'DEBIT_XOF', errors);
      var credit = parseAmount(record.CREDIT_XOF, rowNumber, 'CREDIT_XOF', errors);
      if (debit === 0 && credit === 0 && record.CODE_COMPTE_GENERAL) errors.push('Ligne ' + rowNumber + ' : un mouvement doit avoir un débit ou un crédit positif.');
      if (debit > 0 && credit > 0) errors.push('Ligne ' + rowNumber + ' : débit et crédit ne peuvent pas être renseignés simultanément.');

      var metadataRow = {
        format: record.FORMAT,
        version: record.VERSION,
        sourceSystem: record.SYSTEME_SOURCE,
        dossierReference: record.REFERENCE_DOSSIER,
        exercise: Number(record.EXERCICE),
        batchReference: record.REFERENCE_LOT
      };
      if (!metadata) metadata = metadataRow;
      else if (metadata.format !== metadataRow.format || metadata.version !== metadataRow.version ||
          metadata.sourceSystem !== metadataRow.sourceSystem || metadata.dossierReference !== metadataRow.dossierReference ||
          metadata.exercise !== metadataRow.exercise || metadata.batchReference !== metadataRow.batchReference) {
        errors.push('Ligne ' + rowNumber + ' : les métadonnées du lot doivent être identiques dans tout le fichier.');
      }

      if (record.ID_SOURCE && seenSourceIds[record.ID_SOURCE]) errors.push('Ligne ' + rowNumber + ' : ID_SOURCE « ' + record.ID_SOURCE + ' » est répété dans le lot.');
      else if (record.ID_SOURCE) seenSourceIds[record.ID_SOURCE] = true;
      if (record.CODE_AUXILIAIRE) auxiliaryMovementCount += 1;

      var documentKey = JSON.stringify([record.CODE_JOURNAL_SOURCE, record.DATE_SOURCE, record.REFERENCE_PIECE_SOURCE]);
      var document = documents[documentKey];
      if (!document) {
        document = {
          sourceJournal: record.CODE_JOURNAL_SOURCE,
          sourceDate: record.DATE_SOURCE,
          sourceReference: record.REFERENCE_PIECE_SOURCE,
          description: record.LIBELLE_PIECE_SOURCE,
          debit: 0,
          credit: 0,
          lineCount: 0
        };
        documents[documentKey] = document;
        documentKeys.push(documentKey);
      } else if (document.description !== record.LIBELLE_PIECE_SOURCE) {
        errors.push('Ligne ' + rowNumber + ' : le libellé diffère des autres lignes de la même pièce source.');
      }
      document.debit += debit;
      document.credit += credit;
      document.lineCount += 1;
      totalDebit += debit;
      totalCredit += credit;
      if (!Number.isSafeInteger(document.debit) || !Number.isSafeInteger(document.credit) ||
          !Number.isSafeInteger(totalDebit) || !Number.isSafeInteger(totalCredit)) {
        errors.push('Ligne ' + rowNumber + ' : les totaux du lot dépassent la capacité numérique sûre.');
      }
      parsedMovements.push({
        sourceJournal: record.CODE_JOURNAL_SOURCE,
        sourceDate: record.DATE_SOURCE,
        sourceReference: record.REFERENCE_PIECE_SOURCE,
        sourceDescription: record.LIBELLE_PIECE_SOURCE,
        account: record.CODE_COMPTE_GENERAL,
        accountLabel: record.LIBELLE_COMPTE_GENERAL,
        auxiliaryCode: record.CODE_AUXILIAIRE,
        auxiliaryLabel: record.LIBELLE_AUXILIAIRE,
        description: record.LIBELLE_MOUVEMENT,
        debit: debit,
        credit: credit,
        sourceId: record.ID_SOURCE,
        sourceRow: rowNumber,
        documentKey: documentKey
      });
    });

    if (!parsedMovements.length) errors.push('Le fichier ne contient aucun mouvement auxiliaire à centraliser.');
    if (parsedMovements.length && auxiliaryMovementCount === 0) errors.push('Aucun mouvement ne comporte de code auxiliaire ; vérifiez qu’il s’agit bien d’un lot de comptabilité auxiliaire.');
    documentKeys.forEach(function (key) {
      var document = documents[key];
      if (document.lineCount < 2) errors.push('Pièce source « ' + document.sourceReference + ' » : au moins deux lignes mouvementées sont requises.');
      if (document.lineCount && document.debit !== document.credit) {
        errors.push('Pièce source « ' + document.sourceReference + ' » non équilibrée : débit ' + document.debit + ' XOF, crédit ' + document.credit + ' XOF.');
      }
    });
    if (parsedMovements.length && totalDebit !== totalCredit) errors.push('Le lot auxiliaire n’est pas équilibré : débit ' + totalDebit + ' XOF, crédit ' + totalCredit + ' XOF.');
    return {
      ok: errors.length === 0,
      errors: errors,
      rows: parsedMovements,
      metadata: metadata,
      documentCount: documentKeys.length,
      auxiliaryMovementCount: auxiliaryMovementCount,
      totalDebit: totalDebit,
      totalCredit: totalCredit,
      documents: documentKeys.map(function (key) { return documents[key]; }),
      delimiter: parsedRows.delimiter
    };
  }

  function templateAuxiliary() {
    return toCsv([], AUXILIARY_HEADERS);
  }

  function buildEntryRows(data, entries) {
    var dossier = data.dossier || {};
    var accountMap = {};
    var journalMap = {};
    (data.accounts || []).forEach(function (account) { accountMap[account.code] = account; });
    (data.journals || []).forEach(function (journal) { journalMap[journal.code] = journal; });
    var posted = (entries || []).filter(function (entry) { return entry.status === 'posted'; })
      .filter(function (entry) { return entry.date >= dossier.cycleStart && entry.date <= dossier.cycleEnd; })
      .slice().sort(function (a, b) {
        return String(a.date).localeCompare(String(b.date)) || String(a.journal).localeCompare(String(b.journal)) || String(a.reference).localeCompare(String(b.reference));
      });
    var rows = [];
    var seenReferences = Object.create(null);
    posted.forEach(function (entry) {
      if (!entry.reference || seenReferences[entry.reference]) throw new Error('Export bloqué : référence absente ou répétée « ' + String(entry.reference || '') + ' ».');
      seenReferences[entry.reference] = true;
      if (!validIsoDate(entry.date)) throw new Error('Export bloqué : date invalide pour la pièce « ' + String(entry.reference) + ' ».');
      var journal = journalMap[entry.journal];
      if (!journal) throw new Error('Export bloqué : journal inconnu pour la pièce « ' + String(entry.reference || '') + ' ».');
      if (!Array.isArray(entry.lines) || entry.lines.length < 2) throw new Error('Export bloqué : la pièce « ' + String(entry.reference || '') + ' » ne comporte pas au moins deux lignes.');
      var debitTotal = 0;
      var creditTotal = 0;
      entry.lines.forEach(function (line) {
        var debit = Number(line.debit);
        var credit = Number(line.credit);
        if (!Number.isSafeInteger(debit) || !Number.isSafeInteger(credit) || debit < 0 || credit < 0 || (debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
          throw new Error('Export bloqué : montant ou ligne invalide dans la pièce « ' + String(entry.reference || '') + ' ». Les montants XOF doivent être des entiers positifs, avec un seul côté renseigné.');
        }
        if (!accountMap[line.account]) throw new Error('Export bloqué : compte « ' + String(line.account || '') + ' » absent du plan comptable pour la pièce « ' + String(entry.reference || '') + ' ».');
        debitTotal += debit;
        creditTotal += credit;
      });
      if (debitTotal !== creditTotal || debitTotal <= 0) throw new Error('Export bloqué : la pièce « ' + String(entry.reference || '') + ' » n’est pas équilibrée.');
      var sourceId = entry.sourceId || entry.id || [entry.journal, entry.date, entry.reference].join(':');
      entry.lines.forEach(function (line) {
        var account = accountMap[line.account] || {};
        rows.push({
          FORMAT: FORMAT,
          VERSION: VERSION,
          SYSTEME_SOURCE: 'PERFECTO',
          REFERENCE_DOSSIER: dossier.reference || '',
          EXERCICE: dossier.exerciseYear || '',
          CODE_JOURNAL: entry.journal,
          LIBELLE_JOURNAL: journal.label || entry.journal,
          DATE: entry.date,
          REFERENCE_PIECE: entry.reference,
          LIBELLE_PIECE: entry.description || '',
          CODE_COMPTE: line.account,
          LIBELLE_COMPTE: account.label || line.account,
          CLASSE_COMPTE: account.cls || String(line.account).charAt(0),
          NATURE_COMPTE: account.nature || '',
          DEBIT_XOF: Number(line.debit) || 0,
          CREDIT_XOF: Number(line.credit) || 0,
          STATUT_SOURCE: entry.status === 'posted' ? 'VALIDEE' : 'BROUILLON',
          ID_SOURCE: sourceId
        });
      });
    });
    return rows;
  }

  function exportEntries(data, entries) {
    return toCsv(buildEntryRows(data || {}, entries || []), HEADERS);
  }

  function template() {
    return toCsv([], HEADERS);
  }

  function exportAccounts(accounts) {
    var headers = ['CODE_COMPTE', 'LIBELLE_COMPTE', 'CLASSE_COMPTE', 'SOUS_CLASSE', 'LIBELLE_SOUS_CLASSE', 'NATURE_COMPTE', 'UTILISATION', 'AUXILIAIRE', 'IMPUTABLE', 'ACTIF', 'COMPTE_HISTORIQUE'];
    var rows = (accounts || []).slice().sort(function (a, b) { return String(a.code).localeCompare(String(b.code)); }).map(function (account) {
      return {
        CODE_COMPTE: account.code,
        LIBELLE_COMPTE: account.label,
        CLASSE_COMPTE: account.cls,
        SOUS_CLASSE: account.subclass || String(account.code).slice(0, 2),
        LIBELLE_SOUS_CLASSE: account.subclassLabel || '',
        NATURE_COMPTE: account.nature,
        UTILISATION: account.usage || '',
        AUXILIAIRE: account.aux ? 'OUI' : 'NON',
        IMPUTABLE: account.postable === false ? 'NON' : 'OUI',
        ACTIF: account.active === false ? 'NON' : 'OUI',
        COMPTE_HISTORIQUE: account.legacy ? 'OUI' : 'NON'
      };
    });
    return toCsv(rows, headers);
  }

  function exportJournals(journals) {
    var headers = ['CODE_JOURNAL', 'LIBELLE_JOURNAL', 'TYPE'];
    var rows = (journals || []).map(function (journal) {
      return { CODE_JOURNAL: journal.code, LIBELLE_JOURNAL: journal.label, TYPE: journal.type || '' };
    });
    return toCsv(rows, headers);
  }

  /* ----------------------------- Classeur .xlsx --------------------------- */
  function xmlEscape(value) {
    return String(value == null ? '' : value)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  function bytesFromText(text) {
    return new root.TextEncoder().encode(String(text));
  }

  function excelColumnName(index) {
    var name = '';
    var number = index + 1;
    while (number > 0) {
      var remainder = (number - 1) % 26;
      name = String.fromCharCode(65 + remainder) + name;
      number = Math.floor((number - 1) / 26);
    }
    return name;
  }

  function workbookCell(value, reference, header) {
    if (value === null || value === undefined || value === '') return '';
    var style = header ? ' s="1"' : '';
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error('Valeur numérique invalide dans le classeur Excel.');
      return '<c r="' + reference + '"' + style + '><v>' + String(value) + '</v></c>';
    }
    return '<c r="' + reference + '" t="inlineStr"' + style + '><is><t xml:space="preserve">' + xmlEscape(value) + '</t></is></c>';
  }

  function worksheetXml(rows, autoFilter) {
    var matrix = rows && rows.length ? rows : [['']];
    var maxColumns = matrix.reduce(function (max, row) { return Math.max(max, row.length); }, 1);
    var lastCell = excelColumnName(maxColumns - 1) + matrix.length;
    var sheetRows = matrix.map(function (row, rowIndex) {
      var cells = [];
      for (var column = 0; column < row.length; column += 1) {
        var cell = workbookCell(row[column], excelColumnName(column) + (rowIndex + 1), rowIndex === 0);
        if (cell) cells.push(cell);
      }
      return '<row r="' + (rowIndex + 1) + '">' + cells.join('') + '</row>';
    }).join('');
    var filter = autoFilter ? '<autoFilter ref="A1:' + lastCell + '"/>' : '';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<dimension ref="A1:' + lastCell + '"/><sheetViews><sheetView workbookViewId="0"/></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="16"/><sheetData>' + sheetRows + '</sheetData>' + filter + '</worksheet>';
  }

  function workbookStyleXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="2"><font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font></fonts>' +
      '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FF27645A"/><bgColor indexed="64"/></patternFill></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  }

  function workbookFiles(sheetDefs) {
    var sheetXml = sheetDefs.map(function (sheet, index) {
      return '<sheet name="' + xmlEscape(sheet.name) + '" sheetId="' + (index + 1) + '" r:id="rId' + (index + 1) + '"/>';
    }).join('');
    var sheetRels = sheetDefs.map(function (sheet, index) {
      return '<Relationship Id="rId' + (index + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (index + 1) + '.xml"/>';
    }).join('');
    var overrides = sheetDefs.map(function (sheet, index) {
      return '<Override PartName="/xl/worksheets/sheet' + (index + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
    }).join('');
    var files = {
      '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + overrides + '</Types>',
      '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<bookViews><workbookView/></bookViews><sheets>' + sheetXml + '</sheets></workbook>',
      'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheetRels +
        '<Relationship Id="rId' + (sheetDefs.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
      'xl/styles.xml': workbookStyleXml()
    };
    sheetDefs.forEach(function (sheet, index) {
      files['xl/worksheets/sheet' + (index + 1) + '.xml'] = worksheetXml(sheet.rows, sheet.autoFilter);
    });
    var totalBytes = 0;
    Object.keys(files).forEach(function (name) {
      files[name] = bytesFromText(files[name]);
      totalBytes += files[name].length;
    });
    if (totalBytes > MAX_WORKBOOK_UNCOMPRESSED_BYTES) throw new Error('Le classeur Excel dépasserait la limite décompressée de 20 Mo. Réduisez le volume ou exportez par période.');
    return files;
  }

  function workbookSheetDefinitions(data, entries, includeEntries) {
    var dossier = data && data.dossier || {};
    var accounts = data && data.accounts || [];
    var journals = data && data.journals || [];
    var entryRows = includeEntries ? buildEntryRows(data || {}, entries || []) : [];
    var instructionRows = [
      ['PERFECTO-ÉCHANGE', 'Version ' + VERSION],
      ['Utilisation', 'Import/export comptable général ; une ligne dans Écritures = une ligne de mouvement.'],
      ['Feuille à importer', 'Écritures'],
      ['Date', 'Format AAAA-MM-JJ ; conserver ce format texte lors de la saisie.'],
      ['Montants', 'XOF entiers, sans séparateurs de milliers ni décimales.'],
      ['Codes', 'Codes de compte et de journal à conserver au format texte ; préserver les zéros initiaux.'],
      ['Pièce', 'Les lignes d’une même pièce partagent journal, date, référence, libellé et ID_SOURCE.'],
      ['Import', 'Les comptes et journaux doivent être associés au dossier cible ; aucun référentiel n’est créé automatiquement.'],
      ['Sécurité', 'Classeur sans macros ; l’import n’exécute pas les formules Excel.'],
      ['Statut', 'Le statut de source est informatif ; le mode choisi dans PERFECTO décide brouillon/validée.']
    ];
    var dossierRows = [
      ['REFERENCE_DOSSIER', 'NOM_DOSSIER', 'EXERCICE', 'DEBUT_CYCLE', 'FIN_CYCLE', 'DEVISE'],
      [dossier.reference || '', dossier.name || dossier.clientName || '', dossier.exerciseYear || '', dossier.cycleStart || '', dossier.cycleEnd || '', 'XOF']
    ];
    var accountHeaders = ['CODE_COMPTE', 'LIBELLE_COMPTE', 'CLASSE_COMPTE', 'NATURE_COMPTE', 'AUXILIAIRE', 'ACTIF'];
    var accountRows = [accountHeaders].concat((accounts || []).slice().sort(function (a, b) { return String(a.code).localeCompare(String(b.code)); }).map(function (account) {
      return [account.code, account.label, account.cls, account.nature, account.aux ? 'OUI' : 'NON', account.active === false ? 'NON' : 'OUI'];
    }));
    var journalHeaders = ['CODE_JOURNAL', 'LIBELLE_JOURNAL', 'TYPE'];
    var journalRows = [journalHeaders].concat((journals || []).map(function (journal) { return [journal.code, journal.label, journal.type || '']; }));
    var entriesRows = [HEADERS].concat(entryRows.map(function (row) { return HEADERS.map(function (header) { return row[header]; }); }));
    return [
      { name: 'Instructions', rows: instructionRows, autoFilter: false },
      { name: 'Dossier', rows: dossierRows, autoFilter: true },
      { name: 'Comptes', rows: accountRows, autoFilter: true },
      { name: 'Journaux', rows: journalRows, autoFilter: true },
      { name: 'Ecritures', rows: entriesRows, autoFilter: true }
    ];
  }

  function compressWorkbook(sheetDefinitions) {
    if (!root.fflate || typeof root.fflate.zipSync !== 'function') throw new Error('Le module local de création Excel n’est pas disponible.');
    var bytes = root.fflate.zipSync(workbookFiles(sheetDefinitions), { level: 6 });
    if (bytes.length > MAX_WORKBOOK_BYTES) throw new Error('Le classeur Excel dépasserait la limite de 5 Mo. Réduisez le volume ou exportez par période.');
    return bytes;
  }

  function exportWorkbook(data, entries) {
    return compressWorkbook(workbookSheetDefinitions(data || {}, entries || [], true));
  }

  function templateWorkbook(data) {
    return compressWorkbook(workbookSheetDefinitions(data || {}, [], false));
  }

  function balanceWorkbookSheetDefinitions(data) {
    var dossier = data && data.dossier || {};
    var accounts = data && data.accounts || [];
    var instructions = [
      ['PERFECTO-BALANCE', 'Version ' + BALANCE_VERSION],
      ['Feuille à importer', 'Balance'],
      ['Dossier', 'Feuille de repère du dossier PERFECTO cible ; renseigner les métadonnées de la source dans la feuille Balance.'],
      ['Périmètre', 'Soldes nets par compte uniquement ; ne pas saisir les mouvements de la période.'],
      ['Compte', 'Une seule ligne par compte source ; associer les codes au plan du dossier cible dans PERFECTO.'],
      ['Soldes', 'Renseigner un solde débiteur OU créditeur en XOF entiers. Omettre les soldes nuls.'],
      ['Contrôle', 'Le total débiteur doit être égal au total créditeur ; sinon la reprise est refusée.'],
      ['Métadonnées', 'Répéter FORMAT, VERSION, SYSTEME_SOURCE, REFERENCE_DOSSIER, EXERCICE, DATE_BALANCE et REFERENCE_BALANCE sur chaque ligne.'],
      ['ID_SOURCE', 'Facultatif, mais s’il est renseigné, conserver la même valeur sur toutes les lignes pour bloquer un doublon d’import.'],
      ['Import', 'PERFECTO ajoutera une seule pièce au journal et à la date choisis ; les données du dossier ne seront pas remplacées.'],
      ['Sécurité', 'Classeur sans macros ; les formules sont refusées dans la feuille Balance.']
    ];
    var dossierRows = [
      ['REFERENCE_DOSSIER', 'NOM_DOSSIER', 'EXERCICE', 'DEBUT_CYCLE', 'FIN_CYCLE', 'DEVISE'],
      [dossier.reference || '', dossier.name || dossier.clientName || '', dossier.exerciseYear || '', dossier.cycleStart || '', dossier.cycleEnd || '', 'XOF']
    ];
    var accountHeaders = ['CODE_COMPTE', 'LIBELLE_COMPTE', 'CLASSE_COMPTE', 'NATURE_COMPTE', 'AUXILIAIRE', 'ACTIF'];
    var accountRows = [accountHeaders].concat(accounts.slice().sort(function (a, b) { return String(a.code).localeCompare(String(b.code)); }).map(function (account) {
      return [account.code, account.label, account.cls, account.nature, account.aux ? 'OUI' : 'NON', account.active === false ? 'NON' : 'OUI'];
    }));
    return [
      { name: 'Instructions', rows: instructions, autoFilter: false },
      { name: 'Dossier', rows: dossierRows, autoFilter: true },
      { name: 'Comptes', rows: accountRows, autoFilter: true },
      { name: 'Balance', rows: [BALANCE_HEADERS], autoFilter: true }
    ];
  }

  function templateBalanceWorkbook(data) {
    return compressWorkbook(balanceWorkbookSheetDefinitions(data || {}));
  }

  function auxiliaryWorkbookSheetDefinitions(data) {
    var dossier = data && data.dossier || {};
    var accounts = data && data.accounts || [];
    var journals = data && data.journals || [];
    var instructions = [
      ['PERFECTO-AUXILIAIRE', 'Version ' + AUXILIARY_VERSION],
      ['Feuille à importer', 'Auxiliaire'],
      ['Objet', 'Lot de pièces auxiliaires complet à centraliser en une écriture générale agrégée.'],
      ['Pièces sources', 'Chaque couple CODE_JOURNAL_SOURCE + DATE_SOURCE + REFERENCE_PIECE_SOURCE forme une pièce ; chaque pièce doit être équilibrée.'],
      ['Comptes', 'CODE_COMPTE_GENERAL désigne le compte général source. Associer les codes au plan cible ; aucun compte ne sera créé automatiquement.'],
      ['Codes et références', 'Saisir les codes, références et ID_SOURCE au format texte ; préserver les zéros initiaux.'],
      ['Auxiliaires', 'Pour chaque ligne de tiers, renseigner ensemble CODE_AUXILIAIRE et LIBELLE_AUXILIAIRE. Le compte cible correspondant doit être marqué auxiliaire.'],
      ['Contreparties', 'Les autres lignes générales de la pièce source sont à inclure dans le lot pour conserver son équilibre.'],
      ['Montants', 'XOF entiers sans séparateur ni décimale ; un seul côté par ligne.'],
      ['ID_SOURCE', 'Identifiant unique et obligatoire pour chaque mouvement source.'],
      ['Import', 'PERFECTO regroupera les lignes par compte cible dans une pièce de centralisation ; le lot source n’est pas remplacé.'],
      ['Sécurité', 'Classeur sans macros ; les formules sont refusées dans la feuille Auxiliaire.']
    ];
    var dossierRows = [
      ['REFERENCE_DOSSIER', 'NOM_DOSSIER', 'EXERCICE', 'DEBUT_CYCLE', 'FIN_CYCLE', 'DEVISE'],
      [dossier.reference || '', dossier.name || dossier.clientName || '', dossier.exerciseYear || '', dossier.cycleStart || '', dossier.cycleEnd || '', 'XOF']
    ];
    var accountHeaders = ['CODE_COMPTE', 'LIBELLE_COMPTE', 'CLASSE_COMPTE', 'NATURE_COMPTE', 'AUXILIAIRE', 'ACTIF'];
    var accountRows = [accountHeaders].concat(accounts.slice().sort(function (a, b) { return String(a.code).localeCompare(String(b.code)); }).map(function (account) {
      return [account.code, account.label, account.cls, account.nature, account.aux ? 'OUI' : 'NON', account.active === false ? 'NON' : 'OUI'];
    }));
    var journalRows = [['CODE_JOURNAL', 'LIBELLE_JOURNAL', 'TYPE']].concat(journals.map(function (journal) {
      return [journal.code, journal.label, journal.type || ''];
    }));
    return [
      { name: 'Instructions', rows: instructions, autoFilter: false },
      { name: 'Dossier', rows: dossierRows, autoFilter: true },
      { name: 'Comptes', rows: accountRows, autoFilter: true },
      { name: 'Journaux', rows: journalRows, autoFilter: true },
      { name: 'Auxiliaire', rows: [AUXILIARY_HEADERS], autoFilter: true }
    ];
  }

  function templateAuxiliaryWorkbook(data) {
    return compressWorkbook(auxiliaryWorkbookSheetDefinitions(data || {}));
  }

  function auxiliaryExtractionRecords(extraction) {
    if (!extraction || !extraction.ok || !Array.isArray(extraction.movements) || !extraction.movements.length) {
      throw new Error(extraction && extraction.errors && extraction.errors[0] || 'Aucun mouvement auxiliaire validé et identifié à exporter.');
    }
    if (extraction.movements.length > MAX_DATA_ROWS) {
      throw new Error('L’extraction dépasse la limite de ' + MAX_DATA_ROWS + ' mouvements par export. Réduisez le périmètre de la période.');
    }
    var dossierReference = String(extraction.dossierReference || '');
    var exercise = extraction.exercise == null ? '' : extraction.exercise;
    var records = [];
    (extraction.byCollective || []).forEach(function (group) {
      records.push({
        TYPE_LIGNE: 'TOTAL_COMPTE_COLLECTIF', REFERENCE_DOSSIER: dossierReference, EXERCICE: exercise,
        CODE_COMPTE_COLLECTIF: group.account, LIBELLE_COMPTE_COLLECTIF: group.accountLabel,
        DEBIT_XOF: group.debit, CREDIT_XOF: group.credit,
        NB_MOUVEMENTS: group.movementCount, NB_AUXILIAIRES: group.auxiliaryCount
      });
    });
    (extraction.byAuxiliary || []).forEach(function (group) {
      records.push({
        TYPE_LIGNE: 'TOTAL_AUXILIAIRE', REFERENCE_DOSSIER: dossierReference, EXERCICE: exercise,
        CODE_COMPTE_COLLECTIF: group.account, LIBELLE_COMPTE_COLLECTIF: group.accountLabel,
        CODE_AUXILIAIRE: group.auxiliaryCode, LIBELLE_AUXILIAIRE_SOURCE: group.auxiliaryLabel,
        DEBIT_XOF: group.debit, CREDIT_XOF: group.credit,
        NB_MOUVEMENTS: group.movementCount
      });
    });
    extraction.movements.forEach(function (movement) {
      records.push({
        TYPE_LIGNE: 'MOUVEMENT_SOURCE', REFERENCE_DOSSIER: dossierReference, EXERCICE: exercise,
        DATE_ECRITURE: movement.date, CODE_JOURNAL_ECRITURE: movement.journal,
        REFERENCE_ECRITURE: movement.reference, LIBELLE_ECRITURE: movement.description,
        DATE_SOURCE: movement.sourceDate, CODE_JOURNAL_SOURCE: movement.sourceJournal,
        REFERENCE_PIECE_SOURCE: movement.sourceReference, LIBELLE_SOURCE: movement.sourceDescription,
        NUM_LIGNE_DANS_ECRITURE: movement.lineNumber, NO_LIGNE_ORIGINALE: movement.sourceRow,
        CODE_COMPTE_COLLECTIF: movement.account, LIBELLE_COMPTE_COLLECTIF: movement.accountLabel,
        CODE_AUXILIAIRE: movement.auxiliaryCode, LIBELLE_AUXILIAIRE_SOURCE: movement.auxiliaryLabel,
        LIBELLE_MOUVEMENT_SOURCE: movement.sourceDescription, DEBIT_XOF: movement.debit, CREDIT_XOF: movement.credit,
        ID_ECRITURE_SOURCE: movement.sourceEntryId, ID_ECRITURE_ORIGINALE_LIEE: movement.originalEntryId,
        ID_SOURCE: movement.sourceId, SYSTEME_SOURCE: movement.sourceSystem,
        ID_FICHIER_SOURCE: movement.sourceFileId
      });
    });
    return records.map(function (record) {
      record.FORMAT = AUXILIARY_REPORT_FORMAT;
      record.VERSION = AUXILIARY_REPORT_VERSION;
      return record;
    });
  }

  function exportAuxiliaryExtractionCsv(extraction) {
    return toDelimited(auxiliaryExtractionRecords(extraction), AUXILIARY_REPORT_HEADERS, ';');
  }

  function exportAuxiliaryExtractionText(extraction) {
    return toDelimited(auxiliaryExtractionRecords(extraction), AUXILIARY_REPORT_HEADERS, '\t');
  }

  function auxiliaryExtractionWorkbookSheetDefinitions(extraction, dossier) {
    var records = auxiliaryExtractionRecords(extraction);
    dossier = dossier || {};
    var collectiveHeaders = [
      'CODE_COMPTE_COLLECTIF', 'LIBELLE_COMPTE_COLLECTIF', 'NB_MOUVEMENTS',
      'NB_AUXILIAIRES', 'DEBIT_XOF', 'CREDIT_XOF'
    ];
    var auxiliaryHeaders = [
      'CODE_COMPTE_COLLECTIF', 'LIBELLE_COMPTE_COLLECTIF', 'CODE_AUXILIAIRE',
      'LIBELLE_AUXILIAIRE_SOURCE', 'NB_MOUVEMENTS', 'DEBIT_XOF', 'CREDIT_XOF'
    ];
    var movementHeaders = [
      'DATE_ECRITURE', 'CODE_JOURNAL_ECRITURE', 'REFERENCE_ECRITURE', 'LIBELLE_ECRITURE',
      'DATE_SOURCE', 'CODE_JOURNAL_SOURCE', 'REFERENCE_PIECE_SOURCE', 'LIBELLE_SOURCE',
      'NUM_LIGNE_DANS_ECRITURE', 'NO_LIGNE_ORIGINALE', 'CODE_COMPTE_COLLECTIF',
      'LIBELLE_COMPTE_COLLECTIF', 'CODE_AUXILIAIRE', 'LIBELLE_AUXILIAIRE_SOURCE',
      'LIBELLE_MOUVEMENT_SOURCE', 'DEBIT_XOF', 'CREDIT_XOF', 'ID_ECRITURE_SOURCE',
      'ID_ECRITURE_ORIGINALE_LIEE', 'ID_SOURCE', 'SYSTEME_SOURCE', 'ID_FICHIER_SOURCE'
    ];
    var collectiveRows = [collectiveHeaders].concat((extraction.byCollective || []).map(function (group) {
      return [group.account, group.accountLabel, group.movementCount, group.auxiliaryCount, group.debit, group.credit];
    }));
    var auxiliaryRows = [auxiliaryHeaders].concat((extraction.byAuxiliary || []).map(function (group) {
      return [group.account, group.accountLabel, group.auxiliaryCode, group.auxiliaryLabel, group.movementCount, group.debit, group.credit];
    }));
    var movementRows = [movementHeaders].concat(records.filter(function (record) {
      return record.TYPE_LIGNE === 'MOUVEMENT_SOURCE';
    }).map(function (record) {
      return movementHeaders.map(function (header) { return record[header] == null ? '' : record[header]; });
    }));
    var stats = extraction.stats || {};
    var controlRows = [
      ['FORMAT', AUXILIARY_REPORT_FORMAT],
      ['VERSION', AUXILIARY_REPORT_VERSION],
      ['REFERENCE_DOSSIER', extraction.dossierReference || dossier.reference || ''],
      ['NOM_DOSSIER', dossier.name || dossier.clientName || ''],
      ['EXERCICE', extraction.exercise || dossier.exerciseYear || ''],
      ['DEBUT_CYCLE', extraction.cycleStart || dossier.cycleStart || ''],
      ['FIN_CYCLE', extraction.cycleEnd || dossier.cycleEnd || ''],
      ['MOUVEMENTS_VALIDES_EXPORTES', Number(stats.eligibleMovementCount) || 0],
      ['ECRITURES_SOURCE', Number(stats.eligibleEntryCount) || 0],
      ['AUXILIAIRES_IDENTIFIES', Number(stats.auxiliaryCount) || 0],
      ['LIGNES_COLLECTIVES_SANS_ID_AUXILIAIRE_OMISES', Number(stats.unattributedMovementCount) || 0],
      ['LIGNES_AUXILIAIRES_SUR_COMPTE_NON_AUXILIAIRE_OMISES', Number(stats.unclassifiedAuxiliaryMovementCount) || 0],
      ['BROUILLONS_EXCLUS', Number(stats.ignoredDraftEntryCount) || 0],
      ['ECRITURES_DE_DEMONSTRATION_EXCLUES', Number(stats.excludedDemoEntryCount) || 0],
      ['CENTRALISATIONS_ANTERIEURES_EXCLUES', Number(stats.excludedCentralizationEntryCount) || 0],
      ['ECRITURES_HORS_CYCLE_EXCLUES', Number(stats.excludedOutOfCycleEntryCount) || 0],
      ['TOTAL_DEBIT_XOF', Number(stats.totalDebit) || 0],
      ['TOTAL_CREDIT_XOF', Number(stats.totalCredit) || 0],
      ['MODE', 'Export de contrôle en lecture seule ; aucune nouvelle écriture comptable n’est créée.']
    ];
    return [
      { name: 'Contrôles', rows: controlRows, autoFilter: false },
      { name: 'Totaux collectifs', rows: collectiveRows, autoFilter: true },
      { name: 'Totaux auxiliaires', rows: auxiliaryRows, autoFilter: true },
      { name: 'Mouvements sources', rows: movementRows, autoFilter: true }
    ];
  }

  function exportAuxiliaryExtractionWorkbook(extraction, dossier) {
    return compressWorkbook(auxiliaryExtractionWorkbookSheetDefinitions(extraction, dossier));
  }

  function readZipDirectory(bytes) {
    function u16(offset) { return bytes[offset] | (bytes[offset + 1] << 8); }
    function u32(offset) { return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0; }
    var start = Math.max(0, bytes.length - 65557);
    var endRecord = -1;
    for (var i = bytes.length - 22; i >= start; i -= 1) {
      if (u32(i) === 0x06054b50 && i + 22 + u16(i + 20) === bytes.length) { endRecord = i; break; }
    }
    if (endRecord < 0) throw new Error('Archive Excel invalide : fin ZIP introuvable.');
    var count = u16(endRecord + 10);
    var centralSize = u32(endRecord + 12);
    var centralOffset = u32(endRecord + 16);
    if (!count || count > 50 || centralOffset + centralSize > endRecord) throw new Error('Archive Excel invalide ou trop complexe.');
    var names = [];
    var totalSize = 0;
    var position = centralOffset;
    for (var entryIndex = 0; entryIndex < count; entryIndex += 1) {
      if (u32(position) !== 0x02014b50 || position + 46 > bytes.length) throw new Error('Archive Excel invalide : répertoire ZIP incorrect.');
      var compressedSize = u32(position + 20);
      var uncompressedSize = u32(position + 24);
      var nameLength = u16(position + 28);
      var extraLength = u16(position + 30);
      var commentLength = u16(position + 32);
      if (uncompressedSize === 0xffffffff || compressedSize === 0xffffffff) throw new Error('Les classeurs ZIP64 ne sont pas pris en charge.');
      var nameStart = position + 46;
      var name = '';
      for (var charIndex = 0; charIndex < nameLength; charIndex += 1) name += String.fromCharCode(bytes[nameStart + charIndex]);
      if (!name || name.charAt(0) === '/' || name.split('/').indexOf('..') !== -1) throw new Error('Archive Excel invalide : chemin de fichier interdit.');
      names.push(name);
      totalSize += uncompressedSize;
      if (totalSize > MAX_WORKBOOK_UNCOMPRESSED_BYTES) throw new Error('Le classeur Excel dépasse la limite décompressée de 20 Mo.');
      position = nameStart + nameLength + extraLength + commentLength;
    }
    return names;
  }

  function decodeUtf8(bytes) {
    return new root.TextDecoder('utf-8').decode(bytes);
  }

  function localName(node) {
    return node.localName || String(node.nodeName || '').split(':').pop();
  }

  function elementsByName(node, name) {
    var all = node.getElementsByTagName('*');
    var matches = [];
    for (var i = 0; i < all.length; i += 1) if (localName(all[i]) === name) matches.push(all[i]);
    return matches;
  }

  function directChildrenByName(node, name) {
    var matches = [];
    for (var i = 0; i < node.childNodes.length; i += 1) {
      var child = node.childNodes[i];
      if (child.nodeType === 1 && localName(child) === name) matches.push(child);
    }
    return matches;
  }

  function parseXml(text) {
    if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('Le classeur contient une déclaration XML interdite.');
    var doc = new root.DOMParser().parseFromString(text, 'application/xml');
    if (elementsByName(doc, 'parsererror').length) throw new Error('Une partie XML du classeur Excel est invalide.');
    return doc;
  }

  function resolveSheetTarget(target) {
    var path = String(target || '').replace(/\\/g, '/');
    if (path.charAt(0) === '/') path = path.slice(1);
    if (path.indexOf('xl/') !== 0) path = 'xl/' + path;
    var parts = [];
    path.split('/').forEach(function (part) {
      if (!part || part === '.') return;
      if (part === '..') parts.pop();
      else parts.push(part);
    });
    var resolved = parts.join('/');
    if (resolved.indexOf('xl/worksheets/') !== 0) throw new Error('La feuille Excel est située hors du répertoire attendu.');
    return resolved;
  }

  function readSharedStrings(bytes) {
    var key = 'xl/sharedStrings.xml';
    if (!bytes[key]) return [];
    var doc = parseXml(decodeUtf8(bytes[key]));
    return elementsByName(doc, 'si').map(function (item) {
      return elementsByName(item, 't').map(function (textNode) { return textNode.textContent || ''; }).join('');
    });
  }

  function cellColumnIndex(reference, fallback) {
    var match = /^\$?([A-Z]+)\$?\d+$/i.exec(String(reference || ''));
    if (!match) return fallback;
    var column = 0;
    var letters = match[1].toUpperCase();
    for (var i = 0; i < letters.length; i += 1) column = column * 26 + letters.charCodeAt(i) - 64;
    return column - 1;
  }

  function excelSerialDate(value, date1904) {
    var serial = Number(value);
    if (!Number.isSafeInteger(serial) || serial < 0 || serial > 100000) return String(value);
    var base = date1904
      ? Date.UTC(1904, 0, 1)
      : (serial >= 60 ? Date.UTC(1899, 11, 30) : Date.UTC(1899, 11, 31));
    var date = new Date(base + serial * 86400000);
    if (!Number.isFinite(date.getTime())) return String(value);
    return date.getUTCFullYear() + '-' + String(date.getUTCMonth() + 1).padStart(2, '0') + '-' + String(date.getUTCDate()).padStart(2, '0');
  }

  function readSheetRows(bytes, path, sharedStrings, date1904, expectedHeaders) {
    var headersExpected = expectedHeaders || HEADERS;
    if (!bytes[path]) throw new Error('Feuille de données introuvable dans le classeur.');
    var doc = parseXml(decodeUtf8(bytes[path]));
    var sheetData = elementsByName(doc, 'sheetData')[0];
    if (!sheetData) throw new Error('La feuille Excel ne contient pas de tableau de données.');
    var rowNodes = directChildrenByName(sheetData, 'row');
    if (rowNodes.length > MAX_DATA_ROWS + 20) throw new Error('La feuille Excel dépasse la limite de lignes autorisée.');
    var matrix = rowNodes.map(function (rowNode) {
      var values = [];
      var cellNodes = directChildrenByName(rowNode, 'c');
      cellNodes.forEach(function (cell, index) {
        if (directChildrenByName(cell, 'f').length) throw new Error('Les formules Excel ne sont pas importées. Remplacez-les par leurs valeurs avant l’import.');
        var column = cellColumnIndex(cell.getAttribute('r'), index);
        if (column > 63) throw new Error('La feuille Excel contient plus de 64 colonnes.');
        var type = cell.getAttribute('t') || '';
        var value = '';
        if (type === 'inlineStr') {
          value = elementsByName(cell, 't').map(function (textNode) { return textNode.textContent || ''; }).join('');
        } else {
          var valueNodes = directChildrenByName(cell, 'v');
          value = valueNodes.length ? String(valueNodes[0].textContent || '') : '';
          if (type === 's') {
            var stringIndex = Number(value);
            if (!Number.isSafeInteger(stringIndex) || stringIndex < 0 || stringIndex >= sharedStrings.length) throw new Error('Le classeur contient une référence de texte Excel invalide.');
            value = sharedStrings[stringIndex];
          } else if (type === 'e') {
            throw new Error('La feuille Excel contient une cellule en erreur.');
          } else if (type === 'b') {
            value = value === '1' ? 'TRUE' : 'FALSE';
          }
        }
        values[column] = value;
      });
      return values.map(function (value) { return value == null ? '' : String(value); });
    });
    var headerIndex = -1;
    var headerLimit = Math.min(20, matrix.length);
    for (var rowIndex = 0; rowIndex < headerLimit; rowIndex += 1) {
      var normalized = matrix[rowIndex].map(function (value) { return String(value || '').trim().toUpperCase(); });
      if (headersExpected.every(function (header) { return normalized.indexOf(header) !== -1; })) { headerIndex = rowIndex; break; }
    }
    if (headerIndex < 0) throw new Error('La feuille ne contient pas l’en-tête complet du modèle attendu.');
    var header = matrix[headerIndex].map(function (value) { return String(value || '').trim().toUpperCase(); });
    var dateIndex = header.indexOf('DATE');
    if (dateIndex < 0) dateIndex = header.indexOf('DATE_BALANCE');
    var result = matrix.slice(headerIndex);
    var dateIndexes = dateIndex >= 0 ? [dateIndex] : [];
    var dateHeaderOffset = 0;
    if (!dateIndexes.length) {
      var bestDateHeaderScore = -1;
      for (var headerOffset = 0; headerOffset < Math.min(20, result.length); headerOffset += 1) {
        var candidateDateHeader = result[headerOffset] || [];
        var possibleDateIndexes = candidateDateHeader.map(function (value, index) {
          return normalizeToken(value).indexOf('DATE') !== -1 ? index : -1;
        }).filter(function (index) { return index >= 0; });
        if (!possibleDateIndexes.length) continue;
        var dateHeaderScore = possibleDateIndexes.length * 100 + candidateDateHeader.filter(function (value) { return String(value || '').trim() !== ''; }).length;
        if (dateHeaderScore > bestDateHeaderScore) {
          bestDateHeaderScore = dateHeaderScore;
          dateIndexes = possibleDateIndexes;
          dateHeaderOffset = headerOffset;
        }
      }
    }
    result.slice(dateHeaderOffset + 1).forEach(function (row) {
      dateIndexes.forEach(function (index) {
        if (row[index] && /^\d+(?:\.\d+)?$/.test(row[index])) row[index] = excelSerialDate(row[index], date1904);
      });
    });
    return result;
  }

  function matrixCsv(rows) {
    return '\uFEFF' + rows.map(function (row) {
      return row.map(function (value) { return '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"'; }).join(';');
    }).join('\r\n') + '\r\n';
  }

  function openWorkbook(input) {
    if (!root.fflate || typeof root.fflate.unzipSync !== 'function') throw new Error('Le module local de lecture Excel n’est pas disponible.');
    var bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    if (!bytes.length || bytes.length > MAX_WORKBOOK_BYTES) throw new Error('Le classeur doit faire au plus 5 Mo.');
    var zipNames = readZipDirectory(bytes);
    if (zipNames.some(function (name) { return /vbaProject\.bin$/i.test(name); })) throw new Error('Les classeurs avec macros VBA ne sont pas acceptés.');
    var files = root.fflate.unzipSync(bytes);
    if (!files['xl/workbook.xml'] || !files['xl/_rels/workbook.xml.rels']) throw new Error('Le fichier n’est pas un classeur Excel OOXML valide.');
    var workbookDoc = parseXml(decodeUtf8(files['xl/workbook.xml']));
    var relationDoc = parseXml(decodeUtf8(files['xl/_rels/workbook.xml.rels']));
    var relationships = Object.create(null);
    elementsByName(relationDoc, 'Relationship').forEach(function (relationship) {
      relationships[relationship.getAttribute('Id')] = relationship.getAttribute('Target');
    });
    var sheetNodes = elementsByName(workbookDoc, 'sheet');
    var sheets = sheetNodes.map(function (sheet) {
      var relId = sheet.getAttribute('r:id') || sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
      return { name: sheet.getAttribute('name') || '', path: resolveSheetTarget(relationships[relId]) };
    });
    var sharedStrings = readSharedStrings(files);
    var workbookProperties = elementsByName(workbookDoc, 'workbookPr')[0];
    var date1904 = workbookProperties && ['1', 'true'].indexOf(String(workbookProperties.getAttribute('date1904')).toLowerCase()) !== -1;
    return { files: files, sheets: sheets, sharedStrings: sharedStrings, date1904: !!date1904 };
  }

  function readWorkbookRows(input, preferredSheetName, expectedHeaders) {
    var workbook = openWorkbook(input);
    var files = workbook.files;
    var sheets = workbook.sheets;
    var sharedStrings = workbook.sharedStrings;
    var date1904 = workbook.date1904;
    if (preferredSheetName === '__ALL__') {
      return sheets.map(function (sheet) {
        try {
          return { name: sheet.name, rows: readSheetRows(files, sheet.path, sharedStrings, date1904, expectedHeaders || []) };
        } catch (err) {
          return { name: sheet.name, rows: [], error: err.message || 'Feuille illisible.' };
        }
      });
    }
    var expectedSheet = normalizeToken(preferredSheetName).replace(/[^A-Z0-9]/g, '');
    var candidate = sheets.find(function (sheet) { return normalizeToken(sheet.name).replace(/[^A-Z0-9]/g, '') === expectedSheet; });
    var rows = null;
    if (candidate) rows = readSheetRows(files, candidate.path, sharedStrings, date1904, expectedHeaders);
    else {
      for (var sheetIndex = 0; sheetIndex < sheets.length && !rows; sheetIndex += 1) {
        try { rows = readSheetRows(files, sheets[sheetIndex].path, sharedStrings, date1904, expectedHeaders); }
        catch (sheetError) { if (sheetIndex === sheets.length - 1) throw sheetError; }
      }
    }
    if (!rows) throw new Error('Aucune feuille « ' + preferredSheetName + ' » conforme au modèle attendu n’a été trouvée.');
    return rows;
  }

  function parseTableCsv(text) {
    return parseRows(text);
  }

  function parseTableWorkbook(input, sheetName) {
    try {
      var preferred = String(sheetName || 'Releve');
      return { ok: true, rows: readWorkbookRows(input, preferred, []), sheetName: preferred };
    } catch (err) {
      return { ok: false, errors: [err.message || 'Classeur Excel illisible.'], rows: [] };
    }
  }

  function listTableWorkbook(input) {
    try {
      var sheets = readWorkbookRows(input, '__ALL__', []).filter(function (sheet) { return sheet.rows && sheet.rows.length; });
      if (!sheets.length) return { ok: false, errors: ['Le classeur ne contient aucune feuille tabulaire lisible.'], sheets: [] };
      return { ok: true, errors: [], sheets: sheets };
    } catch (err) {
      return { ok: false, errors: [err.message || 'Classeur Excel illisible.'], sheets: [] };
    }
  }

  function parseWorkbook(input) {
    try {
      return parse(matrixCsv(readWorkbookRows(input, 'Ecritures', HEADERS)));
    } catch (err) {
      return { ok: false, errors: [err.message || 'Classeur Excel illisible.'], entries: [], metadata: null };
    }
  }

  function parseBalanceWorkbook(input) {
    try {
      return parseBalance(matrixCsv(readWorkbookRows(input, 'Balance', BALANCE_HEADERS)));
    } catch (err) {
      return { ok: false, errors: [err.message || 'Classeur de balance illisible.'], rows: [], metadata: null, totalDebit: 0, totalCredit: 0 };
    }
  }

  function parseAuxiliaryWorkbook(input) {
    try {
      return parseAuxiliary(matrixCsv(readWorkbookRows(input, 'Auxiliaire', AUXILIARY_HEADERS)));
    } catch (err) {
      return { ok: false, errors: [err.message || 'Classeur auxiliaire illisible.'], rows: [], metadata: null, documentCount: 0, totalDebit: 0, totalCredit: 0 };
    }
  }

  var api = {
    FORMAT: FORMAT,
    VERSION: VERSION,
    HEADERS: HEADERS.slice(),
    BALANCE_FORMAT: BALANCE_FORMAT,
    BALANCE_VERSION: BALANCE_VERSION,
    BALANCE_HEADERS: BALANCE_HEADERS.slice(),
    AUXILIARY_FORMAT: AUXILIARY_FORMAT,
    AUXILIARY_VERSION: AUXILIARY_VERSION,
    AUXILIARY_HEADERS: AUXILIARY_HEADERS.slice(),
    AUXILIARY_REPORT_FORMAT: AUXILIARY_REPORT_FORMAT,
    AUXILIARY_REPORT_VERSION: AUXILIARY_REPORT_VERSION,
    AUXILIARY_REPORT_HEADERS: AUXILIARY_REPORT_HEADERS.slice(),
    parse: parse,
    parseTableCsv: parseTableCsv,
    parseTableWorkbook: parseTableWorkbook,
    listTableWorkbook: listTableWorkbook,
    template: template,
    exportEntries: exportEntries,
    exportAccounts: exportAccounts,
    exportJournals: exportJournals,
    exportWorkbook: exportWorkbook,
    templateWorkbook: templateWorkbook,
    parseWorkbook: parseWorkbook,
    parseBalance: parseBalance,
    templateBalance: templateBalance,
    templateBalanceWorkbook: templateBalanceWorkbook,
    parseBalanceWorkbook: parseBalanceWorkbook,
    parseAuxiliary: parseAuxiliary,
    templateAuxiliary: templateAuxiliary,
    templateAuxiliaryWorkbook: templateAuxiliaryWorkbook,
    parseAuxiliaryWorkbook: parseAuxiliaryWorkbook,
    exportAuxiliaryExtractionCsv: exportAuxiliaryExtractionCsv,
    exportAuxiliaryExtractionText: exportAuxiliaryExtractionText,
    exportAuxiliaryExtractionWorkbook: exportAuxiliaryExtractionWorkbook
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PerfectoAccountingExchange = api;
}(typeof window !== 'undefined' ? window : globalThis));
