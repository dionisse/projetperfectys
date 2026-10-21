/* =========================================================================
   PERFECTO · Lecteur FEC béninois
   Import local, sans connexion au logiciel comptable externe.
   Format de référence : arrêté béninois du 23 avril 2020.
   ========================================================================= */
(function (root) {
  'use strict';

  var FORMAT = 'FEC-BENIN';
  var MAX_DATA_ROWS = 50000;
  var MAX_ERRORS = 200;
  var MAX_FIELD_LENGTH = 10000;
  var DECIMAL_SCALE = 10000;

  var BASE_FIELDS = [
    'CodeJournal', 'LibJournal', 'NumEcriture', 'DateEcriture', 'NumCompte', 'LibCompte',
    'NumCompteAux', 'LibCompteAux', 'RefPiece', 'DatePiece', 'LibEcriture',
    'MontDebit', 'MontCredit', 'LetEcriture', 'DateLetEcriture', 'DateValid',
    'MontDevise', 'CodeDevise'
  ];
  var CASH_FIELDS = ['DateReglement', 'ModeReglement', 'NatOp'];

  var EBCDIC_IBM037_MAP = [0,1,2,3,156,9,134,127,151,141,142,11,12,13,14,15,16,17,18,19,157,133,8,135,24,25,146,143,28,29,30,31,128,129,130,131,132,10,23,27,136,137,138,139,140,5,6,7,144,145,22,147,148,149,150,4,152,153,154,155,20,21,158,26,32,160,226,228,224,225,227,229,231,241,162,46,60,40,43,124,38,233,234,235,232,237,238,239,236,223,33,36,42,41,59,172,45,47,194,196,192,193,195,197,199,209,166,44,37,95,62,63,248,201,202,203,200,205,206,207,204,96,58,35,64,39,61,34,216,97,98,99,100,101,102,103,104,105,171,187,240,253,254,177,176,106,107,108,109,110,111,112,113,114,170,186,230,184,198,164,181,126,115,116,117,118,119,120,121,122,161,191,208,221,222,174,94,163,165,183,169,167,182,188,189,190,91,93,175,168,180,215,123,65,66,67,68,69,70,71,72,73,173,244,246,242,243,245,125,74,75,76,77,78,79,80,81,82,185,251,252,249,250,255,92,247,83,84,85,86,87,88,89,90,178,212,214,210,211,213,48,49,50,51,52,53,54,55,56,57,179,219,220,217,218,159];
  var EBCDIC_IBM500_MAP = [0,1,2,3,156,9,134,127,151,141,142,11,12,13,14,15,16,17,18,19,157,133,8,135,24,25,146,143,28,29,30,31,128,129,130,131,132,10,23,27,136,137,138,139,140,5,6,7,144,145,22,147,148,149,150,4,152,153,154,155,20,21,158,26,32,160,226,228,224,225,227,229,231,241,91,46,60,40,43,33,38,233,234,235,232,237,238,239,236,223,93,36,42,41,59,94,45,47,194,196,192,193,195,197,199,209,166,44,37,95,62,63,248,201,202,203,200,205,206,207,204,96,58,35,64,39,61,34,216,97,98,99,100,101,102,103,104,105,171,187,240,253,254,177,176,106,107,108,109,110,111,112,113,114,170,186,230,184,198,164,181,126,115,116,117,118,119,120,121,122,161,191,208,221,222,174,162,163,165,183,169,167,182,188,189,190,172,124,175,168,180,215,123,65,66,67,68,69,70,71,72,73,173,244,246,242,243,245,125,74,75,76,77,78,79,80,81,82,185,251,252,249,250,255,92,247,83,84,85,86,87,88,89,90,178,212,214,210,211,213,48,49,50,51,52,53,54,55,56,57,179,219,220,217,218,159];

  var HEADER_ALIASES = Object.create(null);

  function normalizeHeader(value) {
    return String(value == null ? '' : value).trim().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function registerHeader(key, aliases) {
    [key].concat(aliases || []).forEach(function (alias) {
      HEADER_ALIASES[normalizeHeader(alias)] = key;
    });
  }

  registerHeader('CodeJournal', ['Code journal', 'Code du journal']);
  registerHeader('LibJournal', ['Libellé journal', 'Libellé du journal', 'LibJournal', 'LibJourna1']);
  registerHeader('NumEcriture', ['Numéro d’écriture', 'Numéro de l’écriture', 'Numéro séquentiel de l’écriture']);
  registerHeader('DateEcriture', ['Date d’écriture', 'Date de comptabilisation de l’écriture']);
  registerHeader('NumCompte', ['Numéro du compte', 'Numéro de compte']);
  registerHeader('LibCompte', ['Libellé du compte']);
  registerHeader('NumCompteAux', ['Compte auxiliaire', 'Numéro du compte auxiliaire', 'Numéro de compte auxiliaire']);
  registerHeader('LibCompteAux', ['Libellé du compte auxiliaire']);
  registerHeader('RefPiece', ['Référence pièce', 'Référence de la pièce', 'Référence de la pièce justificative de l’écriture']);
  registerHeader('DatePiece', ['Date de la pièce', 'Date de la pièce justificative de l’écriture']);
  registerHeader('LibEcriture', ['Libellé de l’écriture', 'Libellé écriture']);
  registerHeader('MontDebit', ['Montant au débit', 'Montant au début']);
  registerHeader('MontCredit', ['Montant au crédit']);
  registerHeader('Montant', ['Montant']);
  registerHeader('Sens', ['Sens']);
  registerHeader('LetEcriture', ['Lettrage de l’écriture', 'Lettrage écriture']);
  registerHeader('DateLetEcriture', ['Date de lettrage', 'Date du lettrage']);
  registerHeader('DateValid', ['Date de validation de l’écriture', 'Date de validation']);
  registerHeader('MontDevise', ['Montant en devise', 'Montant de la devise']);
  registerHeader('CodeDevise', ['Code de la devise', 'Code devise']);
  registerHeader('DateReglement', ['Date règlement', 'Date de règlement', 'Date règlement obligatoire']);
  registerHeader('ModeReglement', ['Mode règlement', 'Mode de règlement']);
  registerHeader('NatOp', ['Nature opération', 'Nature de l’opération', 'NatOp']);

  function decodeBytes(input, encoding) {
    var bytes = input instanceof Uint8Array ? input : new Uint8Array(input || new ArrayBuffer(0));
    var mode = String(encoding || 'iso-8859-15').toLowerCase();
    var offset = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
    if (mode === 'ascii') {
      var ascii = '';
      for (var a = offset; a < bytes.length; a += 1) {
        if (bytes[a] > 0x7f) throw new Error('Le fichier contient des octets hors ASCII ; choisissez le jeu de caractères déclaré par la source.');
        ascii += String.fromCharCode(bytes[a]);
      }
      return ascii;
    }
    if (mode === 'iso-8859-15' || mode === 'iso8859-15' || mode === 'latin9') {
      if (typeof TextDecoder !== 'function') throw new Error('Ce navigateur ne peut pas décoder ISO-8859-15.');
      return new TextDecoder('iso-8859-15', { fatal: true }).decode(bytes.subarray(offset));
    }
    var table = mode === 'ibm037' || mode === 'ebcdic-037' ? EBCDIC_IBM037_MAP
      : mode === 'ibm500' || mode === 'ebcdic-500' ? EBCDIC_IBM500_MAP : null;
    if (!table) throw new Error('Jeu de caractères non pris en charge. Sélectionnez ASCII, ISO-8859-15, EBCDIC IBM037 ou EBCDIC IBM500.');
    var decoded = '';
    var chunk = [];
    for (var i = offset; i < bytes.length; i += 1) {
      chunk.push(table[bytes[i]]);
      if (chunk.length >= 4096) {
        decoded += String.fromCharCode.apply(null, chunk);
        chunk = [];
      }
    }
    if (chunk.length) decoded += String.fromCharCode.apply(null, chunk);
    return decoded;
  }

  function recordSeparator(text) {
    var hasCrLf = /\r\n/.test(text);
    var withoutCrLf = text.replace(/\r\n/g, '');
    var hasCr = /\r/.test(withoutCrLf);
    var hasLf = /\n/.test(withoutCrLf);
    if (hasCrLf && !hasCr && !hasLf) return 'CRLF';
    if (hasCr && !hasLf && !hasCrLf) return 'CR';
    if (hasLf && !hasCr && !hasCrLf) return 'LF';
    if (!hasCrLf && !hasCr && !hasLf) return 'Aucun';
    return 'Mixte';
  }

  function countFirstRecordDelimiters(text, delimiter) {
    var count = 0;
    var quoted = false;
    for (var i = 0; i < text.length; i += 1) {
      var ch = text.charAt(i);
      if (ch === '"') {
        if (quoted && text.charAt(i + 1) === '"') { i += 1; continue; }
        quoted = !quoted;
      } else if (!quoted && ch === delimiter) {
        count += 1;
      } else if (!quoted && (ch === '\r' || ch === '\n')) {
        break;
      }
    }
    return count;
  }

  function selectDelimiter(text, requested) {
    if (requested === '\t' || requested === 'tab') return { ok: true, delimiter: '\t', label: 'TAB' };
    if (requested === '|' || requested === 'pipe') return { ok: true, delimiter: '|', label: '|' };
    if (requested && requested !== 'auto') return { ok: false, errors: ['Le séparateur choisi n’est pas autorisé par ce parcours.'] };
    var candidates = ['\t', '|'].filter(function (delimiter) {
      var fieldCount = countFirstRecordDelimiters(text, delimiter) + 1;
      return fieldCount === 18 || fieldCount === 21;
    });
    if (candidates.length === 1) {
      return { ok: true, delimiter: candidates[0], label: candidates[0] === '\t' ? 'TAB' : '|' };
    }
    if (candidates.length > 1) return { ok: false, errors: ['Le séparateur est ambigu : choisissez explicitement la tabulation ou le caractère « | ».'] };
    return { ok: false, errors: ['L’en-tête ne présente pas 18 ou 21 colonnes avec une tabulation ou le caractère « | ».'] };
  }

  function parseRows(text, delimiter) {
    var rows = [];
    var row = [];
    var field = '';
    var quoted = false;
    var afterQuote = false;
    var endedRow = false;

    function finishRow() {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      afterQuote = false;
      endedRow = true;
    }

    for (var i = 0; i < text.length; i += 1) {
      var ch = text.charAt(i);
      if (quoted) {
        if (ch === '"' && text.charAt(i + 1) === '"') {
          field += '"';
          i += 1;
        } else if (ch === '"') {
          quoted = false;
          afterQuote = true;
        } else if (ch === '\r' || ch === '\n') {
          field += '\n';
          if (ch === '\r' && text.charAt(i + 1) === '\n') i += 1;
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        if (field.length || afterQuote) return { ok: false, errors: ['Guillemet inattendu dans un champ FEC.'] };
        quoted = true;
        endedRow = false;
      } else if (ch === delimiter) {
        row.push(field);
        field = '';
        afterQuote = false;
        endedRow = false;
      } else if (ch === '\r' || ch === '\n') {
        finishRow();
        if (ch === '\r' && text.charAt(i + 1) === '\n') i += 1;
        if (rows.length > MAX_DATA_ROWS + 1) return { ok: false, errors: ['Le fichier dépasse la limite de 50 000 lignes de données.'] };
      } else if (afterQuote && /\s/.test(ch)) {
        // Espaces de remplissage après un champ CSV entre guillemets.
      } else if (afterQuote) {
        return { ok: false, errors: ['Caractères inattendus après un champ FEC entre guillemets.'] };
      } else {
        field += ch;
        endedRow = false;
      }
    }
    if (quoted) return { ok: false, errors: ['Le fichier FEC contient un champ entre guillemets qui n’est pas refermé.'] };
    if (!endedRow || field.length || row.length) finishRow();
    while (rows.length && rows[rows.length - 1].every(function (cell) { return String(cell).trim() === ''; })) rows.pop();
    if (rows.length > MAX_DATA_ROWS + 1) return { ok: false, errors: ['Le fichier dépasse la limite de 50 000 lignes de données.'] };
    return { ok: true, rows: rows };
  }

  function canonicalHeader(value) {
    return HEADER_ALIASES[normalizeHeader(value)] || '';
  }

  function inspectHeader(cells) {
    var errors = [];
    if (cells.length !== 18 && cells.length !== 21) {
      return { ok: false, errors: ['L’en-tête FEC doit comporter 18 colonnes, ou 21 pour le complément de comptabilité de trésorerie.'] };
    }
    var keys = cells.map(canonicalHeader);
    var unknown = [];
    keys.forEach(function (key, index) {
      if (!key) unknown.push('colonne ' + (index + 1) + ' (« ' + String(cells[index] || '').trim() + ' »)');
    });
    if (unknown.length) errors.push('En-tête non reconnu : ' + unknown.join(', ') + '.');

    var expected = BASE_FIELDS.slice();
    var variant = '';
    if (keys[11] === 'MontDebit' && keys[12] === 'MontCredit') variant = 'debit-credit';
    else if (keys[11] === 'Montant' && keys[12] === 'Sens') variant = 'amount-sense';
    else errors.push('Les colonnes 12–13 doivent être MontDebit/MontCredit ou Montant/sens.');
    if (cells.length === 21) expected = expected.concat(CASH_FIELDS);

    if (variant === 'amount-sense') {
      expected[11] = 'Montant';
      expected[12] = 'Sens';
    }
    if (keys.length === expected.length && keys.some(function (key, index) { return key !== expected[index]; })) {
      errors.push('Les colonnes FEC ne respectent pas l’ordre prescrit par l’arrêté béninois.');
    }
    var duplicates = keys.filter(function (key, index) { return key && keys.indexOf(key) !== index; });
    if (duplicates.length) errors.push('L’en-tête contient des champs répétés : ' + duplicates.join(', ') + '.');
    return { ok: errors.length === 0, errors: errors, keys: keys, variant: variant, count: cells.length };
  }

  function validDate(value) {
    var raw = String(value == null ? '' : value).trim();
    if (!/^\d{8}$/.test(raw)) return '';
    var year = Number(raw.slice(0, 4));
    var month = Number(raw.slice(4, 6));
    var day = Number(raw.slice(6, 8));
    var date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
    return raw.slice(0, 4) + '-' + raw.slice(4, 6) + '-' + raw.slice(6, 8);
  }

  function parseAmount(value, rowNumber, name, errors, allowNegative) {
    var raw = String(value == null ? '' : value).trim();
    if (!raw) {
      errors.push('Ligne ' + rowNumber + ' : ' + name + ' est obligatoire.');
      return null;
    }
    var match = /^([+-]?)(\d+)(?:,(\d+))?$/.exec(raw);
    if (!match) {
      errors.push('Ligne ' + rowNumber + ' : ' + name + ' doit être numérique, avec virgule décimale et sans séparateur de milliers.');
      return null;
    }
    var fraction = match[3] || '';
    if (fraction.length > 4) {
      errors.push('Ligne ' + rowNumber + ' : ' + name + ' dépasse la précision maximale de 4 décimales gérée par ce dossier.');
      return null;
    }
    var whole = Number(match[2]);
    var fractionalUnits = Number((fraction + '0000').slice(0, 4));
    var units = whole * DECIMAL_SCALE + fractionalUnits;
    if (!Number.isSafeInteger(units)) {
      errors.push('Ligne ' + rowNumber + ' : ' + name + ' dépasse la capacité numérique sûre.');
      return null;
    }
    var negative = match[1] === '-';
    if (negative && !allowNegative) {
      errors.push('Ligne ' + rowNumber + ' : ' + name + ' est négatif ; la conversion de ce signe en débit/crédit n’est pas automatique.');
      return null;
    }
    return { value: (negative ? -1 : 1) * units / DECIMAL_SCALE, units: negative ? -units : units, raw: raw };
  }

  function stableHash(text) {
    var a = 2166136261;
    var b = 0x9e3779b9;
    for (var i = 0; i < text.length; i += 1) {
      var code = text.charCodeAt(i);
      a ^= code;
      a = Math.imul(a, 16777619) >>> 0;
      b = (Math.imul(b ^ code, 2246822519) + i) >>> 0;
    }
    return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
  }

  function safeReferencePart(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 35) || 'source';
  }

  function parse(text, options) {
    var opts = options || {};
    var source = String(text == null ? '' : text).replace(/^\uFEFF/, '');
    var errors = [];
    var overflowErrors = false;
    function addError(message) {
      if (errors.length < MAX_ERRORS) errors.push(message);
      else overflowErrors = true;
    }
    var delimiterChoice = selectDelimiter(source, opts.delimiter || 'auto');
    if (!delimiterChoice.ok) return { ok: false, errors: delimiterChoice.errors, warnings: [], entries: [], rows: [], metadata: null };
    var parsedRows = parseRows(source, delimiterChoice.delimiter);
    if (!parsedRows.ok) return { ok: false, errors: parsedRows.errors, warnings: [], entries: [], rows: [], metadata: null };
    var rows = parsedRows.rows;
    if (!rows.length || !rows[0].some(function (cell) { return String(cell).trim() !== ''; })) {
      return { ok: false, errors: ['La première ligne du fichier doit contenir l’en-tête FEC.'], warnings: [], entries: [], rows: [], metadata: null };
    }
    var header = inspectHeader(rows[0]);
    if (!header.ok) return { ok: false, errors: header.errors, warnings: [], entries: [], rows: [], metadata: null };
    if (rows.length < 2) return { ok: false, errors: ['Le fichier contient un en-tête mais aucune écriture.'], warnings: [], entries: [], rows: [], metadata: null };

    var dataRows = rows.slice(1);
    if (dataRows.length > MAX_DATA_ROWS) return { ok: false, errors: ['Le fichier dépasse la limite de 50 000 lignes de données.'], warnings: [], entries: [], rows: [], metadata: null };
    var groupMap = Object.create(null);
    var groups = [];
    var parsedMovements = [];
    var previousValidationDate = '';
    var totalDebitUnits = 0;
    var totalCreditUnits = 0;
    var normalizedSignCount = 0;
    var fileHash = String(opts.fileHash || stableHash(source));
    var recordNumber = 0;

    dataRows.forEach(function (cells, index) {
      var rowNumber = index + 2;
      if (!cells.some(function (cell) { return String(cell).trim() !== ''; })) {
        addError('Ligne ' + rowNumber + ' : ligne vide inattendue dans les données FEC.');
        return;
      }
      recordNumber += 1;
      if (cells.length !== header.count) {
        addError('Ligne ' + rowNumber + ' : ' + cells.length + ' colonne(s), alors que l’en-tête en prévoit ' + header.count + '.');
        return;
      }
      var record = Object.create(null);
      header.keys.forEach(function (key, columnIndex) {
        record[key] = String(cells[columnIndex] == null ? '' : cells[columnIndex]).trim();
      });
      if (Object.keys(record).some(function (key) { return record[key].length > MAX_FIELD_LENGTH; })) {
        addError('Ligne ' + rowNumber + ' : un champ dépasse la limite de longueur autorisée.');
        return;
      }

      ['CodeJournal', 'LibJournal', 'NumEcriture', 'NumCompte', 'LibCompte', 'RefPiece', 'LibEcriture'].forEach(function (field) {
        if (!record[field]) addError('Ligne ' + rowNumber + ' : ' + field + ' est obligatoire.');
      });
      if (record.CodeJournal.length > 30) addError('Ligne ' + rowNumber + ' : CodeJournal dépasse 30 caractères.');
      if (record.NumEcriture.length > 80) addError('Ligne ' + rowNumber + ' : NumEcriture dépasse 80 caractères.');
      if (record.NumCompte && !/^\d{3}/.test(record.NumCompte)) {
        addError('Ligne ' + rowNumber + ' : les trois premiers caractères de NumCompte doivent être des chiffres SYSCOHADA.');
      }

      var entryDate = validDate(record.DateEcriture);
      var pieceDate = validDate(record.DatePiece);
      var validationDate = validDate(record.DateValid);
      var lettrageDate = record.DateLetEcriture ? validDate(record.DateLetEcriture) : '';
      if (!entryDate) addError('Ligne ' + rowNumber + ' : DateEcriture doit être une date valide au format AAAAMMJJ.');
      if (!pieceDate) addError('Ligne ' + rowNumber + ' : DatePiece doit être une date valide au format AAAAMMJJ.');
      if (!validationDate) addError('Ligne ' + rowNumber + ' : DateValid doit être une date valide au format AAAAMMJJ.');
      if (record.DateLetEcriture && !lettrageDate) addError('Ligne ' + rowNumber + ' : DateLetEcriture doit être une date valide au format AAAAMMJJ.');
      if (validationDate && previousValidationDate && validationDate < previousValidationDate) {
        addError('Ligne ' + rowNumber + ' : les enregistrements doivent être classés chronologiquement par date de validation.');
      }
      if (validationDate) previousValidationDate = validationDate;

      var debit = null;
      var credit = null;
      var debitRaw = '';
      var creditRaw = '';
      var amountRaw = '';
      var sourceSens = '';
      var signNormalized = false;
      if (header.variant === 'debit-credit') {
        var parsedDebit = parseAmount(record.MontDebit, rowNumber, 'MontDebit', { push: addError }, true);
        var parsedCredit = parseAmount(record.MontCredit, rowNumber, 'MontCredit', { push: addError }, true);
        if (parsedDebit) debitRaw = parsedDebit.raw;
        if (parsedCredit) creditRaw = parsedCredit.raw;
        if (parsedDebit && parsedCredit) {
          var hasDebit = parsedDebit.units !== 0;
          var hasCredit = parsedCredit.units !== 0;
          if (hasDebit && hasCredit) {
            addError('Ligne ' + rowNumber + ' : un seul des champs MontDebit et MontCredit peut être non nul.');
          } else if (parsedDebit.units < 0) {
            debit = 0;
            credit = -parsedDebit.value;
            signNormalized = true;
          } else if (parsedCredit.units < 0) {
            debit = -parsedCredit.value;
            credit = 0;
            signNormalized = true;
          } else {
            debit = parsedDebit.value;
            credit = parsedCredit.value;
          }
          if (signNormalized) normalizedSignCount += 1;
          if (debit === 0 && credit === 0) addError('Ligne ' + rowNumber + ' : une ligne FEC doit porter un débit ou un crédit non nul.');
        }
      } else {
        var parsedAmount = parseAmount(record.Montant, rowNumber, 'Montant', { push: addError }, true);
        var side = String(record.Sens || '').toUpperCase();
        sourceSens = side;
        if (side !== 'D' && side !== 'C') addError('Ligne ' + rowNumber + ' : sens doit valoir D (débit) ou C (crédit).');
        if (parsedAmount) {
          amountRaw = parsedAmount.raw;
          var effectiveSide = side;
          var normalizedAmount = parsedAmount.value;
          if (parsedAmount.units < 0) {
            effectiveSide = side === 'D' ? 'C' : (side === 'C' ? 'D' : side);
            normalizedAmount = Math.abs(parsedAmount.value);
            signNormalized = true;
            normalizedSignCount += 1;
          }
          debitRaw = side === 'D' ? parsedAmount.raw : '';
          creditRaw = side === 'C' ? parsedAmount.raw : '';
          debit = effectiveSide === 'D' ? normalizedAmount : 0;
          credit = effectiveSide === 'C' ? normalizedAmount : 0;
          if (parsedAmount.value === 0) addError('Ligne ' + rowNumber + ' : Montant doit être différent de zéro.');
        }
      }

      var foreignAmount = '';
      if (record.MontDevise) {
        var parsedForeignAmount = parseAmount(record.MontDevise, rowNumber, 'MontDevise', { push: addError }, true);
        if (parsedForeignAmount) foreignAmount = parsedForeignAmount.raw;
      }
      var settlementDate = '';
      if (header.count === 21) {
        settlementDate = validDate(record.DateReglement);
        if (!settlementDate) addError('Ligne ' + rowNumber + ' : DateReglement est obligatoire et doit respecter AAAAMMJJ.');
        if (!record.ModeReglement) addError('Ligne ' + rowNumber + ' : ModeReglement est obligatoire dans la variante de trésorerie.');
      }

      if (debit == null || credit == null || !entryDate || !pieceDate || !validationDate || !record.CodeJournal || !record.NumEcriture) return;
      var key = JSON.stringify([record.CodeJournal, record.NumEcriture]);
      var entry = groupMap[key];
      if (!entry) {
        var targetReference = 'FEC-' + safeReferencePart(record.CodeJournal) + '-' + safeReferencePart(record.NumEcriture) + '-' + stableHash(key).slice(0, 6);
        entry = {
          reference: targetReference.slice(0, 100),
          journal: record.CodeJournal,
          journalLabel: record.LibJournal,
          date: entryDate,
          description: record.LibEcriture,
          sourceSystem: FORMAT,
          sourceStatus: 'posted',
          sourceId: FORMAT + ':' + fileHash + ':' + stableHash(key),
          sourceMetadata: {
            format: 'FEC béninois · arrêté du 23 avril 2020',
            fileHash: fileHash,
            sourceJournal: record.CodeJournal,
            sourceJournalLabel: record.LibJournal,
            numEcriture: record.NumEcriture,
            dateEcriture: entryDate,
            referencePiece: record.RefPiece,
            datePiece: pieceDate,
            dateValidation: validationDate,
            header: rows[0].map(function (cell) { return String(cell).trim(); }),
            delimiter: delimiterChoice.label,
            recordSeparator: recordSeparator(source),
            lines: []
          },
          lines: [],
          debitUnits: 0,
          creditUnits: 0,
          sourceOrder: recordNumber
        };
        groupMap[key] = entry;
        groups.push(entry);
      } else if (entry.date !== entryDate || entry.journalLabel !== record.LibJournal ||
          entry.sourceMetadata.referencePiece !== record.RefPiece || entry.sourceMetadata.datePiece !== pieceDate ||
          entry.sourceMetadata.dateValidation !== validationDate) {
        addError('Ligne ' + rowNumber + ' : les métadonnées de l’écriture ' + record.NumEcriture + ' diffèrent entre ses lignes.');
      }

      var debitUnits = Math.round(debit * DECIMAL_SCALE);
      var creditUnits = Math.round(credit * DECIMAL_SCALE);
      entry.debitUnits += debitUnits;
      entry.creditUnits += creditUnits;
      totalDebitUnits += debitUnits;
      totalCreditUnits += creditUnits;
      if (!Number.isSafeInteger(entry.debitUnits) || !Number.isSafeInteger(entry.creditUnits) ||
          !Number.isSafeInteger(totalDebitUnits) || !Number.isSafeInteger(totalCreditUnits)) {
        addError('Ligne ' + rowNumber + ' : les totaux du fichier dépassent la capacité numérique sûre.');
      }
      var sourceLine = {
        sourceRow: rowNumber,
        account: record.NumCompte,
        accountLabel: record.LibCompte,
        auxiliaryAccount: record.NumCompteAux,
        auxiliaryLabel: record.LibCompteAux,
        pieceReference: record.RefPiece,
        pieceDate: pieceDate,
        description: record.LibEcriture,
        debitRaw: debitRaw,
        creditRaw: creditRaw,
        amountRaw: amountRaw,
        sourceSens: sourceSens,
        signNormalized: signNormalized,
        lettrage: record.LetEcriture,
        lettrageDate: lettrageDate,
        validationDate: validationDate,
        foreignAmount: foreignAmount,
        currencyCode: record.CodeDevise,
        settlementDate: settlementDate,
        settlementMode: record.ModeReglement || '',
        natureOperation: record.NatOp || ''
      };
      entry.sourceMetadata.lines.push(sourceLine);
      entry.lines.push({
        account: record.NumCompte,
        accountLabel: record.LibCompte,
        debit: debit,
        credit: credit,
        sourceRow: rowNumber
      });
      parsedMovements.push({
        sourceRow: rowNumber,
        journal: record.CodeJournal,
        journalLabel: record.LibJournal,
        entryNumber: record.NumEcriture,
        date: entryDate,
        validationDate: validationDate,
        account: record.NumCompte,
        accountLabel: record.LibCompte,
        debit: debit,
        credit: credit,
        debitRaw: debitRaw,
        creditRaw: creditRaw,
        signNormalized: signNormalized,
        sourceEntryKey: key
      });
    });

    groups.forEach(function (entry) {
      if (entry.lines.length < 2) addError('Écriture source « ' + entry.sourceMetadata.numEcriture + ' » : au moins deux lignes sont requises.');
      if (entry.debitUnits !== entry.creditUnits) {
        addError('Écriture source « ' + entry.sourceMetadata.numEcriture + ' » du journal « ' + entry.journal + ' » non équilibrée.');
      }
      entry.sourceMetadata.totalDebit = entry.debitUnits / DECIMAL_SCALE;
      entry.sourceMetadata.totalCredit = entry.creditUnits / DECIMAL_SCALE;
      delete entry.debitUnits;
      delete entry.creditUnits;
      delete entry.sourceOrder;
    });

    if (!parsedMovements.length) addError('Le fichier ne contient aucune ligne comptable exploitable.');
    if (overflowErrors) errors.push('D’autres erreurs ont été omises ; corrigez les premières erreurs puis relancez l’analyse.');
    var warnings = [];
    if (header.count === 21) warnings.push('Les champs de règlement sont conservés dans la trace source ; aucune écriture ou conversion de trésorerie n’est calculée.');
    if (header.variant === 'amount-sense') warnings.push('Les champs Montant/sens sont convertis en colonnes débit/crédit selon D et C.');
    if (normalizedSignCount) warnings.push(normalizedSignCount + ' ligne(s) négative(s) ont été reportée(s) sur le côté comptable opposé, sans modification du montant absolu ; la source signée est conservée.');

    var metadata = {
      format: FORMAT,
      normativeReference: 'Arrêté béninois du 23 avril 2020',
      fileName: String(opts.fileName || ''),
      fileHash: fileHash,
      encoding: String(opts.encoding || 'iso-8859-15'),
      delimiter: delimiterChoice.label,
      recordSeparator: recordSeparator(source),
      headerCount: header.count,
      amountVariant: header.variant,
      lineCount: parsedMovements.length,
      entryCount: groups.length,
      normalizedSignCount: normalizedSignCount,
      totalDebit: totalDebitUnits / DECIMAL_SCALE,
      totalCredit: totalCreditUnits / DECIMAL_SCALE,
      dateRange: parsedMovements.length ? {
        firstValidationDate: parsedMovements[0].validationDate,
        lastValidationDate: parsedMovements[parsedMovements.length - 1].validationDate
      } : null
    };
    return {
      ok: errors.length === 0,
      errors: errors,
      warnings: warnings,
      entries: errors.length ? [] : groups.map(function (entry) {
        return {
          reference: entry.reference,
          journal: entry.journal,
          journalLabel: entry.journalLabel,
          date: entry.date,
          description: entry.description,
          sourceSystem: entry.sourceSystem,
          sourceStatus: entry.sourceStatus,
          sourceId: entry.sourceId,
          sourceMetadata: entry.sourceMetadata,
          lines: entry.lines
        };
      }),
      rows: parsedMovements,
      metadata: metadata
    };
  }

  root.PerfectoFecImport = {
    FORMAT: FORMAT,
    BASE_FIELDS: BASE_FIELDS.slice(),
    CASH_FIELDS: CASH_FIELDS.slice(),
    decodeBytes: decodeBytes,
    parse: parse,
    normalizeHeader: normalizeHeader
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PerfectoFecImport;
})(typeof window !== 'undefined' ? window : globalThis);
