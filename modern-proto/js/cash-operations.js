/*
 * PERFECTO · Fonctions locales des opérations de caisse
 * Le solde est dérivé des écritures validées ; aucun registre parallèle n'est créé.
 */
(function (root) {
  'use strict';

  var CASH_JOURNAL = 'CA';

  function isCashCode(code) {
    return /^57\d*$/.test(String(code == null ? '' : code).trim());
  }

  function isCashAccount(account) {
    return !!account && isCashCode(account.code) && Number(account.cls) === 5 &&
      account.active !== false && account.postable !== false;
  }

  function cashAccounts(accounts) {
    return (accounts || []).filter(isCashAccount).slice().sort(function (a, b) {
      return String(a.code).localeCompare(String(b.code));
    });
  }

  function cashBalances(accounts, entries, cycleStart, cycleEnd, asOfDate) {
    var records = Object.create(null);
    (accounts || []).forEach(function (account) {
      if (!isCashCode(account && account.code)) return;
      var code = String(account.code);
      records[code] = {
        code: code,
        label: String(account.label || code),
        debit: 0,
        credit: 0,
        balance: 0,
        selectable: isCashAccount(account)
      };
    });

    (entries || []).forEach(function (entry) {
      var date = String(entry && entry.date || '');
      if (!entry || entry.status !== 'posted' || !date || date < cycleStart || date > cycleEnd || (asOfDate && date > asOfDate)) return;
      (entry.lines || []).forEach(function (line) {
        var code = String(line && line.account || '');
        if (!isCashCode(code)) return;
        if (!records[code]) records[code] = { code: code, label: code, debit: 0, credit: 0, balance: 0, selectable: false };
        records[code].debit += Number(line.debit) || 0;
        records[code].credit += Number(line.credit) || 0;
      });
    });

    return Object.keys(records).map(function (code) {
      var record = records[code];
      record.balance = record.debit - record.credit;
      return record;
    }).sort(function (a, b) { return a.code.localeCompare(b.code); });
  }

  function movementRecords(entries, accounts, cycleStart, cycleEnd) {
    var labels = Object.create(null);
    (accounts || []).forEach(function (account) { labels[String(account.code)] = String(account.label || account.code); });
    return (entries || []).filter(function (entry) {
      return entry && String(entry.journal || '').toUpperCase() === CASH_JOURNAL &&
        String(entry.date || '') >= cycleStart && String(entry.date || '') <= cycleEnd &&
        (entry.lines || []).some(function (line) { return isCashCode(line && line.account); });
    }).map(function (entry) {
      var cashLines = (entry.lines || []).filter(function (line) { return isCashCode(line && line.account); });
      var otherLines = (entry.lines || []).filter(function (line) { return !isCashCode(line && line.account); });
      var debit = cashLines.reduce(function (sum, line) { return sum + (Number(line.debit) || 0); }, 0);
      var credit = cashLines.reduce(function (sum, line) { return sum + (Number(line.credit) || 0); }, 0);
      var net = debit - credit;
      var cashCodes = cashLines.map(function (line) { return String(line.account); }).filter(function (code, index, list) { return list.indexOf(code) === index; });
      var counterpartCodes = otherLines.map(function (line) { return String(line.account); }).filter(function (code, index, list) { return list.indexOf(code) === index; });
      return {
        id: entry.id,
        date: entry.date,
        reference: entry.reference,
        description: entry.description || '',
        status: entry.status,
        direction: net > 0 ? 'Encaissement' : (net < 0 ? 'Décaissement' : 'Mouvement interne'),
        amount: Math.abs(net) || Math.max(debit, credit),
        cashAccounts: cashCodes.map(function (code) { return { code: code, label: labels[code] || code }; }),
        counterpartAccounts: counterpartCodes.map(function (code) { return { code: code, label: labels[code] || code }; })
      };
    }).sort(function (a, b) {
      return String(b.date).localeCompare(String(a.date)) || String(b.reference).localeCompare(String(a.reference));
    });
  }

  function buildEntry(input, accounts) {
    input = input || {};
    var errors = [];
    var direction = String(input.direction || '');
    var cashCode = String(input.cashAccount || '').trim();
    var counterpartCode = String(input.counterpartAccount || '').trim();
    var amount = Number(input.amount);
    var accountMap = Object.create(null);
    (accounts || []).forEach(function (account) { accountMap[String(account.code)] = account; });
    var cashAccount = accountMap[cashCode];
    var counterpart = accountMap[counterpartCode];

    if (direction !== 'receipt' && direction !== 'disbursement') errors.push('Choisissez un encaissement ou un décaissement.');
    if (!isCashAccount(cashAccount)) errors.push('Choisissez un compte de caisse actif et imputable de la famille 57.');
    if (!counterpart || counterpart.active === false || counterpart.postable === false) errors.push('Choisissez un compte de contrepartie actif et imputable.');
    else if (isCashCode(counterpart.code)) errors.push('Un autre compte de caisse ne peut pas servir de contrepartie dans cette saisie rapide ; utilisez la saisie générale pour un transfert entre caisses.');
    if (!Number.isSafeInteger(amount) || amount <= 0) errors.push('Le montant doit être un nombre entier positif en XOF.');
    if (!String(input.date || '').trim()) errors.push('La date de l’opération est obligatoire.');
    if (!String(input.reference || '').trim()) errors.push('La référence est obligatoire.');
    if (!String(input.description || '').trim()) errors.push('Le libellé de l’opération est obligatoire.');
    if (errors.length) return { ok: false, errors: errors, entry: null };

    var receipt = direction === 'receipt';
    return {
      ok: true,
      errors: [],
      entry: {
        reference: String(input.reference).trim(),
        journal: CASH_JOURNAL,
        date: String(input.date).trim(),
        description: String(input.description).trim(),
        lines: [
          { account: cashCode, debit: receipt ? amount : 0, credit: receipt ? 0 : amount },
          { account: counterpartCode, debit: receipt ? 0 : amount, credit: receipt ? amount : 0 }
        ]
      }
    };
  }

  var api = {
    CASH_JOURNAL: CASH_JOURNAL,
    isCashCode: isCashCode,
    isCashAccount: isCashAccount,
    cashAccounts: cashAccounts,
    cashBalances: cashBalances,
    movementRecords: movementRecords,
    buildEntry: buildEntry
  };

  root.PerfectoCashOperations = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
}(typeof window === 'object' ? window : globalThis));
