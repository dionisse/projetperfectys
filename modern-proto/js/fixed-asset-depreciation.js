/*
 * PERFECTO · Simulation indicative des amortissements
 * Lecture seule, sans génération de mouvements ni d'écritures.
 * Les conventions de départ sont toujours choisies explicitement par l'utilisateur.
 */
(function (root) {
  'use strict';

  var DAY_MS = 24 * 60 * 60 * 1000;
  var CONVENTIONS = {
    'month-full': 'Mois civil entier dès le mois de début',
    'days-exact': 'Prorata journalier exact (début inclus, fin exclue)'
  };

  function dateParts(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value == null ? '' : value));
    if (!match) return null;
    var parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
    if (parts.month < 1 || parts.month > 12 || parts.day < 1 || parts.day > daysInMonth(parts.year, parts.month)) return null;
    return parts;
  }

  function isLeapYear(year) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  }

  function daysInMonth(year, month) {
    return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] || 0;
  }

  function dateTime(parts) {
    var date = new Date(0);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
    return date.getTime();
  }

  function toIso(parts) {
    return String(parts.year).padStart(4, '0') + '-' + String(parts.month).padStart(2, '0') + '-' + String(parts.day).padStart(2, '0');
  }

  function monthIndex(parts) {
    return parts.year * 12 + parts.month - 1;
  }

  function monthParts(index, day) {
    var year = Math.floor(index / 12);
    var month = index - year * 12 + 1;
    return { year: year, month: month, day: Math.min(day || 1, daysInMonth(year, month)) };
  }

  function addMonthsClamped(parts, count) {
    return monthParts(monthIndex(parts) + count, parts.day);
  }

  function addDays(parts, count) {
    var date = new Date(dateTime(parts) + count * DAY_MS);
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
  }

  function monthLabel(month) {
    return ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][month - 1] || String(month);
  }

  function cycleMonths(cycleStart, cycleEnd) {
    var start = dateParts(cycleStart);
    var end = dateParts(cycleEnd);
    if (!start || !end || cycleEnd < cycleStart) return null;
    var startMonth = monthIndex(start);
    var endMonth = monthIndex(end);
    var endExclusive = dateTime(addDays(end, 1));
    var result = [];
    for (var index = startMonth; index <= endMonth; index += 1) {
      var month = monthParts(index, 1);
      var nextMonth = monthParts(index + 1, 1);
      var monthStart = dateTime(month);
      var monthEnd = dateTime(nextMonth);
      var periodStart = Math.max(monthStart, dateTime(start));
      var periodEnd = Math.min(monthEnd, endExclusive);
      result.push({
        index: index,
        year: month.year,
        month: month.month,
        label: monthLabel(month.month) + ' ' + month.year,
        startTime: periodStart,
        endTime: periodEnd
      });
    }
    return result;
  }

  function skipReason(asset) {
    if (!asset || typeof asset !== 'object') return 'Fiche d’immobilisation invalide.';
    if (asset.assetType === 'financiere') return 'Les immobilisations financières ne sont pas simulées comme amortissables.';
    if (asset.status !== 'en-service') {
      return asset.status === 'retiree'
        ? 'Le bien est retiré ; sa date de sortie n’est pas renseignée dans le registre.'
        : 'Le bien n’est pas encore en service.';
    }
    if (asset.depreciationMethod !== 'lineaire') {
      if (asset.depreciationMethod === 'a-definir') return 'La méthode d’amortissement reste à définir et à valider.';
      if (asset.depreciationMethod === 'degressif') return 'La convention dégressive et son articulation comptable/fiscale restent à valider.';
      if (asset.depreciationMethod === 'unites-oeuvre') return 'Les quantités réalisées par période ne sont pas encore disponibles.';
      if (asset.depreciationMethod === 'aucun') return 'La fiche est déclarée non amortissable.';
      return 'La méthode d’amortissement n’est pas reconnue.';
    }
    if (!dateParts(asset.depreciationStartDate)) return 'La date de début d’amortissement est absente ou invalide.';
    if (!Number.isInteger(Number(asset.usefulLifeMonths)) || Number(asset.usefulLifeMonths) < 1 || Number(asset.usefulLifeMonths) > 1200) {
      return 'La durée d’utilisation doit être renseignée entre 1 et 1 200 mois.';
    }
    var cost = Number(asset.grossCost);
    var residual = Number(asset.residualValue || 0);
    if (!Number.isSafeInteger(cost) || !Number.isSafeInteger(residual) || cost < 0 || residual < 0 || residual > cost) {
      return 'Le coût d’acquisition ou la valeur résiduelle n’est pas valide.';
    }
    if (cost - residual <= 0) return 'La base amortissable est nulle ou négative.';
    return '';
  }

  function simulateAsset(asset, periods, convention) {
    var reason = skipReason(asset);
    if (reason) return { ok: false, reason: reason };

    var start = dateParts(asset.depreciationStartDate);
    var life = Number(asset.usefulLifeMonths);
    var base = Number(asset.grossCost) - Number(asset.residualValue || 0);
    var schedule = [];
    if (convention === 'month-full') {
      var firstMonth = monthIndex(start);
      var endMonth = firstMonth + life;
      var monthlyAmount = base / life;
      periods.forEach(function (period) {
        if (period.index >= firstMonth && period.index < endMonth) {
          schedule.push({
            assetId: asset.id,
            code: String(asset.code || ''),
            name: String(asset.name || ''),
            period: period.label,
            year: period.year,
            month: period.month,
            amount: monthlyAmount
          });
        }
      });
    } else {
      var startTime = dateTime(start);
      var endTime = dateTime(addMonthsClamped(start, life));
      var totalDays = (endTime - startTime) / DAY_MS;
      if (!Number.isInteger(totalDays) || totalDays <= 0) return { ok: false, reason: 'La durée calendaire de la simulation est invalide.' };
      var dailyAmount = base / totalDays;
      periods.forEach(function (period) {
        var activeStart = Math.max(period.startTime, startTime);
        var activeEnd = Math.min(period.endTime, endTime);
        var activeDays = Math.max(0, (activeEnd - activeStart) / DAY_MS);
        if (activeDays > 0) {
          schedule.push({
            assetId: asset.id,
            code: String(asset.code || ''),
            name: String(asset.name || ''),
            period: period.label,
            year: period.year,
            month: period.month,
            amount: dailyAmount * activeDays
          });
        }
      });
    }

    if (!schedule.length) return { ok: false, reason: 'Aucune période d’amortissement du plan ne tombe dans le cycle actif.' };
    return {
      ok: true,
      assetId: asset.id,
      code: String(asset.code || ''),
      name: String(asset.name || ''),
      depreciableBase: base,
      schedule: schedule,
      cycleTotal: schedule.reduce(function (sum, row) { return sum + row.amount; }, 0)
    };
  }

  function simulate(assets, cycleStart, cycleEnd, convention) {
    if (!CONVENTIONS[convention]) return { ok: false, errors: ['Choisissez explicitement une convention de simulation.'] };
    var periods = cycleMonths(cycleStart, cycleEnd);
    if (!periods) return { ok: false, errors: ['Les dates du cycle actif ne sont pas valides.'] };
    if (!Array.isArray(assets)) return { ok: false, errors: ['Le registre des immobilisations est indisponible.'] };

    var plans = [];
    var excluded = [];
    var rows = [];
    assets.forEach(function (asset) {
      var plan = simulateAsset(asset, periods, convention);
      if (!plan.ok) {
        excluded.push({
          code: String(asset && asset.code || ''),
          name: String(asset && asset.name || ''),
          reason: plan.reason
        });
        return;
      }
      plans.push(plan);
      rows = rows.concat(plan.schedule);
    });
    rows.sort(function (left, right) {
      return left.year - right.year || left.month - right.month || left.name.localeCompare(right.name, 'fr');
    });
    return {
      ok: true,
      convention: convention,
      conventionLabel: CONVENTIONS[convention],
      cycleStart: cycleStart,
      cycleEnd: cycleEnd,
      periods: periods.map(function (period) { return { year: period.year, month: period.month, label: period.label }; }),
      plans: plans,
      excluded: excluded,
      rows: rows,
      total: rows.reduce(function (sum, row) { return sum + row.amount; }, 0)
    };
  }

  var api = Object.freeze({
    conventions: Object.freeze(Object.assign({}, CONVENTIONS)),
    simulate: simulate
  });
  root.PerfectoFixedAssetDepreciation = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
}(typeof window === 'object' ? window : globalThis));
