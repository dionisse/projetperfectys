/**
 * Paramétrage du dossier : société, plan de comptes, taux.
 *
 * Le paquet pays est la référence légale, versionnée ; le dossier porte ce qui s'applique ici, et
 * l'utilisateur peut le corriger. Ces tests vérifient deux choses : que la correction est possible,
 * et qu'elle ne réécrit pas l'histoire — un taux qui a déjà servi ne se modifie pas, il se remplace
 * par un nouveau code.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  BENIN,
  COMPTE_RESULTAT_EXERCICE,
  deserialiserEtat,
  formaterTaux,
  serialiserEtat,
  type ServiceComptable
} from "../src/noyau/index";
import { nouveauService, posterLot, posterVente, xof } from "./aide";

let service: ServiceComptable;

beforeEach(() => {
  ({ service } = nouveauService());
});

describe("Société du dossier", () => {
  it("se modifie champ par champ, et chaque changement est tracé avec sa valeur d'avant", async () => {
    const avant = (await service.lire()).societe;
    expect(avant.raisonSociale).toBe("BÉNIN NÉGOCE DISTRIBUTION");

    const apres = await service.modifierSociete({
      raisonSociale: "BÉNIN NÉGOCE DISTRIBUTION SARL",
      adresse: "Lot 214, quartier Ganhi, BP 1234 Cotonou",
      telephone: "+229 21 30 45 67",
      courriel: "COMPTABILITE@Benin-Negoce.bj",
      regimeFiscal: "Réel normal — assujetti TVA 18 %"
    });

    expect(apres.raisonSociale).toBe("BÉNIN NÉGOCE DISTRIBUTION SARL");
    // Le courriel est normalisé : une adresse ne se compare pas à la casse près.
    expect(apres.courriel).toBe("comptabilite@benin-negoce.bj");

    const audit = (await service.lire()).audit.at(-1)!;
    expect(audit.action).toBe("Société modifiée");
    expect(audit.detail).toContain("« BÉNIN NÉGOCE DISTRIBUTION » → « BÉNIN NÉGOCE DISTRIBUTION SARL »");
    expect(audit.detail).toContain("courriel");

    // Le numéro de dossier suit la société, et le contexte le renvoie.
    const contexte = await service.contexte();
    expect(contexte.societe.raisonSociale).toBe("BÉNIN NÉGOCE DISTRIBUTION SARL");
    expect(contexte.numero).toContain(avant.code);
  });

  it("valide l'identifiant fiscal avec la règle du paquet pays, pas avec une règle codée en dur", async () => {
    const modifiee = await service.modifierSociete({ identifiantFiscal: "0020181456789" });
    expect(modifiee.identifiantFiscal).toBe("0020181456789");

    await expect(service.modifierSociete({ identifiantFiscal: "12" })).rejects.toThrow(
      BENIN.regleIdentifiantFiscal.messageErreur
    );
    await expect(service.modifierSociete({ identifiantFiscal: "" })).rejects.toThrow(/obligatoire/u);
    // Rien n'a été écrit par les refus.
    expect((await service.lire()).societe.identifiantFiscal).toBe("0020181456789");
  });

  it("refuse ce qui rendrait les états exportés faux ou inutilisables", async () => {
    await expect(service.modifierSociete({ raisonSociale: "   " })).rejects.toThrow(/raison sociale est obligatoire/u);
    await expect(service.modifierSociete({ pays: "" })).rejects.toThrow(/pays est obligatoire/u);
    await expect(service.modifierSociete({ courriel: "pas-un-courriel" })).rejects.toThrow(/format valide/u);
    await expect(service.modifierSociete({ formeJuridique: "LICENCE" })).rejects.toThrow(/SARL/u);
    await expect(service.modifierSociete({ code: "TROP-LONG-CODE" })).rejects.toThrow(/numéro de dossier/u);

    const admise = await service.modifierSociete({ formeJuridique: "sa" });
    expect(admise.formeJuridique).toBe("SA");
  });

  it("ne trace rien quand rien ne change", async () => {
    const societe = (await service.lire()).societe;
    const avant = (await service.lire()).audit.length;
    await service.modifierSociete({ raisonSociale: societe.raisonSociale, ville: societe.ville });
    expect((await service.lire()).audit.length).toBe(avant);
  });
});

describe("Plan de comptes", () => {
  it("modifie le libellé, l'activation et l'accès à la saisie", async () => {
    const compte = await service.modifierCompte("626000", {
      libelle: "Frais postaux, télécommunications et internet",
      autoriseSaisie: true
    });
    expect(compte.libelle).toBe("Frais postaux, télécommunications et internet");

    const desactive = await service.modifierCompte("626000", { actif: false });
    expect(desactive.actif).toBe(false);

    const audit = (await service.lire()).audit.at(-1)!;
    expect(audit.action).toBe("Compte modifié");
    expect(audit.detail).toContain("actif : oui → non");
  });

  it("déplace un compte non mouvementé d'un groupe à l'autre, et refuse un compte mouvementé", async () => {
    // 671000 (intérêts des emprunts) n'est pas mouvementé dans le dossier de démonstration.
    const deplace = await service.modifierCompte("671000", { groupe: "CHG-EXP" });
    expect(deplace.groupe).toBe("CHG-EXP");
    await service.modifierCompte("671000", { groupe: "CHG-FIN" });

    await posterVente(service, { date: "2026-04-05", piece: "FV-2026-001", montant: "2000000" });
    await expect(service.modifierCompte("701100", { groupe: "PRD-HAO" })).rejects.toThrow(
      /ne change pas de groupe/u
    );
    // Le groupe n'a pas bougé : le bilan ne sera pas réécrit en silence.
    const compte = (await service.planComptable()).find((item) => item.comptePrincipal === "701100")!;
    expect(compte.groupe).toBe("PRD-EXP");

    await expect(service.modifierCompte("671000", { groupe: "INCONNU" })).rejects.toThrow(
      /n'existe pas dans le référentiel/u
    );
    await expect(service.modifierCompte("999999", { libelle: "x" })).rejects.toThrow(
      /n'existe pas dans le plan/u
    );
  });

  it("refuse de toucher au solde initial d'un compte mouvementé : les à-nouveaux passent par un lot", async () => {
    await expect(service.modifierCompte("521100", { soldeInitial: "60000000" })).rejects.toThrow(
      /à-nouveaux se saisissent par un lot/u
    );

    // Un compte ajouté au plan, jamais mouvementé, accepte un solde initial.
    await service.ajouterCompte({ numero: "674100", libelle: "Services bancaires", groupe: "CHG-FIN" });
    const compte = await service.modifierCompte("674100", { soldeInitial: "0" });
    expect(compte.soldeInitial).toBe(xof("0"));
  });

  it("supprime un compte neuf et refuse tout ce qui tient au dossier", async () => {
    await service.ajouterCompte({ numero: "674200", libelle: "Cotisations bancaires", groupe: "CHG-FIN" });
    await service.supprimerCompte("674200");
    expect((await service.planComptable()).some((item) => item.comptePrincipal === "674200")).toBe(false);

    await posterVente(service, { date: "2026-04-05", piece: "FV-2026-001", montant: "2000000" });
    await expect(service.supprimerCompte("701100")).rejects.toThrow(/porte des mouvements/u);
    await expect(service.supprimerCompte("445200")).rejects.toThrow(/enregistre la taxe/u);
    await expect(service.supprimerCompte(COMPTE_RESULTAT_EXERCICE)).rejects.toThrow(/résultat de l'exercice/u);
    // 521100 cumule deux raisons : les deux sont dites en une fois, pas l'une après l'autre.
    await expect(service.supprimerCompte("521100")).rejects.toThrow(/contrepartie du journal BQ/u);
    const message = await service.supprimerCompte("521100").then(
      () => "",
      (erreur: unknown) => (erreur as Error).message
    );
    expect(message).toMatch(/porte des mouvements/u);
    expect(message).toMatch(/contrepartie du journal BQ/u);

    // Un compte figurant dans un lot en saisie ne se supprime pas non plus.
    await service.ajouterCompte({ numero: "674100", libelle: "Services bancaires", groupe: "CHG-FIN" });
    const lot = await service.creerLot({ journalCode: "OD", date: "2026-04-20", libelle: "Lot en cours" });
    await service.ajouterEcriture(lot.id, {
      piece: "OD-9",
      date: "2026-04-20",
      libelle: "Regularisation",
      lignes: [
        { compte: "674100", libelle: "Services bancaires", debit: "5000" },
        { compte: "521100", libelle: "Banque", credit: "5000" }
      ]
    });
    await expect(service.supprimerCompte("674100")).rejects.toThrow(/figure dans un lot/u);
    // Rien n'a été supprimé par tous ces refus.
    const plan = await service.planComptable();
    for (const numero of ["701100", "445200", "521100", "674100", COMPTE_RESULTAT_EXERCICE]) {
      expect(plan.some((item) => item.comptePrincipal === numero)).toBe(true);
    }
  });
});

describe("Taux et codes de taxe", () => {
  it("le dossier porte ses propres codes : modifier un taux ne touche pas au paquet pays", async () => {
    const tauxDuPaquet = BENIN.codesTaxe.find((code) => code.code === "TVA-V18")!.pointsDeBase;

    await service.ajouterCodeTaxe({
      code: "TVA-V19",
      libelle: "TVA collectée 19 % (réforme à venir)",
      pointsDeBase: 1900n,
      base: "hors-taxe",
      sens: "collectee",
      compteTaxe: "443100",
      exigibleSur: "vente",
      condition: "interieur",
      referenceLegale: "Loi de finances pour 2027, article 4 (fictif, pour l'exemple)"
    });

    const codes = await service.codesTaxe();
    expect(codes.map((code) => code.code)).toContain("TVA-V19");
    // Le paquet pays, référence légale partagée, n'a pas bougé.
    expect(BENIN.codesTaxe.some((code) => code.code === "TVA-V19")).toBe(false);
    expect(BENIN.codesTaxe.find((code) => code.code === "TVA-V18")!.pointsDeBase).toBe(tauxDuPaquet);
    expect(service.paquetPays.codesTaxe.length).toBe(BENIN.codesTaxe.length);

    // Le nouveau code est proposé à la saisie d'une vente.
    const proposes = await service.codesTaxePour({
      operation: "vente",
      tiersImmatricule: true,
      tiersPublic: false,
      exportation: false
    });
    expect(proposes.map((code) => code.code)).toContain("TVA-V19");
  });

  it("un taux saisi s'applique au calcul de la taxe et à la déclaration", async () => {
    await service.ajouterCodeTaxe({
      code: "TVA-V19",
      libelle: "TVA collectée 19 %",
      pointsDeBase: 1900n,
      base: "hors-taxe",
      sens: "collectee",
      compteTaxe: "443100",
      exigibleSur: "vente",
      condition: "interieur",
      referenceLegale: "Décret fictif n° 2027-01, article 2"
    });

    await posterLot(service, {
      journalCode: "VTE",
      date: "2026-04-06",
      piece: "FV-2026-004",
      libelle: "Vente taxée au nouveau taux",
      lignes: [{ compte: "701100", libelle: "Vente de marchandises", credit: "1000000", codesTaxe: ["TVA-V19"] }],
      contrepartie: "411100",
      tiers: "CLI01"
    });

    const declaration = await service.declarationTva(4);
    const ligne = declaration.lignes.find((item) => item.code === "TVA-V19")!;
    expect(ligne).toBeDefined();
    expect(ligne.pointsDeBase).toBe(1900n);
    expect(ligne.montant).toBe(xof("190000"));
    expect(ligne.base).toBe(xof("1000000"));
  });

  it("refuse un code de taxe qui ne tient pas debout", async () => {
    const demande = {
      code: "TVA-V19",
      libelle: "TVA collectée 19 %",
      pointsDeBase: 1900n,
      base: "hors-taxe" as const,
      sens: "collectee" as const,
      compteTaxe: "443100",
      exigibleSur: "vente" as const,
      condition: "interieur" as const,
      referenceLegale: "Décret fictif n° 2027-01"
    };

    await expect(service.ajouterCodeTaxe({ ...demande, code: "TVA-V18" })).rejects.toThrow(/existe déjà/u);
    await expect(service.ajouterCodeTaxe({ ...demande, pointsDeBase: 12000n })).rejects.toThrow(/dépasse 100 %/u);
    await expect(service.ajouterCodeTaxe({ ...demande, pointsDeBase: -100n })).rejects.toThrow(/négatif/u);
    await expect(service.ajouterCodeTaxe({ ...demande, compteTaxe: "449999" })).rejects.toThrow(
      /nulle part où s'enregistrer/u
    );
    await expect(service.ajouterCodeTaxe({ ...demande, referenceLegale: "  " })).rejects.toThrow(
      /pas défendable/u
    );
    await expect(service.ajouterCodeTaxe({ ...demande, code: "code trop long pour un identifiant" })).rejects.toThrow(
      /Code de taxe invalide/u
    );

    expect((await service.codesTaxe()).some((code) => code.code === "TVA-V19")).toBe(false);
  });

  it("modifie le taux d'un code qui n'a pas servi, et le marque comme fixé par l'utilisateur", async () => {
    // ACHT-1 (acompte de 1 %) est marqué « à confirmer » dans le paquet pays.
    const avant = (await service.codesTaxe()).find((code) => code.code === "ACHT-1")!;
    expect(avant.aVerifier).toBe(true);

    const apres = await service.modifierCodeTaxe("ACHT-1", {
      pointsDeBase: 100n,
      referenceLegale: "CGI Bénin art. 123 bis — confirmé par le cabinet le 20/10/2026"
    });
    expect(apres.pointsDeBase).toBe(100n);
    // Le paramètre n'est plus « à confirmer » : c'est l'utilisateur qui l'a fixé.
    expect(apres.aVerifier).toBe(false);

    const audit = (await service.lire()).audit.at(-1)!;
    expect(audit.action).toBe("Code de taxe modifié");
    expect(audit.detail).toContain(`taux : ${formaterTaux(avant.pointsDeBase)} → 1 %`);
    expect(audit.detail).toContain("à confirmer → fixé par l'utilisateur");
  });

  it("refuse de réécrire le taux d'un code qui a déjà servi : un changement de taux est un nouveau code", async () => {
    await posterVente(service, { date: "2026-04-05", piece: "FV-2026-001", montant: "2000000" });

    await expect(service.modifierCodeTaxe("TVA-V18", { pointsDeBase: 2000n })).rejects.toThrow(
      /a déjà servi dans des écritures/u
    );
    await expect(service.modifierCodeTaxe("TVA-V18", { pointsDeBase: 2000n })).rejects.toThrow(/nouveau code/u);
    await expect(service.modifierCodeTaxe("TVA-V18", { compteTaxe: "445200" })).rejects.toThrow(/a déjà servi/u);
    await expect(service.modifierCodeTaxe("TVA-V18", { base: "toutes-taxes-comprises" })).rejects.toThrow(
      /a déjà servi/u
    );

    // Le taux en vigueur n'a pas bougé, et la déclaration déjà calculée reste juste.
    const code = (await service.codesTaxe()).find((item) => item.code === "TVA-V18")!;
    expect(code.pointsDeBase).toBe(1800n);
    const declaration = await service.declarationTva(4);
    expect(declaration.lignes.find((ligne) => ligne.code === "TVA-V18")!.montant).toBe(xof("360000"));

    // Ce qui ne touche pas au montant reste modifiable, même sur un code utilisé.
    const renomme = await service.modifierCodeTaxe("TVA-V18", {
      libelle: "TVA collectée 18 % — régime intérieur (CGI art. 123)"
    });
    expect(renomme.libelle).toContain("CGI art. 123");
  });

  it("supprime un code qui n'a pas servi et refuse un code utilisé", async () => {
    await service.ajouterCodeTaxe({
      code: "TVA-V05",
      libelle: "TVA collectée 5 % (taux réduit)",
      pointsDeBase: 500n,
      base: "hors-taxe",
      sens: "collectee",
      compteTaxe: "443100",
      exigibleSur: "vente",
      condition: "interieur",
      referenceLegale: "CGI Bénin art. 123 quater (fictif)"
    });
    await service.supprimerCodeTaxe("TVA-V05");
    expect((await service.codesTaxe()).some((code) => code.code === "TVA-V05")).toBe(false);

    await posterVente(service, { date: "2026-04-05", piece: "FV-2026-001", montant: "2000000" });
    await expect(service.supprimerCodeTaxe("TVA-V18")).rejects.toThrow(/figure dans des écritures/u);
    await expect(service.supprimerCodeTaxe("INCONNU")).rejects.toThrow(/n'existe pas dans le paramétrage/u);
  });

  it("reprendre les taux du paquet pays ne réécrit pas ce qui a servi", async () => {
    // Un code non utilisé, modifié par l'utilisateur.
    await service.modifierCodeTaxe("ACHT-1", { pointsDeBase: 250n });
    expect((await service.codesTaxe()).find((code) => code.code === "ACHT-1")!.pointsDeBase).toBe(250n);

    // Un code utilisé, que l'utilisateur ne peut pas réécrire — il reste au dossier.
    await posterVente(service, { date: "2026-04-05", piece: "FV-2026-001", montant: "2000000" });

    // Un code créé par l'utilisateur, que le paquet ne connaît pas.
    await service.ajouterCodeTaxe({
      code: "TVA-V19",
      libelle: "TVA collectée 19 %",
      pointsDeBase: 1900n,
      base: "hors-taxe",
      sens: "collectee",
      compteTaxe: "443100",
      exigibleSur: "vente",
      condition: "interieur",
      referenceLegale: "Décret fictif n° 2027-01"
    });

    const bilan = await service.reprendreCodesTaxeDuPaquet();
    expect(bilan.repris).toContain("ACHT-1");
    expect(bilan.personnalises).toContain("TVA-V19");
    expect(bilan.conserves).not.toContain("TVA-V18");

    const codes = await service.codesTaxe();
    expect(codes.find((code) => code.code === "ACHT-1")!.pointsDeBase).toBe(100n);
    expect(codes.find((code) => code.code === "ACHT-1")!.aVerifier).toBe(true);
    expect(codes.find((code) => code.code === "TVA-V18")!.pointsDeBase).toBe(1800n);
    expect(codes.some((code) => code.code === "TVA-V19")).toBe(true);
  });

  it("les codes modifiés survivent à un aller-retour de sérialisation", async () => {
    await service.ajouterCodeTaxe({
      code: "TVA-V19",
      libelle: "TVA collectée 19 %",
      pointsDeBase: 1900n,
      base: "hors-taxe",
      sens: "collectee",
      compteTaxe: "443100",
      exigibleSur: "vente",
      condition: "interieur",
      referenceLegale: "Décret fictif n° 2027-01"
    });
    await service.modifierCompte("626000", { libelle: "Frais postaux et télécommunications" });

    const avant = await service.lire();
    const apres = deserialiserEtat(JSON.parse(JSON.stringify(serialiserEtat(avant))));

    expect(apres.codesTaxe.length).toBe(avant.codesTaxe.length);
    const code = apres.codesTaxe.find((item) => item.code === "TVA-V19")!;
    expect(typeof code.pointsDeBase).toBe("bigint");
    expect(code.pointsDeBase).toBe(1900n);
    expect(apres.comptes.find((item) => item.comptePrincipal === "626000")!.libelle).toBe(
      "Frais postaux et télécommunications"
    );
    expect(apres.societe.raisonSociale).toBe(avant.societe.raisonSociale);
  });

  it("un ancien dossier sans codes enregistrés retombe sur ceux du paquet pays", async () => {
    const brut = JSON.parse(JSON.stringify(serialiserEtat(await service.lire())));
    delete brut.codesTaxe;
    const repris = deserialiserEtat(brut);
    expect(repris.codesTaxe.length).toBe(BENIN.codesTaxe.length);
    expect(repris.codesTaxe.find((code) => code.code === "TVA-V18")!.pointsDeBase).toBe(1800n);
  });
});
