/* =========================================================================
   PERFECTO · États financiers OHADA révisé
   - Référentiel de compteurs conservé comme source et le modèle XLSX n'est
     jamais modifié : chaque génération travaille sur une copie OOXML.
   - Les expressions des formules et les styles du modèle sont préservés.
   ========================================================================= */
(function (root, factory) {
  'use strict';
  var framework = root.PerfectoAccountingFramework;
  var balanceItems = root.PerfectoBalanceItems;
  var zip = root.fflate;
  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    if (!framework) framework = require('./accounting-framework.js');
    if (!balanceItems) balanceItems = require('./accounting-balance-items.js');
    if (!zip) zip = require('../vendor/fflate-0.8.2.js');
  }
  var api = factory(framework, balanceItems, zip);
  root.PerfectoOhadaFinancialStatements = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (AccountingFramework, BalanceItems, Fflate) {
  'use strict';

  var TEMPLATE_URL = 'assets/OHADAr-template.xlsx';
  var TEMPLATE_SHA256 = '3628d0babbf0ad201ad47c575e9f10add60623842c14a2da677d9e32199e5527';
  var DB_NAME = 'perfecto-ohada-statements-v1';
  var DB_STORE = 'active-snapshots';
  var DEFAULT_SELECTED_KEY = 'financial-statements';
  var ITEMS = [
    { key: 'financial-statements', label: 'Générer les tableaux financiers OHADA' },
    { key: 'is-declaration', label: 'Déclaration fiscales IS' },
    { key: 'iba-declaration', label: 'Déclaration IBA — Impôt sur les bénéfices d’affaires' },
    { key: 'fees-declaration', label: 'Déclaration des honoraires' },
    { key: 'separator-1', separator: true },
    { key: 'all-items-by-account', label: 'Ensemble des postes détaillés par comptes' },
    { key: 'separator-2', separator: true },
    { key: 'expenses-by-account', label: 'Charges détaillées par comptes' },
    { key: 'products-by-account', label: 'Produits détaillés par comptes' },
    { key: 'assets-by-account', label: 'Actif détaillé par comptes' },
    { key: 'liabilities-by-account', label: 'Passif détaillé par comptes' },
    { key: 'separator-3', separator: true },
    { key: 'tax-adjustments', label: 'Déductions et réintégrations fiscales' }
  ];

  var DATA_NAMES = [
    '_soNom', '_DesEnt', '_nSo', '_soSigle', '_sigle', '_soTel', '_soINSAE', '_insae',
    '_soId', '_soNumFisc', 'numFisc', '_nGref', '_soRegCom', '_regCom', '_nCod',
    '_soActp', '_cdimpo', '_soAdr', '_soAg1', '_soAg2', '_CBP', '_nuBP', '_nvilleBP',
    '_centreImpot', '_Ville', '_nPCont', '_nPSal', '_nDGS', '_nBq1', '_nCBq1',
    '_nBq2', '_nCBq2', '_nBq3', '_nCBq3', '_dAn', '_dDeb', '_dFin', '_ExerClos',
    '_ExerClot', '_ExerFin', '_ExerFin1', '_Duree', '_Mois', '_nbMois', '_sTabExer',
    'tauxImpot'
  ];

  var CLEAR_COLUMNS = {
    'ACTIF': { columns: ['D', 'E', 'F', 'G'], first: 10, last: 40 },
    'PASSIF': { columns: ['D', 'E'], first: 10, last: 37 },
    'BILAN': { columns: ['D', 'E', 'F', 'G', 'K', 'L'], first: 11, last: 39 },
    'RESULTAT': { columns: ['E', 'F'], first: 9, last: 50 },
    'TFT': { columns: ['H', 'I'], first: 11, last: 41 },
    'FICHE R2 ': { columns: ['Y'], first: 30, last: 41 }
  };
  var CLEAR_CELLS = {
    'PAGE DE GARDE': ['C42', 'E43', 'E44', 'C45', 'C46'],
    'FICHE R1 ': ['AQ14'],
    'FICHE R2 ': ['AH30', 'AH42']
  };

  function item(key) {
    return ITEMS.find(function (candidate) { return candidate.key === key && !candidate.separator; }) || null;
  }

  function buildPreview(key, exercise) {
    var selected = item(key);
    if (!selected) throw new Error('Sélectionnez un état dans la liste.');
    return { key: selected.key, label: selected.label, exercise: Number(exercise) || null, generatedLineCount: 0, financialRows: [] };
  }

  function xmlEscape(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  function xmlUnescape(value) {
    return String(value || '').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<').replace(/&amp;/g, '&');
  }

  function attr(tag, name) {
    var match = new RegExp('(?:^|\\s)' + name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&') + '="([^"]*)"').exec(tag);
    return match ? xmlUnescape(match[1]) : '';
  }

  function decode(bytes) {
    return new TextDecoder('utf-8').decode(bytes);
  }

  function encode(text) {
    return new TextEncoder().encode(String(text));
  }

  function sheetPaths(files) {
    var workbook = decode(files['xl/workbook.xml']);
    var relationships = decode(files['xl/_rels/workbook.xml.rels']);
    var targets = Object.create(null);
    relationships.replace(/<Relationship\b[^>]*\/?\s*>/g, function (tag) {
      var id = attr(tag, 'Id');
      var target = attr(tag, 'Target');
      if (id && target) targets[id] = target.charAt(0) === '/' ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
      return tag;
    });
    var paths = Object.create(null);
    workbook.replace(/<sheet\b[^>]*\/?\s*>/g, function (tag) {
      var name = attr(tag, 'name');
      var relId = attr(tag, 'r:id');
      if (!relId) relId = attr(tag, 'id');
      if (name && targets[relId]) paths[name] = targets[relId].replace(/\\/g, '/');
      return tag;
    });
    return { workbook: workbook, paths: paths };
  }

  function cellTag(xml, reference) {
    var escaped = reference.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
    var re = new RegExp('<c\\b(?=[^>]*\\br="' + escaped + '")[^>]*?(?:/\\s*>|>[\\s\\S]*?<\\/c>)');
    return re;
  }

  function cellHasFormula(cellXml) {
    return /<f(?:\s|>)/.test(cellXml);
  }

  function clearCellValue(xml, reference, clearFormulaCache) {
    var re = cellTag(xml, reference);
    var found = false;
    var updated = xml.replace(re, function (cell) {
      found = true;
      if (cellHasFormula(cell)) {
        if (!clearFormulaCache) return cell;
        return cell.replace(/<v(?:\s[^>]*)?>[\s\S]*?<\/v>|<v\s*\/>/g, '');
      }
      return cell.replace(/\s+t="(?:s|inlineStr|str|n)"/g, '').replace(/<v(?:\s[^>]*)?>[\s\S]*?<\/v>|<is>[\s\S]*?<\/is>/g, '').replace(/\s*\/>$/, '/>');
    });
    return { xml: updated, found: found };
  }

  function setCellValue(xml, reference, value) {
    var re = cellTag(xml, reference);
    var found = false;
    var skippedFormula = false;
    var isNumber = typeof value === 'number' && Number.isFinite(value);
    var payload = isNumber
      ? '<v>' + String(value) + '</v>'
      : '<is><t xml:space="preserve">' + xmlEscape(value) + '</t></is>';
    var updated = xml.replace(re, function (cell) {
      found = true;
      if (cellHasFormula(cell)) { skippedFormula = true; return cell; }
      var open = /^<c\b[^>]*>/.exec(cell);
      if (!open) return cell;
      var opening = open[0].replace(/\s+t="[^"]*"/g, '') .replace(/\/>$/, '>');
      var body = cell.slice(open[0].length).replace(/<\/c>$/, '').replace(/<v(?:\s[^>]*)?>[\s\S]*?<\/v>|<is>[\s\S]*?<\/is>/g, '');
      return opening + (isNumber ? payload : '<cTemp></cTemp>').replace('<cTemp></cTemp>', '') + body + (isNumber ? '' : payload) + '</c>';
    });
    return { xml: updated, found: found, skippedFormula: skippedFormula };
  }

  function setDefinedName(xml, name, value, numeric) {
    var escaped = name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
    var re = new RegExp('(<definedName\\b(?=[^>]*\\bname="' + escaped + '")[^>]*>)([\\s\\S]*?)(<\\/definedName>)');
    var found = false;
    var updated = xml.replace(re, function (_all, open, _old, close) {
      found = true;
      return open + (numeric ? String(value) : '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"') + close;
    });
    return { xml: updated, found: found };
  }

  function formatDate(value) {
    var text = String(value || '');
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    return match ? match[3] + '/' + match[2] + '/' + match[1] : '';
  }

  function cycleDurationMonths(start, end) {
    var a = /^(\d{4})-(\d{2})-\d{2}$/.exec(String(start || ''));
    var b = /^(\d{4})-(\d{2})-\d{2}$/.exec(String(end || ''));
    if (!a || !b) return '';
    return Math.max(0, (Number(b[1]) - Number(a[1])) * 12 + Number(b[2]) - Number(a[2]) + 1);
  }

  function commonInformationValues(rows) {
    var result = Object.create(null);
    (Array.isArray(rows) ? rows : []).forEach(function (row) {
      if (row && row.id && !row.separator) result[row.id] = String(row.value == null ? '' : row.value).trim();
    });
    return result;
  }

  function definedNameValues(options) {
    options = options || {};
    var common = commonInformationValues(options.printedInformationRows);
    var values = Object.create(null);
    DATA_NAMES.forEach(function (name) { values[name] = ''; });
    function assign(names, value) { names.forEach(function (name) { values[name] = String(value == null ? '' : value).trim(); }); }
    assign(['_soNom', '_DesEnt', '_nSo'], common['company-name']);
    assign(['_soSigle', '_sigle'], common['business-name']);
    assign(['_soTel'], common.phone);
    assign(['_soINSAE', '_insae'], common['insae-number']);
    assign(['_soId', '_soNumFisc', 'numFisc'], common['ifu-number']);
    assign(['_nGref'], common['registry-office']);
    assign(['_soRegCom', '_regCom'], common['trade-register-number']);
    assign(['_nCod'], common['activity-code']);
    assign(['_soActp'], common['main-activity']);
    assign(['_cdimpo'], common['importer-code']);
    assign(['_soAdr'], common['head-office-address']);
    assign(['_soAg1'], common['secondary-address-1']);
    assign(['_soAg2'], common['secondary-address-2']);
    assign(['_CBP'], common['bp-code']);
    assign(['_nuBP'], common['postal-box']);
    assign(['_nvilleBP'], common['bp-city']);
    assign(['_centreImpot', '_Ville'], common['tax-office-city']);
    assign(['_nDGS'], common['general-manager-name']);
    assign(['_nPCont'], common['contact-person']);
    assign(['_nPSal'], common['staff-or-cabinet']);
    assign(['_nBq1'], common['bank-1']); assign(['_nCBq1'], common['bank-1-account']);
    assign(['_nBq2'], common['bank-2']); assign(['_nCBq2'], common['bank-2-account']);
    assign(['_nBq3'], common['bank-3']); assign(['_nCBq3'], common['bank-3-account']);

    var start = String(options.cycleStart || '');
    var end = String(options.cycleEnd || '');
    var duration = cycleDurationMonths(start, end);
    assign(['_dAn'], end ? end.slice(0, 4) : '');
    assign(['_dDeb'], formatDate(start));
    assign(['_dFin'], formatDate(end));
    assign(['_ExerClos'], end ? 'Exercice clos le ' + formatDate(end) : '');
    assign(['_ExerFin'], formatDate(end) ? ' ' + formatDate(end) : '');
    assign(['_ExerFin1', '_ExerClot'], options.previousYearEnd ? ' ' + formatDate(options.previousYearEnd) : '');
    assign(['_Duree'], duration ? 'Durée (en mois) ' + duration : '');
    assign(['_sTabExer'], end ? 'Tableau financiers au ' + formatDate(end) : '');
    values._Mois = duration || '';
    values._nbMois = duration || '';
    values.tauxImpot = '';
    return values;
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

  function parsePatternLine(line) {
    var positive = [];
    var negative = [];
    String(line || '').replace(/<[^>]*>/g, ' ').split(/[\s,;]+/).forEach(function (token) {
      if (!token) return;
      var excluded = token.charAt(0) === '-';
      var code = excluded ? token.slice(1) : token;
      if (!/^[0-9?*]+$/.test(code)) return;
      (excluded ? negative : positive).push(code);
    });
    return { positive: positive, negative: negative };
  }

  function accountMatchesPattern(code, pattern) {
    var regex = '^' + pattern.split('').map(function (character) {
      return character === '*' ? '.*' : (character === '?' ? '.' : character);
    }).join('') + '$';
    try { return new RegExp(regex).test(String(code)); } catch (_error) { return false; }
  }

  function balanceItemGroups(items) {
    var groups = [];
    (items || []).forEach(function (item) {
      var depreciation = false;
      var normal = [];
      var dep = [];
      (Array.isArray(item.accounts) ? item.accounts : []).forEach(function (line) {
        if (/<\s*d[ée]pr[ée]ciation\s*>/i.test(line)) { depreciation = true; return; }
        var parsed = parsePatternLine(line);
        if (parsed.positive.length || parsed.negative.length) (depreciation ? dep : normal).push(parsed);
      });
      groups.push({ code: String(item.code), normal: normal, depreciation: dep });
    });
    return groups;
  }

  function matchGroup(code, patterns) {
    var positive = false;
    var excluded = false;
    patterns.forEach(function (group) {
      group.positive.forEach(function (pattern) { if (accountMatchesPattern(code, pattern)) positive = true; });
      group.negative.forEach(function (pattern) { if (accountMatchesPattern(code, pattern)) excluded = true; });
    });
    return positive && !excluded;
  }

  function frameworkMap(records, overrides) {
    var byCode = Object.create(null);
    (records || []).forEach(function (record) { byCode[String(record.code)] = record; });
    var overrideMap = overrides && typeof overrides === 'object' ? overrides : {};
    return function (accountCode) {
      var code = String(accountCode == null ? '' : accountCode);
      var effective = overrideMap[code];
      if (effective) return { code: code, debit: effective.debit ? { code: effective.debit } : null, credit: effective.credit ? { code: effective.credit } : null, exact: true, overridden: true };
      if (byCode[code]) return Object.assign({ exact: true, overridden: false }, byCode[code]);
      var parent = Object.keys(byCode).filter(function (candidate) { return code.indexOf(candidate) === 0; })
        .sort(function (a, b) { return b.length - a.length; })[0];
      return parent ? Object.assign({ exact: false, overridden: false, parentCode: parent }, byCode[parent]) : null;
    };
  }

  function computeStatementData(options) {
    options = options || {};
    var balances = Array.isArray(options.balance) ? options.balance : [];
    var frameworkRecords = Array.isArray(options.frameworkRecords) ? options.frameworkRecords :
      (AccountingFramework && AccountingFramework.all ? AccountingFramework.all() : []);
    var items = Array.isArray(options.balanceItems) ? options.balanceItems :
      (BalanceItems && BalanceItems.all ? BalanceItems.all() : []);
    var getMapping = frameworkMap(frameworkRecords, options.mappings);
    var groupRecords = balanceItemGroups(items);
    var assetCodes = Object.create(null);
    var liabilityCodes = Object.create(null);
    var incomeCodes = Object.create(null);
    var actRows = Object.create(null);
    var passifRows = Object.create(null);
    var resultRows = Object.create(null);
    items.forEach(function (item) {
      if (/^A/.test(item.code) || /^B/.test(item.code)) assetCodes[item.code] = item;
      if (/^[CD]/.test(item.code)) liabilityCodes[item.code] = item;
      if (/^[TRX]/.test(item.code)) incomeCodes[item.code] = item;
    });
    var values = Object.create(null);
    var postTotals = Object.create(null);
    var gaps = [];
    var mappedAccountCount = 0;
    var unmappedAccountCount = 0;
    var prefixMappedAccountCount = 0;
    var balanceByCode = Object.create(null);
    balances.forEach(function (row) { balanceByCode[String(row.code)] = row; });

    balances.forEach(function (row) {
      var code = String(row.code || '');
      var debit = Number(row.debit) || 0;
      var credit = Number(row.credit) || 0;
      var net = debit - credit;
      if (!net) return;
      var mapping = getMapping(code);
      if (!mapping || (!mapping.debit && !mapping.credit)) {
        unmappedAccountCount += 1;
        gaps.push({ sheet: '', cell: '', field: 'Compte ' + code, source: 'Balance du cycle', reason: 'Aucun rattachement Débit/Crédit disponible dans le cadre comptable.', action: 'Compléter ou corriger le rattachement du compte dans Paramètres → Cadre comptable et postes des tableaux financiers.' });
        return;
      }
      if (!mapping.exact) {
        prefixMappedAccountCount += 1;
        gaps.push({ sheet: '', cell: '', field: 'Compte ' + code, source: 'Rattachement du compte parent ' + mapping.parentCode, reason: 'Le compte n’a pas de ligne exacte dans le référentiel ; le rattachement du compte parent a été repris.', action: 'Vérifier le rattachement du compte parent ou ajouter une correction pour ce compte.' });
      }
      var side = net > 0 ? 'debit' : 'credit';
      var posting = mapping[side];
      if (!posting || !posting.code) {
        unmappedAccountCount += 1;
        gaps.push({ sheet: '', cell: '', field: 'Compte ' + code, source: 'Balance du cycle', reason: 'Le côté ' + (side === 'debit' ? 'Débit' : 'Crédit') + ' n’a pas de poste rattaché.', action: 'Définir le poste de ce côté dans le cadre comptable.' });
        return;
      }
      var postCode = String(posting.code);
      var amount = Math.abs(net);
      mappedAccountCount += 1;
      var depreciation = false;
      var matchedBalanceItem = null;
      groupRecords.forEach(function (group) {
        if (matchGroup(code, group.normal) || matchGroup(code, group.depreciation)) {
          matchedBalanceItem = group;
          if (matchGroup(code, group.depreciation)) depreciation = true;
        }
      });
      var postTotal = postTotals[postCode];
      if (!postTotal) postTotal = postTotals[postCode] = { code: postCode, debit: 0, credit: 0, normalDebit: 0, normalCredit: 0, depreciationDebit: 0, depreciationCredit: 0 };
      postTotal[side] += amount;
      postTotal[(depreciation ? 'depreciation' : 'normal') + (side === 'debit' ? 'Debit' : 'Credit')] += amount;
      var actRow = postCode;
      if (assetCodes[actRow] && !incomeCodes[actRow]) {
        var assetCell = depreciation ? 'E' : 'D';
        var assetTarget = 'ACTIF!' + assetCell + findRowByCode(options.templateIndex, 'ACTIF', actRow);
        if (!findRowByCode(options.templateIndex, 'ACTIF', actRow)) {
          gaps.push({ sheet: 'ACTIF', cell: '', field: postCode, source: 'Cadre comptable', reason: 'Le code de poste n’a pas de ligne correspondante dans la feuille ACTIF.', action: 'Vérifier le rattachement ou le modèle.' });
        } else addValue(values, assetTarget, amount);
      } else if (liabilityCodes[postCode] && !incomeCodes[postCode]) {
        var passifRow = findRowByCode(options.templateIndex, 'PASSIF', postCode);
        if (passifRow) addValue(values, 'PASSIF!D' + passifRow, amount);
      }
      var resultRow = findRowByCode(options.templateIndex, 'RESULTAT', postCode);
      if (resultRow && (postCode.charAt(0) === 'R' || postCode.charAt(0) === 'T')) {
        addValue(values, 'RESULTAT!E' + resultRow, amount);
      }
      if (!matchedBalanceItem && assetCodes[postCode]) {
        gaps.push({ sheet: 'ACTIF', cell: '', field: postCode, source: 'Postes du bilan', reason: 'Le compte n’a pas de correspondance explicite dans les lignes de comptes du poste du bilan.', action: 'Vérifier le poste et ses comptes associés.' });
      }
    });

    var totalDebit = balances.reduce(function (sum, row) { return sum + (Number(row.debit) || 0); }, 0);
    var totalCredit = balances.reduce(function (sum, row) { return sum + (Number(row.credit) || 0); }, 0);
    return {
      values: values,
      postTotals: postTotals,
      gaps: gaps,
      summary: {
        accountCount: balances.length,
        mappedAccountCount: mappedAccountCount,
        unmappedAccountCount: unmappedAccountCount,
        parentMappedAccountCount: prefixMappedAccountCount,
        totalDebit: totalDebit,
        totalCredit: totalCredit,
        balanced: Math.abs(totalDebit - totalCredit) < 0.005,
        mappedCellCount: Object.keys(values).length
      }
    };
  }

  function findRowByCode(index, sheet, code) {
    if (!index || !index[sheet]) return '';
    return index[sheet][String(code)] || '';
  }

  function addValue(values, key, amount) {
    values[key] = (Number(values[key]) || 0) + (Number(amount) || 0);
  }

  function templateIndex(files) {
    var sheets = sheetPaths(files);
    var ss = [];
    if (files['xl/sharedStrings.xml']) {
      var shared = decode(files['xl/sharedStrings.xml']);
      shared.replace(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g, function (_all, body) {
        var parts = [];
        body.replace(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g, function (_t, text) { parts.push(xmlUnescape(text)); return _t; });
        ss.push(parts.join(''));
        return _all;
      });
    }
    var index = Object.create(null);
    Object.keys(sheets.paths).forEach(function (sheetName) {
      var xml = decode(files[sheets.paths[sheetName]]);
      var rows = Object.create(null);
      xml.replace(/<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g, function (_all, rowNum, body) {
        var rowMap = Object.create(null);
        body.replace(/<c\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/c>)/g, function (cell, attributes, cellBody) {
          var opening = '<c' + attributes + '>';
          var reference = attr(opening, 'r');
          if (!/^[A-Z]+\d+$/.test(reference)) return cell;
          var formula = /<f(?:\s[^>]*)?>([\s\S]*?)<\/f>/.exec(cellBody || '');
          var raw = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(cellBody || '');
          var type = attr(opening, 't');
          var value = raw ? xmlUnescape(raw[1]) : '';
          if (type === 's' && value) value = ss[Number(value)] || '';
          rowMap[reference.replace(/\d+$/, '')] = { reference: reference, value: value, formula: formula && formula[1] || '' };
          return cell;
        });
        rows[rowNum] = rowMap;
        return _all;
      });
      index[sheetName] = { rows: rows, path: sheets.paths[sheetName], xml: xml };
    });
    return { sheets: index, workbook: sheets.workbook };
  }

  function postCodeRows(template, sheet, codeColumn) {
    var result = Object.create(null);
    var target = template && template.sheets[sheet];
    if (!target) return result;
    Object.keys(target.rows).forEach(function (rowNumber) {
      var row = target.rows[rowNumber] || {};
      var cell = row[codeColumn];
      if (!cell || !cell.value) return;
      var match = /^\s*([A-Z]{1,3})\b/.exec(String(cell.value));
      if (match) result[match[1]] = rowNumber;
    });
    return result;
  }

  function workbookWriteMap(options, template) {
    var input = options || {};
    var data = computeStatementData(Object.assign({}, input, { templateIndex: {
      ACTIF: postCodeRows(template, 'ACTIF', 'A'), PASSIF: postCodeRows(template, 'PASSIF', 'A'), RESULTAT: postCodeRows(template, 'RESULTAT', 'A')
    } }));
    var values = Object.assign(Object.create(null), data.values);
    var actRows = postCodeRows(template, 'ACTIF', 'A');
    var passRows = postCodeRows(template, 'PASSIF', 'A');
    var resultRows = postCodeRows(template, 'RESULTAT', 'A');
    var bilanLeft = postCodeRows(template, 'BILAN', 'A');
    var bilanRight = postCodeRows(template, 'BILAN', 'H');
    Object.keys(actRows).forEach(function (code) {
      var row = actRows[code];
      ['D','E'].forEach(function (column) {
        var value = values['ACTIF!' + column + row];
        if (value != null) values['BILAN!' + column + (bilanLeft[code] || '')] = value;
      });
      if (values['ACTIF!F' + row] != null) values['BILAN!F' + (bilanLeft[code] || '')] = values['ACTIF!F' + row];
    });
    Object.keys(passRows).forEach(function (code) {
      var row = passRows[code];
      var targetRow = bilanRight[code];
      if (targetRow && values['PASSIF!D' + row] != null) values['BILAN!K' + targetRow] = values['PASSIF!D' + row];
    });
    return { values: values, gaps: data.gaps, summary: data.summary, rowMaps: { actRows: actRows, passRows: passRows, resultRows: resultRows } };
  }

  function clearSampleValues(files, template) {
    var cleared = 0;
    Object.keys(template.sheets).forEach(function (sheetName) {
      var cachedSheet = template.sheets[sheetName];
      var cachedXml = cachedSheet.xml.replace(/<c\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/c>)/g, function (cell, attributes, body) {
        if (!body || !/<f(?:\s|>)/.test(body)) return cell;
        return cell.replace(/<v(?:\s[^>]*)?>[\s\S]*?<\/v>|<v\s*\/>/g, '');
      });
      cachedSheet.xml = cachedXml;
      files[cachedSheet.path] = encode(cachedXml);
    });
    Object.keys(CLEAR_COLUMNS).forEach(function (sheetName) {
      var definition = CLEAR_COLUMNS[sheetName];
      var sheet = template.sheets[sheetName];
      if (!sheet) return;
      var xml = sheet.xml;
      for (var row = definition.first; row <= definition.last; row += 1) {
        definition.columns.forEach(function (column) {
          var result = clearCellValue(xml, column + row, true);
          if (result.found && result.xml !== xml) cleared += 1;
          xml = result.xml;
        });
      }
      sheet.xml = xml;
      files[sheet.path] = encode(xml);
    });
    Object.keys(CLEAR_CELLS).forEach(function (sheetName) {
      var sheet = template.sheets[sheetName];
      if (!sheet) return;
      var xml = sheet.xml;
      CLEAR_CELLS[sheetName].forEach(function (reference) {
        var result = clearCellValue(xml, reference, false);
        if (result.found && result.xml !== xml) cleared += 1;
        xml = result.xml;
      });
      sheet.xml = xml;
      files[sheet.path] = encode(xml);
    });
    Object.keys(template.sheets).forEach(function (sheetName) {
      if (!/^NOTE\s/i.test(sheetName) || sheetName === 'NOTE 36') return;
      var sheet = template.sheets[sheetName];
      var xml = sheet.xml;
      xml = xml.replace(/<c\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/c>)/g, function (cell, attributes, body) {
        if (!body || /<f(?:\s|>)/.test(body)) return cell;
        var opening = '<c' + attributes + '>';
        var type = attr(opening, 't');
        if (type && type !== 'n') return cell;
        if (!/<v(?:\s[^>]*)?>\s*(?:-?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?)\s*<\/v>/.test(body)) return cell;
        cleared += 1;
        return cell.replace(/\s+t="n"/g, '').replace(/<v(?:\s[^>]*)?>[\s\S]*?<\/v>/g, '');
      });
      sheet.xml = xml;
      files[sheet.path] = encode(xml);
    });
    return cleared;
  }

  function applyDefinedNames(workbookXml, options) {
    var values = definedNameValues(options);
    DATA_NAMES.forEach(function (name) {
      var numeric = name === '_Mois' || name === '_nbMois';
      var result = setDefinedName(workbookXml, name, values[name], numeric && values[name] !== '');
      workbookXml = result.xml;
    });
    return setCalculationOnOpen(workbookXml);
  }

  function generateWorkbook(templateBytes, options) {
    if (!Fflate || typeof Fflate.unzipSync !== 'function' || typeof Fflate.zipSync !== 'function') throw new Error('Le module local de traitement Excel n’est pas disponible.');
    var bytes = templateBytes instanceof Uint8Array ? templateBytes : new Uint8Array(templateBytes || []);
    if (!bytes.length) throw new Error('Le modèle OHADA embarqué est vide ou inaccessible.');
    var files = Fflate.unzipSync(bytes);
    var template = templateIndex(files);
    var population = workbookWriteMap(options, template);
    var clearedSampleCellCount = clearSampleValues(files, template);

    Object.keys(population.values).forEach(function (key) {
      var split = key.split('!');
      var sheetName = split[0];
      var reference = split[1];
      var sheet = template.sheets[sheetName];
      if (!sheet) {
        population.gaps.push({ sheet: sheetName, cell: reference, field: reference, source: 'Données comptables', reason: 'Feuille introuvable dans le modèle.', action: 'Vérifier le modèle OHADA intégré.' });
        return;
      }
      var result = setCellValue(sheet.xml, reference, population.values[key]);
      if (result.skippedFormula) {
        population.gaps.push({ sheet: sheetName, cell: reference, field: reference, source: 'Données comptables', reason: 'La cellule cible contient une formule, conservée sans modification.', action: 'Vérifier la correspondance avant de la corriger.' });
        return;
      }
      if (!result.found) {
        population.gaps.push({ sheet: sheetName, cell: reference, field: reference, source: 'Données comptables', reason: 'Cellule de saisie absente du modèle.', action: 'Vérifier la cellule cible dans le modèle.' });
        return;
      }
      sheet.xml = result.xml;
      files[sheet.path] = encode(result.xml);
    });

    var workbookXml = decode(files['xl/workbook.xml']);
    files['xl/workbook.xml'] = encode(applyDefinedNames(workbookXml, options));
    return {
      bytes: Fflate.zipSync(files, { level: 6 }),
      gaps: population.gaps,
      summary: population.summary,
      clearedSampleCellCount: clearedSampleCellCount,
      formulaPreservation: true
    };
  }

  function csvEscape(value) {
    var text = String(value == null ? '' : value);
    return /[";\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }

  function buildGapReport(gaps, summary, options) {
    var rows = [
      ['Feuille', 'Cellule', 'Rubrique', 'Source attendue', 'Constat', 'Action proposée'],
      ['État général', '', 'Comptes traités', '', String(summary && summary.accountCount || 0), 'Contrôler la balance avant toute validation.'],
      ['État général', '', 'Comptes rattachés', '', String(summary && summary.mappedAccountCount || 0), 'Vérifier les correspondances du cadre comptable.'],
      ['État général', '', 'Comptes non rattachés', '', String(summary && summary.unmappedAccountCount || 0), 'Compléter les rattachements manquants.'],
      ['Formules conservées', '', 'Valeurs nulles affichées par formule', 'Cellules sources de chaque formule du modèle', 'Les formules originales sont intactes. Si Excel affiche zéro pour une rubrique dont les cellules sources sont vides, ce résultat est calculé par formule et n’est pas confirmé par une donnée source.', 'Vérifier les cellules sources documentées. Ne pas remplacer ni modifier les formules du modèle.'],
      ['Exercice comparatif', '', 'N-1', 'Balance de l’exercice précédent', 'Aucune source comparative fournie pour le dossier actif.', 'Importer ou sélectionner l’exercice précédent avant de renseigner les colonnes comparatives.'],
      ['TFT', '', 'Flux de trésorerie', 'Classification validée des flux opérationnels, d’investissement et de financement', 'Aucune règle complète de classement n’est disponible dans le modèle comptable actuel.', 'Compléter et valider le classement des flux avant de renseigner le TFT.'],
      ['Notes 1 à 36', '', 'Données annexes', 'Registres et justificatifs propres aux notes', 'Les notes sans source structurée restent sans montants d’exemple.', 'Intégrer les sources métier concernées et valider leurs règles de passage.']
    ];
    (gaps || []).forEach(function (gap) { rows.push([gap.sheet, gap.cell, gap.field, gap.source, gap.reason, gap.action]); });
    (options && Array.isArray(options.printedInformationRows) ? options.printedInformationRows : []).forEach(function (field) {
      if (!field || field.separator || String(field.value || '').trim()) return;
      rows.push(['Informations communes', '', field.label || field.id, 'Configuration des informations communes aux états imprimés', 'Aucune valeur source n’est renseignée pour ce champ.', 'Compléter le champ dans les informations communes du dossier si cette donnée est applicable.']);
    });
    var dossierName = options && options.dossierName || '';
    rows.splice(1, 0, ['Dossier', '', dossierName, '', 'Rapport généré pour le cycle actif.', 'Les valeurs nulles éventuellement affichées par formule sont signalées dans la ligne « Formules conservées » ci-dessous.']);
    return '\uFEFF' + rows.map(function (row) { return row.map(csvEscape).join(';'); }).join('\r\n');
  }

  function openDatabase() {
    if (typeof indexedDB === 'undefined') return Promise.reject(new Error('Le stockage local de fichiers n’est pas disponible dans ce navigateur.'));
    return new Promise(function (resolve, reject) {
      var request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath: 'dossierId' });
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error('Ouverture du stockage OHADA impossible.')); };
    });
  }

  function loadTemplate(fetchFunction) {
    var fetcher = fetchFunction || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    if (!fetcher) return Promise.reject(new Error('Le chargement local du modèle OHADA n’est pas disponible.'));
    return fetcher(TEMPLATE_URL, { cache: 'no-store' }).then(function (response) {
      if (!response || !response.ok) throw new Error('Le modèle OHADA intégré n’a pas pu être chargé.');
      return response.arrayBuffer();
    }).then(function (buffer) {
      var bytes = new Uint8Array(buffer);
      return verifyTemplateBytes(bytes).then(function (valid) {
        if (!valid) throw new Error('Le modèle OHADA intégré ne correspond pas à la ressource de référence.');
        return bytes;
      });
    });
  }

  function verifyTemplateBytes(bytes) {
    var cryptoApi = (typeof crypto !== 'undefined' && crypto.subtle) ? crypto : null;
    if (cryptoApi) return cryptoApi.subtle.digest('SHA-256', bytes).then(function (digest) {
      var actual = Array.prototype.map.call(new Uint8Array(digest), function (value) { return value.toString(16).padStart(2, '0'); }).join('');
      return actual === TEMPLATE_SHA256;
    });
    if (typeof require === 'function') {
      try {
        var nodeCrypto = require('crypto');
        var actualNode = nodeCrypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex');
        return Promise.resolve(actualNode === TEMPLATE_SHA256);
      } catch (_error) { return Promise.resolve(false); }
    }
    return Promise.resolve(false);
  }

  function saveActiveSnapshot(dossierId, record) {
    return openDatabase().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).put(Object.assign({}, record, { dossierId: String(dossierId) }));
        tx.oncomplete = function () { db.close(); resolve(true); };
        tx.onerror = function () { db.close(); reject(tx.error || new Error('Enregistrement de l’état OHADA impossible.')); };
        tx.onabort = function () { db.close(); reject(tx.error || new Error('Enregistrement de l’état OHADA interrompu.')); };
      });
    });
  }

  function readActiveSnapshot(dossierId) {
    return openDatabase().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(DB_STORE, 'readonly');
        var request = tx.objectStore(DB_STORE).get(String(dossierId));
        request.onsuccess = function () { resolve(request.result || null); };
        request.onerror = function () { reject(request.error || new Error('Lecture de l’état OHADA impossible.')); };
        tx.oncomplete = function () { db.close(); };
        tx.onerror = function () { db.close(); };
      });
    });
  }

  function deleteActiveSnapshot(dossierId) {
    return openDatabase().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).delete(String(dossierId));
        tx.oncomplete = function () { db.close(); resolve(true); };
        tx.onerror = function () { db.close(); reject(tx.error || new Error('Suppression de l’état OHADA impossible.')); };
        tx.onabort = function () { db.close(); reject(tx.error || new Error('Suppression de l’état OHADA interrompue.')); };
      });
    });
  }

  function itemizeTemplateCells(bytes) {
    if (!Fflate) throw new Error('Le module local Excel est indisponible.');
    var files = Fflate.unzipSync(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []));
    var template = templateIndex(files);
    var formulaCount = 0;
    Object.keys(template.sheets).forEach(function (name) {
      var xml = template.sheets[name].xml;
      xml.replace(/<c\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/c>)/g, function (_cell, _attributes, body) { if (body && /<f(?:\s|>)/.test(body)) formulaCount += 1; return _cell; });
    });
    return { sheets: Object.keys(template.sheets), formulaCount: formulaCount, index: template };
  }

  return Object.freeze({
    ITEMS: Object.freeze(ITEMS.map(function (candidate) { return Object.freeze(candidate); })),
    DEFAULT_SELECTED_KEY: DEFAULT_SELECTED_KEY,
    TEMPLATE_URL: TEMPLATE_URL,
    TEMPLATE_SHA256: TEMPLATE_SHA256,
    item: item,
    buildPreview: buildPreview,
    computeStatementData: computeStatementData,
    generateWorkbook: generateWorkbook,
    buildGapReport: buildGapReport,
    definedNameValues: definedNameValues,
    loadTemplate: loadTemplate,
    verifyTemplateBytes: verifyTemplateBytes,
    templateIndex: function (files) { return templateIndex(files); },
    itemizeTemplateCells: itemizeTemplateCells,
    saveActiveSnapshot: saveActiveSnapshot,
    readActiveSnapshot: readActiveSnapshot,
    deleteActiveSnapshot: deleteActiveSnapshot
  });
});
