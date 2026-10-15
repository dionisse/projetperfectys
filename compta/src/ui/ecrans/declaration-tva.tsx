/**
 * Déclaration de TVA mensuelle — États › Déclaration TVA.
 *
 * L'écran ne ressaisit rien : il affiche ce que le noyau recalcule depuis le grand livre et les
 * codes de taxe du paquet pays, puis le **rapproche** de ce que la comptabilité contient. Deux
 * blocs, donc : la déclaration (bases, taux, taxes, crédit antérieur, net à payer) et le contrôle
 * (attendu contre comptabilisé, compte par compte). Un écart est affiché en alerte, jamais noyé
 * dans un total — c'est ce qui distingue un état de contrôle d'un tableau décoratif.
 *
 * L'honnêteté impose aussi une limite explicite : le formulaire officiel béninois n'a pas été
 * relevé dans le texte juridique, l'écran ne prétend donc pas le reproduire. Il produit les
 * montants et leurs références, à reporter sur l'imprimé administratif.
 */

import { useState } from "preact/hooks";
import {
  formaterTaux,
  formaterDateFr,
  type DeclarationTva as Declaration,
  type LigneDeclarationTva,
  type ControleDeDeclaration,
  type Periode
} from "../../noyau/index";
import { getService } from "../../web/noyau";
import {
  ChargementEnCours,
  Erreur,
  Etiquette,
  ExportCsv,
  Fenetre,
  Grille,
  montant,
  useAsync,
  type CelluleCsv,
  type Colonne
} from "../composants";

const LIBELLES_SENS: Record<LigneDeclarationTva["sens"], string> = {
  collectee: "Collectée",
  deductible: "Déductible",
  retenue: "Retenue",
  exoneree: "Exonérée"
};

export function DeclarationTva() {
  const service = getService();
  const [periode, setPeriode] = useState<number | null>(null);

  const { donnees, erreur, charge, recharger } = useAsync(
    async () => {
      const contexte = await service.contexte();
      const etat = await service.lire();
      const numero = periode ?? contexte.periodeCourante;
      return {
        contexte,
        declaration: await service.declarationTva(numero),
        periodes: etat.exercice.periodes.filter((item: Periode) => item.type === "normale")
      };
    },
    [periode]
  );

  if (erreur) {
    return <Erreur message={erreur} onRetry={recharger} />;
  }
  if (charge && !donnees) {
    return <ChargementEnCours libelle="Recalcul de la déclaration depuis le grand livre…" />;
  }
  if (!donnees) {
    return <ChargementEnCours libelle="Chargement du dossier…" />;
  }

  const { contexte, declaration } = donnees;
  const ecarts = declaration.controles.filter((controle) => controle.ecart !== 0n);

  const colonnesLignes: Colonne<LigneDeclarationTva>[] = [
    { cle: "code", titre: "Code", valeur: (ligne) => <span class="mono">{ligne.code}</span> },
    { cle: "libelle", titre: "Libellé du code de taxe", valeur: (ligne) => ligne.libelle },
    { cle: "compte", titre: "Compte", valeur: (ligne) => <span class="mono">{ligne.compte}</span> },
    {
      cle: "base",
      titre: "Base",
      alignement: "droite",
      valeur: (ligne) => <span class="mono">{montant(ligne.base)}</span>
    },
    {
      cle: "taux",
      titre: "Taux",
      alignement: "droite",
      valeur: (ligne) => <span class="mono">{formaterTaux(ligne.pointsDeBase)}</span>
    },
    {
      cle: "taxe",
      titre: "Taxe",
      alignement: "droite",
      valeur: (ligne) => <span class="mono">{montant(ligne.montant)}</span>
    },
    {
      cle: "sens",
      titre: "Sens",
      valeur: (ligne) => (
        <Etiquette ton={ligne.sens === "collectee" ? "info" : ligne.sens === "deductible" ? "succes" : "alerte"}>
          {LIBELLES_SENS[ligne.sens]}
        </Etiquette>
      )
    },
    { cle: "reference", titre: "Référence légale", valeur: (ligne) => ligne.referenceLegale },
    {
      cle: "statut",
      titre: "Statut",
      valeur: (ligne) => (ligne.aVerifier ? <Etiquette ton="alerte">à confirmer</Etiquette> : <Etiquette>établi</Etiquette>)
    }
  ];

  const colonnesControles: Colonne<ControleDeDeclaration>[] = [
    { cle: "compte", titre: "Compte de taxe", valeur: (controle) => <span class="mono">{controle.compte}</span> },
    { cle: "libelle", titre: "Libellé", valeur: (controle) => controle.libelle },
    {
      cle: "attendu",
      titre: "Attendu d'après les codes",
      alignement: "droite",
      valeur: (controle) => <span class="mono">{montant(controle.attendu)}</span>
    },
    {
      cle: "comptabilise",
      titre: "Comptabilisé dans la période",
      alignement: "droite",
      valeur: (controle) => <span class="mono">{montant(controle.comptabilise)}</span>
    },
    {
      cle: "ecart",
      titre: "Écart",
      alignement: "droite",
      valeur: (controle) =>
        controle.ecart === 0n ? (
          <span class="succes-texte">—</span>
        ) : (
          <span class="erreur-texte mono">{montant(controle.ecart)}</span>
        )
    }
  ];

  const lignesCsv = (): (readonly CelluleCsv[])[] => [
    ["Déclaration de TVA — état de contrôle"],
    ["Dossier", contexte.numero],
    ["Société", contexte.societe.raisonSociale],
    ["Identifiant fiscal", contexte.societe.identifiantFiscal],
    ["Pays", service.paquetPays.nom, service.paquetPays.version],
    ["Exercice", declaration.exercice],
    ["Période", declaration.periode, declaration.periodeLabel],
    ["Du", formaterDateFr(declaration.dateDebut), "au", formaterDateFr(declaration.dateFin)],
    ["Échéance", declaration.echeance],
    ["Référence", declaration.referenceLegale],
    ["Mouvements dans la période", declaration.mouvementsDeLaPeriode],
    [],
    ["Code", "Libellé", "Compte", "Base", "Taux (points de base)", "Taxe", "Sens", "Référence légale", "À confirmer"],
    ...declaration.lignes.map((ligne) => [
      ligne.code,
      ligne.libelle,
      ligne.compte,
      ligne.base,
      ligne.pointsDeBase,
      ligne.montant,
      LIBELLES_SENS[ligne.sens],
      ligne.referenceLegale,
      ligne.aVerifier ? "oui" : "non"
    ]),
    [],
    ["Récapitulatif"],
    ["Base des opérations taxées", declaration.baseCollectee],
    ["Base des opérations exonérées", declaration.baseExoneree],
    ["Base des achats ouvrant droit à déduction", declaration.baseDeductible],
    ["TVA collectée", declaration.taxeCollectee],
    ["TVA déductible", declaration.taxeDeductible],
    ["Retenue de TVA", declaration.retenueDeTva],
    ["Crédit de TVA antérieur", declaration.creditAnterieur],
    ["TVA nette à payer", declaration.netteAPayer],
    ["Crédit de TVA à reporter", declaration.creditAReporter],
    [],
    ["Rapprochement avec le grand livre"],
    ["Compte", "Libellé", "Attendu", "Comptabilisé", "Écart"],
    ...declaration.controles.map((controle) => [
      controle.compte,
      controle.libelle,
      controle.attendu,
      controle.comptabilise,
      controle.ecart
    ])
  ];

  return (
    <Fenetre
      titre="Déclaration de TVA"
      chemin="États › Déclaration TVA mensuelle"
      sousTitre={`Exercice ${declaration.exercice} · Période ${declaration.periode} — ${declaration.periodeLabel} · ${formaterDateFr(
        declaration.dateDebut
      )} au ${formaterDateFr(declaration.dateFin)} · ${declaration.mouvementsDeLaPeriode} mouvement${
        declaration.mouvementsDeLaPeriode > 1 ? "s" : ""
      } comptabilisé${declaration.mouvementsDeLaPeriode > 1 ? "s" : ""}`}
      actions={
        <>
          <label class="champ-court">
            Période
            <select
              value={declaration.periode}
              onChange={(evenement) => setPeriode(Number(evenement.currentTarget.value))}
            >
              {donnees.periodes.map((item: Periode) => (
                <option key={item.numero} value={item.numero}>
                  {item.numero} — {item.libelle}
                  {item.clots ? " (clôturée)" : ""}
                </option>
              ))}
            </select>
          </label>
          <ExportCsv
            tige="declaration-tva"
            contexte={`${contexte.societe.code}-${declaration.exercice}-P${declaration.periode.toString().padStart(2, "0")}`}
            date={declaration.dateFin}
            lignes={lignesCsv}
          />
          <button class="bouton" type="button" onClick={() => recharger()}>
            Actualiser
          </button>
        </>
      }
    >
      {declaration.aVerifier ? (
        <div class="bloc avertissement">
          <h2>Paramètres à confirmer</h2>
          <p class="note">
            Les taux et l'échéance de cette déclaration proviennent du paquet pays{" "}
            {service.paquetPays.nom} {service.paquetPays.version}, relevés dans des publications de
            la DGI Bénin et des guides fiscaux croisés — pas dans le texte officiel lu article par
            article. Vérifiez chaque taux avant tout dépôt. L'échéance annoncée :{" "}
            <strong>{declaration.echeance}</strong> ({declaration.referenceLegale}).
          </p>
        </div>
      ) : null}

      {declaration.comporteUnEcart ? (
        <div class="bloc avertissement">
          <h2>Écart avec le grand livre</h2>
          <p class="note">
            {ecarts.length} compte{ecarts.length > 1 ? "s" : ""} de TVA présente
            {ecarts.length > 1 ? "nt" : ""} un écart entre ce que les codes de taxe produisent et ce
            que la période contient : une ligne de taxe saisie à la main, un code oublié sur une
            base, ou une régularisation passée directement sur le compte. La déclaration n'est pas
            fiable tant que l'écart n'est pas expliqué.
          </p>
        </div>
      ) : (
        <p class="retour succes" role="status">
          Rapprochement conforme : les taxes recalculées correspondent aux mouvements de la période.
        </p>
      )}

      <div class="deux-colonnes">
        <div class="bloc">
          <h2>Base et taxe par code</h2>
          <Grille
            colonnes={colonnesLignes}
            lignes={declaration.lignes}
            cleDe={(ligne) => ligne.code}
            vide="Aucune opération taxée dans cette période : la déclaration est néant."
            pied={
              <tr>
                <th colSpan={3}>Totaux</th>
                <td class="align-droite mono">{montant(declaration.baseCollectee + declaration.baseDeductible + declaration.baseExoneree)}</td>
                <td />
                <td class="align-droite mono">
                  {montant(declaration.taxeCollectee + declaration.taxeDeductible + declaration.retenueDeTva)}
                </td>
                <td colSpan={3} />
              </tr>
            }
          />
        </div>

        <div class="bloc">
          <h2>Taxe due</h2>
          <dl class="liste-definition">
            <dt>Base taxée collectée</dt>
            <dd class="mono">{montant(declaration.baseCollectee)}</dd>
            <dt>Base exonérée</dt>
            <dd class="mono">{montant(declaration.baseExoneree)}</dd>
            <dt>Base déductible</dt>
            <dd class="mono">{montant(declaration.baseDeductible)}</dd>
            <dt>TVA collectée</dt>
            <dd class="mono">{montant(declaration.taxeCollectee)}</dd>
            <dt>Retenue de TVA</dt>
            <dd class="mono">− {montant(declaration.retenueDeTva)}</dd>
            <dt>TVA déductible</dt>
            <dd class="mono">− {montant(declaration.taxeDeductible)}</dd>
            <dt>Crédit antérieur</dt>
            <dd class="mono">− {montant(declaration.creditAnterieur)}</dd>
            <dt>TVA nette à payer</dt>
            <dd class="mono">
              <strong>{montant(declaration.netteAPayer)}</strong>
            </dd>
            <dt>Crédit à reporter</dt>
            <dd class="mono">{montant(declaration.creditAReporter)}</dd>
          </dl>
          <p class="note">
            Une retenue de TVA n'est pas encaissée par l'entreprise : elle est versée au Trésor par
            celui qui la retient. Elle vient donc en déduction de la taxe due, et non en supplément.
          </p>
        </div>
      </div>

      <div class="bloc">
        <h2>Rapprochement avec le grand livre</h2>
        <Grille
          colonnes={colonnesControles}
          lignes={declaration.controles}
          cleDe={(controle) => controle.compte}
          vide="Aucun compte de TVA mouvementé dans cette période."
        />
      </div>

      <p class="note">
        Cet écran est un état de contrôle, pas le formulaire administratif : la mise en page de
        l'imprimé béninois n'a pas été relevée dans le texte officiel et ne sera pas inventée. Les
        montants ci-dessus sont à reporter sur la déclaration en ligne ou papier de la DGI. Les
        acomptes et retenues d'impôt sur le résultat (compte 442100) ne figurent pas ici : ils
        relèvent d'une autre obligation déclarative du paquet pays.
      </p>
    </Fenetre>
  );
}
