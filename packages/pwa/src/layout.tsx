/**
 * Coquille de l'application.
 *
 * Structure fidèle à PERFECTO, exécution moderne (décision du 15/10/2026) :
 *
 *  - la barre supérieure porte le **contexte du dossier** en permanence, comme le titre de
 *    fenêtre de l'original (« CR000-26: Comptabilité générale SOCIETE TEST
 *    [01/01/2026-31/12/2026] ») : un comptable doit toujours savoir dans quel module,
 *    quelle société et quelle période il écrit ;
 *  - la colonne de navigation reprend l'arborescence des six menus d'origine — **Fichier,
 *    Définitions, Saisies, Éditions, Paramètres, Outils** — avec leurs entrées réelles. Les
 *    fonctions non implémentées sont montrées comme telles, avec la tranche qui les livrera,
 *    jamais comme des liens morts ni comme des écrans vides ;
 *  - la barre d'état rappelle le dossier, la session, le stockage et la dernière
 *    modification tracée.
 *
 * R-ORG-3 (spec §1) : pas d'empilement MDI de fenêtres — une coquille, une navigation, des
 * listes filtrables et des panneaux de détail.
 */

import { useEffect } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { Icon, Link, currentRoute, formatTimestamp, useAsync } from "./ui";
import { getKernel } from "./kernel";

/* ------------------------------------------------------------------ */
/* Arborescence des menus, fidèle à l'original                         */
/* ------------------------------------------------------------------ */

interface NavEntry {
  /** Cible de navigation ; absente pour une fonction pas encore implémentée. */
  href?: string;
  label: string;
  icon: string;
  /** Raccourci affiché, comme dans les menus de l'original (`Sociétés… <F2>`). */
  shortcut?: string;
  /** Action immédiate au lieu d'une navigation. */
  action?: () => void;
  /** Raison honnête de l'indisponibilité : la fonction est annoncée, jamais simulée. */
  unavailable?: string;
}

function buildMenu(onReset: () => void): { heading: string; items: NavEntry[] }[] {
  return [
    {
      heading: "Module ouvert",
      items: [
        { href: "/comptabilite", label: "Comptabilité générale", icon: "home" }
      ]
    },
    {
      heading: "Fichier",
      items: [
        { href: "/", label: "Ouverture des dossiers", icon: "folder" },
        { href: "/comptabilite/editions", label: "Exporter les données", icon: "printer" },
        { label: "Sauvegarde du dossier", icon: "folder", unavailable: "Tranche 9 — sauvegarde et restauration testables" },
        { label: "Restauration", icon: "folder", unavailable: "Tranche 9 — sauvegarde et restauration testables" }
      ]
    },
    {
      heading: "Définitions",
      items: [
        { href: "/comptabilite/plan", label: "Plan de comptes généraux", icon: "book" },
        { href: "/comptabilite/tiers", label: "Tiers (clients, fournisseurs…)", icon: "users" },
        { href: "/comptabilite/journaux", label: "Journaux", icon: "grid" },
        { label: "Centres de responsabilité", icon: "grid", unavailable: "Comptabilité analytique — après le module général" },
        { label: "Comptes alternatifs et analyses", icon: "grid", unavailable: "Comptabilité analytique — après le module général" }
      ]
    },
    {
      heading: "Saisies",
      items: [
        { href: "/comptabilite/pieces/nouvelle", label: "Saisie de journaux", icon: "file" },
        { href: "/comptabilite/pieces", label: "Pièces comptables", icon: "file" },
        { href: "/comptabilite/tiers", label: "Lettrage des tiers", icon: "users" },
        { href: "/comptabilite/periodes", label: "Périodes et verrous", icon: "calendar" },
        { label: "Rapprochement bancaire", icon: "scale", unavailable: "Tranche 9 — pointage et rapprochement" },
        { label: "Reports à nouveau et clôture", icon: "calendar", unavailable: "Tranche 9 — multi-exercices et clôture annuelle" }
      ]
    },
    {
      heading: "Éditions",
      items: [
        { href: "/comptabilite/editions", label: "Toutes les éditions", icon: "printer" },
        { href: "/comptabilite/etats/journal", label: "Journaux", icon: "file" },
        { href: "/comptabilite/etats/grand-livre", label: "Comptes généraux", icon: "grid" },
        { href: "/comptabilite/balance", label: "Balance générale", icon: "scale" },
        { label: "Tableaux financiers OHADA révisé", icon: "scale", unavailable: "Tranche 9 — états financiers SYSCOHADA" }
      ]
    },
    {
      heading: "Paramètres",
      items: [
        { href: "/parametres/societe", label: "Fiche société", icon: "settings", shortcut: "F2" },
        { label: "Utilisateurs et rôles", icon: "users", unavailable: "Authentification et rôles minimaux — après la refonte" },
        { label: "Préférences d'impression", icon: "printer", unavailable: "R-ORG-1 : aucun démarrage ne dépend d'une imprimante" }
      ]
    },
    {
      heading: "Outils",
      items: [
        { href: "/comptabilite/audit", label: "Piste d'audit", icon: "shield" },
        { label: "Réinitialiser la démonstration", icon: "wrench", action: onReset },
        { label: "Calculatrice", icon: "wrench", shortcut: "F12", unavailable: "Non reprise : le navigateur et le tableur la fournissent" },
        { label: "Impression de la fenêtre courante", icon: "printer", shortcut: "F11", unavailable: "Remplacée par l'export PDF/Excel/CSV au choix" }
      ]
    }
  ];
}

export function Shell(props: { onReset: () => void; children: ComponentChildren }) {
  const route = currentRoute();
  const menus = buildMenu(props.onReset);
  const { data } = useAsync(() => getKernel().getDossierContext(), []);

  // `Sociétés… <F2>` : le raccourci de l'original, conservé tel quel.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "F2") {
        return;
      }
      event.preventDefault();
      location.hash = "#/parametres/societe";
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div class="app-shell">
      <aside class="sidebar">
        <Link href="/" class="brand">
          <img src="perfecto-mark.png" alt="" />
          <span>
            <strong>PERFECTO</strong>
            <small>Nouvelle Génération</small>
          </span>
        </Link>

        <nav aria-label="Menus du module comptable">
          {menus.map((group) => (
            <div class="nav-group" key={group.heading}>
              <span class="nav-heading">{group.heading}</span>
              {group.items.map((item) => (
                <NavEntryLink key={item.label} item={item} route={route} />
              ))}
            </div>
          ))}
        </nav>

        <div class="sidebar-footer">
          <span class="status-dot"></span>
          <div>
            <strong>{data?.storageMode ?? "Noyau TypeScript"}</strong>
            <small>{data ? `${data.counts.entries} pièces · ${data.counts.accounts} comptes` : "Chargement…"}</small>
          </div>
        </div>
      </aside>

      <div class="workspace">
        <header class="topbar">
          <div>
            {/* Le titre de fenêtre de l'original, rendu comme un contexte permanent. */}
            {data ? (
              <Link href="/comptabilite" class="dossier-context">
                <span class="dossier-code" title={`Module ${data.moduleCode} — ${data.moduleLabel}`}>
                  {data.dossierCode}
                </span>
                <span class="dossier-separator">/</span>
                <span class="dossier-society">{data.societyName}</span>
                <span class="dossier-separator">·</span>
                <span class="dossier-period">{data.periodLabel}</span>
              </Link>
            ) : (
              <span class="dossier-context">Ouverture du dossier…</span>
            )}
          </div>
          <div class="topbar-actions">
            <span class="sync-chip">
              <span class="status-dot"></span>Hors ligne prêt
            </span>
            <span class="avatar-button" title={data ? `Session : ${data.actor}` : "Session"}>
              {data ? data.actor.slice(0, 2).toUpperCase() : "··"}
            </span>
          </div>
        </header>

        <div class="page-content">{props.children}</div>

        <footer class="statusbar">
          {data ? (
            <>
              <span class="statusbar-segment">
                Dossier <strong>{data.dossierCode}</strong>
              </span>
              <span class="statusbar-segment">
                Société <strong>{data.societyCode || "sans code"}</strong>
              </span>
              <span class="statusbar-segment">
                Exercice <strong>{data.fiscalYear}</strong>
              </span>
              <span class="statusbar-segment">
                Période <strong>{data.periodLabel}</strong>
              </span>
              <span class="statusbar-segment">
                Session <strong>{data.actor}</strong>
              </span>
              <span class="statusbar-segment">{data.storageMode}</span>
              <span class="statusbar-segment">
                {data.counts.postedEntries} validées · {data.counts.draftEntries} brouillons
              </span>
              <span class="statusbar-segment">
                Dernière modification{" "}
                <strong>
                  {data.lastModifiedAt
                    ? `${formatTimestamp(data.lastModifiedAt)} — ${data.lastModifiedLabel}`
                    : "aucune écriture"}
                </strong>
              </span>
            </>
          ) : (
            <span class="statusbar-segment">Lecture du dossier…</span>
          )}
          <span class="statusbar-spacer"></span>
          <span class="statusbar-segment">
            <button class="link-button" type="button" onClick={props.onReset}>
              Réinitialiser la démonstration
            </button>
          </span>
        </footer>
      </div>
    </div>
  );
}

function NavEntryLink(props: { item: NavEntry; route: string }) {
  const { item, route } = props;

  if (item.unavailable) {
    return (
      <span class="nav-unavailable" title={item.unavailable} aria-disabled="true">
        <span class="nav-icon">
          <Icon name={item.icon} />
        </span>
        <span class="nav-item-label">{item.label}</span>
      </span>
    );
  }

  if (item.action) {
    return (
      <button class="nav-action" type="button" onClick={item.action} title={item.label}>
        <span class="nav-icon">
          <Icon name={item.icon} />
        </span>
        <span class="nav-item-label">{item.label}</span>
      </button>
    );
  }

  const active =
    route === item.href ||
    (item.href !== "/" && item.href !== undefined && route.startsWith(`${item.href}/`));

  return (
    <Link href={item.href!} class={active ? "active" : undefined}>
      <span class="nav-icon">
        <Icon name={item.icon} />
      </span>
      <span class="nav-item-label">{item.label}</span>
      {item.shortcut ? <span class="nav-shortcut">{item.shortcut}</span> : null}
    </Link>
  );
}
