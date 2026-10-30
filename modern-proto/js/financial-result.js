/* PERFECTO · Agrégation en lecture seule du résultat comptable à une date d’arrêté. */
(function (root, factory) {
  'use strict';
  var api = factory();
  root.PerfectoFinancialResult = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
}(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  function validDate(value) { var text = String(value || ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false; var date = new Date(text + 'T00:00:00Z'); return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text; }
  function resolvePosting(code, side, mappings, framework) {
    var accountCode = String(code || '');
    if (Object.prototype.hasOwnProperty.call(mappings, accountCode)) return String(mappings[accountCode] && mappings[accountCode][side] || '').trim();
    if (framework[accountCode]) return String(framework[accountCode][side] && framework[accountCode][side].code || '').trim();
    var parent = Object.keys(framework).filter(function (candidate) { return accountCode.indexOf(candidate) === 0; }).sort(function (a, b) { return b.length - a.length; })[0];
    return parent ? String(framework[parent][side] && framework[parent][side].code || '').trim() : '';
  }
  function accountingResult(input) {
    input = input || {};
    var mappings = input.mappings && typeof input.mappings === 'object' ? input.mappings : {};
    var framework = Object.create(null), income = 0, expenses = 0, movementCount = 0, missing = [];
    (Array.isArray(input.financialFramework) ? input.financialFramework : []).forEach(function (record) { if (record && record.code != null) framework[String(record.code)] = record; });
    (Array.isArray(input.balance) ? input.balance : []).forEach(function (row) {
      if (!row || [6, 7, 8].indexOf(Number(row.cls)) < 0) return;
      var net = (Number(row.debit) || 0) - (Number(row.credit) || 0);
      if (!net) return;
      movementCount++;
      var side = net > 0 ? 'debit' : 'credit', post = resolvePosting(row.code, side, mappings, framework), value = Math.abs(net);
      if (post.charAt(0) === 'T') income += side === 'credit' ? value : -value;
      else if (post.charAt(0) === 'R') expenses += side === 'debit' ? value : -value;
      else missing.push(String(row.code));
    });
    var uniqueMissing = Array.from(new Set(missing)).sort();
    return { complete: movementCount > 0 && uniqueMissing.length === 0, result: movementCount > 0 && uniqueMissing.length === 0 ? income - expenses : null,
      income: movementCount > 0 && uniqueMissing.length === 0 ? income : null, expenses: movementCount > 0 && uniqueMissing.length === 0 ? expenses : null,
      movementAccountCount: movementCount, unmappedOrNonResultAccountCodes: uniqueMissing };
  }
  function calculate(input) {
    input = input || {};
    var start = String(input.cycleStart || ''), end = String(input.cycleEnd || ''), asOf = String(input.asOfDate || '');
    if (!validDate(start) || !validDate(end) || !validDate(asOf) || start > end || asOf < start || asOf > end) {
      return { ok: false, errors: ['La date d’arrêté doit être valide et comprise dans le cycle actif.'], balance: [], postedEntryCount: 0, openingBalanceCount: 0 };
    }
    var rows = Object.create(null);
    (Array.isArray(input.accounts) ? input.accounts : []).forEach(function (account) {
      if (!account || account.code == null) return;
      var code = String(account.code);
      rows[code] = { code: code, label: String(account.label || code), cls: Number(account.cls) || Number(code.charAt(0)), nature: String(account.nature || '—'), debit: 0, credit: 0 };
    });
    function add(codeValue, debitValue, creditValue) {
      var code = String(codeValue || '').trim();
      if (!code) return;
      if (!rows[code]) rows[code] = { code: code, label: code, cls: Number(code.charAt(0)), nature: '—', debit: 0, credit: 0 };
      var debit = Number(debitValue), credit = Number(creditValue);
      if (Number.isFinite(debit)) rows[code].debit += debit;
      if (Number.isFinite(credit)) rows[code].credit += credit;
    }
    var postedEntryCount = 0;
    (Array.isArray(input.entries) ? input.entries : []).forEach(function (entry) {
      if (!entry || entry.status !== 'posted' || !validDate(entry.date) || entry.date < start || entry.date > asOf || !Array.isArray(entry.lines)) return;
      postedEntryCount += 1;
      entry.lines.forEach(function (line) { if (line) add(line.account, line.debit, line.credit); });
    });
    var openingBalanceCount = 0;
    (Array.isArray(input.openingBalances) ? input.openingBalances : []).forEach(function (opening) {
      if (!opening || !opening.accountCode || !validDate(opening.date) || opening.date >= start) return;
      add(opening.accountCode, opening.debit, opening.credit);
      openingBalanceCount += 1;
    });
    var balance = Object.keys(rows).map(function (code) { return rows[code]; })
      .filter(function (row) { return row.debit !== 0 || row.credit !== 0; })
      .sort(function (a, b) { return a.code.localeCompare(b.code); });
    return { ok: true, errors: [], asOfDate: asOf, balance: balance, postedEntryCount: postedEntryCount, openingBalanceCount: openingBalanceCount };
  }
  return Object.freeze({ calculate: calculate, accountingResult: accountingResult, validDate: validDate });
}));
