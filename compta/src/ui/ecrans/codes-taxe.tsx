import { BENIN, formaterTaux, type CodeTaxe, type ImpotAnnuel } from "../../noyau/index";
import { getService } from "../../web/noyau";
import { Etiquette, Fenetre, Grille, montant, type Colonne } from "../composants";

const LIBELLES_SENS: Record<string, string> = {
  collectee: "Collectée",
  deductible: "Déductible",
  "retenue-a-la-source": "Retenue à la source",
  charge: "Charge de l'entreprise"
};

const LIBELLES_CONDITION: Record<string, string> = {
  aucune: "Toujours",
  interieur: "Régime intérieur",
  "tiers-immatricule": "Tiers immatriculé à l'IFU",
  "tiers-non-immatricule": "Tiers non immatriculé",
  "tiers-public": "Tiers public (État, collectivité)",
  exportation: "Exportation / importation"
};

/**
 * Codes de taxe du paquet pays.
 *
 * Chaque ligne porte sa **référence légale** et son statut : établi, ou à confirmer. C'est la
 * différence entre un paramétrage et une approximation présentée comme telle.
 */
export function CodesTaxe() {
  const service = getService();
  const paquet = service.paquetPays;

  const colonnesTaxe: Colonne<CodeTaxe>[] = [
    { cle: "code", titre: "Code", largeur: "8rem", valeur: (code) => <span class="mono">{code.code}</span> },
    { cle: "libelle", titre: "Libellé", valeur: (code) => code.libelle },
    { cle: "taux", titre: "Taux", alignement: "droite", largeur: "6rem", valeur: (code) => formaterTaux(code.pointsDeBase) },
    { cle: "base", titre: "Base", largeur: "12rem", valeur: (code) => (code.base === "hors-taxe" ? "Hors taxe" : "Toutes taxes comprises") },
    { cle: "sens", titre: "Sens", largeur: "12rem", valeur: (code) => LIBELLES_SENS[code.sens] ?? code.sens },
    { cle: "compte", titre: "Compte de taxe", alignement: "centre", largeur: "9rem", valeur: (code) => <span class="mono">{code.compteTaxe}</span> },
    { cle: "operation", titre: "Opération", alignement: "centre", largeur: "7rem", valeur: (code) => (code.exigibleSur === "achat" ? "Achat" : "Vente") },
    { cle: "condition", titre: "Condition", largeur: "16rem", valeur: (code) => LIBELLES_CONDITION[code.condition] ?? code.condition },
    { cle: "reference", titre: "Référence légale", largeur: "20rem", valeur: (code) => code.referenceLegale },
    {
      cle: "statut",
      titre: "Statut",
      alignement: "centre",
      largeur: "8rem",
      valeur: (code) => (code.aVerifier ? <Etiquette ton="alerte">à confirmer</Etiquette> : <Etiquette ton="succes">établi</Etiquette>)
    }
  ];

  const colonnesImpot: Colonne<ImpotAnnuel>[] = [
    { cle: "code", titre: "Code", largeur: "10rem", valeur: (impot) => <span class="mono">{impot.code}</span> },
    { cle: "libelle", titre: "Impôt", valeur: (impot) => impot.libelle },
    { cle: "assiette", titre: "Assiette", largeur: "26rem", valeur: (impot) => impot.assiette },
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
      largeur: "26rem",
      valeur: (impot) =>
        impot.variantes.length === 0
          ? "—"
          : impot.variantes.map((variante) => `${variante.condition} : ${formaterTaux(variante.pointsDeBase)}`).join(" · ")
    },
    { cle: "compte", titre: "Compte", alignement: "centre", largeur: "7rem", valeur: (impot) => <span class="mono">{impot.compte}</span> }
  ];

  return (
    <Fenetre
      titre="Codes de taxe et impôts"
      chemin={`Outils › Paquet pays · ${paquet.nom} ${paquet.version}`}
      sousTitre="Aucun taux n'est écrit dans le noyau : ils appartiennent au paquet pays, versionné. Un autre pays de l'UEMOA sera un autre paquet, pas une modification de celui-ci."
    >
      <section class="bloc">
        <h2>Codes de taxe applicables aux écritures</h2>
        <Grille colonnes={colonnesTaxe} lignes={paquet.codesTaxe} cleDe={(code) => code.code} />
      </section>

      <section class="bloc">
        <h2>Impôts assis sur l'exercice</h2>
        <Grille colonnes={colonnesImpot} lignes={paquet.impotsAnnuel} cleDe={(impot) => impot.code} />
      </section>

      <section class="bloc">
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
      </section>

      <p class="note">
        Identifiant fiscal : <strong>{paquet.regleIdentifiantFiscal.nomLong}</strong> ({paquet.regleIdentifiantFiscal.nom}),
        exemple <span class="mono">{paquet.regleIdentifiantFiscal.exemple}</span>.{" "}
        {paquet.regleIdentifiantFiscal.aVerifier
          ? "Le format officiel reste à confirmer auprès de la DGI : la validation accepte 12 à 13 chiffres."
          : "Format validé."}{" "}
        Source des taux : tableaux DGI Bénin et guides fiscaux croisés, relevés le 15/10/2026
        ({BENIN.version}).
      </p>
    </Fenetre>
  );
}
