/*
 * Recherche cohérente dans les codes de comptes : une requête numérique
 * correspond au début du code, jamais à une suite de chiffres au milieu.
 */
(function (root) {
  'use strict';

  function normalize(value) {
    return String(value == null ? '' : value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('fr');
  }

  function codeQuery(value) {
    var query = normalize(value).trim();
    if (!/^\d[\d.*-]*$/.test(query)) return '';
    return query.replace(/\*+$/, '');
  }

  function matches(code, label, query) {
    var needle = normalize(query).trim();
    if (!needle) return true;
    var prefix = codeQuery(needle);
    if (prefix) return String(code == null ? '' : code).trim().toLocaleLowerCase('fr').indexOf(prefix) === 0;
    return normalize([code, label].join(' ')).indexOf(needle) !== -1;
  }

  var api = Object.freeze({ normalize: normalize, codeQuery: codeQuery, matches: matches });
  root.PerfectoAccountSearch = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : globalThis));
