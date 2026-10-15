import type { ComponentChildren } from "preact";
import { Link, currentRoute } from "./ui";

interface NavEntry {
  href: string;
  icon: string;
  label: string;
}

/**
 * Navigation groupée, comme le menu du logiciel d'origine (Saisies, Éditions, Outils).
 * Les groupes sont déclarés explicitement : ajouter un écran ne décale plus les autres.
 */
const NAV_GROUPS: { heading: string; items: NavEntry[] }[] = [
  {
    heading: "Pilotage",
    items: [{ href: "/", icon: "⌂", label: "Tableau de bord" }]
  },
  {
    heading: "Comptabilité SYSCOHADA",
    items: [
      { href: "/comptabilite", icon: "≡", label: "Comptabilité générale" },
      { href: "/comptabilite/plan", icon: "0", label: "Plan comptable" },
      { href: "/comptabilite/journaux", icon: "J", label: "Journaux" },
      { href: "/comptabilite/tiers", icon: "◉", label: "Tiers" },
      { href: "/comptabilite/pieces", icon: "✓", label: "Pièces" },
      { href: "/comptabilite/balance", icon: "=", label: "Balance" },
      { href: "/comptabilite/etats/grand-livre", icon: "▤", label: "Grand livre" },
      { href: "/comptabilite/periodes", icon: "◷", label: "Périodes" }
    ]
  },
  {
    heading: "Éditions",
    items: [
      { href: "/comptabilite/editions", icon: "⎙", label: "Éditions et exports" },
      { href: "/comptabilite/audit", icon: "§", label: "Piste d'audit" }
    ]
  },
  {
    heading: "Paramètres",
    items: [{ href: "/parametres/societe", icon: "✎", label: "Fiche société" }]
  }
];

export function Shell(props: { onReset: () => void; children: ComponentChildren }) {
  const route = currentRoute();
  return (
    <div class="app-shell">
      <aside class="sidebar">
        <Link href="/" class="brand">
          <img src="perfecto-mark.png" alt="" />
          <span>
            <strong>PERFECTO</strong>
            <small>Gestion intégrée</small>
          </span>
        </Link>
        <nav aria-label="Navigation principale">
          {NAV_GROUPS.map((group) => (
            <div class="nav-group" key={group.heading}>
              <span class="nav-heading">{group.heading}</span>
              {group.items.map((item) => (
                <NavItem key={item.href} item={item} route={route} />
              ))}
            </div>
          ))}
        </nav>
        <div class="sidebar-footer">
          <span class="status-dot"></span>
          <div>
            <strong>Noyau TypeScript · IndexedDB</strong>
            <small>
              <button class="link-button" type="button" onClick={props.onReset}>
                Réinitialiser la démonstration
              </button>
            </small>
          </div>
        </div>
      </aside>
      <main class="workspace">
        <header class="topbar">
          <div>
            <span class="eyebrow">Espace de gestion</span>
            <strong>PERFECTO Nouvelle Génération</strong>
          </div>
          <div class="topbar-actions">
            <span class="sync-chip">
              <span class="status-dot"></span>Hors ligne prêt
            </span>
            <span class="avatar-button" aria-label="Compte utilisateur">SD</span>
          </div>
        </header>
        <div class="page-content">{props.children}</div>
      </main>
    </div>
  );
}

function NavItem(props: { item: NavEntry; route: string }) {
  const active =
    props.route === props.item.href ||
    (props.item.href === "/comptabilite/pieces" && props.route.startsWith("/comptabilite/pieces/"));
  return (
    <Link href={props.item.href} class={active ? "active" : undefined}>
      <span class="nav-icon">{props.item.icon}</span>
      {props.item.label}
    </Link>
  );
}
