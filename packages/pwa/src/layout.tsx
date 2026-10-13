import type { ComponentChildren } from "preact";
import { Link, currentRoute } from "./ui";

const NAV_ITEMS: { href: string; icon: string; label: string }[] = [
  { href: "/", icon: "⌂", label: "Tableau de bord" },
  { href: "/comptabilite", icon: "≡", label: "Comptabilité générale" },
  { href: "/comptabilite/plan", icon: "0", label: "Plan comptable" },
  { href: "/comptabilite/journaux", icon: "J", label: "Journaux" },
  { href: "/comptabilite/tiers", icon: "◉", label: "Tiers" },
  { href: "/comptabilite/pieces", icon: "✓", label: "Pièces" },
  { href: "/comptabilite/balance", icon: "=", label: "Balance" },
  { href: "/comptabilite/etats/grand-livre", icon: "▤", label: "Grand livre" },
  { href: "/comptabilite/periodes", icon: "◷", label: "Périodes" },
  { href: "/comptabilite/audit", icon: "§", label: "Piste d'audit" }
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
          <span class="nav-heading">Pilotage</span>
          {NAV_ITEMS.slice(0, 1).map((item) => (
            <NavItem key={item.href} item={item} route={route} />
          ))}
          <span class="nav-heading">Comptabilité SYSCOHADA</span>
          {NAV_ITEMS.slice(1, 9).map((item) => (
            <NavItem key={item.href} item={item} route={route} />
          ))}
          <span class="nav-heading">Contrôle</span>
          {NAV_ITEMS.slice(9).map((item) => (
            <NavItem key={item.href} item={item} route={route} />
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

function NavItem(props: { item: { href: string; icon: string; label: string }; route: string }) {
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
