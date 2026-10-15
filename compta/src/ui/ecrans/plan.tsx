/**
 * Plan comptable — Structure › Plan comptable.
 *
 * Le compte est **segmenté** : la tête de l'écran rappelle le format, parce qu'un utilisateur qui ne
 * voit pas la structure ne comprend pas pourquoi `401100-FOU01` et `401100` sont le même compte du
 * plan vu deux fois.
 *
 * Le plan se modifie : un cabinet ajoute les subdivisions dont il a besoin, corrige un libellé, retire
 * un compte qui ne sert pas. Deux garde-fous tiennent l'ensemble, et ils sont visibles avant d'être
 * éprouvés — la colonne « Utilisation » dit ce qui tient à chaque compte :
 *
 * - un compte **mouvementé** ne change pas de groupe : le groupe décide de la ligne du bilan où le
 *   compte apparaît, et le déplacer réécrirait des états déjà produits ;
 * - un compte **mouvementé** ne se supprime pas : il se désactive, pour sortir de la saisie sans
 *   effacer l'histoire.
 */

import { useState } from "preact/hooks";
import {
  SYSCOHADA_REVISE,
  ZERO,
  classeDuReferentiel,
  groupeDuReferentiel,
  type Compte,
  type DateCivile
} from "../../noyau/index";
import { getService } from "../../web/noyau";
import {
  ChargementEnCours,
  Erreur,
  Etiquette,
  Fenetre,
  Grille,
  message,
  montant,
  useAsync,
  type CelluleCsv,
  type Colonne
} from "../composants";
import { Exporter } from "../exporter";

interface BrouillonCompte {
  numero: string;
  libelle: string;
  groupe: string;
  actif: boolean;
  autoriseSaisie: boolean;
  exigeTiers: boolean;
}

export function PlanComptable(props: { onMutation: () => void }) {
  const service = getService();
  const [recherche, setRecherche] = useState("");
  const [selection, setSelection] = useState<string | null>(null);
  const [brouillon, setBrouillon] = useState<BrouillonCompte | null>(null);
  const [creation, setCreation] = useState(false);
  const [retour, setRetour] = useState<{ ton: "succes" | "erreur"; texte: string } | null>(null);
  const [revision, setRevision] = useState(0);
  const aujourdHui = new Date().toISOString().slice(0, 10) as DateCivile;

  const structure = SYSCOHADA_REVISE.structure;

  const { donnees, erreur, charge, recharger } = useAsync(
    async () => ({
      contexte: await service.contexte(),
      comptes: await service.planComptable(recherche),
      utilisation: await service.utilisationDesComptes()
    }),
    [recherche, revision]
  );

  if (erreur) {
    return <Erreur message={erreur} onRetry={recharger} />;
  }
  if (charge && !donnees) {
    return <ChargementEnCours libelle="Lecture du plan comptable…" />;
  }
  if (!donnees) {
    return <ChargementEnCours libelle="Chargement du dossier…" />;
  }

  const { contexte, comptes, utilisation } = donnees;

  const utilisationDe = (numero: string): { mouvements: number; lots: number } =>
    utilisation[numero] ?? { mouvements: 0, lots: 0 };
  const mouvemente = (numero: string): boolean => utilisationDe(numero).mouvements > 0;
  const tient = (numero: string): boolean => {
    const usage = utilisationDe(numero);
    return usage.mouvements + usage.lots > 0;
  };

  const terminer = (texte: string): void => {
    setRetour({ ton: "succes", texte });
    setBrouillon(null);
    setCreation(false);
    setRevision((valeur) => valeur + 1);
    props.onMutation();
  };

  const echouer = (erreurInconnue: unknown): void => {
    setRetour({ ton: "erreur", texte: message(erreurInconnue) });
  };

  const compteSelectionne = comptes.find((compte) => compte.numero === selection) ?? null;
  const brouillonEnCours: BrouillonCompte | null = creation
    ? brouillon ?? {
        numero: "",
        libelle: "",
        groupe: SYSCOHADA_REVISE.groupes[0]!.code,
        actif: true,
        autoriseSaisie: true,
        exigeTiers: false
      }
    : compteSelectionne
      ? brouillon ?? {
          numero: compteSelectionne.numero,
          libelle: compteSelectionne.libelle,
          groupe: compteSelectionne.groupe,
          actif: compteSelectionne.actif,
          autoriseSaisie: compteSelectionne.autoriseSaisie,
          exigeTiers: compteSelectionne.exigeTiers
        }
      : null;

  const modifie =
    brouillonEnCours !== null &&
    compteSelectionne !== null &&
    !creation &&
    (brouillonEnCours.libelle.trim() !== compteSelectionne.libelle ||
      brouillonEnCours.groupe !== compteSelectionne.groupe ||
      brouillonEnCours.actif !== compteSelectionne.actif ||
      brouillonEnCours.autoriseSaisie !== compteSelectionne.autoriseSaisie ||
      brouillonEnCours.exigeTiers !== compteSelectionne.exigeTiers);
  const creationPrete =
    creation &&
    brouillonEnCours !== null &&
    brouillonEnCours.numero.trim() !== "" &&
    brouillonEnCours.libelle.trim() !== "" &&
    brouillonEnCours.groupe !== "";

  const raisonEnregistrement = (() => {
    if (!brouillonEnCours) {
      return "Sélectionnez un compte, ou ajoutez-en un.";
    }
    if (creation) {
      return creationPrete ? "" : "Un numéro, un libellé et un groupe sont obligatoires.";
    }
    return modifie ? "" : "Aucune modification : rien à enregistrer.";
  })();

  const enregistrer = async (): Promise<void> => {
    if (!brouillonEnCours) {
      return;
    }
    try {
      if (creation) {
        const cree = await service.ajouterCompte({
          numero: brouillonEnCours.numero.trim(),
          libelle: brouillonEnCours.libelle.trim(),
          groupe: brouillonEnCours.groupe
        });
        setSelection(cree.numero);
        terminer(
          `Compte ${cree.numero} ajouté au plan : ${cree.libelle}, groupe ${groupeDuReferentiel(SYSCOHADA_REVISE, cree.groupe).libelle}.`
        );
        return;
      }
      const compte = await service.modifierCompte(compteSelectionne!.numero, {
        libelle: brouillonEnCours.libelle,
        groupe: brouillonEnCours.groupe,
        actif: brouillonEnCours.actif,
        autoriseSaisie: brouillonEnCours.autoriseSaisie,
        exigeTiers: brouillonEnCours.exigeTiers
      });
      terminer(`Compte ${compte.comptePrincipal} mis à jour : ${compte.libelle}.`);
    } catch (erreurInconnue) {
      echouer(erreurInconnue);
    }
  };

  const supprimer = async (compte: Compte): Promise<void> => {
    try {
      await service.supprimerCompte(compte.numero);
      if (selection === compte.numero) {
        setSelection(null);
      }
      terminer(`Compte ${compte.comptePrincipal} retiré du plan.`);
    } catch (erreurInconnue) {
      echouer(erreurInconnue);
    }
  };

  const colonnes: Colonne<Compte>[] = [
    { cle: "numero", titre: "Numéro", largeur: "9rem", valeur: (compte) => <span class="mono">{compte.numero}</span> },
    { cle: "libelle", titre: "Libellé", valeur: (compte) => compte.libelle },
    {
      cle: "classe",
      titre: "Classe",
      largeur: "15rem",
      valeur: (compte) => `${compte.classe} — ${classeDuReferentiel(SYSCOHADA_REVISE, compte.classe).libelle}`
    },
    {
      cle: "groupe",
      titre: "Groupe",
      largeur: "18rem",
      valeur: (compte) => {
        const groupe = groupeDuReferentiel(SYSCOHADA_REVISE, compte.groupe);
        return `${groupe.libelle} · ${groupe.etat}`;
      }
    },
    {
      cle: "auxiliaire",
      titre: "Tiers",
      alignement: "centre",
      largeur: "6rem",
      valeur: (compte) => (compte.exigeTiers ? <Etiquette ton="info">Auxiliaire</Etiquette> : "—")
    },
    {
      cle: "saisie",
      titre: "Saisie",
      alignement: "centre",
      largeur: "6rem",
      valeur: (compte) => (compte.autoriseSaisie ? "Autorisée" : "Regroupement")
    },
    {
      cle: "solde",
      titre: "Solde initial",
      alignement: "droite",
      largeur: "10rem",
      valeur: (compte) => (compte.soldeInitial === ZERO ? "—" : montant(compte.soldeInitial))
    },
    {
      cle: "etat",
      titre: "État",
      alignement: "centre",
      largeur: "7rem",
      valeur: (compte) => (compte.actif ? <Etiquette ton="succes">actif</Etiquette> : <Etiquette>désactivé</Etiquette>)
    },
    {
      cle: "utilisation",
      titre: "Utilisation",
      alignement: "centre",
      largeur: "9rem",
      valeur: (compte) => {
        const usage = utilisationDe(compte.comptePrincipal);
        const total = usage.mouvements + usage.lots;
        return total === 0
          ? "—"
          : `${usage.mouvements} écriture${usage.mouvements > 1 ? "s" : ""}${
              usage.lots > 0 ? ` · ${usage.lots} en lot` : ""
            }`;
      }
    }
  ];

  const lignesCsv = (): (readonly CelluleCsv[])[] => [
    ["Plan comptable"],
    ["Dossier", contexte.numero],
    ["Société", contexte.societe.raisonSociale],
    ["Référentiel", SYSCOHADA_REVISE.nom, SYSCOHADA_REVISE.version],
    ["Structure", structure.code, structure.segments.map((segment) => segment.libelle).join(structure.separateur)],
    [],
    ["Numéro", "Libellé", "Classe", "Groupe", "Nature du groupe", "Tiers exigé", "Saisie", "Actif", "Solde initial", "Écritures", "Lignes en lot"],
    ...comptes.map((compte) => {
      const groupe = groupeDuReferentiel(SYSCOHADA_REVISE, compte.groupe);
      const usage = utilisationDe(compte.comptePrincipal);
      return [
        compte.numero,
        compte.libelle,
        `${compte.classe} — ${classeDuReferentiel(SYSCOHADA_REVISE, compte.classe).libelle}`,
        compte.groupe,
        groupe.libelle,
        compte.exigeTiers ? "oui" : "non",
        compte.autoriseSaisie ? "autorisée" : "regroupement",
        compte.actif ? "actif" : "désactivé",
        compte.soldeInitial,
        usage.mouvements,
        usage.lots
      ];
    })
  ];

  const groupeFiges = compteSelectionne !== null && mouvemente(compteSelectionne.comptePrincipal);

  return (
    <Fenetre
      titre="Plan comptable"
      chemin={`Structure › Plan comptable · ${SYSCOHADA_REVISE.nom}`}
      sousTitre={`${SYSCOHADA_REVISE.version} · ${comptes.length} comptes affichés · dossier ${contexte.numero}`}
      actions={
        <>
          <div class="recherche" role="search">
            <label for="recherche-compte">Rechercher</label>
            <input
              id="recherche-compte"
              type="search"
              value={recherche}
              placeholder="numéro ou libellé"
              onInput={(evenement) => setRecherche((evenement.target as HTMLInputElement).value)}
            />
          </div>
          <Exporter tige="plan-comptable" contexte={contexte.societe.code} date={aujourdHui} lignes={lignesCsv} />
          <button
            class="bouton"
            type="button"
            onClick={() => {
              setCreation(true);
              setSelection(null);
              setBrouillon(null);
              setRetour(null);
            }}
          >
            Ajouter un compte
          </button>
        </>
      }
    >
      {retour ? (
        <p class={`retour ${retour.ton === "succes" ? "succes" : "erreur"}`} role="status">
          {retour.texte}
        </p>
      ) : null}

      <p class="structure">
        Structure de comptes <strong>{structure.code}</strong> :{" "}
        {structure.segments
          .map((segment) => `${segment.libelle} (${segment.longueur}${segment.obligatoire ? "" : ", facultatif"})`)
          .join(structure.separateur === "-" ? " · " : ` ${structure.separateur} `)}{" "}
        — exemple <span class="mono">411100-CLI01-ABJ1</span>
      </p>

      <Grille
        colonnes={colonnes}
        lignes={comptes}
        cleDe={(compte) => compte.numero}
        selection={selection}
        surSelection={(cle) => {
          setSelection(cle);
          setCreation(false);
          setBrouillon(null);
          setRetour(null);
        }}
        vide="Aucun compte ne correspond à cette recherche."
        pied={
          <tr>
            <th scope="row">{comptes.length} comptes</th>
            <td colSpan={8}>
              {SYSCOHADA_REVISE.classes.length} classes · {SYSCOHADA_REVISE.groupes.length} groupes d'états
              financiers
            </td>
          </tr>
        }
      />

      {brouillonEnCours ? (
        <div class="bloc">
          <h2>{creation ? "Ajouter un compte au plan" : `Modifier ${compteSelectionne?.numero ?? ""}`}</h2>
          {groupeFiges ? (
            <p class="avertissement">
              Ce compte porte{" "}
              {utilisationDe(compteSelectionne!.comptePrincipal).mouvements} écriture
              {utilisationDe(compteSelectionne!.comptePrincipal).mouvements > 1 ? "s" : ""} : son groupe et son solde
              initial sont figés. Le groupe décide de la ligne du bilan où le compte apparaît — le
              déplacer réécrirait des états déjà produits. Le libellé et les drapeaux restent
              modifiables.
            </p>
          ) : null}
          <div class="deux-colonnes">
            <label class="champ-court">
              Numéro
              <input
                class="mono"
                value={brouillonEnCours.numero}
                disabled={!creation}
                placeholder="674100"
                title={
                  creation
                    ? `6 chiffres au moins, selon la structure ${structure.code}`
                    : "Le numéro identifie le compte dans les écritures : il ne change pas"
                }
                onChange={(evenement) => setBrouillon({ ...brouillonEnCours, numero: evenement.currentTarget.value })}
              />
            </label>
            <label class="champ-court">
              Libellé
              <input
                value={brouillonEnCours.libelle}
                onChange={(evenement) => setBrouillon({ ...brouillonEnCours, libelle: evenement.currentTarget.value })}
              />
            </label>
            <label class="champ-court">
              Groupe d'états financiers
              <select
                value={brouillonEnCours.groupe}
                disabled={!creation && groupeFiges}
                title={
                  !creation && groupeFiges
                    ? "Ce compte est mouvementé : il ne change pas de groupe, sinon les états déjà produits ne correspondraient plus au plan."
                    : "Le groupe décide de la ligne du bilan ou du compte de résultat où le compte apparaît"
                }
                onChange={(evenement) => setBrouillon({ ...brouillonEnCours, groupe: evenement.currentTarget.value })}
              >
                {SYSCOHADA_REVISE.groupes.map((groupe) => (
                  <option key={groupe.code} value={groupe.code}>
                    {groupe.code} — {groupe.libelle} · {groupe.etat}
                  </option>
                ))}
              </select>
            </label>
            <label class="case-a-cocher">
              <input
                type="checkbox"
                checked={brouillonEnCours.autoriseSaisie}
                onChange={(evenement) =>
                  setBrouillon({ ...brouillonEnCours, autoriseSaisie: evenement.currentTarget.checked })
                }
              />
              Autoriser la saisie directe
            </label>
            <label class="case-a-cocher">
              <input
                type="checkbox"
                checked={brouillonEnCours.exigeTiers}
                onChange={(evenement) =>
                  setBrouillon({ ...brouillonEnCours, exigeTiers: evenement.currentTarget.checked })
                }
              />
              Exiger un tiers (compte auxiliaire)
            </label>
            <label class="case-a-cocher">
              <input
                type="checkbox"
                checked={brouillonEnCours.actif}
                onChange={(evenement) => setBrouillon({ ...brouillonEnCours, actif: evenement.currentTarget.checked })}
              />
              Compte actif
            </label>
          </div>
          <div class="barre-actions">
            <button
              class="bouton"
              type="button"
              disabled={creation ? !creationPrete : !modifie}
              title={raisonEnregistrement || (creation ? "Ajouter ce compte au plan" : "Enregistrer les modifications")}
              onClick={() => void enregistrer()}
            >
              {creation ? "Ajouter le compte" : "Enregistrer"}
            </button>
            {!creation && compteSelectionne ? (
              <button
                class="bouton"
                type="button"
                disabled={tient(compteSelectionne.comptePrincipal)}
                title={
                  tient(compteSelectionne.comptePrincipal)
                    ? `Ce compte tient au dossier (${
                        utilisationDe(compteSelectionne.comptePrincipal).mouvements
                      } écriture(s), ${
                        utilisationDe(compteSelectionne.comptePrincipal).lots
                      } ligne(s) en lot) : il ne se supprime pas. Désactivez-le pour le retirer de la saisie.`
                    : "Retirer ce compte du plan"
                }
                onClick={() => void supprimer(compteSelectionne)}
              >
                Supprimer ce compte
              </button>
            ) : null}
            <button
              class="bouton"
              type="button"
              onClick={() => {
                setBrouillon(null);
                setCreation(false);
                setRetour(null);
              }}
            >
              Abandonner
            </button>
          </div>
        </div>
      ) : null}

      <p class="note">
        Jeu de démarrage : les classes et leurs divisions sont celles du SYSCOHADA révisé ; les
        subdivisions les plus fines restent à valider sur l'annexe de l'Acte uniforme avant une mise en
        production. Ajoutez ici les comptes dont le dossier a besoin — un compte ajouté est proposé à la
        saisie immédiatement, et son groupe décide de la ligne d'état financier où il apparaîtra.
      </p>
    </Fenetre>
  );
}
