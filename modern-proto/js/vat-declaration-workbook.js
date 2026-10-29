/* =========================================================================
   PERFECTO · Préparation du formulaire officiel mensuel de TVA
   Les cellules inconnues restent vides; le rapport CSV les signale.
   Aucun journal de liquidation n’est créé par ce module.
   ========================================================================= */
(function (root) {
  'use strict';

  var Fflate = root.fflate;
  var TEMPLATE_URL = 'assets/vat-declaration-template.xlsx';
  var TEMPLATE_SHA256 = '10592036669e4a69b5551ff0e8050036b220daa53ef3b19d528ef05f76f7d970';

  function round(value, places) {
    var digits = Math.max(0, Math.min(6, Number(places) || 0));
    var factor = Math.pow(10, digits);
    return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
  }

  function rowByKey(report, key) {
    return report && Array.isArray(report.rows) ? report.rows.find(function (row) { return row.key === key; }) || null : null;
  }

  function signedTotal(report, key, direction) {
    var row = rowByKey(report, key);
    if (!row || !Array.isArray(row.selectors) || !row.selectors.length) return null;
    return round(row.accounts.reduce(function (sum, account) {
      var isDebitNormal = String(account.code || '').charAt(0) === '6';
      if (direction === 'debit-credit') return sum + (isDebitNormal ? account.debit - account.credit : account.debit - account.credit);
      if (direction === 'base') return sum + (isDebitNormal ? account.debit - account.credit : account.credit - account.debit);
      return sum + account.credit - account.debit;
    }, 0), report.decimalPlaces);
  }

  function gap(gaps, message, category) {
    gaps.push({ entryId: '', reference: '', date: '', account: '', category: category || 'declaration', message: message });
  }

  function calculate(preparation) {
    preparation = preparation || {};
    var report = preparation.movementReport || {};
    var configuration = preparation.configuration || {};
    var declaration = preparation.declaration || {};
    var decimalPlaces = Number(preparation.decimalPlaces) || 0;
    var values = Object.create(null);
    var gaps = (report.gaps || []).slice();
    var numeric = Object.create(null);

    function set(name, value, isNumeric) {
      values[name] = value == null ? '' : value;
      numeric[name] = !!isNumeric;
    }
    function fromRow(name, key, direction, label) {
      var total = signedTotal(report, key, direction);
      if (total == null) gap(gaps, 'Comptes non configurés pour « ' + label + ' »; la cellule est restée vide.', key);
      set(name, total, total != null);
      return total;
    }

    var exempt = fromRow('mVenExo', 'exemptLocalSales', 'base', 'ventes locales exonérées');
    var taxableExports = fromRow('mVenExp', 'taxableExports', 'base', 'exportations taxables');
    var nonTaxableExports = fromRow('mVenExpExo', 'nonTaxableExports', 'base', 'exportations non taxables');
    var taxableSales = fromRow('mVenTVA', 'taxableSales', 'base', 'autres opérations taxables');
    var internalBase = fromRow('mLivTVA', 'taxableInternalConsumption', 'base', 'livraisons à soi-même / consommations internes');
    var bases = [exempt, taxableExports, nonTaxableExports, taxableSales];
    var totalBase = bases.every(function (value) { return value != null; }) ? round(bases.reduce(function (sum, value) { return sum + value; }, 0), decimalPlaces) : null;

    var collectedSales = fromRow('mTVABrut_sales', 'collectedSales', 'credit-debit', 'TVA exigible sur ventes');
    var collectedInternal = fromRow('mTVABrut_internal', 'collectedInternalConsumption', 'credit-debit', 'TVA exigible sur livraisons à soi-même');
    var serviceRelease = preparation.serviceVatRelease;
    var serviceVatBasis = configuration.serviceVatBasisConfirmed === true ? configuration.serviceVatBasis : '';
    var serviceSelectors = Array.isArray(configuration.serviceExigibleVatAccounts) ? configuration.serviceExigibleVatAccounts : [];
    var serviceMovement = report.serviceExigibleMovement || null;
    var serviceReleaseAmount = serviceSelectors.length && serviceMovement
      ? Number(serviceMovement.netCredit) || 0
      : (serviceVatBasis === 'cash' && serviceRelease && serviceRelease.ok && serviceRelease.confirmed === true && serviceRelease.total != null ? serviceRelease.total : null);
    if (!serviceVatBasis) gap(gaps, 'Régime d’exigibilité des prestations de services non confirmé; TVA brute laissée incomplète.', 'serviceVatBasis');
    if (serviceVatBasis === 'debits' && !serviceSelectors.length) {
      serviceReleaseAmount = null;
      gap(gaps, 'Comptes de TVA exigible sur services non configurés pour le régime des débits; TVA brute laissée incomplète.', 'serviceExigibleVatAccounts');
    }
    if (serviceVatBasis === 'cash' && !serviceSelectors.length && !(serviceRelease && serviceRelease.ok && serviceRelease.confirmed === true)) {
      gap(gaps, 'Comptes de TVA exigible sur services non configurés et ventilation TVA par ligne non confirmée; TVA brute laissée incomplète.', 'serviceExigibleVatAccounts');
    }
    var overlapSelectors = function (left, right) {
      return left.some(function (a) { var ap = String(a).replace(/\*$/, ''); return right.some(function (b) { var bp = String(b).replace(/\*$/, ''); return ap.indexOf(bp) === 0 || bp.indexOf(ap) === 0; }); });
    };
    if (overlapSelectors(serviceSelectors, (configuration.accounts && configuration.accounts.collectedSales) || [])) {
      serviceReleaseAmount = null;
      gap(gaps, 'Les comptes de TVA exigible sur services recouvrent les comptes de TVA collectée sur ventes; risque de double comptabilisation, montant laissé inconnu.', 'serviceExigibleVatAccounts');
    }
    if (serviceVatBasis === 'cash' && serviceSelectors.length && serviceRelease && serviceRelease.candidateTotal != null && serviceMovement && Math.abs(serviceRelease.candidateTotal - serviceMovement.netCredit) > Math.pow(10, -decimalPlaces) / 2) {
      gap(gaps, 'Écart entre la TVA comptabilisée sur les comptes de services exigibles et l’estimation des affectations; rapprocher les pièces et les lignes de TVA.', 'serviceVatReconciliation');
    }
    var collected = collectedSales != null && collectedInternal != null && serviceReleaseAmount != null
      ? round(collectedSales + collectedInternal + serviceReleaseAmount, decimalPlaces) : null;
    if (serviceVatBasis === 'cash') {
      if (serviceRelease && serviceRelease.gaps) serviceRelease.gaps.forEach(function (item) { gap(gaps, item.message || String(item), 'serviceVat'); });
      else if (!serviceRelease) gap(gaps, 'Le montant de TVA sur services exigible par encaissements n’a pas été calculé.', 'serviceVat');
    }
    set('mTVABrut', collected, collected != null);
    if (collected == null) gap(gaps, 'TVA brute incomplète; la cellule de déclaration est restée vide.', 'collectedVat');

    var fullOperating = signedTotal(report, 'fullDeductibleOperatingPurchases', 'debit-credit');
    var prorataOperating = signedTotal(report, 'prorataDeductibleOperatingPurchases', 'debit-credit');
    var fullFixed = signedTotal(report, 'fullDeductibleFixedAssets', 'debit-credit');
    var prorataFixed = signedTotal(report, 'prorataDeductibleFixedAssets', 'debit-credit');
    var prorataInput = configuration.prorataPercent;
    var prorata = prorataInput == null || String(prorataInput).trim() === '' ? NaN : Number(prorataInput);
    var unsupportedRegularisation = rowByKey(report, 'fullDeductibleRegularisation') && rowByKey(report, 'fullDeductibleRegularisation').selectors.length > 0;
    if (unsupportedRegularisation) {
      gap(gaps, 'Le mapping « achats à régulariser » est visible dans le relevé, mais son traitement n’est pas défini pour les rubriques du formulaire; le total déductible reste inconnu.', 'fullDeductibleRegularisation');
    }
    var withholding = rowByKey(report, 'sourceWithholding');
    var unsupportedWithholding = !!(withholding && withholding.selectors.length);
    if (unsupportedWithholding) gap(gaps, 'Une rubrique de retenue à la source est paramétrée, mais son traitement n’est pas intégré au formulaire; les totaux déductibles restent inconnus.', 'withholding');
    var deductionsConfigured = [
      ['fullDeductibleOperatingPurchases', fullOperating, 'achats d’exploitation déductibles à 100 %'],
      ['prorataDeductibleOperatingPurchases', prorataOperating, 'achats d’exploitation soumis au prorata'],
      ['fullDeductibleFixedAssets', fullFixed, 'immobilisations déductibles à 100 %'],
      ['prorataDeductibleFixedAssets', prorataFixed, 'immobilisations soumises au prorata']
    ];
    deductionsConfigured.forEach(function (item) {
      if (!configuration.accounts || !configuration.accounts[item[0]] || !configuration.accounts[item[0]].length) gap(gaps, 'Affectation comptable à confirmer pour « ' + item[2] + ' ». La déduction correspondante est laissée vide.', item[0]);
    });
    if (!Number.isFinite(prorata) || prorata < 0 || prorata > 100) gap(gaps, 'Prorata non renseigné ou invalide; les rubriques de déduction sont laissées vides.', 'prorata');
    var validDeductionMapping = !unsupportedRegularisation && !unsupportedWithholding && deductionsConfigured.every(function (item) { return item[1] != null; });
    var deductibleOperating = validDeductionMapping && Number.isFinite(prorata) ? round(fullOperating + prorataOperating * prorata / 100, decimalPlaces) : null;
    var deductibleFixed = validDeductionMapping && Number.isFinite(prorata) ? round(fullFixed + prorataFixed * prorata / 100, decimalPlaces) : null;
    set('mTVAAch', deductibleOperating, deductibleOperating != null);
    set('mTVAIm', deductibleFixed, deductibleFixed != null);

    var credit = declaration.credit === '' || declaration.credit == null ? null : Number(declaration.credit);
    var complement = declaration.extraDeduction === '' || declaration.extraDeduction == null ? null : Number(declaration.extraDeduction);
    var repayment = declaration.extraAmount === '' || declaration.extraAmount == null ? null : Number(declaration.extraAmount);
    [ ['mCrRep', credit, 'Crédit reporté'], ['mTVAReg', complement, 'Complément de déduction'], ['augAPayer', repayment, 'Reversement à effectuer'] ].forEach(function (item) {
      if (item[1] == null || !Number.isFinite(item[1]) || item[1] < 0) gap(gaps, '« ' + item[2] + ' » non renseigné; la cellule est restée vide.', 'manual');
      set(item[0], item[1] != null && Number.isFinite(item[1]) && item[1] >= 0 ? round(item[1], decimalPlaces) : null, item[1] != null && Number.isFinite(item[1]) && item[1] >= 0);
    });

    var deductionsTotal = [credit, deductibleOperating, deductibleFixed, complement, repayment].every(function (value) { return value != null && Number.isFinite(value); })
      ? round(credit + deductibleOperating + deductibleFixed + complement - repayment, decimalPlaces) : null;
    var net = collected != null && deductionsTotal != null ? round(collected - deductionsTotal, decimalPlaces) : null;
    var vatDue = net == null ? null : Math.max(0, net);
    var creditToCarry = net == null ? null : Math.max(0, -net);
    set('mTVANet', vatDue, vatDue != null);
    set('mTVACr', creditToCarry, creditToCarry != null);
    if (net == null) gap(gaps, 'TVA nette et crédit à reporter non calculés : au moins une rubrique nécessaire reste inconnue.', 'netVat');

    return {
      ok: true, values: values, numeric: numeric, gaps: gaps,
      totals: { bases: totalBase, collectedVat: collected, deductibleOperating: deductibleOperating, deductibleFixed: deductibleFixed, deductions: deductionsTotal, net: net, vatDue: vatDue, creditToCarry: creditToCarry },
      completeness: { bases: bases.every(function (value) { return value != null; }), collectedVat: collected != null, deductions: deductionsTotal != null, net: net != null }
    };
  }

  function escapeXml(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }
  function unescapeXml(value) {
    return String(value || '').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
  }
  function encode(value) { return new TextEncoder().encode(String(value)); }
  function decode(value) { return new TextDecoder('utf-8').decode(value); }
  function setDefinedName(xml, name, value, isNumeric) {
    var expression = new RegExp('(<definedName\\b(?=[^>]*\\bname="' + name + '")[^>]*>)([\\s\\S]*?)(<\\/definedName>)');
    var found = false;
    var text = isNumeric && value != null && Number.isFinite(Number(value)) ? String(value) : '"' + escapeXml(String(value == null ? '' : value).replace(/"/g, '""')) + '"';
    var result = xml.replace(expression, function (_all, open, _old, close) { found = true; return open + text + close; });
    if (!found) throw new Error('Nom défini absent du modèle TVA : ' + name);
    return result;
  }
  function setCache(cellXml, reference, value, isNumeric) {
    var expression = new RegExp('(<c\\b(?=[^>]*\\br="' + reference + '")[^>]*>)([\\s\\S]*?)(<\\/c>)');
    var found = false;
    var result = cellXml.replace(expression, function (_all, open, body, close) {
      if (!/<f(?:\s[^>]*)?>[\s\S]*?<\/f>/.test(body)) return open + body + close;
      found = true;
      var numeric = isNumeric && value != null && value !== '' && Number.isFinite(Number(value));
      var nextOpen = open.replace(/\s+t="[^"]*"/g, '');
      if (!numeric && !/\s+t=/.test(nextOpen)) nextOpen = nextOpen.replace(/>$/, ' t="str">');
      var cached = numeric ? String(value) : escapeXml(value == null ? '' : value);
      var nextBody = /<v(?:\s[^>]*)?>[\s\S]*?<\/v>/.test(body)
        ? body.replace(/<v(?:\s[^>]*)?>[\s\S]*?<\/v>/, '<v>' + cached + '</v>')
        : body.replace(/<\/f>/, '</f><v>' + cached + '</v>');
      return nextOpen + nextBody + close;
    });
    return { xml: result, found: found };
  }
  function formulaCount(xml) { var matches = xml.match(/<f(?:\s[^>]*)?>/g); return matches ? matches.length : 0; }

  function commonInfo(rows) {
    var map = Object.create(null);
    (Array.isArray(rows) ? rows : []).forEach(function (item) { if (item && item.id && !item.separator) map[item.id] = String(item.value == null ? '' : item.value).trim(); });
    return map;
  }
  function identityGaps(info, declaration) {
    declaration = declaration || {};
    var missing = [];
    [
      ['N° INSAE', info['insae-number']], ['N° IFU', info['ifu-number']], ['Raison sociale', info['company-name']],
      ['Nom commercial', info['business-name']], ['Adresse', info['head-office-address']],
      ['Adresse complémentaire 1', info['secondary-address-1']], ['Adresse complémentaire 2', info['secondary-address-2']],
      ['Ville', declaration.city || info['signature-city']], ['Date déclarant', declaration.declarantDate],
      ['Mode de paiement', declaration.paymentMethod]
    ].forEach(function (item) { if (!String(item[1] || '').trim()) missing.push(item[0]); });
    if (declaration.paymentMethod === 'cheque') {
      if (!String(declaration.bank || '').trim()) missing.push('Banque');
      if (!String(declaration.cheque || '').trim()) missing.push('Numéro de chèque');
    }
    return missing;
  }
  function monthLabel(period) {
    var parts = String(period || '').split('-');
    if (!parts[0] || !parts[1]) return '';
    var text = new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, 1)));
    return text.charAt(0).toLocaleUpperCase('fr-FR') + text.slice(1);
  }
  function shortDate(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    return match ? match[3] + '/' + match[2] + '/' + match[1] : '';
  }
  function templateValues(preparation, printedRows) {
    var calculated = preparation.calculated;
    var values = Object.assign(Object.create(null), calculated.values);
    var numeric = Object.assign(Object.create(null), calculated.numeric);
    delete values.mTVABrut_sales;
    delete values.mTVABrut_internal;
    delete numeric.mTVABrut_sales;
    delete numeric.mTVABrut_internal;
    var info = commonInfo(printedRows);
    function put(key, value, isNumeric) { values[key] = value == null ? '' : value; numeric[key] = !!isNumeric; }
    put('PerDeclaration', 'Déclaration de ' + monthLabel(preparation.period) + ' ' + preparation.period.slice(0, 4));
    put('soINSAE', info['insae-number'] || '');
    put('soIFU', info['ifu-number'] || '');
    put('soNom', info['company-name'] || '');
    put('soSigle', info['business-name'] || '');
    put('soAdr', info['head-office-address'] || '');
    put('soAg1', info['secondary-address-1'] || '');
    put('soAg2', info['secondary-address-2'] || '');
    put('Ville', preparation.declaration.city || info['signature-city'] || '');
    put('dSign', shortDate(preparation.declaration.declarantDate));
    put('Mode', preparation.declaration.paymentMethod === 'cash' ? 'En espèces' : (preparation.declaration.paymentMethod === 'cheque' ? 'Chèque' : ''));
    put('Bq', preparation.declaration.paymentMethod === 'cheque' ? preparation.declaration.bank : '');
    put('Chq', preparation.declaration.paymentMethod === 'cheque' ? preparation.declaration.cheque : '');
    put('Motif', preparation.declaration.extraReason || '');
    put('mTVADed', calculated.totals.deductions, calculated.totals.deductions != null);
    var derived = Object.create(null);
    derived.N22 = calculated.totals.bases;
    derived.M40 = calculated.totals.deductions;
    derived.H45 = calculated.totals.deductions;
    derived.H47 = calculated.totals.vatDue;
    derived.H49 = calculated.totals.creditToCarry;
    derived.N44 = calculated.totals.vatDue;
    return { values: values, numeric: numeric, derived: derived, info: info };
  }

  function csvEscape(value) { return '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"'; }
  function buildGapCsv(preparation, printedRows) {
    var gaps = preparation.calculated.gaps.slice();
    var info = commonInfo(printedRows);
    identityGaps(info, preparation.declaration).forEach(function (field) {
      gaps.push({ entryId: '', reference: '', date: '', account: '', category: 'identity', message: 'Champ « ' + field + ' » non renseigné; laissé vide dans le classeur.' });
    });
    var rows = [['Pièce', 'Référence', 'Date', 'Compte', 'Rubrique', 'Point à vérifier']];
    gaps.forEach(function (item) { rows.push([item.entryId, item.reference, item.date, item.account, item.category, item.message]); });
    return '\ufeff' + rows.map(function (row) { return row.map(csvEscape).join(';'); }).join('\r\n');
  }

  function generateWorkbook(templateBytes, preparation, printedRows) {
    if (!Fflate || typeof Fflate.unzipSync !== 'function' || typeof Fflate.zipSync !== 'function') throw new Error('Le module local de création Excel est indisponible.');
    var files = Fflate.unzipSync(templateBytes instanceof Uint8Array ? templateBytes : new Uint8Array(templateBytes || []));
    if (!files['xl/workbook.xml'] || !files['xl/worksheets/sheet1.xml']) throw new Error('Le modèle officiel TVA a une structure inattendue.');
    var workbook = decode(files['xl/workbook.xml']);
    var sheet = decode(files['xl/worksheets/sheet1.xml']);
    var originalCount = formulaCount(sheet);
    var population = templateValues(preparation, printedRows);
    Object.keys(population.values).forEach(function (name) { workbook = setDefinedName(workbook, name, population.values[name], population.numeric[name]); });
    var cacheByFormula = Object.create(null);
    Object.keys(population.values).forEach(function (name) { cacheByFormula[name] = { value: population.values[name], numeric: population.numeric[name] }; });
    var derivedExpressions = {
      'mVenExo+mVenExp+mVenExpExo+mVenTVA': population.derived.N22,
      'M28+M30+M32+M34-M37': population.derived.M40,
      M40: population.derived.H45,
      H47: population.derived.N44
    };
    Object.keys(derivedExpressions).forEach(function (formula) { cacheByFormula[formula] = { value: derivedExpressions[formula], numeric: derivedExpressions[formula] != null }; });
    sheet = sheet.replace(/<c\b[^>]*\/>|<c\b[^>]*>[\s\S]*?<\/c>/g, function (cell) {
      var formula = /<f(?:\s[^>]*)?>([\s\S]*?)<\/f>/.exec(cell);
      if (!formula) return cell;
      var key = unescapeXml(formula[1]).trim().replace(/\s+/g, '');
      var matched = Object.keys(cacheByFormula).find(function (candidate) { return candidate.replace(/\s+/g, '') === key; });
      if (!matched) return cell;
      var ref = /\br="([^"]+)"/.exec(/^<c\b[^>]*>/.exec(cell)[0]);
      if (!ref) return cell;
      return setCache(cell, ref[1], cacheByFormula[matched].value, cacheByFormula[matched].numeric).xml;
    });
    // Recalculate automatically only when all declaration bases and net amounts are known.
    // An incomplete workbook keeps blank formula caches instead of presenting partial totals as final.
    var complete = !!(preparation.calculated.completeness.bases && preparation.calculated.completeness.net && preparation.calculated.gaps.length === 0 && identityGaps(population.info, preparation.declaration).length === 0);
    var calcProperties = complete
      ? '<calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>'
      : '<calcPr calcMode="manual" fullCalcOnLoad="0" forceFullCalc="0"/>';
    workbook = workbook.replace(/<calcPr\b[^>]*\/>/, calcProperties);
    if (formulaCount(sheet) !== originalCount) throw new Error('La génération a modifié les formules du formulaire officiel TVA.');
    files['xl/workbook.xml'] = encode(workbook);
    files['xl/worksheets/sheet1.xml'] = encode(sheet);
    return { bytes: Fflate.zipSync(files, { level: 6 }), values: population.values, derived: population.derived, formulaCount: originalCount, complete: complete };
  }

  async function loadTemplate() {
    var response = await fetch(TEMPLATE_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error('Le modèle officiel TVA est inaccessible (HTTP ' + response.status + ').');
    var bytes = new Uint8Array(await response.arrayBuffer());
    if (root.crypto && root.crypto.subtle && typeof root.crypto.subtle.digest === 'function') {
      var digest = await root.crypto.subtle.digest('SHA-256', bytes);
      var hash = Array.from(new Uint8Array(digest)).map(function (byte) { return byte.toString(16).padStart(2, '0'); }).join('');
      if (hash !== TEMPLATE_SHA256) throw new Error('Le modèle officiel TVA intégré ne correspond pas à sa version vérifiée.');
    }
    return bytes;
  }

  root.PerfectoVatDeclarationWorkbook = {
    TEMPLATE_URL: TEMPLATE_URL,
    TEMPLATE_SHA256: TEMPLATE_SHA256,
    calculate: calculate,
    buildGapCsv: buildGapCsv,
    generateWorkbook: generateWorkbook,
    loadTemplate: loadTemplate
  };
}(typeof window !== 'undefined' ? window : globalThis));
