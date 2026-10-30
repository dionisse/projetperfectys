/* PERFECTO · Propositions IS limitées aux règles explicites du CGI béninois 2026. */
(function (root, factory) {
  'use strict';
  var api = factory();
  root.PerfectoIsTaxAdjustments = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
}(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  var RULES = [
    { id: 'is-profit-tax', article: '35', label: 'Impôt sur les bénéfices comptabilisé', explanation: 'L’article 35 exclut l’impôt sur les bénéfices des impôts déductibles. Détection limitée aux comptes SYSCOHADA explicitement rattachés à l’impôt de l’exercice et aux rappels sur résultats antérieurs.' },
    { id: 'is-penalty', article: '36', label: 'Amende, pénalité ou sanction comptabilisée', explanation: 'L’article 36 rend non déductibles les transactions, amendes, confiscations, pénalités et sanctions visées. Vérifier la nature, la pièce et le rattachement légal.' },
    { id: 'is-exempt-security-income', article: '15', label: 'Revenu mobilier susceptible d’exonération', explanation: 'L’article 15 vise certains revenus nets de valeurs et capitaux mobiliers figurant à l’actif et atteints par l’IRCM ou exonérés. Après confirmation et saisie du revenu net justifié, le montant déductible proposé est de 70% en règle générale ou 100% pour les produits des titres publics béninois visés.' },
    { id: 'is-sumptuous-expense', article: '33', label: 'Dépense somptuaire potentielle', explanation: 'L’article 33 exclut certaines dépenses de chasse, pêche sportive, bateaux de plaisance, avions de tourisme, résidences d’agrément et autres dépenses somptuaires, sauf si cette activité constitue la branche principale. Le compte ne prouve pas cette condition : confirmation humaine obligatoire.' }
  ];
  function norm(value) { return String(value == null ? '' : value).toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, ' ').replace(/\s+/g, ' ').trim(); }
  function lineAmount(line) { var d = Number(line && line.debit) || 0, c = Number(line && line.credit) || 0, n = d - c; return Number.isFinite(n) ? n : 0; }
  function isCharge(account) { return !!(account && account.nature === 'Charge' && (Number(account.cls) === 6 || Number(account.cls) === 8)); }
  function matchingRule(account) {
    if (!account) return null;
    var code = String(account.code == null ? '' : account.code).trim(), label = norm(account.label);
    if (Number(account.cls) === 7 && account.nature === 'Produit' && ['7721', '7722', '7745', '7746'].indexOf(code) !== -1 && /\b(revenus?|produits?).*\b(titres?|participations?|obligations?)\b/.test(label)) return RULES[2];
    if (!isCharge(account)) return null;
    if (/\b(chasse|peche sportive|bateaux? de plaisance|avions? de tourisme|residences? d agrement|depenses? somptuaires?)\b/.test(label)) return RULES[3];
    var standardTax = ['89', '891', '8911', '8912', '8913', '892'].indexOf(code) !== -1 && String(account.chartOriginCode || '') === code && String(account.subclass || '') === '89';
    var explicitTax = ['891', '892'].indexOf(code) !== -1 && /\bimpots?\b/.test(label) && /\b(resultats?|benefices?)\b/.test(label);
    if (standardTax || explicitTax) return RULES[0];
    if (/\b(penalite|penalites|amende|amendes|sanction|sanctions)\b/.test(label) && !/\bprovision(s)?\b/.test(label)) return RULES[1];
    return null;
  }
  function reviewKey(entryId, lineIndex, ruleId) { return String(entryId || '') + ':' + String(lineIndex) + ':' + String(ruleId || ''); }
  function normalizePosting(value) { return value && typeof value === 'object' ? String(value.code || '').trim() : String(value || '').trim(); }
  function postingFor(accountCode, side, overrides, framework) {
    var code = String(accountCode || '');
    if (Object.prototype.hasOwnProperty.call(overrides, code)) return normalizePosting(overrides[code] && overrides[code][side]);
    if (framework[code]) return normalizePosting(framework[code][side]);
    var parent = Object.keys(framework).filter(function (candidate) { return code.indexOf(candidate) === 0; }).sort(function (a, b) { return b.length - a.length; })[0];
    return parent ? normalizePosting(framework[parent][side]) : '';
  }
  function analyze(input) {
    input = input || {};
    var accounts = Object.create(null), reviews = Object.create(null), framework = Object.create(null);
    (Array.isArray(input.accounts) ? input.accounts : []).forEach(function (a) { if (a && a.code != null) accounts[String(a.code)] = a; });
    (Array.isArray(input.reviews) ? input.reviews : []).forEach(function (r) { if (r && r.key) reviews[String(r.key)] = r; });
    (Array.isArray(input.financialFramework) ? input.financialFramework : []).forEach(function (r) { if (r && r.code != null) framework[String(r.code)] = r; });
    var overrides = input.accountMappings && typeof input.accountMappings === 'object' ? input.accountMappings : {};
    var expensePosts = Object.create(null), incomePosts = Object.create(null);
    var hasExpenseScope = Array.isArray(input.expensePostCodes), hasIncomeScope = Array.isArray(input.incomePostCodes);
    (hasExpenseScope ? input.expensePostCodes : []).forEach(function (p) { expensePosts[String(p)] = true; });
    (hasIncomeScope ? input.incomePostCodes : []).forEach(function (p) { incomePosts[String(p)] = true; });
    var proposals = [], unclassifiedExpenseLineCount = 0;
    (Array.isArray(input.entries) ? input.entries : []).forEach(function (entry) {
      if (!entry || entry.status !== 'posted' || !Array.isArray(entry.lines)) return;
      entry.lines.forEach(function (line, lineIndex) {
        var account = accounts[String(line && line.account || '')], rule = matchingRule(account), raw = lineAmount(line);
        if (!rule) { if (isCharge(account) && raw > 0) unclassifiedExpenseLineCount++; return; }
        var isIncome = rule.id === 'is-exempt-security-income', amount = isIncome ? -raw : raw;
        if (!amount) return;
        var isSumptuous = rule.id === 'is-sumptuous-expense';
        var key = reviewKey(entry.id, lineIndex, rule.id), review = reviews[key] || null, decision = review && review.decision;
        if ((isIncome || isSumptuous) && decision === 'automatic') decision = 'awaiting-qualification';
        var positiveSide = isIncome ? 'credit' : 'debit';
        var side = amount > 0 ? positiveSide : (positiveSide === 'debit' ? 'credit' : 'debit');
        var postingCode = postingFor(account.code, side, overrides, framework);
        var posts = isIncome ? incomePosts : expensePosts, hasScope = isIncome ? hasIncomeScope : hasExpenseScope;
        var inBase = !hasScope || (!!postingCode && !!posts[postingCode]);
        var included = 0;
        if (inBase && decision !== 'exclude') {
          if (isIncome && decision === 'article15-standard') included = (amount < 0 ? -1 : 1) * Number(review.overrideAmount) * 0.7;
          else if (isIncome && decision === 'article15-government') included = (amount < 0 ? -1 : 1) * Number(review.overrideAmount);
          else if (isSumptuous && decision === 'article33-reintegration') included = amount;
          else if (decision === 'override') included = (amount < 0 ? -1 : 1) * Number(review.overrideAmount);
          else if (!isIncome && !isSumptuous) included = amount;
        }
        proposals.push({ key: key, sourceEntryId: String(entry.id || ''), sourceLineIndex: lineIndex,
          entryReference: String(entry.reference || ''), entryDate: String(entry.date || ''), journal: String(entry.journal || ''),
          entryDescription: String(entry.description || ''), accountCode: String(account.code || ''), accountLabel: String(account.label || ''),
          ruleId: rule.id, article: rule.article, ruleLabel: rule.label, explanation: rule.explanation,
          direction: isIncome ? 'deduction' : 'reintegration', proposedAmount: amount, includedAmount: included,
          inIncomeStatementBase: inBase, postingCode: postingCode, postingSide: side,
          decision: inBase ? (decision || ((isIncome || isSumptuous) ? 'awaiting-qualification' : 'automatic')) : 'not-in-is-base',
          reviewed: !!review, reviewNote: String(review && review.note || '') });
      });
    });
    proposals.sort(function (a, b) { return a.entryDate.localeCompare(b.entryDate) || a.entryReference.localeCompare(b.entryReference) || a.sourceLineIndex - b.sourceLineIndex; });
    var automaticReintegrations = Math.max(0, proposals.reduce(function (s, p) { return s + (p.inIncomeStatementBase && p.direction === 'reintegration' ? p.includedAmount : 0); }, 0));
    var automaticDeductions = Math.max(0, proposals.reduce(function (s, p) { return s + (p.inIncomeStatementBase && p.direction === 'deduction' ? p.includedAmount : 0); }, 0));
    var manualReintegrations = 0, manualDeductions = 0, manualReintegrationCount = 0, manualDeductionCount = 0;
    (Array.isArray(input.manualAdjustments) ? input.manualAdjustments : []).forEach(function (r) { var n = Number(r && r.amount); if (!Number.isFinite(n) || n <= 0) return; if (r.direction === 'reintegration') { manualReintegrations += n; manualReintegrationCount++; } if (r.direction === 'deduction') { manualDeductions += n; manualDeductionCount++; } });
    var awaiting = proposals.filter(function (p) { return p.inIncomeStatementBase && ['is-exempt-security-income', 'is-sumptuous-expense'].indexOf(p.ruleId) >= 0 && p.decision === 'awaiting-qualification'; }).length;
    var importable = proposals.filter(function (p) { return p.inIncomeStatementBase && p.decision !== 'exclude' && p.decision !== 'not-in-is-base' && !(['is-exempt-security-income', 'is-sumptuous-expense'].indexOf(p.ruleId) >= 0 && p.decision === 'awaiting-qualification'); }).length;
    return { proposals: proposals, rules: RULES.map(function (r) { return Object.assign({}, r); }), automaticReintegrations: automaticReintegrations,
      automaticDeductions: automaticDeductions, manualReintegrations: manualReintegrations, manualDeductions: manualDeductions,
      reintegrationsToImport: automaticReintegrations + manualReintegrations, deductionsToImport: automaticDeductions + manualDeductions,
      automaticProposalCount: importable, awaitingQualificationCount: awaiting,
      outsideIsBaseCount: proposals.filter(function (p) { return !p.inIncomeStatementBase; }).length,
      autoExcludedCount: proposals.filter(function (p) { return p.decision === 'exclude'; }).length,
      correctedCount: proposals.filter(function (p) { return p.decision === 'override'; }).length,
      manualReintegrationCount: manualReintegrationCount, manualDeductionCount: manualDeductionCount,
      unclassifiedExpenseLineCount: unclassifiedExpenseLineCount };
  }
  return Object.freeze({ RULES: RULES, matchingRule: matchingRule, analyze: analyze, reviewKey: reviewKey });
}));
