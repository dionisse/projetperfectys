/**
 * Fiche société : l'identité imprimée sur chaque document.
 *
 * PERFECTO WinDev ouvrait chaque dossier par cet écran (`society_screen_findings.md`,
 * dossier `CR000-26`). Ici elle n'est pas décorative : raison sociale, forme juridique,
 * IFU, adresse et coordonnées s'impriment en en-tête et en pied de page des exports PDF,
 * Excel et CSV. Une raison sociale absente produirait des pièces comptables sans
 * émetteur identifiable — d'où l'aperçu en direct, qui montre exactement ce qui sortira.
 */

import { useState } from "preact/hooks";
import {
  emptyOrganizationProfile,
  normalizeOrganizationProfile,
  organizationFooterIdentity,
  organizationHeaderLines,
  type OrganizationProfile
} from "@perfecto/domain";
import { DEMO_ORGANIZATION_ID, getKernel } from "../kernel";
import { AuditTrailFor, ErrorNote, Loading, PageHero, useAsync } from "../ui";

/** Champs de l'écran, dans l'ordre d'affichage ; les libellés suivent la fiche d'origine. */
const FIELDS: {
  key: keyof OrganizationProfile;
  label: string;
  placeholder: string;
  hint?: string;
  type?: "email" | "tel";
  maxLength: number;
  required?: boolean;
}[] = [
  {
    key: "name",
    label: "Raison sociale",
    placeholder: "Ex. PERFECTO Négoce Abidjan",
    hint: "Obligatoire : elle signe tous vos documents.",
    maxLength: 120,
    required: true
  },
  { key: "legalForm", label: "Forme juridique", placeholder: "SARL, SA, SCI…", maxLength: 40 },
  {
    key: "taxIdentifier",
    label: "Identifiant fiscal (IFU)",
    placeholder: "CI-2024-B-1187",
    hint: "Enregistré en majuscules : un identifiant administratif n'a pas de casse.",
    maxLength: 40
  },
  { key: "address", label: "Adresse", placeholder: "Boulevard Latrille, Cocody Danga", maxLength: 160 },
  { key: "city", label: "Ville", placeholder: "Abidjan", maxLength: 80 },
  { key: "country", label: "Pays", placeholder: "Côte d'Ivoire", maxLength: 80 },
  { key: "phone", label: "Téléphone", placeholder: "+225 27 22 44 55 66", type: "tel", maxLength: 40 },
  { key: "email", label: "Courriel", placeholder: "compta@societe.ci", type: "email", maxLength: 120 }
];

export function Society() {
  const kernel = getKernel();
  const { data, error, reload } = useAsync(() => kernel.getOrganization());
  // `null` = aucune modification en cours : l'écran montre les valeurs enregistrées.
  const [draft, setDraft] = useState<OrganizationProfile | null>(null);
  const [saving, setSaving] = useState(false);
  /**
   * Compteur de révision : l'historique d'audit est un composant autonome qui ne se
   * recharge pas tout seul. Le faire remonter après chaque enregistrement garantit que
   * la trace de la modification apparaît immédiatement sous les yeux de l'utilisateur.
   */
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  if (error) return <ErrorNote message={error} />;
  if (!data) return <Loading />;

  const current = draft ?? data;
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(data);
  const preview = previewOf(current);

  function edit(key: keyof OrganizationProfile, value: string) {
    setDraft({ ...current, [key]: value });
    setMessage(null);
    setFailure(null);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    setFailure(null);
    try {
      const updated = await kernel.updateOrganization({
        organizationId: DEMO_ORGANIZATION_ID,
        ...current
      });
      setDraft(null);
      setRevision((value) => value + 1);
      reload();
      setMessage(
        `Identité enregistrée : ${updated.name}. Vos prochains documents l'impriment en en-tête.`
      );
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHero
        eyebrow="Paramètres"
        title="Fiche société"
        subtitle="Cette identité s'imprime sur tous vos documents : en-tête, pied de page et fichier téléchargé."
      >
        <span class="phase-badge">{current.taxIdentifier || "IFU non renseigné"}</span>
      </PageHero>

      <div class="split-layout society-layout">
        <section class="panel form-panel">
          <span class="eyebrow">Identité du dossier</span>
          <h2>{current.name}</h2>
          <p>
            Les modifications s'appliquent immédiatement aux éditions suivantes. Les documents
            déjà téléchargés ne changent pas : ils sont une photographie à leur date de
            génération, ce qui garantit leur opposabilité.
          </p>

          <div class="form-grid">
            {FIELDS.map((field) => (
              <label class="field" key={field.key}>
                <span>
                  {field.label}
                  {field.required ? <strong class="required-mark" aria-hidden="true"> *</strong> : null}
                </span>
                <input
                  type={field.type ?? "text"}
                  maxlength={field.maxLength}
                  placeholder={field.placeholder}
                  value={current[field.key]}
                  onInput={(event) => edit(field.key, event.currentTarget.value)}
                />
                {field.hint ? <small class="field-hint">{field.hint}</small> : null}
              </label>
            ))}
          </div>

          {failure ? (
            <p class="form-message error" role="alert">
              {failure}
            </p>
          ) : null}
          {message ? (
            <p class="form-message success" role="status">
              {message}
            </p>
          ) : null}

          <div class="action-row">
            <button
              class="button button-primary"
              type="button"
              disabled={!dirty || saving || current.name.trim() === ""}
              onClick={() => void save()}
            >
              {saving ? "Enregistrement…" : "Enregistrer l'identité"}
            </button>
            {draft ? (
              <button class="button button-ghost" type="button" disabled={saving} onClick={() => setDraft(null)}>
                Annuler les modifications
              </button>
            ) : null}
          </div>
        </section>

        <div class="society-side">
          <section class="panel society-preview">
            <div class="panel-heading">
              <div>
                <span class="eyebrow">Aperçu sur vos documents</span>
                <h2>Ce qui s'imprimera</h2>
              </div>
            </div>
            {preview ? (
              <>
                <div class="document-letterhead" aria-live="polite">
                  {preview.header.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
                <p class="document-footer">{preview.footer} · Exercice 2026 · montants en XOF</p>
              </>
            ) : (
              <p class="form-message error">
                Les valeurs saisies ne sont pas encore valides : corrigez-les pour voir l'aperçu.
              </p>
            )}
            <p class="field-hint">
              Un champ laissé vide est simplement omis : l'en-tête ne se décale pas, comme sur les
              éditions du logiciel d'origine.
            </p>
          </section>

          <AuditTrailFor
            key={revision}
            entityId={DEMO_ORGANIZATION_ID}
            entityType="Organization"
            title="Historique de la fiche société"
            emptyLabel="Aucune modification enregistrée pour l'instant."
          />
        </div>
      </div>
    </>
  );
}

/**
 * En-tête et pied de page tels que les documents les imprimeront.
 *
 * @returns `null` quand la saisie en cours viole une règle du domaine — l'aperçu refuse
 * alors d'afficher un profil invalide plutôt que de montrer un résultat trompeur.
 */
function previewOf(
  profile: OrganizationProfile
): { header: string[]; footer: string } | null {
  try {
    const normalized = normalizeOrganizationProfile(profile, emptyOrganizationProfile(""));
    return {
      header: organizationHeaderLines(normalized),
      footer: organizationFooterIdentity(normalized)
    };
  } catch {
    return null;
  }
}
