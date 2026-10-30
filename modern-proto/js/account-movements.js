/*
 * PERFECTO · Arbre et relevés mensuels des comptes.
 * Les mouvements auxiliaires restent distincts tant que les pièces ne portent
 * pas encore d'identifiant auxiliaire ; aucun mouvement n'est imputé par supposition.
 */
(function (root) {
  'use strict';

  var AccountSearch = root.PerfectoAccountSearch;
  if (!AccountSearch && typeof require === 'function') AccountSearch = require('./account-search.js');

  function compareCode(a, b) {
    return String(a == null ? '' : a).localeCompare(String(b == null ? '' : b), undefined, { numeric: true, sensitivity: 'base' });
  }

  function normalize(value) {
    return String(value == null ? '' : value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
  }

  function buildTree(accounts, auxiliaries) {
    var classes = Object.create(null);
    var accountNodes = Object.create(null);

    function ensureClass(cls, label) {
      var key = String(cls);
      if (!classes[key]) {
        classes[key] = {
          id: 'class:' + key,
          parentId: '',
          kind: 'class',
          code: key,
          label: String(label || ('Classe ' + key)),
          depth: 0,
          accountCodes: [],
          hasAuxiliaries: false,
          children: []
        };
      }
      return classes[key];
    }

    var sortedAccounts = (accounts || []).filter(function (account) {
      return account && String(account.code || '').trim();
    }).slice().sort(function (a, b) {
      return compareCode(a.cls || String(a.code).charAt(0), b.cls || String(b.code).charAt(0)) || compareCode(a.code, b.code);
    });

    sortedAccounts.forEach(function (account) {
      var code = String(account.code);
      var cls = Number(account.cls || code.charAt(0));
      if (!Number.isInteger(cls) || cls < 1 || cls > 8) cls = Number(code.charAt(0)) || 0;
      if (!cls) return;
      var classNode = ensureClass(cls, account.classLabel);
      var subclassCode = String(account.subclass || code.slice(0, 2));
      var subclassId = 'subclass:' + cls + ':' + subclassCode;
      var subclassNode = classNode.children.find(function (node) { return node.id === subclassId; });
      if (!subclassNode) {
        subclassNode = {
          id: subclassId,
          parentId: classNode.id,
          kind: 'subclass',
          code: subclassCode,
          label: String(account.subclassLabel || 'Autres comptes'),
          depth: 1,
          accountCodes: [],
          hasAuxiliaries: false,
          children: []
        };
        classNode.children.push(subclassNode);
      }
      var node = {
        id: 'account:' + code,
        parentId: subclassId,
        kind: 'account',
        code: code,
        label: String(account.label || code),
        depth: 2,
        account: account,
        accountCodes: [code],
        hasAuxiliaries: false,
        children: []
      };
      subclassNode.children.push(node);
      accountNodes[code] = node;
    });

    (auxiliaries || []).forEach(function (record) {
      if (!record || !record.accountCode || !accountNodes[String(record.accountCode)]) return;
      var parent = accountNodes[String(record.accountCode)];
      var type = String(record.type || 'Auxiliaire');
      var recordCode = String(record.code || record.id || '');
      var id = String(record.id || recordCode || (type + '-' + recordCode));
      parent.children.push({
        id: 'auxiliary:' + type + ':' + id,
        parentId: parent.id,
        kind: 'auxiliary',
        code: String(record.auxiliaryAccountCode || (record.accountCode + '-' + recordCode)),
        label: String(record.label || record.name || recordCode || 'Auxiliaire sans nom'),
        depth: 3,
        accountCode: String(record.accountCode),
        auxiliaryType: type,
        active: record.active !== false,
        accountCodes: [],
        hasAuxiliaries: false,
        children: []
      });
    });

    function sortAndAggregate(node) {
      node.children.sort(function (a, b) {
        if (a.kind === 'auxiliary' && b.kind !== 'auxiliary') return 1;
        if (b.kind === 'auxiliary' && a.kind !== 'auxiliary') return -1;
        return compareCode(a.code, b.code) || a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
      });
      var codes = [];
      if (node.kind === 'account') codes.push(node.code);
      node.children.forEach(function (child) {
        sortAndAggregate(child);
        child.accountCodes.forEach(function (code) { if (codes.indexOf(code) === -1) codes.push(code); });
        if (child.kind === 'auxiliary' || child.hasAuxiliaries) node.hasAuxiliaries = true;
      });
      node.accountCodes = codes;
    }

    var result = Object.keys(classes).sort(compareCode).map(function (key) { return classes[key]; });
    result.forEach(sortAndAggregate);
    return result;
  }

  function filterTree(tree, query, kind) {
    var needle = normalize(query);
    var mode = kind || 'all';

    function searchText(node) {
      return normalize([node.code, node.label, node.auxiliaryType, node.accountCode, node.account && node.account.subclassLabel].join(' '));
    }

    var codePrefix = AccountSearch && AccountSearch.codeQuery(needle);

    function visit(node, forceDescendants) {
      var matches = !!needle && (codePrefix
        ? [node.code, node.accountCode].some(function (code) { return String(code || '').toLocaleLowerCase().indexOf(codePrefix) === 0; })
        : searchText(node).indexOf(needle) !== -1);
      var force = forceDescendants || (matches && node.kind !== 'auxiliary');
      var children = (node.children || []).map(function (child) { return visit(child, force); }).filter(Boolean);
      var typeAllowed = mode === 'all' || (mode === 'general' && node.kind !== 'auxiliary') || (mode === 'auxiliary' && node.kind === 'auxiliary');
      var queryAllowed = !needle || matches || forceDescendants;
      var includeSelf = typeAllowed && queryAllowed;
      if (mode === 'auxiliary' && node.kind !== 'auxiliary') includeSelf = false;
      if (!includeSelf && !children.length) return null;
      var copy = Object.assign({}, node, { children: children });
      if (children.length && node.kind !== 'auxiliary') {
        copy.accountCodes = mode === 'auxiliary' && node.kind === 'account' ? [node.code] : [];
        if (mode !== 'auxiliary' || node.kind !== 'account') {
          children.forEach(function (child) {
            child.accountCodes.forEach(function (code) { if (copy.accountCodes.indexOf(code) === -1) copy.accountCodes.push(code); });
          });
        }
        copy.hasAuxiliaries = children.some(function (child) { return child.kind === 'auxiliary' || child.hasAuxiliaries; });
      }
      return copy;
    }

    return (tree || []).map(function (node) { return visit(node, false); }).filter(Boolean);
  }

  function flattenTree(tree) {
    var rows = [];
    function visit(nodes) {
      (nodes || []).forEach(function (node) {
        rows.push(node);
        visit(node.children);
      });
    }
    visit(tree);
    return rows;
  }

  function monthlySummary(node, entries, periods, cycleStart, cycleEnd) {
    var rows = (periods || []).map(function (period) {
      return {
        year: Number(period.year),
        month: Number(period.month),
        key: Number(period.year) + '-' + String(period.month).padStart(2, '0'),
        status: period.status || 'open',
        lines: 0,
        drafts: 0,
        debit: 0,
        credit: 0,
        balance: 0
      };
    });
    var byMonth = Object.create(null);
    rows.forEach(function (row) { byMonth[row.key] = row; });
    if (!node) return { available: false, reason: 'Aucun compte sélectionné.', months: rows, totalLines: 0, totalDrafts: 0, debit: 0, credit: 0, closingBalance: 0 };
    if (node.kind === 'auxiliary') return {
      available: false,
      reason: 'Les pièces actuelles enregistrent le compte général, mais ne portent pas encore l’identifiant de l’auxiliaire. Aucun mouvement ni solde ne lui est attribué.',
      months: rows,
      totalLines: null,
      totalDrafts: null,
      debit: null,
      credit: null,
      closingBalance: null
    };

    var targetCodes = node.accountCodes || [];
    var codeSet = Object.create(null);
    targetCodes.forEach(function (code) { codeSet[String(code)] = true; });
    (entries || []).forEach(function (entry) {
      var date = String(entry && entry.date || '');
      if (!entry || !date || date < cycleStart || date > cycleEnd) return;
      var month = byMonth[date.slice(0, 7)];
      if (!month) return;
      if (entry.status === 'draft') {
        if ((entry.lines || []).some(function (line) { return !!codeSet[String(line.account)]; })) month.drafts += 1;
        return;
      }
      if (entry.status !== 'posted') return;
      (entry.lines || []).forEach(function (line) {
        if (!codeSet[String(line.account)]) return;
        var debit = Number(line.debit) || 0;
        var credit = Number(line.credit) || 0;
        if (!debit && !credit) return;
        month.lines += 1;
        month.debit += debit;
        month.credit += credit;
      });
    });

    var debitTotal = 0;
    var creditTotal = 0;
    var lineTotal = 0;
    var draftTotal = 0;
    var running = 0;
    rows.forEach(function (row) {
      debitTotal += row.debit;
      creditTotal += row.credit;
      lineTotal += row.lines;
      draftTotal += row.drafts;
      running += row.debit - row.credit;
      row.balance = running;
    });
    return {
      available: true,
      reason: '',
      months: rows,
      totalLines: lineTotal,
      totalDrafts: draftTotal,
      debit: debitTotal,
      credit: creditTotal,
      closingBalance: debitTotal - creditTotal
    };
  }

  function detailRows(node, entries, accounts, cycleStart, cycleEnd, monthKey) {
    if (!node) return { available: false, reason: 'Aucun compte sélectionné.', rows: [], debit: 0, credit: 0 };
    if (node.kind === 'auxiliary') return {
      available: false,
      reason: 'Aucun mouvement auxiliaire ne peut être affiché : les écritures actuelles ne portent pas d’identifiant de tiers.',
      rows: [],
      debit: null,
      credit: null
    };
    var codeSet = Object.create(null);
    (node.accountCodes || []).forEach(function (code) { codeSet[String(code)] = true; });
    var labels = Object.create(null);
    (accounts || []).forEach(function (account) { labels[String(account.code)] = String(account.label || account.code); });
    var rows = [];
    (entries || []).forEach(function (entry) {
      var date = String(entry && entry.date || '');
      if (!entry || entry.status !== 'posted' || date < cycleStart || date > cycleEnd || (monthKey && date.slice(0, 7) !== monthKey)) return;
      (entry.lines || []).forEach(function (line) {
        var code = String(line.account || '');
        if (!codeSet[code]) return;
        var debit = Number(line.debit) || 0;
        var credit = Number(line.credit) || 0;
        if (!debit && !credit) return;
        rows.push({
          date: date,
          reference: String(entry.reference || ''),
          journal: String(entry.journal || ''),
          description: String(entry.description || ''),
          account: code,
          accountLabel: labels[code] || code,
          debit: debit,
          credit: credit
        });
      });
    });
    rows.sort(function (a, b) {
      return a.date.localeCompare(b.date) || a.reference.localeCompare(b.reference) || compareCode(a.account, b.account);
    });
    return {
      available: true,
      reason: '',
      rows: rows,
      debit: rows.reduce(function (sum, row) { return sum + row.debit; }, 0),
      credit: rows.reduce(function (sum, row) { return sum + row.credit; }, 0)
    };
  }

  var api = {
    buildTree: buildTree,
    filterTree: filterTree,
    flattenTree: flattenTree,
    monthlySummary: monthlySummary,
    detailRows: detailRows
  };

  root.PerfectoAccountMovements = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : globalThis));
