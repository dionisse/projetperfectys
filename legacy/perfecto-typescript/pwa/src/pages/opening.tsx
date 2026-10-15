/**
 * Ouverture des dossiers — l'écran d'entrée de l'intégrateur PERFECTO.
 *
 * Reproduit sur le fond, d'après les relevés du logiciel d'origine :
 *  - le gestionnaire affiche le **module** (`Comptabilité SYSCOHADA révisé`), la **société**,
 *    la **période** (`01/01/2026 - 31/12/2026`) et la **session ouverte**
 *    (`accounting_shell_findings.md`) ;
 *  - le dossier est identifié par son code `CR000-26`, formé du module, du code société et
 *    de l'année (`dossier_findings.md`) ;
 *  - la société doit **préexister** au dossier, et le bouton du formulaire est
 *    `Sociétés… <F2>` ; une saisie libre non conforme est refusée par « Code société
 *    invalide » (`module_selection_findings.md`) ;
 *  - la fiche société est organisée en onglets Définition, Adresse, Contact, **IFU**
 *    (`society_screen_findings.md`) ;
 *  - les opérations sur dossier sont Insérer, Dupliquer, Supprimer, Positionner,
 *    Actualiser, Réindexer, Ouverture, Sauvegarde, Restauration, Fermer, avec les
 *    métadonnées de dernière sauvegarde et dernière modification.
 *
 * Ce qui n'est pas encore implémenté est affiché comme tel, avec la tranche qui le livrera.
 * Aucun bouton ne fait semblant.
 */

import { useState } from "preact/hooks";
import { MODULE_PROFILES } from "@perfecto/application";
import { organizationFooterIdentity, organizationHeaderLines } from "@perfecto/domain";
import { getKernel } from "../kernel";
import { ErrorNote, Icon, Loading, PageHero, formatTimestamp, navigate, useAsync } from "../ui";

/** Onglets de la fiche société, dans l'ordre de l'original. */
const SOCIETY_TABS = ["Définition", "Adresse", "Contact", "IFU"] as const;

type SocietyTab = (typeof SOCIETY_TABS)[number];

export function Opening() {
  const kernel = getKernel();
  const { data, error, reload } = useAsync(async () => {
    const [context, organization] = await Promise.all([
      kernel.getDossierContext(),
      kernel.getOrganization()
    ]);
    return { context, organization };
  });
  const [tab, setTab] = useState<SocietyTab>("Définition");

  if (error) return <ErrorNote message={error} />;
  if (!data) return <Loading label="Ouverture du dossier…" />;

  const { context, organization } = data;

  return (
    <>
      <PageHero
        eyebrow="Intégrateur PERFECTO"
        title="Ouverture des dossiers"
        subtitle="Un dossier est la combinaison d'un module, d'une société et d'une période. La société doit exister avant le dossier ; le référentiel comptable est choisi à sa création et ne se modifie plus rétroactivement."
      >
        <span class="phase-badge">Session {context.actor}</span>
      </PageHero>

      <div class="opening-grid">
        <div class="opening-main">
          <section class="panel dossier-panel">
            <div class="panel-heading">
              <div>
                <span class="eyebrow">Dossier actif</span>
                <h2>
                  {context.dossierCode} : {context.moduleLabel} {context.societyName}
                </h2>
              </div>
              <span class="status-badge success">Ouvert</span>
            </div>

            <dl class="definition-list">
              <dt>Code dossier</dt>
              <dd>{context.dossierCode}</dd>
              <dt>Module</dt>
              <dd>
                {context.moduleCode} — {context.moduleLabel}
              </dd>
              <dt>Référentiel</dt>
              <dd>{context.referential}</dd>
              <dt>Société</dt>
              <dd>
                {context.societyCode || "sans code"} — {context.societyName}
              </dd>
              <dt>Période</dt>
              <dd>{context.periodLabel}</dd>
              <dt>Exercice</dt>
              <dd>
                {context.fiscalYear} · {context.closedPeriodCount} période(s) clôturée(s)
              </dd>
              <dt>Devise</dt>
              <dd>{context.currency}</dd>
              <dt>Session</dt>
              <dd>{context.actor}</dd>
              <dt>Stockage</dt>
              <dd>{context.storageMode}</dd>
              <dt>Dernière modification</dt>
              <dd>
                {context.lastModifiedAt
                  ? `${formatTimestamp(context.lastModifiedAt)} — ${context.lastModifiedLabel}`
                  : "aucune écriture sur ce dossier"}
              </dd>
              <dt>Dernière sauvegarde</dt>
              <dd>
                <span class="operation-state" title="Sauvegarde et restauration testables : tranche 9">
                  jamais — fonction à venir
                </span>
              </dd>
            </dl>

            <div class="action-row">
              <button
                class="button button-primary"
                type="button"
                onClick={() => navigate("/comptabilite")}
              >
                Ouvrir le module comptable
              </button>
              <button class="button button-secondary" type="button" onClick={reload}>
                Actualiser
              </button>
              <button
                class="button button-ghost"
                type="button"
                onClick={() => navigate("/parametres/societe")}
                title="Sociétés… <F2>"
              >
                Sociétés… <span class="nav-shortcut">F2</span>
              </button>
            </div>
          </section>

          <section class="panel modules-panel">
            <div class="panel-heading">
              <div>
                <span class="eyebrow">Catalogue des modules</span>
                <h2>Référentiels comptables</h2>
              </div>
              <span class="status-badge">
                {MODULE_PROFILES.filter((profile) => profile.implemented).length} implémenté ·{" "}
                {MODULE_PROFILES.length} profils
              </span>
            </div>
            <p class="field-hint">
              Les variantes ne sont pas des applications distinctes mais des profils versionnés du
              même noyau : plan initial, classes, contrôles, modèles d'états, règles de clôture,
              taxes et formats d'export. Un profil validé n'est jamais modifié rétroactivement.
            </p>
            <div class="module-grid">
              {MODULE_PROFILES.map((profile) => (
                <button
                  key={profile.code}
                  type="button"
                  class={
                    profile.code === context.moduleCode ? "module-card selected" : "module-card"
                  }
                  disabled={!profile.implemented}
                  title={
                    profile.implemented
                      ? `Profil actif du dossier ${context.dossierCode}`
                      : "Profil prévu : le noyau n'applique pas encore ce référentiel"
                  }
                  aria-pressed={profile.code === context.moduleCode}
                >
                  <strong>
                    <span class="module-code">{profile.code}</span>
                    {profile.label}
                  </strong>
                  <small>{profile.referential}</small>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div class="opening-side">
          <section class="panel society-panel">
            <div class="panel-heading">
              <div>
                <span class="eyebrow">Société du dossier</span>
                <h2>{organization.name}</h2>
              </div>
            </div>

            <div class="tab-strip" role="tablist" aria-label="Onglets de la fiche société">
              {SOCIETY_TABS.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  id={`societe-onglet-${item}`}
                  aria-selected={tab === item}
                  aria-controls="societe-contenu"
                  onClick={() => setTab(item)}
                >
                  {item}
                </button>
              ))}
            </div>

            <div class="tab-panel" role="tabpanel" id="societe-contenu" aria-labelledby={`societe-onglet-${tab}`}>
              {tab === "Définition" ? (
                <dl class="definition-list">
                  <dt>Code société</dt>
                  <dd>{organization.code || "non renseigné"}</dd>
                  <dt>Raison sociale</dt>
                  <dd>{organization.name}</dd>
                  <dt>Forme juridique</dt>
                  <dd>{organization.legalForm || "non renseignée"}</dd>
                  <dt>État</dt>
                  <dd>Active</dd>
                </dl>
              ) : null}
              {tab === "Adresse" ? (
                <dl class="definition-list">
                  <dt>Adresse</dt>
                  <dd>{organization.address || "non renseignée"}</dd>
                  <dt>Ville</dt>
                  <dd>{organization.city || "non renseignée"}</dd>
                  <dt>Pays</dt>
                  <dd>{organization.country || "non renseigné"}</dd>
                </dl>
              ) : null}
              {tab === "Contact" ? (
                <dl class="definition-list">
                  <dt>Téléphone</dt>
                  <dd>{organization.phone || "non renseigné"}</dd>
                  <dt>Courriel</dt>
                  <dd>{organization.email || "non renseigné"}</dd>
                </dl>
              ) : null}
              {tab === "IFU" ? (
                <>
                  <dl class="definition-list">
                    <dt>Identifiant financier unique</dt>
                    <dd>{organization.taxIdentifier || "non renseigné"}</dd>
                  </dl>
                  <p class="field-hint">
                    L'IFU s'imprime en pied de chaque document exporté, avec la raison sociale et
                    la ville : c'est lui qui rend une édition opposable à un tiers.
                  </p>
                </>
              ) : null}
            </div>

            <div class="document-letterhead" aria-label="En-tête imprimé sur les documents">
              {organizationHeaderLines(organization).map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            <p class="document-footer">{organizationFooterIdentity(organization)}</p>
          </section>

          <section class="panel operations-panel">
            <div class="panel-heading">
              <div>
                <span class="eyebrow">Opérations sur le dossier</span>
                <h2>Ce que ce dossier contient</h2>
              </div>
            </div>
            <ul class="operation-list">
              <Operation label="Comptes généraux" detail="Plan SYSCOHADA révisé du profil CR" value={context.counts.accounts} />
              <Operation label="Journaux" detail="ACH, VTE, BQ1, CAI, OD, AN" value={context.counts.journals} />
              <Operation label="Tiers" detail="Fichier unique, fiches typées" value={context.counts.thirdParties} />
              <Operation
                label="Pièces comptables"
                detail={`${context.counts.postedEntries} validées, ${context.counts.draftEntries} brouillons`}
                value={context.counts.entries}
              />
              <Operation label="Justificatifs" detail="Octets chiffrés dans la base locale, empreinte SHA-256" value={context.counts.attachments} />
              <Operation label="Lettrages" detail="Rapprochements de tiers en cours" value={context.counts.reconciliations} />
              <Operation label="Événements d'audit" detail="Historique ajout-seulement, attribué et horodaté" value={context.counts.auditEvents} />
            </ul>
            <p class="field-hint">
              L'original stockait une centaine de fichiers Hyper File par dossier (`.FIC`, `.NDX`,
              `.MMO`) et devait les réindexer à l'ouverture. Ce port applique la règle R-ORG-2 :
              une base transactionnelle unique, cloisonnée logiquement par organisation et par
              exercice — plus de réindexation, plus de répertoire partagé entre données et
              exécutables.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}

function Operation(props: { label: string; detail: string; value: number }) {
  return (
    <li class="operation-item">
      <span class="nav-icon">
        <Icon name="folder" />
      </span>
      <div>
        <strong>{props.label}</strong>
        <small>{props.detail}</small>
      </div>
      <span class="operation-state">{props.value}</span>
    </li>
  );
}
