/**
 * Codes de taxe et taux — Structure › Codes de taxe.
 *
 * Les taux appartiennent au **dossier**, pas au noyau : le paquet pays les amorce, l'utilisateur les
 * corrige. Cet écran est l'endroit où l'on remplace un taux relevé dans une publication par celui que
 * le cabinet a confirmé, où l'on ajoute un code qu'une loi de finances vient de créer, et où l'on
 * revient au paquet pays après une mise à jour.
 *
 * Une règle tient l'ensemble : **un taux qui a déjà servi ne se réécrit pas**. Les écritures
 * comptabilisées ont été calculées avec la valeur d'alors, et la déclaration TVA se recalcule à partir
 * des codes en vigueur — modifier un taux utilisé ferait mentir les deux. Un changement de taux passe
 * par un nouveau code, ce que fait la réalité : la TVA n'a jamais changé de taux en réécrivant
 * l'ancien. Les champs concernés sont grisés, avec la raison, plutôt que laissés à un refus.
 */

import { useState } from "preact/hooks";
import {
  ZERO,
  formaterTaux,
  type CodeTaxe,
  type ConditionTaxe,
  type DateCivile,
  type ImpotAnnuel,
  type SensTaxe
} from "../../noyau/index";
import { getService } from "../../web/noyau";
import {
  ChargementEnCours,
  Erreur,
  Etiquette,
  ExportCsv,
  Fenetre,
  Grille,
  message,
  montant,
  useAsync,
  type CelluleCsv,
  type Colonne
} from "../composants";

const LIBELLES_SENS: Record<SensTaxe, string> = {
  collectee: "Collectée",
  deductible: "Déductible",
  "retenue-a-la-source": "Retenue à la source",
  charge: "Charge de l'entreprise"
};

const LIBELLES_CONDITION: Record<ConditionTaxe, string> = {
  aucune: "Toujours",
  interieur: "Régime intérieur",
  "tiers-immatricule": "Tiers immatriculé à l'IFU",
  "tiers-non-immatricule": "Tiers non immatriculé",
  "tiers-public": "Tiers public (État, collectivité)",
  exportation: "Exportation / importation"
};

/** Un code en cours de saisie : du texte, pas encore des points de base. */
interface BrouillonCode {
  code: string;
  libelle: string;
  taux: string;
  base: CodeTaxe["base"];
  sens: SensTaxe;
  compteTaxe: string;
  exigibleSur: "achat" | "vente";
  condition: ConditionTaxe;
  referenceLegale: string;
}

/**
 * Un pourcentage saisi, en points de base, sans passer par un flottant.
 *
 * Deux décimales au plus : 18 → 1800, 1,5 → 150, 0,1 → 10. Renvoie `null` quand la saisie n'est pas
 * un taux lisible, et l'écran le dit au lieu de proposer un taux faux.
 */
export function pointsDeBaseDepuisPourcent(texte: string): bigint | null {
  const propre = texte.trim().replace(/\s/gu, "").replace(",", ".");
  if (propre === "" || !/^\d{1,3}(\.\d{1,2})?$/.test(propre)) {
    return null;
  }
  const [entier, decimales = ""] = propre.split(".");
  return BigInt(entier!) * 100n + BigInt(decimales.padEnd(2, "0"));
}

/** Des points de base, en pourcentage lisible : 1800 → « 18 », 150 → « 1,50 », 10 → « 0,10 ». */
export function pourcentDepuisPointsDeBase(pointsDeBase: bigint): string {
  const entiers = pointsDeBase / 100n;
  const reste = pointsDeBase % 100n;
  return reste === ZERO ? entiers.toString() : `${entiers.toString()},${reste.toString().padStart(2, "0")}`;
}

const brouillonVide = (): BrouillonCode => ({
  code: "",
  libelle: "",
  taux: "",
  base: "hors-taxe",
  sens: "collectee",
  compteTaxe: "443100",
  exigibleSur: "vente",
  condition: "interieur",
  referenceLegale: ""
});

const brouillonDe = (code: CodeTaxe): BrouillonCode => ({
  code: code.code,
  libelle: code.libelle,
  taux: pourcentDepuisPointsDeBase(code.pointsDeBase),
  base: code.base,
  sens: code.sens,
  compteTaxe: code.compteTaxe,
  exigibleSur: code.exigibleSur,
  condition: code.condition,
  referenceLegale: code.referenceLegale
});

export function CodesTaxe(props: { onMutation: () => void }) {
  const service = getService();
  const paquet = service.paquetPays;
  const [selection, setSelection] = useState<string | null>(null);
  const [brouillon, setBrouillon] = useState<BrouillonCode | null>(null);
  const [creation, setCreation] = useState(false);
  const [retour, setRetour] = useState<{ ton: "succes" | "erreur"; texte: string } | null>(null);
  const [revision, setRevision] = useState(0);
  const aujourdHui = new Date().toISOString().slice(0, 10) as DateCivile;

  const { donnees, erreur, charge, recharger } = useAsync(
    async () => ({
      contexte: await service.contexte(),
      codes: await service.codesTaxe(),
      utilisation: await service.utilisationDesCodesTaxe(),
      comptes: await service.planComptable()
    }),
    [revision]
  );

  if (erreur) {
    return <Erreur message={erreur} onRetry={recharger} />;
  }
  if (charge && !donnees) {
    return <ChargementEnCours libelle="Lecture du paramétrage fiscal…" />;
  }
  if (!donnees) {
    return <ChargementEnCours libelle="Chargement du dossier…" />;
  }

  const { contexte, codes, utilisation, comptes } = donnees;

  const utilisationDe = (code: string): { mouvements: number; lots: number } =>
    utilisation[code] ?? { mouvements: 0, lots: 0 };
  const aServi = (code: string): boolean => {
    const usage = utilisationDe(code);
    return usage.mouvements + usage.lots > 0;
  };

  /** D'où vient la valeur affichée : du paquet pays, d'une correction, ou d'une création du dossier. */
  const origineDe = (code: CodeTaxe): "paquet" | "modifie" | "cree" => {
    const reference = paquet.codesTaxe.find((item) => item.code === code.code);
    if (!reference) {
      return "cree";
    }
    const identique =
      reference.pointsDeBase === code.pointsDeBase &&
      reference.base === code.base &&
      reference.sens === code.sens &&
      reference.compteTaxe === code.compteTaxe &&
      reference.condition === code.condition &&
      reference.exigibleSur === code.exigibleSur &&
      reference.libelle === code.libelle &&
      reference.referenceLegale === code.referenceLegale &&
      reference.aVerifier === code.aVerifier;
    return identique ? "paquet" : "modifie";
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

  const codeSelectionne = codes.find((code) => code.code === selection) ?? null;
  const brouillonEnCours = creation ? brouillon ?? brouillonVide() : codeSelectionne ? brouillon ?? brouillonDe(codeSelectionne) : null;

  const tauxSaisi = brouillonEnCours ? pointsDeBaseDepuisPourcent(brouillonEnCours.taux) : null;
  const tauxIllisible = brouillonEnCours !== null && brouillonEnCours.taux.trim() !== "" && tauxSaisi === null;
  const modifie =
    brouillonEnCours !== null &&
    codeSelectionne !== null &&
    !creation &&
    tauxSaisi !== null &&
    (brouillonEnCours.libelle.trim() !== codeSelectionne.libelle ||
      tauxSaisi !== codeSelectionne.pointsDeBase ||
      brouillonEnCours.base !== codeSelectionne.base ||
      brouillonEnCours.sens !== codeSelectionne.sens ||
      brouillonEnCours.compteTaxe !== codeSelectionne.compteTaxe ||
      brouillonEnCours.exigibleSur !== codeSelectionne.exigibleSur ||
      brouillonEnCours.condition !== codeSelectionne.condition ||
      brouillonEnCours.referenceLegale.trim() !== codeSelectionne.referenceLegale);
  const creationPret =
    creation &&
    brouillonEnCours !== null &&
    brouillonEnCours.code.trim() !== "" &&
    brouillonEnCours.libelle.trim() !== "" &&
    tauxSaisi !== null &&
    brouillonEnCours.referenceLegale.trim() !== "";

  const raisonEnregistrement = (() => {
    if (!brouillonEnCours) {
      return "Sélectionnez un code de taxe, ou créez-en un.";
    }
    if (tauxIllisible) {
      return "Le taux n'est pas lisible : un pourcentage, deux décimales au plus (18 ; 1,5 ; 0,1).";
    }
    if (creation) {
      return creationPret ? "" : "Un code, un libellé, un taux et une référence légale sont obligatoires.";
    }
    return modifie ? "" : "Aucune modification : rien à enregistrer.";
  })();

  const enregistrer = async (): Promise<void> => {
    if (!brouillonEnCours || tauxSaisi === null) {
      return;
    }
    try {
      if (creation) {
        const cree = await service.ajouterCodeTaxe({
          code: brouillonEnCours.code.trim().toUpperCase(),
          libelle: brouillonEnCours.libelle,
          pointsDeBase: tauxSaisi,
          base: brouillonEnCours.base,
          sens: brouillonEnCours.sens,
          compteTaxe: brouillonEnCours.compteTaxe,
          exigibleSur: brouillonEnCours.exigibleSur,
          condition: brouillonEnCours.condition,
          referenceLegale: brouillonEnCours.referenceLegale
        });
        setSelection(cree.code);
        terminer(
          `Code ${cree.code} créé : ${cree.libelle}, ${formaterTaux(cree.pointsDeBase)}, compte ${
            cree.compteTaxe
          }. Il est proposé dès la prochaine saisie.`
        );
        return;
      }
      const avant = codeSelectionne!;
      // Les valeurs sont relevées avant l'appel : le port de stockage peut rendre le même objet, que
      // la mutation modifie alors en place. Comparer des bigint, pas des objets, évite l'illusion.
      const tauxAvant = avant.pointsDeBase;
      const modifieCode = await service.modifierCodeTaxe(avant.code, {
        libelle: brouillonEnCours.libelle,
        pointsDeBase: tauxSaisi,
        base: brouillonEnCours.base,
        sens: brouillonEnCours.sens,
        compteTaxe: brouillonEnCours.compteTaxe,
        exigibleSur: brouillonEnCours.exigibleSur,
        condition: brouillonEnCours.condition,
        referenceLegale: brouillonEnCours.referenceLegale
      });
      terminer(
        tauxSaisi !== tauxAvant
          ? `Code ${modifieCode.code} : taux ${formaterTaux(tauxAvant)} → ${formaterTaux(
              modifieCode.pointsDeBase
            )}. Le changement est dans la piste d'audit, et les écritures déjà comptabilisées gardent l'ancien calcul.`
          : `Code ${modifieCode.code} mis à jour.`
      );
    } catch (erreurInconnue) {
      echouer(erreurInconnue);
    }
  };

  const supprimer = async (code: CodeTaxe): Promise<void> => {
    try {
      await service.supprimerCodeTaxe(code.code);
      if (selection === code.code) {
        setSelection(null);
      }
      terminer(`Code ${code.code} supprimé du paramétrage du dossier.`);
    } catch (erreurInconnue) {
      echouer(erreurInconnue);
    }
  };

  const reprendre = async (): Promise<void> => {
    try {
      const bilan = await service.reprendreCodesTaxeDuPaquet();
      const morceaux = [
        bilan.repris.length > 0 ? `repris : ${bilan.repris.join(", ")}` : "aucun taux à reprendre",
        bilan.ajoutes.length > 0 ? `ajoutés : ${bilan.ajoutes.join(", ")}` : "",
        bilan.conserves.length > 0
          ? `conservés au dossier parce qu'ils ont servi : ${bilan.conserves.join(", ")}`
          : "",
        bilan.personnalises.length > 0 ? `codes créés au dossier, conservés : ${bilan.personnalises.join(", ")}` : ""
      ].filter((morceau) => morceau !== "");
      terminer(`Taux repris du paquet ${paquet.nom} ${paquet.version} — ${morceaux.join(" · ")}.`);
    } catch (erreurInconnue) {
      echouer(erreurInconnue);
    }
  };

  const colonnes: Colonne<CodeTaxe>[] = [
    { cle: "code", titre: "Code", largeur: "8rem", valeur: (code) => <span class="mono">{code.code}</span> },
    { cle: "libelle", titre: "Libellé", valeur: (code) => code.libelle },
    {
      cle: "taux",
      titre: "Taux",
      alignement: "droite",
      largeur: "6rem",
      valeur: (code) => <strong class="mono">{formaterTaux(code.pointsDeBase)}</strong>
    },
    {
      cle: "base",
      titre: "Base",
      largeur: "11rem",
      valeur: (code) => (code.base === "hors-taxe" ? "Hors taxe" : "Toutes taxes comprises")
    },
    { cle: "sens", titre: "Sens", largeur: "11rem", valeur: (code) => LIBELLES_SENS[code.sens] ?? code.sens },
    {
      cle: "compte",
      titre: "Compte de taxe",
      alignement: "centre",
      largeur: "8rem",
      valeur: (code) => <span class="mono">{code.compteTaxe}</span>
    },
    {
      cle: "operation",
      titre: "Opération",
      alignement: "centre",
      largeur: "6rem",
      valeur: (code) => (code.exigibleSur === "achat" ? "Achat" : "Vente")
    },
    {
      cle: "condition",
      titre: "Condition",
      largeur: "14rem",
      valeur: (code) => LIBELLES_CONDITION[code.condition] ?? code.condition
    },
    { cle: "reference", titre: "Référence légale", largeur: "18rem", valeur: (code) => code.referenceLegale },
    {
      cle: "statut",
      titre: "Statut",
      alignement: "centre",
      largeur: "8rem",
      valeur: (code) =>
        code.aVerifier ? <Etiquette ton="alerte">à confirmer</Etiquette> : <Etiquette ton="succes">établi</Etiquette>
    },
    {
      cle: "origine",
      titre: "Valeur",
      alignement: "centre",
      largeur: "9rem",
      valeur: (code) => {
        const origine = origineDe(code);
        return origine === "paquet" ? (
          <Etiquette>paquet pays</Etiquette>
        ) : origine === "modifie" ? (
          <Etiquette ton="info">modifiée au dossier</Etiquette>
        ) : (
          <Etiquette ton="info">créée au dossier</Etiquette>
        );
      }
    },
    {
      cle: "usage",
      titre: "A servi",
      alignement: "centre",
      largeur: "9rem",
      valeur: (code) => {
        const usage = utilisationDe(code.code);
        const total = usage.mouvements + usage.lots;
        return total === 0 ? "—" : `${total} ligne${total > 1 ? "s" : ""}`;
      }
    }
  ];

  const colonnesImpot: Colonne<ImpotAnnuel>[] = [
    { cle: "code", titre: "Code", largeur: "10rem", valeur: (impot) => <span class="mono">{impot.code}</span> },
    { cle: "libelle", titre: "Impôt", valeur: (impot) => impot.libelle },
    { cle: "assiette", titre: "Assiette", largeur: "24rem", valeur: (impot) => impot.assiette },
    {
      cle: "taux",
      titre: "Taux",
      alignement: "droite",
      largeur: "7rem",
      valeur: (impot) => (impot.pointsDeBase === null ? "—" : formaterTaux(impot.pointsDeBase))
    },
    {
      cle: "plancher",
      titre: "Plancher",
      alignement: "droite",
      largeur: "9rem",
      valeur: (impot) => (impot.montantPlancher === null ? "—" : montant(impot.montantPlancher))
    },
    {
      cle: "variantes",
      titre: "Variantes",
      largeur: "24rem",
      valeur: (impot) =>
        impot.variantes.length === 0
          ? "—"
          : impot.variantes.map((variante) => `${variante.condition} : ${formaterTaux(variante.pointsDeBase)}`).join(" · ")
    },
    {
      cle: "compte",
      titre: "Compte",
      alignement: "centre",
      largeur: "7rem",
      valeur: (impot) => <span class="mono">{impot.compte}</span>
    }
  ];

  const lignesCsv = (): (readonly CelluleCsv[])[] => [
    ["Codes de taxe et taux du dossier"],
    ["Dossier", contexte.numero],
    ["Société", contexte.societe.raisonSociale],
    ["Paquet pays", `${paquet.nom} ${paquet.version}`],
    [],
    [
      "Code",
      "Libellé",
      "Taux",
      "Points de base",
      "Base",
      "Sens",
      "Compte de taxe",
      "Opération",
      "Condition",
      "Référence légale",
      "Statut",
      "Valeur",
      "Lignes l'utilisant"
    ],
    ...codes.map((code) => [
      code.code,
      code.libelle,
      formaterTaux(code.pointsDeBase),
      code.pointsDeBase,
      code.base === "hors-taxe" ? "hors taxe" : "toutes taxes comprises",
      LIBELLES_SENS[code.sens] ?? code.sens,
      code.compteTaxe,
      code.exigibleSur === "achat" ? "achat" : "vente",
      LIBELLES_CONDITION[code.condition] ?? code.condition,
      code.referenceLegale,
      code.aVerifier ? "à confirmer" : "établi",
      origineDe(code) === "paquet" ? "paquet pays" : origineDe(code) === "modifie" ? "modifiée au dossier" : "créée au dossier",
      utilisationDe(code.code).mouvements + utilisationDe(code.code).lots
    ]),
    [],
    ["Impôts assis sur l'exercice", "Code", "Libellé", "Assiette", "Taux", "Plancher", "Compte"],
    ...paquet.impotsAnnuel.map((impot) => [
      "",
      impot.code,
      impot.libelle,
      impot.assiette,
      impot.pointsDeBase === null ? "" : formaterTaux(impot.pointsDeBase),
      impot.montantPlancher === null ? "" : impot.montantPlancher,
      impot.compte
    ])
  ];

  const champsFiges = codeSelectionne !== null && !creation && aServi(codeSelectionne.code);
  const titreChampFiges = (champ: string): string =>
    champsFiges
      ? `${champ} : ce code a déjà servi dans ${
          utilisationDe(codeSelectionne!.code).mouvements + utilisationDe(codeSelectionne!.code).lots
        } ligne(s). Un taux qui a servi ne se réécrit pas — créez un nouveau code pour la nouvelle valeur.`
      : "";

  return (
    <Fenetre
      titre="Codes de taxe et taux"
      chemin={`Structure › Codes de taxe · paquet ${paquet.nom} ${paquet.version}`}
      sousTitre={`Dossier ${contexte.numero} · les taux appartiennent au dossier : le paquet pays les amorce, vous les corrigez`}
      actions={
        <>
          <ExportCsv tige="codes-taxe" contexte={paquet.code} date={aujourdHui} lignes={lignesCsv} />
          <button
            class="bouton"
            type="button"
            title={`Reprendre les taux, bases, sens, comptes et références du paquet ${paquet.nom} ${paquet.version}. Les codes qui ont déjà servi gardent la valeur du dossier.`}
            onClick={() => void reprendre()}
          >
            Reprendre les taux du paquet pays
          </button>
          <button
            class="bouton"
            type="button"
            onClick={() => {
              setCreation(true);
              setBrouillon(brouillonVide());
              setSelection(null);
              setRetour(null);
            }}
          >
            Créer un code de taxe
          </button>
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
        <h2>Codes applicables aux écritures — {codes.length} au dossier</h2>
        <p class="note">
          Sélectionnez une ligne pour la modifier. La colonne « A servi » compte les lignes du grand
          livre et des lots qui portent ce code : dès qu'elle n'est pas vide, le taux, la base, le sens
          et le compte de taxe sont figés.
        </p>
        <Grille
          colonnes={colonnes}
          lignes={codes}
          cleDe={(code) => code.code}
          selection={selection}
          surSelection={(cle) => {
            setSelection(cle);
            setCreation(false);
            setBrouillon(null);
            setRetour(null);
          }}
          vide="Aucun code de taxe au dossier."
        />
      </div>

      {brouillonEnCours ? (
        <div class="bloc">
          <h2>{creation ? "Nouveau code de taxe" : `Modifier ${codeSelectionne?.code ?? ""}`}</h2>
          {champsFiges ? (
            <p class="avertissement">
              Ce code a déjà servi : son taux, sa base, son sens et son compte de taxe sont figés. Le
              libellé, la référence légale, la condition et l'opération restent modifiables. Pour une
              nouvelle valeur, créez un code — l'ancien reste attaché aux écritures qui l'ont utilisé.
            </p>
          ) : null}
          <div class="deux-colonnes">
            <label class="champ-court">
              Code
              <input
                class="mono"
                value={brouillonEnCours.code}
                disabled={!creation}
                title={creation ? "16 caractères au plus : lettres, chiffres et tirets" : "Le code identifie le taux dans les écritures : il ne change pas"}
                onChange={(evenement) => setBrouillon({ ...brouillonEnCours, code: evenement.currentTarget.value })}
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
              Taux (%)
              <input
                class="mono"
                value={brouillonEnCours.taux}
                disabled={champsFiges}
                title={titreChampFiges("Taux") || "Un pourcentage, deux décimales au plus : 18 ; 1,5 ; 0,1"}
                onChange={(evenement) => setBrouillon({ ...brouillonEnCours, taux: evenement.currentTarget.value })}
              />
              <span class={tauxIllisible ? "note retour erreur" : "note"}>
                {tauxIllisible
                  ? "Taux illisible : un pourcentage, deux décimales au plus."
                  : tauxSaisi !== null
                    ? `${tauxSaisi.toString()} points de base — ${formaterTaux(tauxSaisi)}`
                    : "Le taux est stocké en points de base entiers : aucun arrondi flottant."}
              </span>
            </label>
            <label class="champ-court">
              Base
              <select
                value={brouillonEnCours.base}
                disabled={champsFiges}
                title={titreChampFiges("Base")}
                onChange={(evenement) =>
                  setBrouillon({ ...brouillonEnCours, base: evenement.currentTarget.value as CodeTaxe["base"] })
                }
              >
                <option value="hors-taxe">Hors taxe</option>
                <option value="toutes-taxes-comprises">Toutes taxes comprises</option>
              </select>
            </label>
            <label class="champ-court">
              Sens
              <select
                value={brouillonEnCours.sens}
                disabled={champsFiges}
                title={titreChampFiges("Sens")}
                onChange={(evenement) =>
                  setBrouillon({ ...brouillonEnCours, sens: evenement.currentTarget.value as SensTaxe })
                }
              >
                {(Object.keys(LIBELLES_SENS) as SensTaxe[]).map((sens) => (
                  <option key={sens} value={sens}>
                    {LIBELLES_SENS[sens]}
                  </option>
                ))}
              </select>
            </label>
            <label class="champ-court">
              Compte de taxe
              <select
                class="mono"
                value={brouillonEnCours.compteTaxe}
                disabled={champsFiges}
                title={titreChampFiges("Compte de taxe")}
                onChange={(evenement) => setBrouillon({ ...brouillonEnCours, compteTaxe: evenement.currentTarget.value })}
              >
                {comptes
                  .filter((compte) => compte.classe === "4")
                  .map((compte) => (
                    <option key={compte.numero} value={compte.numero}>
                      {compte.numero} — {compte.libelle}
                    </option>
                  ))}
                {comptes.every((compte) => compte.numero !== brouillonEnCours.compteTaxe) ? (
                  <option value={brouillonEnCours.compteTaxe}>{brouillonEnCours.compteTaxe} (hors plan)</option>
                ) : null}
              </select>
            </label>
            <label class="champ-court">
              Opération
              <select
                value={brouillonEnCours.exigibleSur}
                onChange={(evenement) =>
                  setBrouillon({
                    ...brouillonEnCours,
                    exigibleSur: evenement.currentTarget.value as "achat" | "vente"
                  })
                }
              >
                <option value="achat">Achat</option>
                <option value="vente">Vente</option>
              </select>
            </label>
            <label class="champ-court">
              Condition d'application
              <select
                value={brouillonEnCours.condition}
                onChange={(evenement) =>
                  setBrouillon({ ...brouillonEnCours, condition: evenement.currentTarget.value as ConditionTaxe })
                }
              >
                {(Object.keys(LIBELLES_CONDITION) as ConditionTaxe[]).map((condition) => (
                  <option key={condition} value={condition}>
                    {LIBELLES_CONDITION[condition]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Référence légale
            <input
              value={brouillonEnCours.referenceLegale}
              placeholder="CGI Bénin art. 123 ; loi de finances pour 2026, art. 4"
              onChange={(evenement) =>
                setBrouillon({ ...brouillonEnCours, referenceLegale: evenement.currentTarget.value })
              }
            />
            <span class="note">
              Obligatoire : un taux sans article n'est pas défendable devant l'administration.
            </span>
          </label>
          <div class="barre-actions">
            <button
              class="bouton"
              type="button"
              disabled={creation ? !creationPret : !modifie}
              title={raisonEnregistrement || (creation ? "Créer ce code de taxe" : "Enregistrer les modifications")}
              onClick={() => void enregistrer()}
            >
              {creation ? "Créer le code" : "Enregistrer"}
            </button>
            {!creation && codeSelectionne ? (
              <button
                class="bouton"
                type="button"
                disabled={aServi(codeSelectionne.code)}
                title={
                  aServi(codeSelectionne.code)
                    ? `Ce code figure dans ${
                        utilisationDe(codeSelectionne.code).mouvements + utilisationDe(codeSelectionne.code).lots
                      } ligne(s) : il ne se supprime pas, une écriture le porte.`
                    : "Retirer ce code du paramétrage du dossier"
                }
                onClick={() => void supprimer(codeSelectionne)}
              >
                Supprimer ce code
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

      <div class="bloc">
        <h2>Impôts assis sur l'exercice</h2>
        <p class="note">
          IS, minimum de perception, TPS, IBA : ces impôts se calculent sur un exercice, pas sur une
          écriture. Aucun écran ne les calcule encore — ils sont affichés tels que le paquet pays les
          documente, et deviennent modifiables avec la tranche qui les emploiera (liasse fiscale,
          acomptes).
        </p>
        <Grille colonnes={colonnesImpot} lignes={paquet.impotsAnnuel} cleDe={(impot) => impot.code} />
      </div>

      <div class="bloc">
        <h2>Calendrier déclaratif</h2>
        <ul class="liste-codes">
          {paquet.calendrierDeclaratif.map((obligation) => (
            <li key={obligation.code}>
              <span class="mono">{obligation.periodicite}</span>
              <span>{obligation.libelle}</span>
              <span>{obligation.echeance}</span>
              {obligation.aVerifier ? <Etiquette ton="alerte">à confirmer</Etiquette> : null}
            </li>
          ))}
        </ul>
      </div>

      <p class="note">
        Identifiant fiscal : <strong>{paquet.regleIdentifiantFiscal.nomLong}</strong> (
        {paquet.regleIdentifiantFiscal.nom}), exemple{" "}
        <span class="mono">{paquet.regleIdentifiantFiscal.exemple}</span>. Source des taux livrés :
        tableaux DGI Bénin et guides fiscaux croisés, relevés le 15/10/2026 ({paquet.version}). Un taux
        que vous corrigez cesse d'être « à confirmer » : la piste d'audit garde qui l'a fixé, quand, et
        quelle était la valeur avant.
      </p>
    </Fenetre>
  );
}
