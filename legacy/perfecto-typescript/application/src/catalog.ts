/**
 * Catalogue de départ SYSCOHADA révisé (18 comptes, 6 journaux).
 * Portage de Perfecto.Application/Accounting/SyscohadaStarterCatalog.cs.
 * Source unique : plus aucune copie dans les adaptateurs (IndexedDB, démo).
 */

import type { AccountingJournalDto, GeneralAccountDto } from "@perfecto/contracts";

export const SYSCOHADA_STARTER_ACCOUNTS: readonly GeneralAccountDto[] = [
  { code: "101000", label: "Capital social", accountClass: "1", accountType: "Capitaux", allowsPosting: true, requiresThirdParty: false, isActive: true },
  { code: "111000", label: "Report à nouveau", accountClass: "1", accountType: "Capitaux", allowsPosting: true, requiresThirdParty: false, isActive: true },
  { code: "201000", label: "Frais d'établissement", accountClass: "2", accountType: "Immobilisation", allowsPosting: true, requiresThirdParty: false, isActive: true },
  { code: "231000", label: "Bâtiments", accountClass: "2", accountType: "Immobilisation", allowsPosting: true, requiresThirdParty: false, isActive: true },
  { code: "244000", label: "Matériel et mobilier", accountClass: "2", accountType: "Immobilisation", allowsPosting: true, requiresThirdParty: false, isActive: true },
  { code: "311000", label: "Marchandises", accountClass: "3", accountType: "Stock", allowsPosting: true, requiresThirdParty: false, isActive: true },
  { code: "401100", label: "Fournisseurs", accountClass: "4", accountType: "Tiers", allowsPosting: true, requiresThirdParty: true, isActive: true },
  { code: "411100", label: "Clients", accountClass: "4", accountType: "Tiers", allowsPosting: true, requiresThirdParty: true, isActive: true },
  { code: "443100", label: "TVA facturée", accountClass: "4", accountType: "État", allowsPosting: true, requiresThirdParty: false, isActive: true },
  { code: "445200", label: "TVA récupérable sur achats", accountClass: "4", accountType: "État", allowsPosting: true, requiresThirdParty: false, isActive: true },
  { code: "521100", label: "Banque locale", accountClass: "5", accountType: "Trésorerie", allowsPosting: true, requiresThirdParty: false, isActive: true },
  { code: "571100", label: "Caisse siège social", accountClass: "5", accountType: "Trésorerie", allowsPosting: true, requiresThirdParty: false, isActive: true },
  { code: "601100", label: "Achats de marchandises", accountClass: "6", accountType: "Charge", allowsPosting: true, requiresThirdParty: false, isActive: true },
  { code: "661100", label: "Rémunérations directes versées au personnel", accountClass: "6", accountType: "Charge", allowsPosting: true, requiresThirdParty: false, isActive: true },
  { code: "664100", label: "Charges sociales sur rémunérations", accountClass: "6", accountType: "Charge", allowsPosting: true, requiresThirdParty: false, isActive: true },
  { code: "701100", label: "Ventes de marchandises", accountClass: "6", accountType: "Produit", allowsPosting: true, requiresThirdParty: false, isActive: true },
  { code: "706100", label: "Services vendus", accountClass: "7", accountType: "Produit", allowsPosting: true, requiresThirdParty: false, isActive: true },
  { code: "771000", label: "Intérêts de prêts", accountClass: "7", accountType: "Produit financier", allowsPosting: true, requiresThirdParty: false, isActive: true }
];

export const STARTER_JOURNALS: readonly AccountingJournalDto[] = [
  { code: "ACH", label: "Journal des achats", journalType: "Achats", counterpartAccount: null, isActive: true },
  { code: "VTE", label: "Journal des ventes", journalType: "Ventes", counterpartAccount: null, isActive: true },
  { code: "BQ1", label: "Banque principale", journalType: "Banque", counterpartAccount: "521100", isActive: true },
  { code: "CAI", label: "Caisse siège", journalType: "Caisse", counterpartAccount: "571100", isActive: true },
  { code: "OD", label: "Opérations diverses", journalType: "Opérations diverses", counterpartAccount: null, isActive: true },
  { code: "AN", label: "À-nouveaux", journalType: "À-nouveaux", counterpartAccount: null, isActive: true }
];

/* ------------------------------------------------------------------ */
/* Modules et dossiers de l'intégrateur                                */
/* ------------------------------------------------------------------ */

/**
 * Catalogue des modules de l'intégrateur PERFECTO.
 *
 * Les quatorze variantes observées dans le logiciel d'origine (`SPEC-ORIGINAL-PERFECTO.md`
 * §3) ne sont pas des applications distinctes : règle **R-REF-1**, ce sont des **profils
 * versionnés** du même noyau — plan initial, classes, contrôles, modèles d'états, règles de
 * clôture, taxes et formats d'export. Règle **R-REF-2** : un profil validé n'est jamais
 * modifié rétroactivement, il migre explicitement ou s'active à un nouvel exercice.
 *
 * Un seul profil est implémenté aujourd'hui : `CR`, celui du dossier de démonstration. Les
 * autres sont listés parce qu'ils existent dans le produit et que l'écran de gestion doit
 * les montrer — jamais comme des fonctions disponibles.
 */
export interface ModuleProfile {
  readonly code: string;
  readonly label: string;
  readonly referential: string;
  readonly implemented: boolean;
}

export const MODULE_PROFILES: readonly ModuleProfile[] = [
  { code: "CR", label: "Comptabilité SYSCOHADA révisé", referential: "SYSCOHADA révisé (OHADA)", implemented: true },
  { code: "CO", label: "Comptabilité OHADA", referential: "SYSCOHADA non révisé", implemented: false },
  { code: "CG", label: "Comptabilité France", referential: "Plan comptable général français", implemented: false },
  { code: "CC", label: "Comptabilité générale PARMEC", referential: "PARMEC (BCEAO)", implemented: false },
  { code: "CB", label: "Bancaire UEMOA", referential: "Plan bancaire UEMOA", implemented: false },
  { code: "CF", label: "SFD Microfinance", referential: "Plan comptable SFD microfinance", implemented: false },
  { code: "CI", label: "CIPRES", referential: "Comptabilité sociale et financière", implemented: false },
  { code: "CQ", label: "Comptabilité SYSCBNL", referential: "SYSCBNL (banque nationale)", implemented: false },
  { code: "CS", label: "S.G.I.", referential: "Société de gestion et d'intermédiation", implemented: false },
  { code: "CA", label: "Assurances CIMA", referential: "Plan comptable CIMA", implemented: false },
  { code: "CL", label: "Plan comptable libre", referential: "Plan libre défini par le dossier", implemented: false },
  { code: "GM", label: "Comptabilité des matières", referential: "Suivi des matières", implemented: false },
  { code: "GP", label: "Maîtrise d'Ouvrages Déléguée", referential: "Comptabilité d'opérations déléguées", implemented: false },
  { code: "IN", label: "Intégrateur PERFECTO", referential: "Gestion des sociétés et des dossiers", implemented: false }
];

/** Le profil actif du prototype : le seul dont le noyau applique le référentiel. */
export function activeModuleProfile(): ModuleProfile {
  return MODULE_PROFILES.find((profile) => profile.implemented) ?? MODULE_PROFILES[0]!;
}

/**
 * Code dossier, à la manière de l'original : module + code société + année sur deux
 * chiffres. `CR` + `000` + `2026` donne `CR000-26`, le répertoire du dossier de
 * démonstration.
 *
 * Sans code société renseigné, on ne fabrique pas un faux `000` : le code reste court et
 * l'écran de gestion invite à compléter la fiche.
 */
export function dossierCode(moduleCode: string, societyCode: string, year: number): string {
  const society = societyCode.trim().toUpperCase();
  const suffix = String(year % 100).padStart(2, "0");
  return society === ""
    ? `${moduleCode.trim().toUpperCase()}-${suffix}`
    : `${moduleCode.trim().toUpperCase()}${society}-${suffix}`;
}
