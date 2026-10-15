/**
 * Coquille de Perfectys Compta.
 *
 * Structure reprise de Sage 100 Comptabilité : une **barre de menus** française (Fichier,
 * Édition, Traitements, Structure, Interrogation, États, Outils, ?), une fenêtre d'écran, et une
 * **barre d'état** qui rappelle en permanence la société, le dossier, l'exercice, la période, la
 * session et le stockage. Un comptable doit toujours savoir où il écrit.
 *
 * Deux règles d'honnêteté, héritées de l'échec de la première refonte :
 *  - une fonction non implémentée est **annoncée avec la tranche qui la livrera** et n'est pas
 *    cliquable : jamais de lien mort, jamais d'écran vide ;
 *  - ce qui est cliquable agit vraiment sur le noyau, avec ses contrôles et sa piste d'audit.
 */

import { useEffect, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { BENIN, parametresAVerifier } from "../noyau/index";
import { getService, reinitialiserDemonstration } from "../web/noyau";
import {
  ChargementEnCours,
  Erreur,
  Etiquette,
  message,
  naviguer,
  routeCourante,
  useAsync,
  useRoute
} from "./composants";
import { Accueil } from "./ecrans/accueil";
import { PlanComptable } from "./ecrans/plan";
import { Journaux } from "./ecrans/journaux";
import { Tiers } from "./ecrans/tiers";
import { CodesTaxe } from "./ecrans/codes-taxe";
import { Lots } from "./ecrans/lots";
import { Saisie } from "./ecrans/saisie";
import { DeclarationTva } from "./ecrans/declaration-tva";
import { BilanOhada } from "./ecrans/bilan";
import { CompteDeResultatOhada } from "./ecrans/compte-resultat";
import { Lettrage } from "./ecrans/lettrage";
import { ClotureExercice } from "./ecrans/cloture";
import { Balance } from "./ecrans/balance";
import { Journal } from "./ecrans/journal";
import { GrandLivre } from "./ecrans/grand-livre";
import { PisteAudit } from "./ecrans/audit";

interface EntreeMenu {
  label: string;
  /** Cible de navigation ; absente quand l'entrée déclenche une action. */
  href?: string | undefined;
  action?: (() => void) | undefined;
  /** Raccourci affiché à droite de l'entrée. */
  raccourci?: string | undefined;
  /** Raison de l'indisponibilité : affichée telle quelle, jamais simulée. */
  indisponible?: string | undefined;
  separation?: boolean | undefined;
}

export function Coquille() {
  const route = useRoute();
  const [revision, setRevision] = useState(0);
  const [menuOuvert, setMenuOuvert] = useState<string | null>(null);
  const [apropos, setApropos] = useState(false);

  const contexte = useAsync(() => getService().contexte(), [revision, route]);

  const recharger = () => setRevision((valeur) => valeur + 1);

  // Un menu ouvert se referme en cliquant ailleurs ou en pressant Échap.
  useEffect(() => {
    if (!menuOuvert) {
      return;
    }
    function fermer(event: MouseEvent) {
      const cible = event.target as HTMLElement | null;
      if (!cible?.closest(".barre-menus")) {
        setMenuOuvert(null);
      }
    }
    function clavier(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOuvert(null);
      }
    }
    document.addEventListener("mousedown", fermer);
    document.addEventListener("keydown", clavier);
    return () => {
      document.removeEventListener("mousedown", fermer);
      document.removeEventListener("keydown", clavier);
    };
  }, [menuOuvert]);

  async function reinitialiser() {
    try {
      await reinitialiserDemonstration();
      recharger();
    } catch (probleme) {
      window.alert(message(probleme));
    }
  }

  function choisir(entree: EntreeMenu) {
    setMenuOuvert(null);
    if (entree.href) {
      naviguer(entree.href);
      return;
    }
    entree.action?.();
  }

  const menus: { titre: string; entrees: EntreeMenu[] }[] = [
    {
      titre: "Fichier",
      entrees: [
        { label: "Dossier ouvert…", href: "/" },
        { label: "Nouveau dossier", indisponible: "Multi-sociétés : après la validation des écrans de saisie" },
        { label: "Ouvrir un dossier", indisponible: "Multi-sociétés : après la validation des écrans de saisie" },
        { label: "", indisponible: "", separation: true },
        { label: "Réinitialiser la démonstration", action: () => void reinitialiser() },
        { label: "Sauvegarde du dossier", indisponible: "Sauvegarde et restauration testables : tranche I" },
        { label: "Restauration", indisponible: "Sauvegarde et restauration testables : tranche I" }
      ]
    },
    {
      titre: "Édition",
      entrees: [
        { label: "Rechercher un compte…", href: "/structure/plan", raccourci: "F3" },
        { label: "Rechercher un tiers…", href: "/structure/tiers" },
        { label: "", indisponible: "", separation: true },
        { label: "Exporter en PDF, Excel ou CSV", indisponible: "Exports des documents : tranche H" },
        { label: "Imprimer", indisponible: "Aucun démarrage ne dépend d'une imprimante : l'export PDF la remplace" }
      ]
    },
    {
      titre: "Traitements",
      entrees: [
        { label: "Saisie des écritures…", href: "/traitements/saisie", raccourci: "F4" },
        { label: "Lots et comptabilisation…", href: "/traitements/lots" },
        { label: "Contre-passation d'un lot", href: "/traitements/lots" },
        { label: "", indisponible: "", separation: true },
        { label: "Lettrage des comptes de tiers…", href: "/traitements/lettrage" },
        {
          label: "Rapprochement bancaire",
          indisponible: "Le lettrage est livré ; le pointage d'un relevé bancaire suit (tranche F)"
        },
        { label: "Écritures récurrentes", indisponible: "Abonnements : après les clôtures de période" },
        { label: "Clôture de période…", href: "/traitements/cloture" },
        { label: "Clôture d'exercice…", href: "/traitements/cloture" }
      ]
    },
    {
      titre: "Structure",
      entrees: [
        { label: "Plan comptable…", href: "/structure/plan" },
        { label: "Journaux…", href: "/structure/journaux" },
        { label: "Tiers…", href: "/structure/tiers", raccourci: "F2" },
        { label: "Codes de taxe…", href: "/structure/codes-taxe" },
        { label: "", indisponible: "", separation: true },
        { label: "Groupes de comptes", indisponible: "Visibles dans la colonne « Groupe » du plan comptable ; l'écran propre arrive avec les états financiers" },
        { label: "Structures de comptes", indisponible: "Le format segmenté est affiché en tête du plan comptable" }
      ]
    },
    {
      titre: "Interrogation",
      entrees: [
        { label: "Balance…", href: "/interrogation/balance" },
        { label: "Journal…", href: "/interrogation/journal" },
        { label: "Grand livre…", href: "/interrogation/grand-livre" },
        { label: "Compte et historique", indisponible: "Historique par compte et comparaison d'exercices : avec les clôtures" }
      ]
    },
    {
      titre: "États",
      entrees: [
        { label: "Bilan OHADA révisé", href: "/etats/bilan" },
        { label: "Compte de résultat OHADA révisé", href: "/etats/compte-resultat" },
        {
          label: "Tableau des flux de trésorerie",
          indisponible: "Aucun compte du plan n'est classé « flux de trésorerie » : tranche H"
        },
        {
          label: "Tableau de variation des activités",
          indisponible: "Aucun compte du plan n'est classé « variation des activités » : tranche H"
        },
        { label: "", indisponible: "", separation: true },
        { label: "Déclaration TVA mensuelle…", href: "/etats/declaration-tva" },
        { label: "États de paramétrage", indisponible: "Impression du paramétrage : tranche H" }
      ]
    },
    {
      titre: "Outils",
      entrees: [
        { label: "Piste d'audit…", href: "/outils/audit" },
        { label: "Paquet pays : Bénin", href: "/structure/codes-taxe" },
        { label: "Diagnostic du dossier", href: "/" },
        { label: "", indisponible: "", separation: true },
        { label: "Import de données", indisponible: "Import de comptes, tiers et lots : tranche I" },
        { label: "Export de données", indisponible: "Export de données brutes : tranche I" },
        { label: "Habilitations par écran", indisponible: "Sécurité par écran, comme Sage : tranche I" }
      ]
    },
    {
      titre: "?",
      entrees: [
        { label: "Raccourcis clavier", indisponible: "Navigation clavier des tables de détail : prochain incrément" },
        { label: "À propos de Perfectys Compta", action: () => setApropos(true) }
      ]
    }
  ];

  // Raccourcis conservés du logiciel d'origine : F2 les tiers, F3 la recherche de comptes,
  // F4 la saisie. F4 ne relance pas l'écran s'il est déjà affiché : une saisie en cours ne se
  // jette pas par accident.
  useEffect(() => {
    function clavier(event: KeyboardEvent) {
      if (event.key === "F2") {
        event.preventDefault();
        naviguer("/structure/tiers");
      } else if (event.key === "F3") {
        event.preventDefault();
        naviguer("/structure/plan");
      } else if (event.key === "F4") {
        event.preventDefault();
        if (routeCourante() !== "/traitements/saisie") {
          naviguer("/traitements/saisie");
        }
      }
    }
    window.addEventListener("keydown", clavier);
    return () => window.removeEventListener("keydown", clavier);
  }, []);

  return (
    <div class="application">
      <div class="barre-menus" role="menubar" aria-label="Menus de Perfectys Compta">
        <span class="marque">
          <strong>Perfectys</strong> Compta
        </span>
        {menus.map((menu) => (
          <div class="menu" key={menu.titre}>
            <button
              type="button"
              class={menuOuvert === menu.titre ? "menu-titre actif" : "menu-titre"}
              aria-haspopup="menu"
              aria-expanded={menuOuvert === menu.titre}
              onClick={() => setMenuOuvert(menuOuvert === menu.titre ? null : menu.titre)}
            >
              {menu.titre}
            </button>
            {menuOuvert === menu.titre ? (
              <div class="menu-panneau" role="menu" aria-label={`Menu ${menu.titre}`}>
                {menu.entrees.map((entree, index) =>
                  entree.separation ? (
                    <div class="menu-separation" key={`sep-${index}`} />
                  ) : entree.indisponible ? (
                    <span class="menu-entree indisponible" role="menuitem" aria-disabled="true" title={entree.indisponible}>
                      {entree.label}
                    </span>
                  ) : (
                    <button
                      type="button"
                      class="menu-entree"
                      role="menuitem"
                      key={entree.label}
                      onClick={() => choisir(entree)}
                    >
                      <span>{entree.label}</span>
                      {entree.raccourci ? <em>{entree.raccourci}</em> : null}
                    </button>
                  )
                )}
              </div>
            ) : null}
          </div>
        ))}
        <span class="barre-menus-espace" />
        {contexte.donnees ? (
          <span class="contexte-dossier">
            <strong>{contexte.donnees.numero}</strong>
            <span>{contexte.donnees.societe.raisonSociale}</span>
            <span>{contexte.donnees.periodeLabel}</span>
          </span>
        ) : null}
      </div>

      <main class="zone-ecran">{ecranPour(route, recharger)}</main>

      <footer class="barre-etat">
        {contexte.erreur ? (
          <span class="segment erreur-texte">{contexte.erreur}</span>
        ) : contexte.donnees ? (
          <>
            <span class="segment">
              Dossier <strong>{contexte.donnees.numero}</strong>
            </span>
            <span class="segment">
              Société <strong>{contexte.donnees.societe.code || "sans code"}</strong>
            </span>
            <span class="segment">
              Exercice <strong>{contexte.donnees.exercice}</strong>
            </span>
            <span class="segment">
              Période <strong>{contexte.donnees.periodeCourante}</strong>
            </span>
            <span class="segment">
              Référentiel <strong>{contexte.donnees.referentiel}</strong>
            </span>
            <span class="segment">
              Devise <strong>{contexte.donnees.devise}</strong>
            </span>
            <span class="segment">
              Session <strong>{contexte.donnees.utilisateur}</strong>
            </span>
            <span class="segment">{contexte.donnees.stockage}</span>
            <span class="segment">
              {contexte.donnees.lots} lots · {contexte.donnees.mouvements} mouvements
            </span>
            <span class="segment">
              {contexte.donnees.equilibre ? (
                <Etiquette ton="succes">Grand livre équilibré</Etiquette>
              ) : (
                <Etiquette ton="alerte">Grand livre déséquilibré</Etiquette>
              )}
            </span>
            <span class="segment pousse" title="Dernière modification tracée dans la piste d'audit">
              {contexte.donnees.derniereModification ?? "aucune modification"}
            </span>
          </>
        ) : (
          <span class="segment">Lecture du dossier…</span>
        )}
      </footer>

      {apropos ? (
        <div class="modale-fond" role="dialog" aria-modal="true" aria-label="À propos">
          <div class="modale">
            <h2>Perfectys Compta</h2>
            <dl class="liste-definition">
              <dt>Modèle</dt>
              <dd>Sage 100 Comptabilité — lots, comptes segmentés, codes de taxe</dd>
              <dt>Référentiel</dt>
              <dd>{BENIN.referentiel.nom} — {BENIN.referentiel.version}</dd>
              <dt>Paquet pays</dt>
              <dd>{BENIN.nom} {BENIN.version}</dd>
              <dt>Paramètres à confirmer</dt>
              <dd>{parametresAVerifier(BENIN).length} taux et formats attendent une confirmation officielle</dd>
              <dt>Noyau</dt>
              <dd>TypeScript, montants entiers exacts, aucun flottant</dd>
              <dt>Build</dt>
              <dd>{identifiantDeBuild()}</dd>
            </dl>
            <div class="modale-actions">
              <button class="bouton" type="button" onClick={() => setApropos(false)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

declare const __BUILD_ID__: string;

function identifiantDeBuild(): string {
  try {
    return typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "local";
  } catch {
    return "local";
  }
}

function ecranPour(route: string, recharger: () => void): ComponentChildren {
  switch (route) {
    case "/":
      return <Accueil onMutation={recharger} />;
    case "/structure/plan":
      return <PlanComptable />;
    case "/structure/journaux":
      return <Journaux />;
    case "/structure/tiers":
      return <Tiers />;
    case "/structure/codes-taxe":
      return <CodesTaxe />;
    case "/traitements/saisie":
      return <Saisie onMutation={recharger} />;
    case "/etats/bilan":
      return <BilanOhada />;
    case "/etats/compte-resultat":
      return <CompteDeResultatOhada />;
    case "/etats/declaration-tva":
      return <DeclarationTva />;
    case "/traitements/lots":
      return <Lots onMutation={recharger} />;
    case "/traitements/lettrage":
      return <Lettrage onMutation={recharger} />;
    case "/traitements/cloture":
      return <ClotureExercice onMutation={recharger} />;
    case "/interrogation/balance":
      return <Balance />;
    case "/interrogation/journal":
      return <Journal />;
    case "/interrogation/grand-livre":
      return <GrandLivre />;
    case "/outils/audit":
      return <PisteAudit />;
    default:
      return (
        <Erreur
          message={`Aucun écran ne correspond à « ${routeCourante()} ».`}
          onRetry={() => naviguer("/")}
        />
      );
  }
}

/** Indicateur de chargement global, utilisé au tout premier rendu. */
export function Demarrage(props: { children: ComponentChildren }) {
  if (typeof indexedDB === "undefined") {
    return <ChargementEnCours libelle="Stockage local indisponible dans ce navigateur." />;
  }
  return <>{props.children}</>;
}
