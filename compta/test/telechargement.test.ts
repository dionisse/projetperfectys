/**
 * Le CSV, testé sans navigateur.
 *
 * La construction du fichier est une fonction pure : c'est elle qui porte les conventions, et ce
 * sont elles qui décident si un cabinet peut ouvrir le fichier dans Excel sans y perdre les
 * accents ni voir toutes ses colonnes fusionnées.
 */

import { describe, expect, it } from "vitest";
import { SEPARATEUR_CSV, celluleCsv, lignesVersCsv, nomDeFichier } from "../src/web/telechargement";

describe("contenu du CSV", () => {
  it("sépare au point-virgule, termine en CRLF et ouvre d'un BOM UTF-8", () => {
    const contenu = lignesVersCsv([
      ["Compte", "Libellé", "Débit"],
      ["601100", "Achat de marchandises", 1000000n]
    ]);

    expect(contenu.startsWith("\uFEFF")).toBe(true);
    expect(contenu).toContain(`Compte${SEPARATEUR_CSV}Libellé${SEPARATEUR_CSV}Débit`);
    expect(contenu).toContain(`601100${SEPARATEUR_CSV}Achat de marchandises${SEPARATEUR_CSV}1000000`);
    expect(contenu.endsWith("\r\n")).toBe(true);
    expect(contenu).not.toContain("\n\r");
    // Chaque ligne se termine, y compris la dernière : un fichier tronqué fait douter de la source.
    expect(contenu.split("\r\n").filter((ligne) => ligne !== "")).toHaveLength(2);
  });

  it("un montant reste un nombre : pas de séparateur de milliers dans un fichier", () => {
    const contenu = lignesVersCsv([["Solde", 1234567890n]]);
    expect(contenu).toContain("1234567890");
    expect(contenu).not.toContain(" ");
  });

  it("une cellule contenant un séparateur, un guillemet ou un saut de ligne est protégée", () => {
    expect(celluleCsv("Achat; vente")).toBe('"Achat; vente"');
    expect(celluleCsv('Fournisseur "Grossiste"')).toBe('"Fournisseur ""Grossiste"""');
    expect(celluleCsv("ligne 1\nligne 2")).toBe('"ligne 1\nligne 2"');
    expect(celluleCsv("Achat de marchandises")).toBe("Achat de marchandises");
    expect(celluleCsv(null)).toBe("");
    expect(celluleCsv(0n)).toBe("0");
  });

  it("une ligne vide reste une ligne vide : elle sépare les sections", () => {
    const contenu = lignesVersCsv([["A"], [], ["B"]]);
    expect(contenu).toBe("\uFEFFA\r\n\r\nB\r\n");
  });
});

describe("nom du fichier", () => {
  it("est lisible, sans accent ni espace, et porte la date", () => {
    // Format retenu : perfectys_<document>_<contexte>_<AAAA-MM-JJ>.<extension>
    expect(nomDeFichier("csv", "déclaration TVA", "SARL BÉNIN NÉGOCE-2026-P04", "2026-04-30")).toBe(
      "perfectys_declaration-tva_sarl-benin-negoce-2026-p04_2026-04-30.csv"
    );
  });

  it("ne produit jamais un nom vide", () => {
    expect(nomDeFichier("csv", "///", "###", "2026-04-30")).toBe("perfectys_document_document_2026-04-30.csv");
  });
});
