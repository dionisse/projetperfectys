/*
 * PERFECTO · Diagnostic d’intégrité et réparation technique conservatrice.
 * Les écritures, montants, journaux et comptes ne sont jamais corrigés automatiquement.
 */
(function (root) {
  'use strict';

  function validIsoDate(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return false;
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    if (year < 1900 || year > 9999) return false;
    var date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function monthKey(year, month) {
    return Number(year) + '-' + String(Number(month)).padStart(2, '0');
  }

  function cycleMonths(start, end) {
    if (!validIsoDate(start) || !validIsoDate(end) || end < start) return [];
    var startYear = Number(start.slice(0, 4));
    var startMonth = Number(start.slice(5, 7));
    var endYear = Number(end.slice(0, 4));
    var endMonth = Number(end.slice(5, 7));
    var span = (endYear - startYear) * 12 + endMonth - startMonth;
    if (span < 0 || span > 119) return [];
    var months = [];
    var year = startYear;
    var month = startMonth;
    while (year < endYear || (year === endYear && month <= endMonth)) {
      months.push({ year: year, month: month });
      month += 1;
      if (month > 12) { month = 1; year += 1; }
    }
    return months;
  }

  function inspect(state, dossier) {
    state = state && typeof state === 'object' ? state : null;
    dossier = dossier && typeof dossier === 'object' ? dossier : {};
    var issues = [];
    var issueMap = Object.create(null);
    var summary = { accounts: 0, journals: 0, entries: 0, postedEntries: 0, draftEntries: 0, validPostedEntries: 0, periods: 0 };
    var structureValid = !!state && Array.isArray(state.accounts) && Array.isArray(state.journals) && Array.isArray(state.entries);
    var cycleStart = state && String(state.cycleStart || '').trim();
    var cycleEnd = state && String(state.cycleEnd || '').trim();
    var months = cycleMonths(cycleStart, cycleEnd);
    var cycleValid = months.length > 0;
    var accounts = Object.create(null);
    var journals = Object.create(null);
    var entryIds = Object.create(null);
    var references = Object.create(null);
    var periodKeys = Object.create(null);
    var periodsRepairable = true;

    function addIssue(code, severity, repairable, message, example) {
      var issue = issueMap[code];
      if (!issue) {
        issue = { code: code, severity: severity, repairable: !!repairable, message: message, count: 0, examples: [] };
        issueMap[code] = issue;
        issues.push(issue);
      }
      issue.count += 1;
      if (example && issue.examples.length < 5 && issue.examples.indexOf(String(example)) === -1) issue.examples.push(String(example));
    }

    if (!state) {
      addIssue('database-missing', 'error', false, 'Les données comptables du dossier sont absentes ou illisibles.');
      return { ok: false, structureValid: false, cycleValid: false, canApplySafeRepair: false, safeRepairNeeded: false, issues: issues, summary: summary };
    }
    if (!Array.isArray(state.accounts)) addIssue('accounts-structure', 'error', false, 'Le plan comptable n’est pas une liste exploitable.');
    if (!Array.isArray(state.journals)) addIssue('journals-structure', 'error', false, 'Le référentiel des journaux n’est pas une liste exploitable.');
    if (!Array.isArray(state.entries)) addIssue('entries-structure', 'error', false, 'Les pièces comptables ne sont pas une liste exploitable.');
    if (!cycleValid) {
      addIssue('cycle-invalid', 'error', false, 'Le cycle comptable est invalide ou dépasse la période analysable.');
      structureValid = false;
    }
    if (state.version !== 1) addIssue('state-version-unknown', 'warning', false, 'La version de structure de la base n’est pas reconnue ; aucune migration automatique n’est appliquée.');
    if (dossier.cycleStart && dossier.cycleEnd && (cycleStart !== dossier.cycleStart || cycleEnd !== dossier.cycleEnd)) {
      addIssue('dossier-cycle-mismatch', 'warning', false, 'Le cycle comptable enregistré dans la base diffère du cycle du dossier client. Aucune date n’est remplacée automatiquement.');
    }

    if (Array.isArray(state.accounts)) {
      summary.accounts = state.accounts.length;
      if (!state.accounts.length) addIssue('accounts-empty', 'error', false, 'Le plan comptable du dossier est vide.');
      state.accounts.forEach(function (account, index) {
        if (!account || typeof account !== 'object' || Array.isArray(account)) {
          structureValid = false;
          addIssue('account-record-invalid', 'error', false, 'Un élément du plan comptable n’est pas exploitable.', 'Ligne ' + (index + 1));
          return;
        }
        var code = String(account.code || '').trim();
        if (!/^\d{4,8}$/.test(code)) addIssue('account-code-invalid', 'error', false, 'Un compte possède un code vide ou invalide.', code || 'Ligne ' + (index + 1));
        if (code && accounts[code]) addIssue('account-code-duplicate', 'error', false, 'Un code de compte est présent plusieurs fois.', code);
        else if (code) accounts[code] = account;
        if (!String(account.label || '').trim()) addIssue('account-label-missing', 'warning', false, 'Un compte ne possède pas d’intitulé.', code || 'Ligne ' + (index + 1));
      });
    }

    if (Array.isArray(state.journals)) {
      summary.journals = state.journals.length;
      if (!state.journals.length) addIssue('journals-empty', 'error', false, 'Le référentiel des journaux du dossier est vide.');
      state.journals.forEach(function (journal, index) {
        if (!journal || typeof journal !== 'object' || Array.isArray(journal)) {
          structureValid = false;
          addIssue('journal-record-invalid', 'error', false, 'Un élément du référentiel des journaux n’est pas exploitable.', 'Ligne ' + (index + 1));
          return;
        }
        var code = String(journal.code || '').trim();
        if (!/^[A-Z0-9]{1,8}$/i.test(code)) addIssue('journal-code-invalid', 'error', false, 'Un journal possède un code vide ou invalide.', code || 'Ligne ' + (index + 1));
        if (code && journals[code]) addIssue('journal-code-duplicate', 'error', false, 'Un code journal est présent plusieurs fois.', code);
        else if (code) journals[code] = journal;
        if (!String(journal.label || '').trim()) addIssue('journal-label-missing', 'warning', false, 'Un journal ne possède pas d’intitulé.', code || 'Ligne ' + (index + 1));
      });
    }

    if (Array.isArray(state.entries)) {
      summary.entries = state.entries.length;
      state.entries.forEach(function (entry, index) {
        var fallback = 'Ligne ' + (index + 1);
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
          structureValid = false;
          addIssue('entry-record-invalid', 'error', false, 'Une pièce n’est pas un objet exploitable.', fallback);
          return;
        }
        var reference = String(entry.reference || '').trim();
        var id = String(entry.id || '').trim();
        var label = reference || id || fallback;
        if (!id) addIssue('entry-id-missing', 'error', false, 'Une pièce ne possède pas d’identifiant.', label);
        else if (entryIds[id]) addIssue('entry-id-duplicate', 'error', false, 'Un identifiant de pièce est présent plusieurs fois.', id);
        else entryIds[id] = true;
        if (!reference) addIssue('entry-reference-missing', 'error', false, 'Une pièce ne possède pas de référence.', label);
        else if (references[reference]) addIssue('entry-reference-duplicate', 'error', false, 'Une référence de pièce est présente plusieurs fois.', reference);
        else references[reference] = true;
        if (entry.status === 'posted') summary.postedEntries += 1;
        else if (entry.status === 'draft') summary.draftEntries += 1;
        else addIssue('entry-status-invalid', 'error', false, 'Une pièce possède un statut différent de brouillon ou validé.', label);
        if (!validIsoDate(entry.date)) addIssue('entry-date-invalid', 'error', false, 'Une pièce possède une date invalide.', label);
        else if (entry.date < cycleStart || entry.date > cycleEnd) addIssue('entry-outside-cycle', 'warning', false, 'Une pièce est datée hors du cycle comptable actif.', label + ' (' + entry.date + ')');
        if (!journals[String(entry.journal || '').trim()]) addIssue('entry-journal-unknown', 'error', false, 'Une pièce utilise un journal absent du référentiel.', label + ' · ' + String(entry.journal || 'sans journal'));
        if (!Array.isArray(entry.lines)) {
          structureValid = false;
          addIssue('entry-lines-invalid', 'error', false, 'Les lignes d’une pièce ne sont pas exploitables.', label);
          return;
        }
        if (entry.lines.length < 2) addIssue('entry-lines-short', 'error', false, 'Une pièce comporte moins de deux lignes.', label);
        var debitTotal = 0;
        var creditTotal = 0;
        var linesValid = true;
        entry.lines.forEach(function (line, lineIndex) {
          if (!line || typeof line !== 'object' || Array.isArray(line)) {
            linesValid = false;
            addIssue('entry-line-invalid', 'error', false, 'Une ligne comptable n’est pas exploitable.', label + ' · ligne ' + (lineIndex + 1));
            return;
          }
          var accountCode = String(line.account || '').trim();
          var debit = Number(line.debit);
          var credit = Number(line.credit);
          if (!accounts[accountCode]) addIssue('entry-account-unknown', 'error', false, 'Une ligne référence un compte absent du plan comptable.', label + ' · ' + (accountCode || 'sans compte'));
          if (!Number.isSafeInteger(debit) || !Number.isSafeInteger(credit) || debit < 0 || credit < 0 ||
              (debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
            linesValid = false;
            addIssue('entry-amount-invalid', 'error', false, 'Une ligne contient un montant ou un sens comptable invalide.', label + ' · ligne ' + (lineIndex + 1));
            return;
          }
          debitTotal += debit;
          creditTotal += credit;
          if (!Number.isSafeInteger(debitTotal) || !Number.isSafeInteger(creditTotal)) {
            linesValid = false;
            addIssue('entry-total-overflow', 'error', false, 'Le total d’une pièce dépasse la capacité numérique sûre.', label);
          }
        });
        if (entry.status === 'posted' && linesValid && entry.lines.length >= 2) {
          if (debitTotal !== creditTotal || debitTotal <= 0) addIssue('entry-unbalanced', 'error', false, 'Une écriture validée n’est pas équilibrée.', label + ' (débit ' + debitTotal + ' / crédit ' + creditTotal + ')');
          else summary.validPostedEntries += 1;
        }
      });
    }

    if (state.exercise !== Number(cycleStart.slice(0, 4))) {
      addIssue('exercise-mismatch', 'warning', true, 'L’exercice affiché ne correspond pas à l’année de début du cycle ; il peut être reconstruit sans toucher aux écritures.');
    }

    var periods = Array.isArray(state.periods) ? state.periods : [];
    summary.periods = periods.length;
    if (!Array.isArray(state.periods)) addIssue('periods-missing', 'warning', true, 'Le registre des périodes est absent ; les mois du cycle peuvent être recréés selon leur état par défaut (ouvert).');
    periods.forEach(function (period, index) {
      if (!period || typeof period !== 'object' || Array.isArray(period)) {
        addIssue('period-record-invalid', 'warning', true, 'Un enregistrement de période illisible sera écarté.', 'Ligne ' + (index + 1));
        return;
      }
      var year = Number(period.year);
      var month = Number(period.month);
      var status = String(period.status || '');
      var keyValid = Number.isInteger(year) && year >= 1900 && year <= 9999 && Number.isInteger(month) && month >= 1 && month <= 12;
      if (!keyValid) {
        if (status === 'closed' || (status && status !== 'open')) {
          periodsRepairable = false;
          addIssue('period-closure-unknown', 'error', false, 'Une période fermée ou à statut inconnu ne peut pas être rattachée à un mois précis ; réparation automatique bloquée.', 'Ligne ' + (index + 1));
        } else {
          addIssue('period-record-invalid', 'warning', true, 'Un enregistrement de période sans année/mois valide sera écarté.', 'Ligne ' + (index + 1));
        }
        return;
      }
      if (status !== 'open' && status !== 'closed') {
        periodsRepairable = false;
        addIssue('period-status-invalid', 'error', false, 'Le statut d’une période est inconnu ; la réparation automatique est bloquée.', monthKey(year, month));
        return;
      }
      var key = monthKey(year, month);
      if (periodKeys[key]) addIssue('period-duplicate', 'warning', true, 'Une période apparaît plusieurs fois ; les doublons pourront être fusionnés sans rouvrir une période clôturée.', key);
      else periodKeys[key] = status;
      if (periodKeys[key] === 'open' && status === 'closed') periodKeys[key] = 'closed';
    });

    if (cycleValid) {
      months.forEach(function (month) {
        var key = monthKey(month.year, month.month);
        if (!periodKeys[key]) addIssue('period-missing', 'warning', true, 'Un mois du cycle ne figure pas dans le registre ; il sera recréé ouvert, comme son statut implicite actuel.', key);
      });
    }

    var safeRepairNeeded = issues.some(function (issue) { return issue.repairable; });
    var criticalCount = issues.filter(function (issue) { return issue.severity === 'error'; }).reduce(function (total, issue) { return total + issue.count; }, 0);
    var warningCount = issues.filter(function (issue) { return issue.severity === 'warning'; }).reduce(function (total, issue) { return total + issue.count; }, 0);
    var canApplySafeRepair = structureValid && cycleValid && periodsRepairable && Array.isArray(state.accounts) && Array.isArray(state.journals) && Array.isArray(state.entries);
    return {
      ok: criticalCount === 0,
      structureValid: structureValid,
      cycleValid: cycleValid,
      canApplySafeRepair: canApplySafeRepair,
      safeRepairNeeded: safeRepairNeeded,
      issues: issues,
      summary: summary,
      criticalCount: criticalCount,
      warningCount: warningCount
    };
  }

  function repair(state, dossier) {
    var report = inspect(state, dossier);
    if (!report.canApplySafeRepair) {
      return { ok: false, errors: ['La base comporte une structure ou un statut de période ambigu ; aucune réparation automatique n’a été appliquée.'], report: report };
    }
    var data;
    try { data = JSON.parse(JSON.stringify(state)); }
    catch (err) { return { ok: false, errors: ['La copie de travail de la base est impossible.'], report: report }; }

    var start = String(data.cycleStart || '').trim();
    var end = String(data.cycleEnd || '').trim();
    var existingPeriods = Array.isArray(data.periods) ? data.periods : [];
    var byKey = Object.create(null);
    var blocked = false;
    existingPeriods.forEach(function (period) {
      if (!period || typeof period !== 'object' || Array.isArray(period)) return;
      var year = Number(period.year);
      var month = Number(period.month);
      var status = String(period.status || '');
      var validKey = Number.isInteger(year) && year >= 1900 && year <= 9999 && Number.isInteger(month) && month >= 1 && month <= 12;
      if (!validKey) {
        if (status === 'closed' || (status && status !== 'open')) blocked = true;
        return;
      }
      if (status !== 'open' && status !== 'closed') { blocked = true; return; }
      var key = monthKey(year, month);
      if (!byKey[key]) byKey[key] = { year: year, month: month, status: status };
      else if (status === 'closed') byKey[key].status = 'closed';
    });
    if (blocked) return { ok: false, errors: ['Un statut de période ne peut pas être conservé sans interprétation humaine.'], report: report };

    cycleMonths(start, end).forEach(function (month) {
      var key = monthKey(month.year, month.month);
      if (!byKey[key]) byKey[key] = { year: month.year, month: month.month, status: 'open' };
    });
    data.periods = Object.keys(byKey).map(function (key) { return byKey[key]; })
      .sort(function (a, b) { return a.year - b.year || a.month - b.month; });
    data.exercise = Number(start.slice(0, 4));

    var changed = JSON.stringify(data.periods) !== JSON.stringify(state.periods || []) || data.exercise !== state.exercise;
    return {
      ok: true,
      changed: changed,
      data: data,
      repairedFields: changed ? ['periods', 'exercise'] : [],
      report: report
    };
  }

  var api = Object.freeze({ inspect: inspect, repair: repair, validIsoDate: validIsoDate });
  root.PerfectoAccountingDatabaseRepair = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
}(typeof window === 'object' ? window : globalThis));
