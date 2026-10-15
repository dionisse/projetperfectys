/**
 * Éditions : le menu « Éditions » de PERFECTO WinDev, repris et étendu.
 *
 * Un seul écran pour tous les documents du dossier. À gauche le choix du document, à
 * droite ses paramètres puis l'aperçu — et sur chaque aperçu, les trois formats : PDF,
 * Excel et CSV. C'est l'utilisateur qui décide du format ; l'application ne lui en impose
 * aucun, conformément à la décision du 14/10/2026.
 *
 * Rien n'est recalculé ici : l'aperçu et les trois fichiers partagent le même
 * {@link ExportDocument} construit par le noyau.
 */

import { useState } from "preact/hooks";
import type { DocumentKind, ExportDocumentRequest } from "@perfecto/contracts";
import { DocumentKind as Kinds } from "@perfecto/contracts";
import { DEMO_ORGANIZATION_ID, getKernel } from "../kernel";
import { ErrorNote, ExportPanel, Loading, PageHero, useAsync } from "../ui";

interface EditionCard {
  kind: DocumentKind;
  icon: string;
  title: string;
  text: string;
}

const EDITION_GROUPS: { heading: string; items: EditionCard[] }[] = [
  {
    heading: "États comptables",
    items: [
      {
        kind: Kinds.trialBalance,
        icon: "=",
        title: "Balance générale",
        text: "Mouvements et soldes de tous les comptes, avec le contrôle d'égalité débit/crédit."
      },
      {
        kind: Kinds.journal,
        icon: "≡",
        title: "Journal des écritures",
        text: "Toutes les imputations validées, filtrables par journal et par période."
      },
      {
        kind: Kinds.generalLedger,
        icon: "▤",
        title: "Grand livre",
        text: "Compte par compte : mouvements, solde progressif et solde de clôture."
      },
      {
        kind: Kinds.entry,
        icon: "✓",
        title: "Pièce comptable",
        text: "Une pièce, ses lignes, son statut, ses justificatifs et sa contre-passation."
      }
    ]
  },
  {
    heading: "Comptes auxiliaires et référentiels",
    items: [
      {
        kind: Kinds.thirdPartyStatement,
        icon: "◉",
        title: "Relevé de tiers",
        text: "Mouvements lettrés, solde progressif et part restant en suspens d'un tiers."
      },
      {
        kind: Kinds.chartOfAccounts,
        icon: "0",
        title: "Plan comptable",
        text: "Les comptes du dossier : classe, nature, imputation et tiers obligatoire."
      },
      {
        kind: Kinds.thirdParties,
        icon: "◈",
        title: "Fichier des tiers",
        text: "Les fiches, leur identifiant fiscal, leur usage comptable et leur solde net."
      }
    ]
  },
  {
    heading: "Contrôle",
    items: [
      {
        kind: Kinds.auditTrail,
        icon: "§",
        title: "Piste d'audit",
        text: "Chaque acte de gestion : acteur, horodatage, opération et entité concernée."
      }
    ]
  }
];

/** Paramètres saisis à l'écran ; une valeur vide signifie « pas de filtre ». */
interface Filters {
  journalCode: string;
  accountCode: string;
  thirdPartyCode: string;
  entryId: string;
  from: string;
  to: string;
  entityType: string;
  limit: string;
}

const EMPTY_FILTERS: Filters = {
  journalCode: "",
  accountCode: "",
  thirdPartyCode: "",
  entryId: "",
  from: "",
  to: "",
  entityType: "",
  limit: ""
};

/** Types d'entité proposés pour filtrer la piste d'audit. */
const AUDIT_ENTITY_TYPES = [
  { value: "", label: "Toutes les entités" },
  { value: "AccountingEntry", label: "Pièces comptables" },
  { value: "ThirdParty", label: "Tiers" },
  { value: "GeneralAccount", label: "Comptes généraux" },
  { value: "AccountingPeriod", label: "Périodes" },
  { value: "Organization", label: "Société" }
];

export function Editions() {
  const kernel = getKernel();
  const [kind, setKind] = useState<DocumentKind>(Kinds.trialBalance);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  function patch(changes: Partial<Filters>) {
    setFilters({ ...filters, ...changes });
  }

  /** Repasse sur un document : les filtres de l'autre document ne suivent pas. */
  function choose(next: DocumentKind) {
    setKind(next);
    setFilters(EMPTY_FILTERS);
  }

  const { data, error } = useAsync(async () => {
    const [journals, accounts, thirdParties, entries, organization] = await Promise.all([
      kernel.getJournals(),
      kernel.getAccounts(),
      kernel.getThirdParties(),
      kernel.getEntries(),
      kernel.getOrganization()
    ]);
    return { journals, accounts, thirdParties, entries, organization };
  });

  if (error) return <ErrorNote message={error} />;
  if (!data) return <Loading />;

  const card =
    EDITION_GROUPS.flatMap((group) => group.items).find((item) => item.kind === kind) ??
    EDITION_GROUPS[0]!.items[0]!;
  const patched = completeFilters(kind, filters, data);
  const request = buildRequest(kind, patched);

  return (
    <>
      <PageHero
        eyebrow="Éditions"
        title="Éditions et exports"
        subtitle="Chaque document du dossier s'obtient au format voulu : PDF pour l'archive et l'impression, Excel pour le calcul, CSV pour l'échange."
      >
        <span class="phase-badge">{data.organization.name}</span>
      </PageHero>

      <div class="split-layout editions-layout">
        <nav class="edition-list" aria-label="Documents disponibles">
          {EDITION_GROUPS.map((group) => (
            <section class="panel edition-group" key={group.heading}>
              <span class="eyebrow">{group.heading}</span>
              {group.items.map((item) => (
                <button
                  key={item.kind}
                  type="button"
                  class={item.kind === kind ? "edition-card selected" : "edition-card"}
                  aria-pressed={item.kind === kind}
                  onClick={() => choose(item.kind)}
                >
                  <span class="edition-icon">{item.icon}</span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.text}</small>
                  </span>
                </button>
              ))}
            </section>
          ))}
        </nav>

        <div class="edition-workspace">
          <section class="panel form-panel">
            <span class="eyebrow">Paramètres de l'édition</span>
            <h2>{card.title}</h2>
            <p>{card.text}</p>

            {kind === Kinds.journal ? (
              <label class="field">
                <span>Journal</span>
                <select
                  value={filters.journalCode}
                  onChange={(event) => patch({ journalCode: event.currentTarget.value })}
                >
                  <option value="">Tous les journaux</option>
                  {data.journals.map((journal) => (
                    <option key={journal.code} value={journal.code}>
                      {journal.code} · {journal.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {kind === Kinds.generalLedger ? (
              <label class="field">
                <span>Compte</span>
                <select
                  value={filters.accountCode}
                  onChange={(event) => patch({ accountCode: event.currentTarget.value })}
                >
                  <option value="">Tous les comptes mouvementés</option>
                  {data.accounts.map((account) => (
                    <option key={account.code} value={account.code}>
                      {account.code} · {account.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {kind === Kinds.entry ? (
              <label class="field">
                <span>Pièce</span>
                <select
                  value={patched.entryId}
                  onChange={(event) => patch({ entryId: event.currentTarget.value })}
                >
                  {data.entries.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.number} · {entry.reference || entry.description}
                    </option>
                  ))}
                </select>
                <small class="field-hint">
                  Les pièces validées et leurs contre-passations sont éditables ; un brouillon
                  l'est aussi, avec la mention qu'il n'alimente aucun état.
                </small>
              </label>
            ) : null}

            {kind === Kinds.thirdPartyStatement ? (
              <label class="field">
                <span>Tiers</span>
                <select
                  value={patched.thirdPartyCode}
                  onChange={(event) => patch({ thirdPartyCode: event.currentTarget.value })}
                >
                  {data.thirdParties.map((party) => (
                    <option key={party.code} value={party.code}>
                      {party.code} · {party.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {kind === Kinds.auditTrail ? (
              <>
                <label class="field">
                  <span>Entité concernée</span>
                  <select
                    value={filters.entityType}
                    onChange={(event) => patch({ entityType: event.currentTarget.value })}
                  >
                    {AUDIT_ENTITY_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label class="field">
                  <span>Nombre d'événements</span>
                  <select value={filters.limit} onChange={(event) => patch({ limit: event.currentTarget.value })}>
                    <option value="">Tous</option>
                    <option value="25">25 derniers</option>
                    <option value="100">100 derniers</option>
                    <option value="500">500 derniers</option>
                  </select>
                </label>
              </>
            ) : null}

            {RANGE_KINDS.includes(kind) ? (
              <div class="form-grid">
                <label class="field">
                  <span>Du</span>
                  <input
                    type="date"
                    value={filters.from}
                    min="2026-01-01"
                    max="2026-12-31"
                    onInput={(event) => patch({ from: event.currentTarget.value })}
                  />
                </label>
                <label class="field">
                  <span>{kind === Kinds.trialBalance ? "Arrêtée au" : "Au"}</span>
                  <input
                    type="date"
                    value={filters.to}
                    min="2026-01-01"
                    max="2026-12-31"
                    onInput={(event) => patch({ to: event.currentTarget.value })}
                  />
                </label>
              </div>
            ) : null}

            {filters.from !== "" || filters.to !== "" || filters.journalCode !== "" ? (
              <div class="action-row">
                <button class="button button-ghost" type="button" onClick={() => setFilters(EMPTY_FILTERS)}>
                  Réinitialiser les paramètres
                </button>
              </div>
            ) : null}
          </section>

          <ExportPanel
            key={`${kind}-${JSON.stringify(patched)}`}
            request={request}
            heading={panelHeading(kind, patched, data)}
            hint="Le fichier obtenu porte l'identité de la société, l'exercice, la devise et l'horodatage de génération."
            maxRows={kind === Kinds.chartOfAccounts ? 8 : 12}
          />
        </div>
      </div>
    </>
  );
}

/**
 * Demande envoyée au noyau : seuls les filtres réellement choisis y figurent, pour que
 * l'aperçu et le fichier téléchargé partagent exactement les mêmes critères.
 */
function buildRequest(kind: DocumentKind, completed: Filters): ExportDocumentRequest {
  return {
      organizationId: DEMO_ORGANIZATION_ID,
      kind,
      ...(kind === Kinds.journal && completed.journalCode !== ""
        ? { journalCode: completed.journalCode }
        : {}),
      ...(kind === Kinds.generalLedger && completed.accountCode !== ""
        ? { accountCode: completed.accountCode }
        : {}),
      ...(kind === Kinds.entry && completed.entryId !== "" ? { entryId: completed.entryId } : {}),
      ...(kind === Kinds.thirdPartyStatement && completed.thirdPartyCode !== ""
        ? { thirdPartyCode: completed.thirdPartyCode }
        : {}),
      ...(kind === Kinds.auditTrail && completed.entityType !== ""
        ? { entityType: completed.entityType }
        : {}),
      ...(kind === Kinds.auditTrail && completed.limit !== ""
        ? { limit: Number(completed.limit) }
        : {}),
      ...(RANGE_KINDS.includes(kind) && completed.from !== "" ? { from: completed.from } : {}),
      ...(RANGE_KINDS.includes(kind) && completed.to !== "" ? { to: completed.to } : {})
    };
}

/** Documents qui acceptent une période ; la balance n'a besoin que d'une date d'arrêt. */
const RANGE_KINDS: DocumentKind[] = [
  Kinds.journal,
  Kinds.generalLedger,
  Kinds.thirdPartyStatement,
  Kinds.trialBalance
];

/**
 * Un document sur une entité précise exige cette entité : à l'ouverture de l'écran, la
 * première pièce, le premier tiers ou le premier compte est retenu pour que l'aperçu ne
 * soit jamais vide d'un paramètre obligatoire.
 */
function completeFilters(
  kind: DocumentKind,
  filters: Filters,
  data: {
    entries: { id: string; status: string }[];
    thirdParties: { code: string }[];
    accounts: { code: string }[];
  }
): Filters {
  if (kind === Kinds.entry && filters.entryId === "") {
    // À défaut de choix, on propose une pièce validée : c'est le document qui a une valeur
    // probante. Un brouillon reste éditable, mais il ne doit pas être le document par défaut.
    const posted = data.entries.find((entry) => entry.status === "posted");
    return { ...filters, entryId: posted?.id ?? data.entries[0]?.id ?? "" };
  }
  if (kind === Kinds.thirdPartyStatement && filters.thirdPartyCode === "") {
    return { ...filters, thirdPartyCode: data.thirdParties[0]?.code ?? "" };
  }
  return filters;
}

function panelHeading(
  kind: DocumentKind,
  filters: Filters,
  data: { entries: { id: string; number: string }[] }
): string {
  switch (kind) {
    case Kinds.journal:
      return filters.journalCode === "" ? "Journal des écritures" : `Journal ${filters.journalCode}`;
    case Kinds.generalLedger:
      return filters.accountCode === ""
        ? "Grand livre général"
        : `Grand livre du compte ${filters.accountCode}`;
    case Kinds.entry: {
      const entry = data.entries.find((item) => item.id === filters.entryId);
      return entry ? `Pièce ${entry.number}` : "Pièce comptable";
    }
    case Kinds.thirdPartyStatement:
      return filters.thirdPartyCode === ""
        ? "Relevé auxiliaire"
        : `Relevé auxiliaire ${filters.thirdPartyCode}`;
    case Kinds.trialBalance:
      return "Balance générale";
    case Kinds.chartOfAccounts:
      return "Plan comptable";
    case Kinds.thirdParties:
      return "Fichier des tiers";
    default:
      return "Piste d'audit";
  }
}
