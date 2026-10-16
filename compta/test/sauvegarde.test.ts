/**
 * Sauvegarde et restauration du dossier.
 *
 * Ce qui est vérifié : qu'une sauvegarde dit ce qu'elle contient avant qu'on ait à l'ouvrir, qu'elle
 * survit à un aller-retour JSON (les montants sont des `bigint`, sérialisés en chaînes), qu'une
 * restauration remplace tout et le trace, et que les quatre refus sont tenus — pas une sauvegarde,
 * mauvaise version, grand livre déséquilibré, autre paquet pays. Le refus d'un dossier déséquilibré
 * est le plus important : restaurer un débit qui ne fait pas le crédit produirait des états faux sans
 * que rien ne le signale jamais.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { FORMAT_SAUVEGARDE, VERSION_SAUVEGARDE, type ServiceComptable } from "../src/noyau/index";
import { nouveauService, posterAchat, posterLot, posterVente, xof } from "./aide";

let source: ServiceComptable;
let cible: ServiceComptable;

beforeEach(() => {
  ({ service: source } = nouveauService());
  ({ service: cible } = nouveauService());
});

/** Ce que le fichier contient réellement : un aller-retour JSON, comme dans un courriel. */
function fichierDe(sauvegarde: unknown): unknown {
  return JSON.parse(JSON.stringify(sauvegarde));
}

async function alimenter(service: ServiceComptable): Promise<void> {
  await posterVente(service, { date: "2026-04-05", piece: "FV-2026-001", montant: "2000000" });
  await posterAchat(service, { date: "2026-04-12", piece: "FA-2026-018", montant: "1000000" });
}

/** Le règlement qui permet un lettrage : une facture seule n'a rien à rapprocher. */
async function regler(service: ServiceComptable): Promise<void> {
  await posterLot(service, {
    journalCode: "BQ",
    date: "2026-04-28",
    piece: "BQ-2026-004",
    libelle: "Règlement fournisseur",
    lignes: [
      { compte: "401100-FOU01", libelle: "Règlement FA-2026-018", debit: "1170000" },
      { compte: "521100", libelle: "Règlement FA-2026-018", credit: "1170000" }
    ],
    contrepartie: "521100"
  });
}

describe("Sauvegarde du dossier", () => {
  it("dit qui l'a produite, quand, sur quel pays, et ce qu'elle contient", async () => {
    await alimenter(source);
    const sauvegarde = await source.produireSauvegarde();

    expect(sauvegarde.format).toBe(FORMAT_SAUVEGARDE);
    expect(sauvegarde.version).toBe(VERSION_SAUVEGARDE);
    expect(sauvegarde.creeeLe).toBe("2026-04-15T08:00:00.000Z");
    expect(sauvegarde.creeePar).toBe("superviseur");
    expect(sauvegarde.paquetPays.nom).toBe("Bénin");
    expect(sauvegarde.devise).toBe("XOF");
    expect(sauvegarde.referentiel).toMatch(/SYSCOHADA/u);
    expect(sauvegarde.societe).toMatchObject({
      code: "000",
      raisonSociale: "BÉNIN NÉGOCE DISTRIBUTION",
      formeJuridique: "SARL",
      identifiantFiscal: "0020151234567",
      ville: "Cotonou",
      pays: "Bénin"
    });
    expect(sauvegarde.exercice).toBe(2026);
    expect(sauvegarde.contenu).toMatchObject({ comptes: 55, journaux: 7, tiers: 8, codesTaxe: 14 });
    expect(sauvegarde.contenu.mouvements).toBeGreaterThan(0);
    expect(sauvegarde.contenu.lots).toBeGreaterThan(0);

    // Un montant sérialisé est une chaîne : c'est ce qui permet à un bigint de passer en JSON.
    const brut = JSON.stringify(sauvegarde);
    expect(brut.length).toBeGreaterThan(20000);
    expect(JSON.parse(brut)).toEqual(fichierDe(sauvegarde));
  });

  it("restaure un dossier entier, à l'unité près, et trace le remplacement", async () => {
    await alimenter(source);
    await regler(source);
    await source.lettrerAutomatiquement({ compte: "401100", tiersCode: "FOU01" });
    const avant = await source.balance();
    const sauvegarde = await source.produireSauvegarde();

    // La cible est un dossier de démonstration vierge, sans les écritures de la source.
    const resultat = await cible.restaurerSauvegarde(fichierDe(sauvegarde));

    expect(resultat.societe).toBe("BÉNIN NÉGOCE DISTRIBUTION");
    expect(resultat.exercice).toBe(2026);
    expect(resultat.sauvegardeDu).toBe("2026-04-15T08:00:00.000Z");
    expect(resultat.apres.mouvements).toBe(sauvegarde.contenu.mouvements);
    expect(resultat.apres.lettrages).toBe(1);
    expect(resultat.avant.mouvements).toBeLessThan(resultat.apres.mouvements);

    // Les soldes restaurés sont ceux de la source, au franc près.
    const apres = await cible.balance();
    expect(apres.length).toBe(avant.length);
    for (const ligne of avant) {
      const restauree = apres.find((item) => item.compte === ligne.compte)!;
      expect(restauree).toBeDefined();
      expect(restauree.solde).toBe(ligne.solde);
      expect(restauree.totalDebit).toBe(ligne.totalDebit);
    }
    // Le règlement d'avril est passé par la banque : 55 000 000 à l'ouverture, moins 1 170 000.
    const banque = apres.find((ligne) => ligne.compte === "521100")!;
    expect(banque.solde).toBe(xof("53830000"));

    // Le lettrage a suivi : ce n'est pas une marque recomposée, c'est la même.
    const lettrages = await cible.lettrages("401100");
    expect(lettrages.length).toBe(1);
    expect(lettrages[0]!.montant).toBe(xof("1170000"));

    // La piste d'audit de la sauvegarde restaurée porte le remplacement, avec ce qu'il a écrasé :
    // c'est la seule mémoire qui reste du dossier précédent.
    const audit = await cible.pisteAudit();
    const dernier = audit.at(-1)!;
    expect(dernier.action).toBe("Restauration du dossier");
    expect(dernier.utilisateur).toBe("superviseur");
    expect(dernier.detail).toMatch(/Dossier écrasé : \d+ mouvement\(s\)/u);
    expect(dernier.detail).toMatch(/Sauvegarde du 2026-04-15/u);
  });

  it("refuse un fichier qui n'est pas une sauvegarde", async () => {
    await expect(cible.restaurerSauvegarde(null)).rejects.toThrow(/n'est pas une sauvegarde/u);
    await expect(cible.restaurerSauvegarde("du texte")).rejects.toThrow(/n'est pas une sauvegarde/u);
    await expect(cible.restaurerSauvegarde([1, 2, 3])).rejects.toThrow(/n'est pas une sauvegarde/u);
    await expect(cible.restaurerSauvegarde({ societe: "autre chose" })).rejects.toThrow(
      /format attendu « perfectys-compta\/sauvegarde »/u
    );

    // Une sauvegarde dont l'état a disparu est refusée, pas chargée à moitié.
    const sauvegarde = await source.produireSauvegarde();
    const sansEtat = { ...fichierDe(sauvegarde) as object, etat: null };
    await expect(cible.restaurerSauvegarde(sansEtat)).rejects.toThrow(/ne contient pas d'état de dossier/u);
  });

  it("refuse une autre version plutôt que de la deviner", async () => {
    const sauvegarde = (await source.produireSauvegarde()) as unknown as Record<string, unknown>;
    const future = { ...fichierDe(sauvegarde) as Record<string, unknown>, version: 2 };
    await expect(cible.restaurerSauvegarde(future)).rejects.toThrow(
      /en version 2 ; cette application lit la version 1/u
    );
  });

  it("refuse un grand livre déséquilibré", async () => {
    await alimenter(source);
    const sauvegarde = (await source.produireSauvegarde()) as unknown as Record<string, unknown>;
    const copie = fichierDe(sauvegarde) as Record<string, unknown>;
    const etat = copie.etat as { mouvements: { debit: string }[] };
    // Un franc retiré d'un débit : le fichier reste lisible, le dossier ne reste pas juste.
    const premier = Number(etat.mouvements[0]!.debit);
    etat.mouvements[0]!.debit = String(premier - 1);

    await expect(cible.restaurerSauvegarde(copie)).rejects.toThrow(/grand livre déséquilibré/u);
    await expect(cible.restaurerSauvegarde(copie)).rejects.toThrow(/pas restaurable en l'état/u);

    // Rien n'a été écrit : la cible est intacte.
    const intact = await cible.balance();
    expect(intact.find((ligne) => ligne.compte === "521100")!.solde).toBe(xof("55000000"));
  });

  it("refuse la sauvegarde d'un autre paquet pays", async () => {
    const sauvegarde = (await source.produireSauvegarde()) as unknown as Record<string, unknown>;
    const copie = fichierDe(sauvegarde) as Record<string, unknown>;
    copie.paquetPays = { nom: "Togo", version: "2026.1" };

    await expect(cible.restaurerSauvegarde(copie)).rejects.toThrow(
      /paquet pays « Togo ».*ce dossier tourne sur « Bénin »/su
    );
  });

  it("refuse une sauvegarde sans compte ni société", async () => {
    const sauvegarde = (await source.produireSauvegarde()) as unknown as Record<string, unknown>;
    const copie = fichierDe(sauvegarde) as Record<string, unknown>;
    const etat = copie.etat as { comptes: unknown[]; societe: Record<string, unknown> };
    etat.comptes = [];
    await expect(cible.restaurerSauvegarde(copie)).rejects.toThrow(/ne contient aucun compte/u);

    const copie2 = fichierDe(sauvegarde) as Record<string, unknown>;
    const etat2 = copie2.etat as { societe: Record<string, unknown> };
    etat2.societe = { ...etat2.societe, raisonSociale: "   " };
    await expect(cible.restaurerSauvegarde(copie2)).rejects.toThrow(/ne dit pas quelle société/u);
  });
});
