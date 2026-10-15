/**
 * Société du dossier — Structure › Société.
 *
 * La société est la première chose que l'on règle en ouvrant un dossier : elle porte tous les états
 * exportés, son identifiant fiscal conditionne les déclarations, et son code entre dans le numéro de
 * dossier. Les valeurs livrées sont celles d'une société **fictive** de démonstration — cet écran
 * existe pour les remplacer par les vraies.
 *
 * Deux choses ne se modifient pas ici, et l'écran le dit plutôt que de les laisser deviner : la
 * **devise** (chaque montant du dossier est en XOF ; changer de devise invaliderait le grand livre)
 * et le **référentiel** (le plan SYSCOHADA révisé vient du paquet pays).
 */

import { useState } from "preact/hooks";
import { type DateCivile, type Societe as SocieteType } from "../../noyau/index";
import { getService } from "../../web/noyau";
import {
  ChargementEnCours,
  Erreur,
  Etiquette,
  Fenetre,
  message,
  useAsync,
  type CelluleCsv
} from "../composants";
import { Exporter } from "../exporter";

export function Societe(props: { onMutation: () => void }) {
  const service = getService();
  const [revision, setRevision] = useState(0);
  const [brouillon, setBrouillon] = useState<SocieteType | null>(null);
  const [retour, setRetour] = useState<{ ton: "succes" | "erreur"; texte: string } | null>(null);
  const aujourdHui = new Date().toISOString().slice(0, 10) as DateCivile;

  const { donnees, erreur, charge, recharger } = useAsync(
    async () => ({
      contexte: await service.contexte(),
      societe: (await service.lire()).societe,
      paquet: service.paquetPays
    }),
    [revision]
  );

  if (erreur) {
    return <Erreur message={erreur} onRetry={recharger} />;
  }
  if (charge && !donnees) {
    return <ChargementEnCours libelle="Lecture du dossier…" />;
  }
  if (!donnees) {
    return <ChargementEnCours libelle="Chargement du dossier…" />;
  }

  const { contexte, societe, paquet } = donnees;

  const champ = (cle: keyof SocieteType, libelle: string, aide?: string) => {
    if (!brouillon) {
      return null;
    }
    return (
      <label class="champ-court" key={cle}>
        {libelle}
        <input
          value={String(brouillon[cle])}
          onChange={(evenement) => setBrouillon({ ...brouillon, [cle]: evenement.currentTarget.value })}
        />
        {aide ? <span class="note">{aide}</span> : null}
      </label>
    );
  };

  const enregistrer = async (): Promise<void> => {
    if (!brouillon) {
      return;
    }
    try {
      const modifiee = await service.modifierSociete(brouillon);
      setBrouillon(null);
      setRetour({
        ton: "succes",
        texte: `Société enregistrée : ${modifiee.raisonSociale} (${modifiee.formeJuridique}), ${
          paquet.regleIdentifiantFiscal.nom
        } ${modifiee.identifiantFiscal}. Chaque changement est dans la piste d'audit.`
      });
      setRevision((valeur) => valeur + 1);
      props.onMutation();
    } catch (erreurInconnue) {
      setRetour({ ton: "erreur", texte: message(erreurInconnue) });
    }
  };

  const lignesCsv = (): (readonly CelluleCsv[])[] => [
    ["Société du dossier"],
    ["Dossier", contexte.numero],
    ["Code société", societe.code],
    ["Raison sociale", societe.raisonSociale],
    ["Forme juridique", societe.formeJuridique],
    [paquet.regleIdentifiantFiscal.nomLong, societe.identifiantFiscal],
    ["Adresse", societe.adresse],
    ["Ville", societe.ville],
    ["Pays", societe.pays],
    ["Téléphone", societe.telephone],
    ["Courriel", societe.courriel],
    ["Régime fiscal", societe.regimeFiscal],
    ["Devise", contexte.devise, "fixée par le paquet pays"],
    ["Référentiel", contexte.referentiel, paquet.version]
  ];

  const regle = paquet.regleIdentifiantFiscal;

  return (
    <Fenetre
      titre="Société du dossier"
      chemin="Structure › Société"
      sousTitre={`Dossier ${contexte.numero} · paquet pays ${paquet.nom} ${paquet.version}`}
      actions={
        <>
          <Exporter tige="societe" contexte={societe.code} date={aujourdHui} lignes={lignesCsv} />
          <button class="bouton" type="button" onClick={() => recharger()}>
            Actualiser
          </button>
        </>
      }
    >
      {retour ? (
        <p class={`retour ${retour.ton === "succes" ? "succes" : "erreur"}`} role="status">
          {retour.texte}
        </p>
      ) : null}

      <div class="bloc">
        <h2>Identification</h2>
        {brouillon === null ? (
          <>
            <dl class="liste-definition">
              <dt>Code société</dt>
              <dd class="mono">{societe.code}</dd>
              <dt>Raison sociale</dt>
              <dd>{societe.raisonSociale}</dd>
              <dt>Forme juridique</dt>
              <dd>{societe.formeJuridique}</dd>
              <dt>{regle.nomLong}</dt>
              <dd>
                <span class="mono">{societe.identifiantFiscal || "non renseigné"}</span>{" "}
                {regle.aVerifier ? (
                  <Etiquette ton="alerte">format à confirmer auprès de la DGI</Etiquette>
                ) : (
                  <Etiquette ton="succes">format validé</Etiquette>
                )}
              </dd>
              <dt>Adresse</dt>
              <dd>
                {societe.adresse}
                {societe.ville ? `, ${societe.ville}` : ""}
                {societe.pays ? ` — ${societe.pays}` : ""}
              </dd>
              <dt>Téléphone</dt>
              <dd>{societe.telephone || "—"}</dd>
              <dt>Courriel</dt>
              <dd>{societe.courriel || "—"}</dd>
              <dt>Régime fiscal</dt>
              <dd>{societe.regimeFiscal || "—"}</dd>
              <dt>Devise</dt>
              <dd>
                {contexte.devise} — {paquet.devise.nom}{" "}
                <Etiquette>non modifiable</Etiquette>
              </dd>
            </dl>
            <p class="note">
              La devise et le référentiel viennent du paquet pays : chaque montant du grand livre est
              en {contexte.devise} et chaque compte appartient à {contexte.referentiel}. Les changer
              ici n'aurait aucun sens — un dossier dans une autre devise est un autre dossier.
            </p>
            <div class="barre-actions">
              <button class="bouton" type="button" onClick={() => setBrouillon({ ...societe })}>
                Modifier la société
              </button>
            </div>
          </>
        ) : (
          <>
            <div class="deux-colonnes">
              {champ("raisonSociale", "Raison sociale")}
              <label class="champ-court" key="formeJuridique">
                Forme juridique
                <select
                  value={brouillon.formeJuridique}
                  onChange={(evenement) => setBrouillon({ ...brouillon, formeJuridique: evenement.currentTarget.value })}
                >
                  {paquet.formesJuridiques.map((forme) => (
                    <option key={forme.code} value={forme.code}>
                      {forme.code} — {forme.libelle}
                    </option>
                  ))}
                  {paquet.formesJuridiques.every((forme) => forme.code !== brouillon.formeJuridique) ? (
                    <option value={brouillon.formeJuridique}>{brouillon.formeJuridique} (valeur actuelle)</option>
                  ) : null}
                </select>
              </label>
              {champ("code", "Code société", "Entre dans le numéro de dossier. 5 caractères au plus.")}
              {champ("identifiantFiscal", regle.nomLong, `Exemple : ${regle.exemple}`)}
              {champ("adresse", "Adresse")}
              {champ("ville", "Ville")}
              {champ("pays", "Pays")}
              {champ("telephone", "Téléphone")}
              {champ("courriel", "Courriel")}
              {champ("regimeFiscal", "Régime fiscal", "Réel normal, réel simplifié, forfaitaire…")}
            </div>
            <div class="barre-actions">
              <button class="bouton" type="button" onClick={() => void enregistrer()}>
                Enregistrer
              </button>
              <button
                class="bouton"
                type="button"
                onClick={() => {
                  setBrouillon(null);
                  setRetour(null);
                }}
              >
                Abandonner
              </button>
            </div>
          </>
        )}
      </div>

      <div class="bloc">
        <h2>À propos des valeurs livrées</h2>
        <p class="note">
          La société affichée est <strong>fictive</strong> : elle sert à démontrer l'application. Son{" "}
          {regle.nom}, son adresse et son régime fiscal sont plausibles pour {paquet.nom}, mais ils ne
          correspondent à aucune entreprise réelle. Remplacez-les par ceux du dossier avant toute
          utilisation — la raison sociale et l'identifiant fiscal figurent sur tous les états exportés
          et sur les déclarations.
        </p>
        {regle.aVerifier ? (
          <p class="avertissement">
            Le format de l'{regle.nom} ({regle.nomLong}) est accepté en {regle.messageErreur} Ce format
            reste à confirmer auprès de la DGI : la validation est volontairement large, et elle
            refusera un identifiant manifestement faux plutôt que d'accepter n'importe quoi.
          </p>
        ) : null}
      </div>
    </Fenetre>
  );
}
