/**
 * Composants d'interface partagés.
 *
 * Rien ici ne connaît la comptabilité : ce sont les briques visuelles et les effets dont les
 * écrans ont besoin. Les garder séparés évite qu'un écran réinvente sa grille — et c'est
 * exactement comme ça qu'on obtient quinze écrans incohérents.
 */

import { useEffect, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { ErreurRegle, SEPARATEUR_MILLIERS, XOF, formatMontant, type Montant } from "../noyau/index";

/* ------------------------------------------------------------------ */
/* Routage par fragment : aucun serveur à configurer, liens partageables */
/* ------------------------------------------------------------------ */

export function routeCourante(): string {
  const fragment = location.hash.replace(/^#/, "");
  return fragment === "" ? "/" : fragment;
}

export function naviguer(vers: string): void {
  location.hash = vers.startsWith("/") ? vers : `/${vers}`;
}

export function useRoute(): string {
  const [route, setRoute] = useState(routeCourante());
  useEffect(() => {
    const changer = () => setRoute(routeCourante());
    window.addEventListener("hashchange", changer);
    return () => window.removeEventListener("hashchange", changer);
  }, []);
  return route;
}

/* ------------------------------------------------------------------ */
/* Chargement asynchrone                                               */
/* ------------------------------------------------------------------ */

export interface Chargement<T> {
  donnees: T | null;
  erreur: string | null;
  charge: boolean;
  recharger: () => void;
}

export function useAsync<T>(operation: () => Promise<T>, dependances: unknown[] = []): Chargement<T> {
  const [donnees, setDonnees] = useState<T | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [charge, setCharge] = useState(false);
  const [tour, setTour] = useState(0);

  useEffect(() => {
    let annule = false;
    setCharge(true);
    operation()
      .then((resultat) => {
        if (!annule) {
          setDonnees(resultat);
          setErreur(null);
        }
      })
      .catch((probleme: unknown) => {
        if (!annule) {
          setErreur(probleme instanceof Error ? probleme.message : String(probleme));
        }
      })
      .finally(() => {
        if (!annule) {
          setCharge(false);
        }
      });
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependances, tour]);

  return { donnees, erreur, charge, recharger: () => setTour((valeur) => valeur + 1) };
}

/* ------------------------------------------------------------------ */
/* Affichage                                                           */
/* ------------------------------------------------------------------ */

export function montant(montantBrut: Montant): string {
  return formatMontant(montantBrut, XOF);
}

export function ChargementEnCours(props: { libelle: string }) {
  return (
    <div class="etat-vide" role="status">
      <span>{props.libelle}</span>
    </div>
  );
}

export function Erreur(props: { message: string; onRetry?: () => void }) {
  return (
    <div class="erreur" role="alert">
      <strong>Opération refusée.</strong>
      <span>{props.message}</span>
      {props.onRetry ? (
        <button class="bouton" type="button" onClick={props.onRetry}>
          Réessayer
        </button>
      ) : null}
    </div>
  );
}

/** Message métier : une règle refusée s'explique, elle ne s'affiche pas en rouge générique. */
export function message(probleme: unknown): string {
  if (probleme instanceof ErreurRegle) {
    return probleme.message;
  }
  return probleme instanceof Error ? probleme.message : String(probleme);
}

export function Vide(props: { children: ComponentChildren }) {
  return <div class="etat-vide">{props.children}</div>;
}

/* ------------------------------------------------------------------ */
/* Grille dense                                                        */
/* ------------------------------------------------------------------ */

export interface Colonne<T> {
  cle: string;
  titre: string;
  alignement?: "gauche" | "droite" | "centre";
  /** Largeur CSS : utile pour figer la colonne des montants. */
  largeur?: string;
  valeur: (ligne: T) => ComponentChildren;
}

export interface GrilleProps<T> {
  colonnes: Colonne<T>[];
  lignes: readonly T[];
  cleDe: (ligne: T) => string;
  vide?: ComponentChildren;
  selection?: string | null;
  surSelection?: (cle: string, ligne: T) => void;
  pied?: ComponentChildren;
}

/**
 * Grille dense : c'est l'objet central d'un logiciel comptable.
 * Une ligne fait 26 px, les montants sont en chiffres tabulaires et alignés à droite, et le
 * tableau reste un vrai tableau HTML — un lecteur d'écran y retrouve ses colonnes.
 */
export function Grille<T>(props: GrilleProps<T>) {
  const { colonnes, lignes, cleDe, selection, surSelection } = props;
  if (lignes.length === 0 && props.vide) {
    return <Vide>{props.vide}</Vide>;
  }
  return (
    <div class="grille-conteneur">
      <table class="grille">
        <thead>
          <tr>
            {colonnes.map((colonne) => (
              <th
                key={colonne.cle}
                scope="col"
                class={colonne.alignement ? `align-${colonne.alignement}` : undefined}
                style={colonne.largeur ? { width: colonne.largeur } : undefined}
              >
                {colonne.titre}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.map((ligne) => {
            const cle = cleDe(ligne);
            return (
              <tr
                key={cle}
                class={selection === cle ? "selection" : undefined}
                tabIndex={surSelection ? 0 : undefined}
                onClick={surSelection ? () => surSelection(cle, ligne) : undefined}
                onKeyDown={
                  surSelection
                    ? (evenement) => {
                        if (evenement.key === "Enter" || evenement.key === " ") {
                          evenement.preventDefault();
                          surSelection(cle, ligne);
                        }
                      }
                    : undefined
                }
              >
                {colonnes.map((colonne) => (
                  <td key={colonne.cle} class={colonne.alignement ? `align-${colonne.alignement}` : undefined}>
                    {colonne.valeur(ligne)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
        {props.pied ? <tfoot>{props.pied}</tfoot> : null}
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fenêtre d'écran                                                     */
/* ------------------------------------------------------------------ */

export interface FenetreProps {
  titre: string;
  sousTitre?: string;
  chemin: string;
  actions?: ComponentChildren;
  children: ComponentChildren;
}

/** Un écran est une fenêtre : titre, chemin, actions, contenu. Comme dans le logiciel d'origine. */
export function Fenetre(props: FenetreProps) {
  return (
    <section class="fenetre">
      <header class="fenetre-titre">
        <div>
          <h1>{props.titre}</h1>
          <span class="chemin">{props.chemin}</span>
        </div>
        <div class="fenetre-actions">{props.actions}</div>
      </header>
      {props.sousTitre ? <p class="fenetre-sous-titre">{props.sousTitre}</p> : null}
      <div class="fenetre-corps">{props.children}</div>
    </section>
  );
}

export function Etiquette(props: { children: ComponentChildren; ton?: string | undefined }) {
  return <span class={`pastille ${props.ton ?? ""}`}>{props.children}</span>;
}

/** Séparateur de milliers visible dans les libellés de test. */
export const ESPACE_MILLIERS = SEPARATEUR_MILLIERS;
