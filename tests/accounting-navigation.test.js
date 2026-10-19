/* Vérifie la hiérarchie des menus et le statut d’activation par défaut. */
'use strict';

const assert = require('node:assert/strict');
const nav = require('../modern-proto/js/accounting-navigation.js');

const groups = nav.all();
assert.deepEqual(groups.map(group => group.id), [
  'fichier', 'definitions', 'saisie', 'editions', 'declarations', 'fin-exercice', 'parametres', 'outils'
]);
assert.deepEqual(groups.map(group => group.label), [
  'Fichier', 'Définitions', 'Saisie', 'Éditions', 'Déclarations périodiques',
  'Opérations de fin d’exercice', 'Paramètres', 'Outils'
]);

const labels = groups.flatMap(group => group.tabs.flatMap(tab => [
  tab.label,
  ...(tab.children || []).map(child => child.label)
]));
[
  'Importation d’une balance générale',
  'Centralisation auxiliaire interne',
  'Centralisation des salaires depuis Paie et RH',
  'Centralisation des opérations depuis Vente, Stock et Facturation',
  'Annulation d’une centralisation',
  'Recalcul du solde des comptes',
  'Réparation complète de la base',
  'Consolidation avant résultat',
  'Consolidation après résultat',
  'Comptes généraux',
  'Fournisseurs',
  'Clients',
  'Prestations',
  'Personnel',
  'Localisation des immobilisations corporelles',
  'Éléments immobilisés',
  'Frais sur véhicules',
  'Bénéficiaires de frais de mission',
  'Natures des flux de trésorerie',
  'Saisie dans les journaux',
  'Opérations de caisse en temps réel',
  'Reports à nouveau',
  'Journaux',
  'Comptes en devises',
  'États analytiques',
  'Comptes à payer (analytique)',
  'Tableaux financiers OHADA révisé',
  'Arrêt définitif des comptes de l’exercice',
  'Calculatrice',
  'Capture d’écran'
].forEach(label => assert(labels.includes(label), `Élément de menu manquant : ${label}`));

const findTab = (groupId, tabId) => nav.getTab(groupId, tabId);
assert.equal(findTab('definitions', 'general-accounts').status, 'active');
assert.equal(findTab('definitions', 'suppliers').status, 'partial');
assert.ok(findTab('definitions', 'suppliers').reason.includes('archivage'));
assert.ok(findTab('definitions', 'suppliers').reason.includes('centralisation'));
assert.equal(findTab('definitions', 'clients').status, 'partial');
assert.ok(findTab('definitions', 'clients').reason.includes('CLI'));
assert.ok(findTab('definitions', 'clients').reason.includes('dossiers clients du cabinet'));
assert.equal(findTab('definitions', 'services').status, 'partial');
assert.ok(findTab('definitions', 'services').reason.includes('Référentiel local'));
assert.ok(findTab('definitions', 'services').reason.includes('facturation'));
assert.equal(findTab('definitions', 'other-debtors-creditors').status, 'partial');
assert.ok(findTab('definitions', 'other-debtors-creditors').reason.includes('DEB/CRE'));
assert.equal(findTab('definitions', 'personnel').status, 'partial');
assert.ok(findTab('definitions', 'personnel').reason.includes('PER'));
assert.equal(findTab('definitions', 'fixed-asset-locations').status, 'partial');
assert.ok(findTab('definitions', 'fixed-asset-locations').reason.includes('hiérarchique'));
assert.ok(findTab('definitions', 'fixed-asset-locations').reason.includes('parent/enfant'));
assert.ok(findTab('definitions', 'fixed-asset-locations').reason.includes('affectés aux fiches'));
assert.equal(findTab('definitions', 'fixed-assets').status, 'partial');
assert.ok(findTab('definitions', 'fixed-assets').reason.includes('classe 2/28/68'));
assert.ok(findTab('definitions', 'fixed-assets').reason.includes('non comptabilisant'));
assert.ok(findTab('definitions', 'fixed-assets').reason.includes('choisie explicitement'));
assert.ok(findTab('definitions', 'fixed-assets').reason.includes('restent à construire'));
assert.equal(findTab('definitions', 'journals').status, 'active');
assert.ok(findTab('definitions', 'journals').reason.includes('journaux libres'));
assert.ok(findTab('definitions', 'journals').reason.includes('réservés au système'));
assert.equal(findTab('saisie', 'journal-entry').status, 'active');
assert.ok(findTab('saisie', 'journal-entry').reason.includes('double-clic'));
assert.equal(findTab('saisie', 'journal-entry').actions, undefined, 'le tableau de sélection des journaux est directement intégré au sous-menu');
assert.equal(findTab('saisie', 'live-cash').status, 'partial');
assert.ok(findTab('saisie', 'live-cash').reason.includes('journal Caisse (CA)'));
assert.ok(findTab('saisie', 'live-cash').reason.includes('synchronisation multi-utilisateur'));
assert.equal(findTab('fichier', 'export-other').status, 'partial');
assert.equal(findTab('fichier', 'import-other').status, 'partial');
assert.equal(findTab('fichier', 'import-balance').status, 'partial');
assert.ok(findTab('fichier', 'import-balance').reason.includes('PERFECTO-BALANCE v1'));
assert.equal(findTab('fichier', 'centralize-auxiliary').status, 'planned');
assert.ok(findTab('fichier', 'centralize-auxiliary').reason.includes('modules internes'));
assert.ok(findTab('fichier', 'centralize-auxiliary').reason.includes('n’alimente pas une centralisation interne'));
assert.equal(findTab('fichier', 'centralize-payroll').status, 'partial');
assert.ok(findTab('fichier', 'centralize-payroll').reason.includes('module interne Paie & RH'));
assert.ok(findTab('fichier', 'centralize-payroll').reason.includes('sans import de fichier externe'));
assert.equal(findTab('fichier', 'centralize-sales').status, 'partial');
assert.ok(findTab('fichier', 'centralize-sales').reason.includes('module maison Ventes, stock & facturation'));
assert.ok(findTab('fichier', 'centralize-sales').reason.includes('sans fichier ni logiciel tiers'));
assert.equal(findTab('fichier', 'cancel-centralization').status, 'partial');
assert.ok(findTab('fichier', 'cancel-centralization').reason.includes('écriture inverse'));
assert.ok(findTab('fichier', 'cancel-centralization').reason.includes('sources tierces'));
assert.equal(findTab('fichier', 'recalculate-balances').status, 'partial');
assert.ok(findTab('fichier', 'recalculate-balances').reason.includes('aucun solde ni aucune écriture n’est modifié'));
assert.equal(findTab('fichier', 'repair-database').status, 'partial');
assert.ok(findTab('fichier', 'repair-database').reason.includes('jamais automatisée'));
assert.equal(findTab('fichier', 'consolidate-before-result').status, 'partial');
assert.ok(findTab('fichier', 'consolidate-before-result').reason.includes('provenance de chaque ligne source'));
assert.ok(findTab('fichier', 'consolidate-before-result').reason.includes('aucun mouvement n’est ajouté au grand livre'));
assert.equal(findTab('fichier', 'consolidate-after-result').status, 'partial');
assert.ok(findTab('fichier', 'consolidate-after-result').reason.includes('provenance de chaque ligne source'));
assert.ok(findTab('fichier', 'consolidate-after-result').reason.includes('ne sont ni calculés ni comptabilisés'));
assert.equal(findTab('editions', 'journals').status, 'active');
assert.equal(findTab('editions', 'general-accounts').status, 'active');
assert.equal(findTab('editions', 'analytic-statements').status, 'inactive');
assert.equal(findTab('definitions', 'responsibility-centers').status, 'inactive');
assert.equal(findTab('outils', 'calculator').status, 'inactive');
assert.equal(findTab('outils', 'screenshot').status, 'inactive');
assert.equal(findTab('fin-exercice', 'period-close').status, 'partial');
assert.equal(findTab('fin-exercice', 'period-close').actions[0].route, 'periods');
assert.equal(findTab('fin-exercice', 'definitive-close').irreversible, true);
assert.equal(findTab('fin-exercice', 'definitive-close').status, 'planned');
assert.deepEqual(findTab('editions', 'general-accounts').actions.map(action => action.route), ['balance', 'ledger']);

console.log('Navigation comptable : 8 menus, hiérarchie, périmètre et états inactifs — OK');
