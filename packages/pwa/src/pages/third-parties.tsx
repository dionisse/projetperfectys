import { useEffect, useState } from "preact/hooks";
import type { ThirdPartyUsageDto } from "@perfecto/contracts";
import { THIRD_PARTY_TYPES, thirdPartyTypeLabel, type ThirdPartyType } from "@perfecto/domain";
import { DEMO_ORGANIZATION_ID, getKernel } from "../kernel";
import { ErrorNote, Loading, PageHero, TierChip, money, signedMoney, useAsync } from "../ui";

interface TierForm {
  code: string;
  name: string;
  type: string;
  taxIdentifier: string;
  address: string;
  phone: string;
  email: string;
  notes: string;
}

const emptyForm = (): TierForm => ({
  code: "",
  name: "",
  type: "supplier",
  taxIdentifier: "",
  address: "",
  phone: "",
  email: "",
  notes: ""
});

export function ThirdParties() {
  const [search, setSearch] = useState("");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [form, setForm] = useState<TierForm>(emptyForm);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const { data, error, reload } = useAsync(() => getKernel().getThirdParties(search || undefined), [search]);

  const tiers = data ?? [];
  const selected = tiers.find((item) => item.code === selectedCode) ?? null;
  const editing = selected !== null;

  // Bascule création <-> révision : le formulaire suit la fiche sélectionnée.
  useEffect(() => {
    if (selected) {
      setForm({
        code: selected.code,
        name: selected.name,
        type: selected.type,
        taxIdentifier: selected.taxIdentifier,
        address: selected.address,
        phone: selected.phone,
        email: selected.email,
        notes: selected.notes
      });
    } else {
      setForm(emptyForm());
    }
  }, [selectedCode, data]);

  const submit = async () => {
    setMessage(null);
    try {
      const payload = {
        organizationId: DEMO_ORGANIZATION_ID,
        name: form.name,
        type: form.type,
        taxIdentifier: form.taxIdentifier,
        address: form.address,
        phone: form.phone,
        email: form.email,
        notes: form.notes
      };
      if (editing && selected) {
        const revised = await getKernel().updateThirdParty(selected.code, payload);
        setMessage({ text: `La fiche ${revised.code} · ${revised.name} a été mise à jour.`, isError: false });
      } else {
        const created = await getKernel().createThirdParty({
          ...payload,
          code: form.code.trim() === "" ? undefined : form.code.trim()
        });
        setMessage({ text: `Le tiers ${created.code} · ${created.name} a été créé.`, isError: false });
        setSelectedCode(created.code);
      }
      reload();
    } catch (cause) {
      setMessage({ text: cause instanceof Error ? cause.message : String(cause), isError: true });
    }
  };

  const toggleActive = async (tier: ThirdPartyUsageDto) => {
    setMessage(null);
    try {
      const revised = await getKernel().setThirdPartyActive(tier.code, !tier.isActive);
      setMessage({
        text: revised.isActive
          ? `Le tiers ${revised.code} est réactivé.`
          : `Le tiers ${revised.code} est désactivé : il reste consultable mais ne peut plus être imputé.`,
        isError: false
      });
      reload();
    } catch (cause) {
      setMessage({ text: cause instanceof Error ? cause.message : String(cause), isError: true });
    }
  };

  const inactiveCount = tiers.filter((item) => !item.isActive).length;

  return (
    <>
      <PageHero
        eyebrow="Référentiels partagés"
        title="Fichier des tiers"
        subtitle="Une fiche unique par tiers, partagée par tous les modules : clients, fournisseurs, salariés, État."
      >
        {selected ? (
          <button class="button button-ghost" type="button" onClick={() => setSelectedCode(null)}>
            Nouveau tiers
          </button>
        ) : null}
      </PageHero>

      {message ? (
        <div class={`form-message ${message.isError ? "error" : "success"} wide-message`}>{message.text}</div>
      ) : null}
      <ErrorNote message={error} />

      {!data ? (
        <Loading />
      ) : (
        <div class="split-layout">
          <section class="panel data-panel">
            <div class="table-toolbar">
              <div class="search-field">
                <span>⌕</span>
                <input
                  placeholder="Rechercher un code ou un nom"
                  value={search}
                  onInput={(event) => setSearch(event.currentTarget.value)}
                />
              </div>
              <span class="result-count">
                {tiers.length} tiers · {inactiveCount} désactivé(s)
              </span>
            </div>
            <div class="responsive-table tall-table">
              <table class="data-table selectable-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Nom</th>
                    <th>Type</th>
                    <th class="number">Lignes</th>
                    <th class="number">Solde validé</th>
                    <th>État</th>
                  </tr>
                </thead>
                <tbody>
                  {tiers.map((tier) => (
                    <tr
                      key={tier.code}
                      class={selectedCode === tier.code ? "selected" : undefined}
                      onClick={() => setSelectedCode(tier.code)}
                    >
                      <td><TierChip code={tier.code} name={tier.name} /></td>
                      <td><strong>{tier.name}</strong></td>
                      <td>{thirdPartyTypeLabel[tier.type]}</td>
                      <td class="number" title={`${tier.postedLineCount} ligne(s) validée(s)`}>{tier.lineCount}</td>
                      <td class="number">{signedMoney(tier.netBalance)}</td>
                      <td>
                        <span class={`status-badge ${tier.isActive ? "success" : "draft"}`}>
                          {tier.isActive ? "Actif" : "Désactivé"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {tiers.length === 0 ? (
                    <tr>
                      <td colspan={6} class="muted">
                        Aucun tiers ne correspond à cette recherche.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <aside class="panel form-panel">
            <span class="eyebrow">{editing ? "Fiche sélectionnée" : "Nouveau tiers"}</span>
            <h2>{editing && selected ? selected.name : "Créer une fiche"}</h2>
            <p>
              Le fichier des tiers est unique : un même nom avec un même type ne peut pas être créé deux fois.
              {editing ? " Le code d'un tiers ne se modifie jamais." : ""}
            </p>

            <label class="field">
              <span>Code tiers</span>
              <input
                maxlength={12}
                placeholder="Proposé automatiquement (FOU003…)"
                value={form.code}
                disabled={editing}
                onInput={(event) => setForm({ ...form, code: event.currentTarget.value })}
              />
            </label>
            <label class="field">
              <span>Nom / raison sociale</span>
              <input
                maxlength={160}
                placeholder="Ex. Grossiste Abidjan Nord"
                value={form.name}
                onInput={(event) => setForm({ ...form, name: event.currentTarget.value })}
              />
            </label>
            <label class="field">
              <span>Type de tiers</span>
              <select
                value={form.type}
                disabled={editing && selected !== null && selected.postedLineCount > 0}
                onChange={(event) => setForm({ ...form, type: event.currentTarget.value })}
              >
                {THIRD_PARTY_TYPES.map((type: ThirdPartyType) => (
                  <option key={type} value={type}>
                    {thirdPartyTypeLabel[type]}
                  </option>
                ))}
              </select>
              {editing && selected !== null && selected.postedLineCount > 0 ? (
                <small class="field-hint">Type verrouillé : {selected.postedLineCount} ligne(s) validée(s) l'utilisent.</small>
              ) : null}
            </label>
            <label class="field">
              <span>Identifiant fiscal (NIF / CC)</span>
              <input
                maxlength={30}
                value={form.taxIdentifier}
                onInput={(event) => setForm({ ...form, taxIdentifier: event.currentTarget.value })}
              />
            </label>
            <label class="field">
              <span>Adresse</span>
              <input
                maxlength={240}
                value={form.address}
                onInput={(event) => setForm({ ...form, address: event.currentTarget.value })}
              />
            </label>
            <label class="field">
              <span>Téléphone</span>
              <input
                maxlength={40}
                value={form.phone}
                onInput={(event) => setForm({ ...form, phone: event.currentTarget.value })}
              />
            </label>
            <label class="field">
              <span>Courriel</span>
              <input
                type="email"
                maxlength={160}
                value={form.email}
                onInput={(event) => setForm({ ...form, email: event.currentTarget.value })}
              />
            </label>
            <label class="field">
              <span>Note interne</span>
              <input
                maxlength={600}
                value={form.notes}
                onInput={(event) => setForm({ ...form, notes: event.currentTarget.value })}
              />
            </label>

            <div class="action-row">
              <button class="button button-primary" type="button" disabled={form.name.trim().length < 2} onClick={submit}>
                {editing ? "Enregistrer les modifications" : "Créer le tiers"}
              </button>
              {selected ? (
                <button class="button button-secondary" type="button" onClick={() => void toggleActive(selected)}>
                  {selected.isActive ? "Désactiver" : "Réactiver"}
                </button>
              ) : null}
            </div>
          </aside>
        </div>
      )}

      {selected ? <ThirdPartyStatement key={selected.code} code={selected.code} /> : null}
    </>
  );
}

/** Relevé auxiliaire : mouvements validés et solde progressif du tiers. */
function ThirdPartyStatement(props: { code: string }) {
  const { data, error } = useAsync(() => getKernel().getThirdPartyStatement(props.code), [props.code]);

  return (
    <section class="panel data-panel statement-panel">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">Relevé auxiliaire</span>
          <h2>{props.code} · mouvements validés</h2>
        </div>
        {data ? (
          <div class="statement-totals">
            <span>Débit {money(data.totalDebit)}</span>
            <span>Crédit {money(data.totalCredit)}</span>
            <strong>Solde {signedMoney(data.closingBalance)}</strong>
          </div>
        ) : null}
      </div>
      <ErrorNote message={error} />
      {!data ? (
        <Loading label="Chargement du relevé…" />
      ) : data.lines.length === 0 ? (
        <p class="muted">Aucun mouvement validé pour ce tiers. Les brouillons n'alimentent pas le relevé.</p>
      ) : (
        <div class="responsive-table">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>N° pièce</th>
                <th>Journal</th>
                <th>Référence</th>
                <th>Compte</th>
                <th>Libellé</th>
                <th class="number">Débit</th>
                <th class="number">Crédit</th>
                <th class="number">Solde</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((line) => (
                <tr key={`${line.entryNumber}-${line.accountCode}-${line.label}`}>
                  <td>{line.entryDate.split("-").reverse().join("/")}</td>
                  <td><TierChip code={line.entryNumber} /></td>
                  <td><span class="code-badge">{line.journalCode}</span></td>
                  <td>{line.reference}</td>
                  <td><strong>{line.accountCode}</strong></td>
                  <td>{line.label}</td>
                  <td class="number">{money(line.debit)}</td>
                  <td class="number">{money(line.credit)}</td>
                  <td class="number">{signedMoney(line.runningBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
