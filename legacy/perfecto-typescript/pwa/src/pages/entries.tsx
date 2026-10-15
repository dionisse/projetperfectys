import { useState } from "preact/hooks";
import type { AccountingEntryDto, AttachmentDto } from "@perfecto/contracts";
import { formatByteSize, formatCivilDateFr, shortFingerprint } from "@perfecto/domain";
import { DEMO_ORGANIZATION_ID, getKernel } from "../kernel";
import {
  AuditTrailFor,
  EntryNumber,
  ErrorNote,
  Link,
  Loading,
  PageHero,
  StatusBadge,
  TierChip,
  formatTimestamp,
  money,
  navigate,
  useAsync
} from "../ui";
import { EntryForm, emptyLine, type EntryFormValues } from "./entry-form";

const FILTERS = ["Toutes", "posted", "draft", "reversed"] as const;
const FILTER_LABELS: Record<(typeof FILTERS)[number], string> = {
  Toutes: "Toutes",
  posted: "Validées",
  draft: "Brouillons",
  reversed: "Extournées"
};

export function Entries() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Toutes");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const { data, error, reload } = useAsync(() => getKernel().getEntries());

  const entries = (data ?? []).filter((entry) => filter === "Toutes" || entry.status === filter);
  const selected = (data ?? []).find((entry) => entry.id === selectedId) ?? null;

  const postSelected = async () => {
    if (!selected) return;
    try {
      const posted = await getKernel().postEntry(selected.id);
      setMessage({ text: `La pièce ${posted.number} (${posted.reference}) a été validée.`, isError: false });
      setSelectedId(posted.id);
      reload();
    } catch (cause) {
      setMessage({ text: cause instanceof Error ? cause.message : String(cause), isError: true });
    }
  };

  const reverseSelected = async (reversalDate: string, reference: string, description: string) => {
    if (!selected) return;
    try {
      const result = await getKernel().reverseEntry(selected.id, {
        organizationId: DEMO_ORGANIZATION_ID,
        reversalDate,
        reference: reference.trim() === "" ? undefined : reference.trim(),
        description: description.trim() === "" ? undefined : description.trim()
      });
      setMessage({
        text: `La pièce ${result.original.number} a été extournée par ${result.reversal.number} (${result.reversal.reference}).`,
        isError: false
      });
      setSelectedId(result.reversal.id);
      reload();
    } catch (cause) {
      setMessage({ text: cause instanceof Error ? cause.message : String(cause), isError: true });
    }
  };

  return (
    <>
      <PageHero
        eyebrow="Comptabilité générale"
        title="Pièces comptables"
        subtitle="Écritures de l'exercice 2026, numérotées automatiquement par journal."
      >
        <Link href="/comptabilite/pieces/nouvelle" class="button button-primary">Nouvelle pièce</Link>
      </PageHero>
      {message ? (
        <div class={`form-message ${message.isError ? "error" : "success"} wide-message`}>{message.text}</div>
      ) : null}
      <ErrorNote message={error} />
      {!data ? (
        <Loading />
      ) : (
        <>
          <section class="panel data-panel">
            <div class="table-toolbar">
              <div class="filter-tabs">
                {FILTERS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    class={filter === value ? "active" : undefined}
                    onClick={() => setFilter(value)}
                  >
                    {FILTER_LABELS[value]}
                  </button>
                ))}
              </div>
              <span class="result-count">{entries.length} pièce(s)</span>
            </div>
            <div class="responsive-table">
              <table class="data-table selectable-table">
                <thead>
                  <tr>
                    <th>N°</th>
                    <th>Date</th>
                    <th>Journal</th>
                    <th>Référence</th>
                    <th>Libellé</th>
                    <th>Statut</th>
                    <th class="number">Justif.</th>
                    <th class="number">Débit</th>
                    <th class="number">Crédit</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr
                      key={entry.id}
                      class={selectedId === entry.id ? "selected" : undefined}
                      onClick={() => setSelectedId(entry.id)}
                    >
                      <td><EntryNumber value={entry.number} /></td>
                      <td>{formatCivilDateFr(entry.entryDate)}</td>
                      <td><span class="code-badge">{entry.journalCode}</span></td>
                      <td><strong>{entry.reference}</strong></td>
                      <td>{entry.description}</td>
                      <td><StatusBadge status={entry.status} /></td>
                      <td class="number">{entry.attachmentCount > 0 ? `📎 ${entry.attachmentCount}` : "—"}</td>
                      <td class="number">{money(entry.totalDebit)}</td>
                      <td class="number">{money(entry.totalCredit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {selected ? (
            <EntryDetail key={selected.id} entry={selected} onPost={postSelected} onReverse={reverseSelected} />
          ) : null}
        </>
      )}
    </>
  );
}

function EntryDetail(props: {
  entry: AccountingEntryDto;
  onPost: () => void;
  onReverse: (reversalDate: string, reference: string, description: string) => Promise<void>;
}) {
  const { entry } = props;
  const [reversalOpen, setReversalOpen] = useState(false);
  const isDraft = entry.status === "draft";

  return (
    <section class="panel entry-detail">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">Détail de la pièce</span>
          <h2>
            <EntryNumber value={entry.number} /> {entry.reference} · {entry.description}
          </h2>
          <p class="detail-meta">
            Journal {entry.journalCode} · {formatCivilDateFr(entry.entryDate)}
            {entry.updatedAt ? ` · révisée le ${formatCivilDateFr(entry.updatedAt.slice(0, 10))}` : ""}
            {entry.postedAt ? ` · validée le ${formatCivilDateFr(entry.postedAt.slice(0, 10))}` : ""}
            {entry.reversedAt ? ` · extournée le ${formatCivilDateFr(entry.reversedAt.slice(0, 10))}` : ""}
          </p>
        </div>
        <div class="accounting-actions">
          <StatusBadge status={entry.status} />
          {isDraft ? (
            <>
              <Link href={`/comptabilite/pieces/${entry.id}/modifier`} class="button button-secondary">
                Modifier le brouillon
              </Link>
              <button class="button button-primary" type="button" onClick={props.onPost}>
                Valider la pièce
              </button>
            </>
          ) : entry.status === "posted" ? (
            <button
              class="button button-secondary"
              type="button"
              onClick={() => setReversalOpen((open) => !open)}
            >
              {reversalOpen ? "Annuler l'extourne" : "Extourner la pièce"}
            </button>
          ) : null}
        </div>
      </div>

      {entry.reversedByNumber ? (
        <div class="reversal-note">
          Cette pièce a été extournée par <EntryNumber value={entry.reversedByNumber} />. Elle reste dans les livres :
          sa contre-passation l'annule.
        </div>
      ) : null}
      {entry.reversalOfNumber ? (
        <div class="reversal-note">
          Contre-passation de <EntryNumber value={entry.reversalOfNumber} /> : les débits et crédits de la pièce
          d'origine sont inversés.
        </div>
      ) : null}

      {reversalOpen ? <ReversalForm entry={entry} onCancel={() => setReversalOpen(false)} onConfirm={props.onReverse} /> : null}

      <div class="responsive-table">
        <table class="data-table">
          <thead>
            <tr>
              <th>Compte</th>
              <th>Intitulé</th>
              <th>Libellé</th>
              <th>Tiers</th>
              <th class="number">Débit</th>
              <th class="number">Crédit</th>
            </tr>
          </thead>
          <tbody>
            {entry.lines.map((line) => (
              <tr key={line.id}>
                <td><strong>{line.accountCode}</strong></td>
                <td>{line.accountLabel}</td>
                <td>{line.label}</td>
                <td><TierChip code={line.thirdPartyCode} name={line.thirdPartyName} /></td>
                <td class="number">{money(line.debit)}</td>
                <td class="number">{money(line.credit)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th colspan={4}>Totaux</th>
              <th class="number">{money(entry.totalDebit)}</th>
              <th class="number">{money(entry.totalCredit)}</th>
            </tr>
          </tfoot>
        </table>
      </div>

      <Attachments entryId={entry.id} entryNumber={entry.number} />
      <AuditTrailFor entityId={entry.id} title="Piste d'audit de la pièce" limit={10} />
    </section>
  );
}

function ReversalForm(props: {
  entry: AccountingEntryDto;
  onCancel: () => void;
  onConfirm: (reversalDate: string, reference: string, description: string) => Promise<void>;
}) {
  const [reversalDate, setReversalDate] = useState(props.entry.entryDate);
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await props.onConfirm(reversalDate, reference, description);
      props.onCancel();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="reversal-form">
      <span class="eyebrow">Contre-passation</span>
      <p>
        Le noyau crée une pièce inverse dans le journal {props.entry.journalCode} (mêmes comptes, mêmes tiers, débits
        et crédits permutés), la valide immédiatement, puis marque {props.entry.number} comme extournée. Les deux
        pièces restent dans les livres : leur somme est nulle.
      </p>
      <div class="entry-header-fields">
        <label class="field">
          <span>Date de l'extourne</span>
          <input
            type="date"
            value={reversalDate}
            onInput={(event) => setReversalDate(event.currentTarget.value)}
          />
        </label>
        <label class="field">
          <span>Référence (facultatif)</span>
          <input
            maxlength={80}
            placeholder={`EXT-${props.entry.reference}`}
            value={reference}
            onInput={(event) => setReference(event.currentTarget.value)}
          />
        </label>
        <label class="field field-wide">
          <span>Motif</span>
          <input
            maxlength={180}
            placeholder="Erreur d'imputation, avoir du fournisseur…"
            value={description}
            onInput={(event) => setDescription(event.currentTarget.value)}
          />
        </label>
      </div>
      <div class="action-row">
        <button class="button button-primary" type="button" disabled={busy} onClick={() => void confirm()}>
          Créer la contre-passation
        </button>
        <button class="button button-secondary" type="button" disabled={busy} onClick={props.onCancel}>
          Renoncer
        </button>
      </div>
    </div>
  );
}

/** Justificatifs rattachés : empreinte tracée, octets conservés dans IndexedDB. */
function Attachments(props: { entryId: string; entryNumber: string }) {
  const { data, error, reload } = useAsync(() => getKernel().getAttachments(props.entryId), [props.entryId]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const attachment = await getKernel().attachDocument(props.entryId, {
        organizationId: DEMO_ORGANIZATION_ID,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        bytes,
        notes: null
      });
      setMessage(`Justificatif rattaché : ${attachment.fileName} · ${shortFingerprint(attachment.sha256)}`);
      reload();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const download = async (attachment: AttachmentDto) => {
    setMessage(null);
    try {
      const content = await getKernel().getAttachmentContent(attachment.id);
      const url = URL.createObjectURL(
        new Blob([content.bytes as unknown as BlobPart], { type: content.attachment.mimeType })
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = content.attachment.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const remove = async (attachment: AttachmentDto) => {
    if (!window.confirm(`Détacher ${attachment.fileName} de la pièce ${props.entryNumber} ?`)) return;
    setMessage(null);
    try {
      await getKernel().removeAttachment(attachment.id);
      setMessage(`Justificatif détaché : ${attachment.fileName}`);
      reload();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <div class="attachments-panel">
      <div class="attachments-heading">
        <div>
          <span class="eyebrow">Justificatifs</span>
          <h3>{data ? `${data.length} fichier(s) rattaché(s)` : "Chargement…"}</h3>
        </div>
        <label class={`button button-secondary attachment-picker ${busy ? "disabled" : ""}`}>
          {busy ? "Rattachement…" : "Rattacher un fichier"}
          <input
            type="file"
            disabled={busy}
            accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.csv,.txt,.odt,.ods,.doc,.docx,.xls,.xlsx,.zip"
            onChange={(event) => void upload(event.currentTarget.files?.[0])}
          />
        </label>
      </div>
      {message ? <p class="attachment-message">{message}</p> : null}
      <ErrorNote message={error} />
      {data && data.length > 0 ? (
        <ul class="attachment-list">
          {data.map((attachment) => (
            <li key={attachment.id}>
              <div>
                <strong>{attachment.fileName}</strong>
                <small>
                  {attachment.mimeType} · {formatByteSize(attachment.sizeBytes)} ·{" "}
                  <code title={attachment.sha256}>{shortFingerprint(attachment.sha256)}</code> · rattaché le{" "}
                  {formatTimestamp(attachment.uploadedAt)} par {attachment.uploadedBy}
                </small>
                {attachment.notes ? <small class="attachment-notes">{attachment.notes}</small> : null}
              </div>
              <div class="action-row">
                <button class="button button-secondary" type="button" onClick={() => void download(attachment)}>
                  Consulter
                </button>
                <button class="button button-ghost" type="button" onClick={() => void remove(attachment)}>
                  Détacher
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p class="muted">
          Aucun justificatif. Formats acceptés : PDF, images, textes et CSV, documents bureautiques ouverts, ZIP
          (15 Mo maximum). L'empreinte SHA-256 est calculée par le noyau et tracée dans la piste d'audit.
        </p>
      )}
    </div>
  );
}

export function NewEntry() {
  const initial: EntryFormValues = {
    journalCode: "OD",
    entryDate: "2026-02-15",
    reference: "",
    description: "",
    lines: [emptyLine(), emptyLine()]
  };

  return (
    <EntryForm
      eyebrow="Saisie des écritures"
      title="Nouvelle pièce comptable"
      subtitle="Le numéro est attribué automatiquement dans la séquence du journal ; la validation exige l'équilibre et le tiers des comptes auxiliaires."
      initial={initial}
      entryNumber={null}
      cancelHref="/comptabilite/pieces"
      onSubmit={async (values, post) => {
        await getKernel().saveEntry({
          organizationId: DEMO_ORGANIZATION_ID,
          journalCode: values.journalCode,
          entryDate: values.entryDate,
          reference: values.reference,
          description: values.description,
          postImmediately: post,
          lines: values.lines.map((line) => ({
            accountCode: line.accountCode,
            label: line.label,
            debit: line.debit === "" ? 0 : line.debit,
            credit: line.credit === "" ? 0 : line.credit,
            thirdPartyCode: line.thirdPartyCode.trim() === "" ? null : line.thirdPartyCode.trim()
          }))
        });
        window.setTimeout(() => navigate("/comptabilite/pieces"), 250);
      }}
    />
  );
}

/** Révision d'un brouillon : le numéro et le journal restent inchangés. */
export function EditEntry(props: { entryId: string }) {
  const { data, error } = useAsync(async () => {
    const kernel = getKernel();
    const entry = await kernel.getEntry(props.entryId);
    return entry;
  }, [props.entryId]);

  if (error) {
    return (
      <>
        <PageHero eyebrow="Saisie des écritures" title="Révision d'un brouillon" />
        <ErrorNote message={error} />
        <Link href="/comptabilite/pieces" class="button button-secondary">Retour aux pièces</Link>
      </>
    );
  }
  if (!data) return <Loading label="Chargement de la pièce…" />;

  if (data.status !== "draft") {
    return (
      <>
        <PageHero eyebrow="Saisie des écritures" title="Pièce non révisable" subtitle={`${data.number} · ${data.reference}`} />
        <section class="panel info-panel">
          <strong>Une pièce validée est immuable</strong>
          <p>
            La pièce {data.number} est {data.status === "posted" ? "validée" : "extournée"} : elle ne peut plus être
            modifiée. Pour la corriger, créez une contre-passation depuis son détail, ou saisissez une nouvelle pièce.
          </p>
          <div class="action-row">
            <Link href="/comptabilite/pieces" class="button button-primary">Retour aux pièces</Link>
            <Link href="/comptabilite/pieces/nouvelle" class="button button-secondary">Nouvelle pièce</Link>
          </div>
        </section>
      </>
    );
  }

  const initial: EntryFormValues = {
    journalCode: data.journalCode,
    entryDate: data.entryDate,
    reference: data.reference,
    description: data.description,
    lines: data.lines.map((line) => ({
      accountCode: line.accountCode,
      label: line.label,
      debit: line.debit === "0" ? "" : line.debit,
      credit: line.credit === "0" ? "" : line.credit,
      thirdPartyCode: line.thirdPartyCode ?? ""
    }))
  };

  return (
    <EntryForm
      key={data.id}
      eyebrow="Saisie des écritures"
      title="Réviser le brouillon"
      subtitle="Le numéro et le journal sont conservés ; chaque révision est tracée dans la piste d'audit."
      initial={initial}
      journalLocked
      entryNumber={data.number}
      cancelHref="/comptabilite/pieces"
      onSubmit={async (values, post) => {
        await getKernel().updateEntry(data.id, {
          organizationId: DEMO_ORGANIZATION_ID,
          entryDate: values.entryDate,
          reference: values.reference,
          description: values.description,
          postImmediately: post,
          lines: values.lines.map((line) => ({
            accountCode: line.accountCode,
            label: line.label,
            debit: line.debit === "" ? 0 : line.debit,
            credit: line.credit === "" ? 0 : line.credit,
            thirdPartyCode: line.thirdPartyCode.trim() === "" ? null : line.thirdPartyCode.trim()
          }))
        });
        window.setTimeout(() => navigate("/comptabilite/pieces"), 250);
      }}
    />
  );
}
