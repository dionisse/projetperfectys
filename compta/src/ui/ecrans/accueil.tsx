import { useState } from "preact/hooks";
import { SYSCOHADA_REVISE, parametresAVerifier } from "../../noyau/index";
import { getService, reinitialiserDemonstration } from "../../web/noyau";
import {
  ChargementEnCours,
  Erreur,
  Etiquette,
  Fenetre,
  Grille,
  montant,
  naviguer,
  useAsync,
  type Colonne
} from "../composants";

/**
 * Dossier ouvert : l'écran d'entrée.
 *
 * Il dit ce qu'est le dossier (société, référentiel, exercice, période, stockage), ce qu'il
 * contient, et — surtout — **ce qui n'est pas encore certain** dans le paquet pays. Un logiciel
 * comptable qui affiche des taux sans dire d'où ils viennent met son utilisateur en faute.
 */
export function Accueil(props: { onMutation: () => void }) {
  const service = getService();
  const [occupé, setOccupé] = useState(false);
  const { donnees, erreur, charge, recharger } = useAsync(async () => {
    const [contexte, balance] = await Promise.all([service.contexte(), service.balance()]);
    const aVerifier = parametresAVerifier(service.paquetPays);
    const totaux = balance.reduce(
      (cumul, ligne) => ({ debit: cumul.debit + ligne.totalDebit, credit: cumul.credit + ligne.totalCredit }),
      { debit: 0n, credit: 0n }
    );
    return { contexte, totaux, aVerifier };
  }, []);

  if (erreur) {
    return <Erreur message={erreur} onRetry={recharger} />;
  }
  if (!donnees) {
    return <ChargementEnCours libelle="Ouverture du dossier…" />;
  }

  const { contexte, totaux, aVerifier } = donnees;

  const colonnes: Colonne<{ libelle: string; valeur: string }>[] = [
    { cle: "libelle", titre: "Paramètre", valeur: (ligne) => ligne.libelle },
    { cle: "valeur", titre: "Valeur", valeur: (ligne) => ligne.valeur }
  ];

  return (
    <Fenetre
      titre="Dossier ouvert"
      chemin="Fichier › Dossier ouvert"
      sousTitre="Séquence d'ouverture d'un logiciel comptable : la société existe avant le dossier, le dossier avant l'exercice, l'exercice avant les écritures."
      actions={
        <>
          <button class="bouton" type="button" onClick={() => naviguer("/structure/plan")}>
            Plan comptable
          </button>
          <button class="bouton" type="button" onClick={() => naviguer("/traitements/lots")}>
            Lots et saisie
          </button>
          <button class="bouton primaire" type="button" onClick={() => naviguer("/interrogation/balance")}>
            Balance
          </button>
        </>
      }
    >
      <div class="deux-colonnes">
        <section class="bloc">
          <h2>Identification</h2>
          <Grille
            colonnes={colonnes}
            cleDe={(ligne) => ligne.libelle}
            lignes={[
              { libelle: "Numéro de dossier", valeur: contexte.numero },
              { libelle: "Société", valeur: `${contexte.societe.code} — ${contexte.societe.raisonSociale}` },
              { libelle: "Forme juridique", valeur: contexte.societe.formeJuridique },
              { libelle: `Identifiant fiscal (${service.paquetPays.regleIdentifiantFiscal.nom})`, valeur: contexte.societe.identifiantFiscal || "non renseigné" },
              { libelle: "Ville", valeur: `${contexte.societe.ville} — ${contexte.societe.pays}` },
              { libelle: "Régime fiscal", valeur: contexte.societe.regimeFiscal },
              { libelle: "Référentiel", valeur: `${contexte.referentiel} (${SYSCOHADA_REVISE.code})` },
              { libelle: "Paquet pays", valeur: contexte.paquetPays },
              { libelle: "Devise", valeur: `${contexte.devise} — ${service.paquetPays.devise.nom}` },
              { libelle: "Exercice", valeur: `${contexte.exercice} — ${contexte.periodeLabel}` },
              { libelle: "Période courante", valeur: String(contexte.periodeCourante) },
              { libelle: "Session", valeur: contexte.utilisateur },
              { libelle: "Stockage", valeur: contexte.stockage },
              { libelle: "Dernière modification", valeur: contexte.derniereModification ?? "aucune" }
            ]}
          />
        </section>

        <div>
          <section class="bloc">
            <h2>Contenu du dossier</h2>
            <ul class="compteurs">
              <li>
                <strong>{contexte.comptes}</strong>
                <span>comptes au plan</span>
              </li>
              <li>
                <strong>{contexte.journaux}</strong>
                <span>journaux</span>
              </li>
              <li>
                <strong>{contexte.tiers}</strong>
                <span>tiers</span>
              </li>
              <li>
                <strong>{contexte.lots}</strong>
                <span>lots ({contexte.lotsComptabilises} comptabilisés)</span>
              </li>
              <li>
                <strong>{contexte.mouvements}</strong>
                <span>mouvements comptabilisés</span>
              </li>
              <li>
                <strong>{montant(totaux.debit)}</strong>
                <span>total débit</span>
              </li>
              <li>
                <strong>{montant(totaux.credit)}</strong>
                <span>total crédit</span>
              </li>
            </ul>
            <p class="note">
              {contexte.equilibre ? (
                <Etiquette ton="succes">Débit = crédit : le grand livre est équilibré</Etiquette>
              ) : (
                <Etiquette ton="alerte">Grand livre déséquilibré : examinez la balance</Etiquette>
              )}
            </p>
          </section>

          <section class="bloc avertissement">
            <h2>Paramètres à confirmer</h2>
            <p>
              Ces {aVerifier.length} paramètres du paquet {service.paquetPays.nom} proviennent de
              guides fiscaux et de tableaux publiés, pas du texte officiel lu article par article.
              Ils sont applicables en démonstration et signalés comme tels partout où ils
              s'affichent.
            </p>
            <ul class="liste-compacte">
              {aVerifier.map((libelle) => (
                <li key={libelle}>{libelle}</li>
              ))}
            </ul>
            <p class="note">
              <button class="bouton lien" type="button" onClick={() => naviguer("/structure/codes-taxe")}>
                Voir les codes de taxe et leurs références légales
              </button>
            </p>
          </section>

          <section class="bloc">
            <h2>Réinitialiser</h2>
            <p class="note">
              Reconstruit le dossier de démonstration : société béninoise fictive, plan SYSCOHADA,
              journaux, tiers et à-nouveaux comptabilisés. Les lots saisis sont perdus.
            </p>
            <button
              class="bouton"
              type="button"
              disabled={occupé}
              onClick={() => {
                if (!window.confirm("Réinitialiser le dossier de démonstration ? Les saisies seront perdues.")) {
                  return;
                }
                setOccupé(true);
                void reinitialiserDemonstration()
                  .then(() => {
                    props.onMutation();
                    recharger();
                  })
                  .catch((probleme: unknown) => {
                    window.alert(probleme instanceof Error ? probleme.message : String(probleme));
                  })
                  .finally(() => setOccupé(false));
              }}
            >
              {occupé ? "Réinitialisation…" : "Réinitialiser la démonstration"}
            </button>
          </section>
        </div>
      </div>
    </Fenetre>
  );
}
