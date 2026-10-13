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
