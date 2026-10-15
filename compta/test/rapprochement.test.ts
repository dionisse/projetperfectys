/**
 * Rapprochement bancaire.
 *
 * Ce que ces tests vérifient tient en une phrase : un rapprochement dit ce qui diffère et pourquoi,
 * sans jamais absorber une différence. Le solde comptable et le solde du relevé ne coïncident presque
 * jamais — c'est normal — mais l'écart doit être entièrement composé de lignes identifiées de part et
 * d'autre. Ce qui reste inexpliqué est une anomalie, et elle est affichée.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  BENIN,
  ErreurRegle,
  analyserMontantSigne,
  deserialiserEtat,
  serialiserEtat,
  soldeDuReleve,
  type DemandeDeReleve,
  type ServiceComptable
} from "../src/noyau/index";
import { nouveauService, posterLot, xof } from "./aide";

let service: ServiceComptable;
let releveId: string;

/** Un encaissement ou un décaissement passé au journal de banque, dans la période du relevé. */
async function mouvementDeBanque(demande: {
  date: string;
  piece: string;
  libelle: string;
  debit?: string;
  credit?: string;
}): Promise<string> {
  const lot = await service.creerLot({ journalCode: "BQ", date: demande.date, libelle: demande.libelle });
  await service.ajouterEcriture(lot.id, {
    piece: demande.piece,
    date: demande.date,
    libelle: demande.libelle,
    lignes: demande.debit
      ? [
          { compte: "521100", libelle: demande.libelle, debit: xof(demande.debit) },
          { compte: "411100-CLI01", libelle: demande.libelle, credit: xof(demande.debit), tiersCode: "CLI01" }
        ]
      : [
          { compte: "671000", libelle: demande.libelle, debit: xof(demande.credit!) },
          { compte: "521100", libelle: demande.libelle, credit: xof(demande.credit!) }
        ]
  });
  await service.marquerPret(lot.id);
  await service.comptabiliserLot(lot.id);
  return lot.id;
}

beforeEach(async () => {
  ({ service } = nouveauService());
  const releves = await service.releves();
  expect(releves.length).toBe(1);
  releveId = releves[0]!.id;
});

describe("Le relevé de démonstration", () => {
  it("rapproche le compte de trésorerie sans rien écrire", async () => {
    const [releve] = await service.releves();
    expect(releve!.compte).toBe("521100");
    expect(releve!.journalCode).toBe("BQ");
    expect(releve!.lignes.length).toBe(4);
    expect(releve!.dateDebut).toBe("2026-03-01");
    expect(releve!.dateFin).toBe("2026-03-31");

    // Solde d'ouverture de la banque = solde des à-nouveaux du compte : rien ne vient des périodes
    // antérieures.
    const etat = await service.etatDeRapprochement(releveId);
    expect(etat.soldeComptableAvantReleve).toBe(xof("55000000"));
    expect(etat.ecartDOuverture).toBe(0n);
    expect(etat.soldeComptable).toBe(xof("55000000"));
    expect(soldeDuReleve(releve!)).toBe(xof("57381500"));
    expect(etat.soldeDuReleve).toBe(xof("57381500"));

    // L'écart existe — quatre opérations de banque ne sont pas comptabilisées — et il est expliqué.
    expect(etat.ecart).toBe(-xof("2381500"));
    expect(etat.lignesNonPointees.length).toBe(4);
    expect(etat.mouvementsNonPointes.length).toBe(0);
    expect(etat.ecartExplique).toBe(-xof("2381500"));
    expect(etat.ecartRestant).toBe(0n);
    expect(etat.conforme).toBe(true);
    expect(etat.pointes.length).toBe(0);

    // Une lecture n'écrit rien : aucun pointage, aucune ligne d'audit ajoutée.
    const dossier = await service.lire();
    expect(dossier.pointages.length).toBe(0);
    expect(dossier.audit.at(-1)!.action).toBe("Dossier de démonstration créé");
  });

  it("porte les montants au sens de la banque, et les convertit une seule fois", () => {
    // Une ligne de relevé positive est de l'argent qui entre : côté compte, c'est un débit. Le noyau
    // garde le sens du relevé, la conversion se fait au pointage.
    expect(analyserMontantSigne("3 500 000", BENIN.devise)).toBe(xof("3500000"));
    expect(analyserMontantSigne("-1 850 000", BENIN.devise)).toBe(-xof("1850000"));
    expect(analyserMontantSigne("\u221218500", BENIN.devise)).toBe(-xof("18500"));
    expect(() => analyserMontantSigne("12,50", BENIN.devise)).toThrow(ErreurRegle);
    expect(() => analyserMontantSigne("abc", BENIN.devise)).toThrow(/illisible/u);
  });
});

describe("Saisie d'un relevé", () => {
  const demandeValide = {
    compte: "521100",
    libelle: "Relevé d'avril 2026",
    dateDebut: "2026-04-01",
    dateFin: "2026-04-30",
    soldeDOuverture: "55000000",
    lignes: [{ date: "2026-04-05", libelle: "Virement client", reference: "VIR-1", montant: "250000" }]
  };

  it("refuse ce qui ne peut pas être rapproché", async () => {
    const refus = async (variation: Partial<DemandeDeReleve>, motif: RegExp): Promise<void> => {
      await expect(service.ajouterReleve({ ...demandeValide, ...variation })).rejects.toThrow(motif);
    };

    await refus({ compte: "411100" }, /classe 5/u);
    await refus({ compte: "529999" }, /n'existe pas dans le plan/u);
    await refus({ journalCode: "INCONNU" }, /n'existe pas dans le dossier/u);
    await refus({ lignes: [] }, /ne rapproche rien/u);
    await refus({ dateFin: "2026-03-31" }, /avant son ouverture/u);
    await refus(
      { lignes: [{ date: "2026-05-02", libelle: "Hors période", reference: "X", montant: "100" }] },
      /hors du relevé/u
    );
    await refus(
      { lignes: [{ date: "2026-04-05", libelle: "Nul", reference: "X", montant: "0" }] },
      /à zéro/u
    );
    await refus(
      { lignes: [{ date: "2026-04-05", libelle: "Illisible", reference: "X", montant: "beaucoup" }] },
      /illisible/u
    );

    // Rien n'a été écrit.
    expect((await service.releves()).length).toBe(1);
  });

  it("attribue des identifiants stables et trace la saisie", async () => {
    const releve = await service.ajouterReleve(demandeValide);
    expect(releve.id).toBe("RELEVE-521100-2");
    expect(releve.lignes[0]!.id).toBe("RELEVE-521100-2-L1");
    expect(releve.soldeDOuverture).toBe(xof("55000000"));

    const audit = (await service.lire()).audit.at(-1)!;
    expect(audit.action).toBe("Relevé saisi");
    expect(audit.entiteIdentifiant).toBe(releve.id);
    expect(audit.detail).toMatch(/Relevé d'avril 2026/);
  });

  it("supprime un relevé non pointé et refuse un relevé pointé", async () => {
    const releve = await service.ajouterReleve(demandeValide);
    await service.supprimerReleve(releve.id);
    expect((await service.releves()).some((item) => item.id === releve.id)).toBe(false);

    await mouvementDeBanque({
      date: "2026-03-05",
      piece: "BQ-2026-001",
      libelle: "Encaissement client",
      debit: "3500000"
    });
    await service.pointerAutomatiquement(releveId);
    await expect(service.supprimerReleve(releveId)).rejects.toThrow(/porte 1 pointage/u);

    const [pointage] = (await service.lire()).pointages.filter((item) => item.defaitLe === null);
    await service.depointer(pointage!.id);
    await service.supprimerReleve(releveId);
    expect((await service.releves()).length).toBe(0);
  });
});

describe("Pointage", () => {
  it("pointe une opération de banque contre son mouvement comptable", async () => {
    await mouvementDeBanque({
      date: "2026-03-05",
      piece: "BQ-2026-001",
      libelle: "Encaissement SUPERMARCHÉ CADJEHOUN",
      debit: "3500000"
    });

    const propositions = await service.proposerPointage(releveId);
    expect(propositions.length).toBe(1);
    expect(propositions[0]!.nature).toBe("montant");
    expect(propositions[0]!.piece).toBe("BQ-2026-001");
    expect(propositions[0]!.montant).toBe(xof("3500000"));

    const { pointages } = await service.pointerAutomatiquement(releveId);
    expect(pointages.length).toBe(1);
    expect(pointages[0]!.defaitLe).toBeNull();

    const etat = await service.etatDeRapprochement(releveId);
    expect(etat.pointes.length).toBe(1);
    expect(etat.pointes[0]!.piece).toBe("BQ-2026-001");
    expect(etat.mouvementsNonPointes.length).toBe(0);
    expect(etat.lignesNonPointees.length).toBe(3);

    // Le solde comptable a bougé, l'écart aussi, et il reste entièrement expliqué.
    expect(etat.soldeComptable).toBe(xof("58500000"));
    expect(etat.ecart).toBe(xof("1118500"));
    expect(etat.ecartExplique).toBe(xof("1118500"));
    expect(etat.ecartRestant).toBe(0n);
    expect(etat.conforme).toBe(true);

    // L'audit dit ce qui a été pointé, avec le montant.
    expect((await service.lire()).audit.at(-1)!.detail).toContain("1 paire");
  });

  it("préfère la référence au montant : deux règlements égaux le même jour ne se confondent pas", async () => {
    await mouvementDeBanque({
      date: "2026-03-11",
      piece: "BQ-2026-009",
      libelle: "Règlement fournisseur — sans référence",
      credit: "1850000"
    });
    await mouvementDeBanque({
      date: "2026-03-12",
      piece: "CHQ-118204",
      libelle: "Chèque émis FOU01",
      credit: "1850000"
    });

    const propositions = await service.proposerPointage(releveId);
    const cheque = propositions.find((item) => item.montant === -xof("1850000"));
    expect(cheque).toBeDefined();
    expect(cheque!.nature).toBe("reference");
    expect(cheque!.piece).toBe("CHQ-118204");
  });

  it("refuse deux montants différents et n'écrit rien", async () => {
    await mouvementDeBanque({
      date: "2026-03-31",
      piece: "BQ-2026-031",
      libelle: "Encaissement partiel",
      debit: "3500000"
    });
    const etatAvant = await service.etatDeRapprochement(releveId);
    const ligneDesFrais = etatAvant.lignesNonPointees.find((ligne) => ligne.reference === "FRAIS-03")!;
    const mouvement = etatAvant.mouvementsNonPointes[0]!;

    await expect(
      service.pointer({ releveId, paires: [{ ligne: ligneDesFrais.id, mouvement: mouvement.ligneId }] })
    ).rejects.toThrow(/Comptabilisez la différence, puis pointez/u);

    const apres = await service.etatDeRapprochement(releveId);
    expect(apres.pointes.length).toBe(0);
    expect(apres.lignesNonPointees.length).toBe(4);
  });

  it("refuse un mouvement d'un autre compte, une ligne déjà pointée, une ligne inconnue", async () => {
    // Un mouvement du compte client, pas de la trésorerie.
    const lot = await posterLot(service, {
      journalCode: "VTE",
      date: "2026-03-06",
      piece: "FV-2026-003",
      libelle: "Vente de marchandises",
      lignes: [{ compte: "701100", libelle: "Vente", credit: "3500000" }],
      contrepartie: "411100",
      tiers: "CLI01"
    });
    const mouvementHorsCompte = (await service.lire()).mouvements.find(
      (item) => item.piece === "FV-2026-003" && item.compte.startsWith("411100")
    )!;
    expect(lot).toBeTruthy();

    const etat = await service.etatDeRapprochement(releveId);
    const ligne = etat.lignesNonPointees[0]!;
    await expect(
      service.pointer({ releveId, paires: [{ ligne: ligne.id, mouvement: mouvementHorsCompte.ligneId }] })
    ).rejects.toThrow(/pas le compte du relevé/u);

    await expect(service.pointer({ releveId, paires: [] })).rejects.toThrow(/Aucune paire demandée/u);
    await expect(
      service.pointer({ releveId, paires: [{ ligne: "INCONNUE", mouvement: mouvementHorsCompte.ligneId }] })
    ).rejects.toThrow(/n'existe pas dans le relevé/u);

    // Une même ligne ne se pointe pas deux fois.
    await mouvementDeBanque({ date: "2026-03-05", piece: "BQ-2026-001", libelle: "Encaissement", debit: "3500000" });
    await service.pointerAutomatiquement(releveId);
    const dejaPointee = (await service.lire()).pointages.find((item) => item.defaitLe === null)!;
    await expect(
      service.pointer({ releveId, paires: [{ ligne: dejaPointee.ligneDeReleve, mouvement: "autre" }] })
    ).rejects.toThrow(/déjà pointée/u);
  });

  it("comptabiliser les frais bancaires puis les pointer laisse un rapprochement conforme", async () => {
    // Les quatre lignes du relevé, comptabilisées une à une : deux encaissements, un chèque émis,
    // les frais de la banque.
    await mouvementDeBanque({ date: "2026-03-05", piece: "BQ-2026-001", libelle: "Virement CADJEHOUN", debit: "3500000" });
    await mouvementDeBanque({ date: "2026-03-12", piece: "CHQ-118204", libelle: "Chèque FOU01", credit: "1850000" });
    await mouvementDeBanque({ date: "2026-03-20", piece: "BQ-2026-002", libelle: "Remise espèces", debit: "750000" });

    await service.ajouterCompte({ numero: "674100", libelle: "Services bancaires", groupe: "CHG-FIN" });
    const lotDesFrais = await service.creerLot({
      journalCode: "BQ",
      date: "2026-03-31",
      libelle: "Frais bancaires de mars"
    });
    await service.ajouterEcriture(lotDesFrais.id, {
      piece: "BQ-2026-031",
      date: "2026-03-31",
      libelle: "Frais de tenue de compte",
      lignes: [
        { compte: "674100", libelle: "Frais de tenue de compte", debit: xof("18500") },
        { compte: "521100", libelle: "Frais de tenue de compte", credit: xof("18500") }
      ]
    });
    await service.marquerPret(lotDesFrais.id);
    await service.comptabiliserLot(lotDesFrais.id);

    const { pointages } = await service.pointerAutomatiquement(releveId);
    expect(pointages.length).toBe(4);

    const etat = await service.etatDeRapprochement(releveId);
    expect(etat.lignesNonPointees.length).toBe(0);
    expect(etat.mouvementsNonPointes.length).toBe(0);
    expect(etat.pointes.length).toBe(4);
    // Tout est pointé : les deux soldes se rejoignent.
    expect(etat.soldeComptable).toBe(etat.soldeDuReleve);
    expect(etat.ecart).toBe(0n);
    expect(etat.ecartRestant).toBe(0n);
    expect(etat.conforme).toBe(true);
  });

  it("un chèque émis avant la période se pointe contre le relevé qui le présente", async () => {
    await mouvementDeBanque({
      date: "2026-02-27",
      piece: "CHQ-118204",
      libelle: "Chèque émis FOU01 fin février",
      credit: "1850000"
    });

    // Dans la période du relevé, rien ne correspond : la proposition n'apparaît pas.
    expect((await service.proposerPointage(releveId)).length).toBe(0);

    // En acceptant les mouvements antérieurs, le chèque de février se pointe sur le relevé de mars.
    const propositions = await service.proposerPointage(releveId, { horsPeriode: true });
    expect(propositions.length).toBe(1);
    expect(propositions[0]!.nature).toBe("reference");
    expect(propositions[0]!.date).toBe("2026-02-27");

    await service.pointerAutomatiquement(releveId, { horsPeriode: true });
    const etat = await service.etatDeRapprochement(releveId);
    expect(etat.pointes.length).toBe(1);
    // Le mouvement est antérieur à la période : il n'est pas un suspens de la période, et l'écart
    // reste expliqué.
    expect(etat.mouvementsNonPointes.length).toBe(0);
    expect(etat.ecartRestant).toBe(0n);
    expect(etat.conforme).toBe(true);
  });
});

describe("Dépointage et persistance", () => {
  it("dépointer rend la ligne à rapprocher et laisse la trace", async () => {
    await mouvementDeBanque({ date: "2026-03-05", piece: "BQ-2026-001", libelle: "Encaissement", debit: "3500000" });
    const { pointages } = await service.pointerAutomatiquement(releveId);
    const pointage = pointages[0]!;

    const defait = await service.depointer(pointage.id);
    expect(defait.defaitLe).not.toBeNull();

    const etat = await service.etatDeRapprochement(releveId);
    expect(etat.pointes.length).toBe(0);
    expect(etat.lignesNonPointees.length).toBe(4);
    expect(etat.mouvementsNonPointes.length).toBe(1);
    expect(etat.conforme).toBe(true);

    // La trace est conservée, pas effacée : un rapprochement refait ne fait pas disparaître l'autre.
    const dossier = await service.lire();
    expect(dossier.pointages.length).toBe(1);
    expect(dossier.pointages[0]!.defaitLe).not.toBeNull();
    expect(dossier.audit.map((ligne) => ligne.action)).toContain("Pointage défait");

    await expect(service.depointer(pointage.id)).rejects.toThrow(/déjà défait/u);
  });

  it("survit à un aller-retour de sérialisation", async () => {
    await mouvementDeBanque({ date: "2026-03-05", piece: "BQ-2026-001", libelle: "Encaissement", debit: "3500000" });
    await service.pointerAutomatiquement(releveId);

    const avant = await service.lire();
    const apres = deserialiserEtat(JSON.parse(JSON.stringify(serialiserEtat(avant))));

    expect(apres.releves.length).toBe(1);
    expect(apres.releves[0]!.soldeDOuverture).toBe(xof("55000000"));
    expect(apres.releves[0]!.lignes[0]!.montant).toBe(xof("3500000"));
    expect(apres.pointages.length).toBe(1);
    expect(apres.pointages[0]!.montant).toBe(xof("3500000"));
    expect(apres.sequencesReleves).toBe(1);
    expect(typeof apres.releves[0]!.lignes[0]!.montant).toBe("bigint");
  });
});
