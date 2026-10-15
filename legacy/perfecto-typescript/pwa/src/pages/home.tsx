import { getKernel } from "../kernel";
import { EntryNumber, ErrorNote, Link, Loading, PageHero, StatusBadge, money, useAsync } from "../ui";

const MODULES = [
  { code: "CG", name: "Comptabilité générale", description: "Plan, journaux, tiers, pièces numérotées et balance SYSCOHADA.", status: "Lot 1 · tranche 2", href: "/comptabilite", progress: 68 },
  { code: "AN", name: "Comptabilité analytique", description: "Axes, sections, budgets et clés de répartition.", status: "Planifié", href: "/", progress: 8 },
  { code: "VS", name: "Ventes, stocks & facturation", description: "Cycle commercial, inventaire et factures.", status: "Planifié", href: "/", progress: 4 },
  { code: "CO", name: "Gestion des courriers", description: "Registres entrants et sortants, affectations.", status: "Planifié", href: "/", progress: 3 },
  { code: "PA", name: "Paie", description: "Salariés, bulletins, déclarations et écritures.", status: "Cadrage pays requis", href: "/", progress: 1 }
];

export function AccountingHome() {
  const { data, error } = useAsync(() => getKernel().getSnapshot());
  if (error) return <ErrorNote message={error} />;
  if (!data) return <Loading label="Chargement de la comptabilité…" />;

  const nav = [
    { n: "01", title: "Plan comptable", text: "Consulter et enrichir les comptes généraux.", href: "/comptabilite/plan" },
    { n: "02", title: "Journaux", text: "Achats, ventes, trésorerie et opérations diverses.", href: "/comptabilite/journaux" },
    { n: "03", title: "Pièces comptables", text: "Saisir, contrôler et consulter les écritures.", href: "/comptabilite/pieces" },
    { n: "04", title: "Balance générale", text: "Vérifier les mouvements et les soldes des comptes.", href: "/comptabilite/balance" },
    { n: "05", title: "Journal des écritures", text: "Mouvements validés dans l'ordre chronologique.", href: "/comptabilite/etats/journal" },
    { n: "06", title: "Grand livre", text: "Détail et solde cumulé de chaque compte.", href: "/comptabilite/etats/grand-livre" },
    { n: "07", title: "Périodes comptables", text: "Contrôler l'ouverture mensuelle de la saisie.", href: "/comptabilite/periodes" },
    { n: "08", title: "Fichier des tiers", text: "Clients, fournisseurs, salariés : fiches uniques et relevés auxiliaires.", href: "/comptabilite/tiers" },
    { n: "09", title: "Piste d'audit", text: "Historique horodaté des saisies, révisions et validations.", href: "/comptabilite/audit" }
  ];

  return (
    <>
      <PageHero eyebrow="CG · SYSCOHADA révisé" title="Comptabilité générale" subtitle="Exercice 2026 ouvert · Société Démo · Devise XOF">
        <span class="storage-chip">{data.storageMode}</span>
        <Link href="/comptabilite/pieces/nouvelle" class="button button-primary">Nouvelle pièce</Link>
      </PageHero>

      <section class="kpi-grid kpi-grid-wide accounting-kpis">
        <article class="kpi-card blue"><div class="kpi-icon">≡</div><div><span>Comptes actifs</span><strong>{data.accountCount}</strong><small>Plan SYSCOHADA initial</small></div></article>
        <article class="kpi-card violet"><div class="kpi-icon">J</div><div><span>Journaux</span><strong>{data.journalCount}</strong><small>Numérotation automatique</small></div></article>
        <article class="kpi-card violet"><div class="kpi-icon">◉</div><div><span>Tiers</span><strong>{data.thirdPartyCount}</strong><small>Fichier unique</small></div></article>
        <article class="kpi-card green"><div class="kpi-icon">✓</div><div><span>Pièces validées</span><strong>{data.postedEntryCount}</strong><small>Écritures immuables</small></div></article>
        <article class="kpi-card amber"><div class="kpi-icon">✎</div><div><span>Brouillons</span><strong>{data.draftEntryCount}</strong><small>Révisables et tracés</small></div></article>
      </section>

      <section class="accounting-nav-grid">
        {nav.map((item) => (
          <Link key={item.n} href={item.href} class="accounting-nav-card">
            <span class="nav-card-icon">{item.n}</span>
            <div><h2>{item.title}</h2><p>{item.text}</p></div>
            <strong>→</strong>
          </Link>
        ))}
      </section>

      <div class="accounting-home-grid">
        <section class="panel data-panel">
          <div class="panel-heading">
            <div><span class="eyebrow">Dernières opérations</span><h2>Pièces récentes</h2></div>
            <Link href="/comptabilite/pieces" class="text-link">Tout afficher</Link>
          </div>
          <div class="responsive-table">
            <table class="data-table">
              <thead><tr><th>N°</th><th>Date</th><th>Journal</th><th>Référence</th><th>Libellé</th><th>Statut</th><th class="number">Montant</th></tr></thead>
              <tbody>
                {data.recentEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td><EntryNumber value={entry.number} /></td>
                    <td>{entry.entryDate.split("-").reverse().join("/")}</td>
                    <td><span class="code-badge">{entry.journalCode}</span></td>
                    <td><strong>{entry.reference}</strong></td>
                    <td>{entry.description}</td>
                    <td><StatusBadge status={entry.status} /></td>
                    <td class="number">{money(entry.totalDebit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside class="panel balance-summary">
          <span class="eyebrow">Contrôle</span>
          <h2>Équilibre de la période</h2>
          <div class="balance-total"><span>Mouvements débit</span><strong>{money(data.totalDebitMovements)}</strong></div>
          <div class="balance-total"><span>Mouvements crédit</span><strong>{money(data.totalCreditMovements)}</strong></div>
          <div class="balance-proof"><span>Écart</span><strong>{money("0")}</strong></div>
          <ul class="control-list">
            <li><span>Pièces extournées</span><strong>{data.reversedEntryCount}</strong></li>
            <li><span>Lettrages de tiers</span><strong>{data.reconciliationCount}</strong></li>
            <li><span>Justificatifs rattachés</span><strong>{data.attachmentCount}</strong></li>
          </ul>
          <Link href="/comptabilite/balance" class="button button-secondary full-width">Ouvrir la balance</Link>
          <Link href="/comptabilite/audit" class="button button-ghost full-width">Voir la piste d'audit</Link>
        </aside>
      </div>
    </>
  );
}
