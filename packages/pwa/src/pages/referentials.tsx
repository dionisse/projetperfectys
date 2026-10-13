import { useState } from "preact/hooks";
import { getKernel, DEMO_ORGANIZATION_ID } from "../kernel";
import { ErrorNote, Loading, PageHero, useAsync } from "../ui";

export function ChartOfAccounts() {
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [form, setForm] = useState({ code: "", label: "", accountType: "Général", requiresThirdParty: false });
  const { data, error, reload } = useAsync(() => getKernel().getAccounts(search || undefined), [search]);

  const createAccount = async () => {
    try {
      const account = await getKernel().createAccount({
        organizationId: DEMO_ORGANIZATION_ID,
        code: form.code,
        label: form.label,
        accountType: form.accountType,
        requiresThirdParty: form.requiresThirdParty
      });
      setMessage({ text: `Le compte ${account.code} a été ajouté.`, isError: false });
      setForm({ code: "", label: "", accountType: "Général", requiresThirdParty: false });
      reload();
    } catch (cause) {
      setMessage({ text: cause instanceof Error ? cause.message : String(cause), isError: true });
    }
  };

  return (
    <>
      <PageHero eyebrow="Comptabilité générale" title="Plan comptable" subtitle="Comptes généraux du profil SYSCOHADA révisé." />
      <div class="split-layout">
        <section class="panel data-panel">
          <div class="table-toolbar">
            <div class="search-field">
              <span>⌕</span>
              <input placeholder="Rechercher un numéro ou un intitulé" value={search} onInput={(event) => setSearch(event.currentTarget.value)} />
            </div>
            <span class="result-count">{data?.length ?? 0} compte(s)</span>
          </div>
          <ErrorNote message={error} />
          <div class="responsive-table tall-table">
            <table class="data-table">
              <thead><tr><th>Compte</th><th>Intitulé</th><th>Classe</th><th>Nature</th><th>Auxiliaire</th><th>État</th></tr></thead>
              <tbody>
                {data?.map((account) => (
                  <tr key={account.code}>
                    <td><strong class="account-number">{account.code}</strong></td>
                    <td>{account.label}</td>
                    <td>Classe {account.accountClass}</td>
                    <td>{account.accountType}</td>
                    <td>{account.requiresThirdParty ? "Requis" : "Non"}</td>
                    <td><span class="status-badge success">Actif</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside class="panel form-panel">
          <span class="eyebrow">Nouveau compte</span>
          <h2>Enrichir le plan</h2>
          <p>Le compte sera conservé dans la base locale de ce navigateur.</p>
          {message ? <div class={`form-message ${message.isError ? "error" : "success"}`}>{message.text}</div> : null}
          <label class="field"><span>Numéro de compte</span><input inputmode="numeric" maxlength={12} placeholder="Ex. 601200" value={form.code} onInput={(event) => setForm({ ...form, code: event.currentTarget.value })} /></label>
          <label class="field"><span>Intitulé</span><input maxlength={120} placeholder="Intitulé du compte" value={form.label} onInput={(event) => setForm({ ...form, label: event.currentTarget.value })} /></label>
          <label class="field"><span>Nature</span>
            <select value={form.accountType} onChange={(event) => setForm({ ...form, accountType: event.currentTarget.value })}>
              {["Général", "Capitaux", "Immobilisation", "Stock", "Tiers", "Trésorerie", "Charge", "Produit"].map((nature) => (
                <option key={nature}>{nature}</option>
              ))}
            </select>
          </label>
          <label class="check-field">
            <input type="checkbox" checked={form.requiresThirdParty} onChange={(event) => setForm({ ...form, requiresThirdParty: event.currentTarget.checked })} />
            <span>Exiger un tiers lors de la saisie</span>
          </label>
          <button class="button button-primary full-width" type="button" onClick={createAccount}>Ajouter le compte</button>
        </aside>
      </div>
    </>
  );
}

export function Journals() {
  const { data, error } = useAsync(() => getKernel().getJournals());
  return (
    <>
      <PageHero eyebrow="Comptabilité générale" title="Journaux comptables" subtitle="Organisation des écritures par cycle et par moyen de trésorerie." />
      <ErrorNote message={error} />
      {!data ? (
        <Loading />
      ) : (
        <>
          <section class="journal-grid">
            {data.map((journal) => (
              <article key={journal.code} class="panel journal-card">
                <div class="journal-code">{journal.code}</div>
                <div>
                  <span class="eyebrow">{journal.journalType}</span>
                  <h2>{journal.label}</h2>
                  <p>{journal.counterpartAccount ? `Compte de contrepartie : ${journal.counterpartAccount}` : "Contrepartie définie à la saisie"}</p>
                </div>
                <span class="status-badge success">Actif</span>
              </article>
            ))}
          </section>
          <section class="panel info-panel">
            <strong>Règle du noyau</strong>
            <p>Chaque pièce appartient à un journal. Les journaux de banque et de caisse portent un compte de contrepartie par défaut. La numérotation automatique par journal arrive à la tranche suivante.</p>
          </section>
        </>
      )}
    </>
  );
}
