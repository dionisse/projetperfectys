/* =========================================================================
   PERFECTO · Affectation des règlements aux factures pour l’exigibilité TVA
   Les liens sont explicites et validés; aucune facture ou imputation n’est
   reconstituée à partir d’un simple libellé.
   ========================================================================= */
(function (root) {
  'use strict';

  function cleanCodes(value) {
    var list = Array.isArray(value) ? value : String(value == null ? '' : value).split(/[\s,;]+/);
    var seen = Object.create(null);
    return list.map(function (code) { return String(code || '').trim(); }).filter(function (code) {
      if (!code || !/^\d+\*?$/.test(code) || seen[code]) return false;
      seen[code] = true;
      return true;
    });
  }

  function matches(code, selectors) {
    code = String(code == null ? '' : code);
    return cleanCodes(selectors).some(function (selector) {
      var prefix = selector.replace(/\*$/, '');
      return code.indexOf(prefix) === 0;
    });
  }

  function amount(entry, selectors, side) {
    if (!entry || !Array.isArray(entry.lines)) return 0;
    return entry.lines.reduce(function (sum, line) {
      if (!line || !matches(line.account, selectors)) return sum;
      return sum + (Number(line[side]) || 0);
    }, 0);
  }

  function invoiceGross(entry, customerAccounts) {
    return amount(entry, customerAccounts, 'debit') - amount(entry, customerAccounts, 'credit');
  }

  function receiptApplied(entry, customerAccounts) {
    return amount(entry, customerAccounts, 'credit') - amount(entry, customerAccounts, 'debit');
  }

  function pendingVat(entry, suspenseAccounts) {
    return amount(entry, suspenseAccounts, 'credit') - amount(entry, suspenseAccounts, 'debit');
  }

  function findEntry(entries, id) {
    return (Array.isArray(entries) ? entries : []).find(function (entry) { return entry && String(entry.id) === String(id); }) || null;
  }

  function validateAllocation(input, options) {
    input = input || {};
    options = options || {};
    var errors = [];
    var invoice = findEntry(options.entries, input.invoiceEntryId);
    var receipt = findEntry(options.entries, input.receiptEntryId);
    var customers = cleanCodes(options.customerAccounts && options.customerAccounts.length ? options.customerAccounts : ['41']);
    var suspense = cleanCodes(options.suspenseAccounts);
    var allocated = Number(input.amountTtc);
    if (!invoice || invoice.status !== 'posted') errors.push('Choisissez une facture comptabilisée et validée.');
    if (!receipt || receipt.status !== 'posted') errors.push('Choisissez un règlement comptabilisé et validé.');
    if (invoice && receipt && invoice.id === receipt.id) errors.push('La facture et le règlement doivent être deux pièces distinctes.');
    if (!Number.isFinite(allocated) || allocated <= 0) errors.push('Le montant affecté doit être strictement positif.');
    if (!customers.length) errors.push('Configurez les comptes clients à rapprocher.');
    if (!suspense.length) errors.push('Sélectionnez les comptes de TVA en attente selon le plan comptable du dossier.');
    if (invoice) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(invoice.date || ''))) errors.push('La date de facture est invalide.');
      if (invoiceGross(invoice, customers) <= 0) errors.push('La pièce sélectionnée ne présente pas de créance client débitrice identifiable.');
      if (pendingVat(invoice, suspense) <= 0) errors.push('Aucun montant créditeur de TVA en attente n’est identifié sur cette pièce.');
    }
    if (receipt) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(receipt.date || ''))) errors.push('La date du règlement est invalide.');
      if (receiptApplied(receipt, customers) <= 0) errors.push('La pièce sélectionnée ne présente pas de règlement client créditeur identifiable.');
    }
    var existing = Array.isArray(options.allocations) ? options.allocations : [];
    if (invoice && Number.isFinite(allocated) && allocated > 0) {
      var alreadyForInvoice = existing.filter(function (row) { return row.invoiceEntryId === invoice.id && row.id !== input.id; })
        .reduce(function (sum, row) { return sum + (Number(row.amountTtc) || 0); }, 0);
      if (alreadyForInvoice + allocated > invoiceGross(invoice, customers) + 0.000001) errors.push('Le total affecté dépasse le montant TTC de la facture.');
    }
    if (receipt && Number.isFinite(allocated) && allocated > 0) {
      var alreadyForReceipt = existing.filter(function (row) { return row.receiptEntryId === receipt.id && row.id !== input.id; })
        .reduce(function (sum, row) { return sum + (Number(row.amountTtc) || 0); }, 0);
      if (alreadyForReceipt + allocated > receiptApplied(receipt, customers) + 0.000001) errors.push('Le total affecté dépasse le montant du règlement client.');
    }
    return { ok: errors.length === 0, errors: errors, invoice: invoice, receipt: receipt, amountTtc: allocated };
  }

  function calculateReleasedVat(options) {
    options = options || {};
    var entries = Array.isArray(options.entries) ? options.entries : [];
    var allocations = Array.isArray(options.allocations) ? options.allocations : [];
    var period = String(options.period || '');
    var customerAccounts = cleanCodes(options.customerAccounts && options.customerAccounts.length ? options.customerAccounts : ['41']);
    var suspenseAccounts = cleanCodes(options.suspenseAccounts);
    var places = Math.max(0, Math.min(6, Number(options.decimalPlaces) || 0));
    var round = function (value) { var factor = Math.pow(10, places); return Math.round((Number(value) + Number.EPSILON) * factor) / factor; };
    var gaps = [];
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return { ok: false, total: null, rows: [], gaps: ['Choisissez un mois valide.'] };
    if (!customerAccounts.length || !suspenseAccounts.length) return { ok: false, total: null, rows: [], gaps: ['Les comptes clients et de TVA en attente doivent être configurés.'] };
    var periodRows = allocations.filter(function (allocation) {
      var receipt = findEntry(entries, allocation.receiptEntryId);
      return receipt && receipt.status === 'posted' && String(receipt.date || '').slice(0, 7) === period;
    });
    var rows = [];
    var total = 0;
    periodRows.forEach(function (allocation) {
      var invoice = findEntry(entries, allocation.invoiceEntryId);
      var receipt = findEntry(entries, allocation.receiptEntryId);
      var validation = validateAllocation(allocation, {
        entries: entries, allocations: allocations, customerAccounts: customerAccounts,
        suspenseAccounts: suspenseAccounts
      });
      if (!validation.ok) {
        gaps.push({ allocationId: allocation.id || '', invoiceEntryId: allocation.invoiceEntryId || '', receiptEntryId: allocation.receiptEntryId || '', message: validation.errors.join(' ') });
        return;
      }
      var gross = invoiceGross(invoice, customerAccounts);
      var vat = pendingVat(invoice, suspenseAccounts);
      var amountTtc = Number(allocation.amountTtc) || 0;
      var released = round(vat * amountTtc / gross);
      rows.push({
        allocationId: allocation.id || '', invoiceEntryId: invoice.id, receiptEntryId: receipt.id,
        invoiceReference: String(invoice.reference || ''), receiptReference: String(receipt.reference || ''),
        paymentDate: String(receipt.date || ''), allocatedTtc: round(amountTtc), vatReleased: released,
        basis: 'Prorata du montant TTC affecté à la pièce; à contrôler si la pièce comporte plusieurs régimes ou taux.'
      });
      total += released;
    });
    return { ok: gaps.length === 0, period: period, total: round(total), rows: rows, gaps: gaps };
  }

  root.PerfectoVatPaymentAllocation = {
    cleanCodes: cleanCodes,
    matches: matches,
    invoiceGross: invoiceGross,
    receiptApplied: receiptApplied,
    pendingVat: pendingVat,
    validateAllocation: validateAllocation,
    calculateReleasedVat: calculateReleasedVat
  };
}(typeof window !== 'undefined' ? window : globalThis));
