/**
 * Import d'un relevé bancaire — CSV, OFX et CAMT.053.
 *
 * Ce qui est vérifié : qu'un fichier se lit sans rien écrire, que la forme du fichier est détectée
 * (séparateur, décimale, en-têtes, sens D/C, colonnes débit/crédit, ordre des dates), que le sens des
 * montants reste celui de la banque, qu'une décimale impossible dans la devise du dossier est refusée
 * plutôt qu'arrondie, qu'un fichier illisible cite la ligne en cause, que l'import crée un relevé dont
 * la provenance est gardée et tracée, qu'un second import du même fichier ne double pas les lignes,
 * et que le relevé d'exemple produit un fichier que le lecteur relit à l'identique.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  BENIN,
  ZERO,
  cleDeDoublon,
  detecterFormatDeReleve,
  demandeDeReleveDepuisImport,
  deserialiserEtat,
  exempleDeReleveCsv,
  lireReleve,
  serialiserEtat,
  type DateCivile,
  type ServiceComptable
} from "../src/noyau/index";
import { nouveauService, posterLot, xof } from "./aide";

let service: ServiceComptable;

beforeEach(() => {
  service = nouveauService().service;
});

const devise = BENIN.devise;
const lire = (texte: string, nomFichier: string | null = null) =>
  lireReleve(texte, { devise, ...(nomFichier ? { nomFichier } : {}) });

/* ------------------------------------------------------------------ */
/* Fichiers d'essai                                                    */
/* ------------------------------------------------------------------ */

/** Ce qu'une banque de l'UEMOA donne : point-virgule, espaces de milliers, colonne de solde. */
const CSV_FRANCAIS = `Résumé de compte — BÉNIN NÉGOCE DISTRIBUTION — 521100
Période du 01/04/2026 au 30/04/2026
Date opération;Date valeur;Libellé;Référence;Montant;Solde
02/04/2026;03/04/2026;VIREMENT EMIS FRS PORT AUTONOME;RG-2026-004;-1 170 000;53 830 000
05/04/2026;05/04/2026;REMISE CHEQUE CLIENT "SOGEMA";CHQ-100234;2 500 000;56 330 000
10/04/2026;10/04/2026;FRAIS DE TENUE DE COMPTE;FRAIS-04;-15 000;56 315 000
30/04/2026;30/04/2026;COMMISSION DE VIREMENT;;-7 500;56 307 500

Total des opérations;4
`;

/** La même chose telle qu'une banque anglo-saxonne l'exporte. */
const CSV_ANGLO_SAXON = `Date,Description,Reference,Amount,Balance
2026-04-02,Transfer to supplier,RG-2026-004,-1170000.00,53830000.00
2026-04-05,Cheque deposit,CHQ-100234,2500000.00,56330000.00
`;

/** Deux colonnes de montants au lieu d'une : le sens est porté par la colonne, pas par le signe. */
const CSV_DEBIT_CREDIT = `Date;Libellé;Débit;Crédit
05/04/2026;Chèque émis au fournisseur;250 000;
06/04/2026;Remise de chèque client;;400 000
`;

/** Une colonne de sens, comme dans certains relevés de banque postale. */
const CSV_AVEC_SENS = `Date;Libellé;Montant;Sens
05/04/2026;Chèque émis au fournisseur;250 000;D
06/04/2026;Remise de chèque client;400 000;C
`;

/** Aucun en-tête : les colonnes se déduisent de leur contenu. */
const CSV_SANS_EN_TETE = `05/04/2026;CHQ-100234;Chèque émis au fournisseur PORT AUTONOME;-250 000
06/04/2026;VIR-220114;Virement reçu du client SOGEMA BENIN;400 000
`;

/** OFX 1.x, qui est du SGML : les balises ne sont pas fermées. */
const OFX_SGML = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
<OFX>
<SIGNONMSGSRSV1><SONRS><STATUS><CODE>0<SEVERITY>INFO<DTSERVER>20260430120000
<BANKMSGSRSV1><STMTTRNRS><TRNUID>0<STATUS><CODE>0<SEVERITY>INFO<STMTRS>
<CURDEF>XOF
<BANKACCTFROM><BANKID>BJ061010001<ACCTID>BJ5306101001000012345678901
<BANKTRANLIST>
<DTSTART>20260401120000<DTEND>20260430120000
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260402120000<DTUSER>20260402<TRNAMT>-1170000.00<FITID>2026040200034<NAME>VIREMENT EMIS FRS PORT AUTONOME<MEMO>RG-2026-004
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260405120000<TRNAMT>2500000.00<FITID>2026040500099<NAME>REMISE CHEQUE CLIENT<CHECKNUM>100234
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260410120000<TRNAMT>-15000.00<FITID>2026041000121<NAME>FRAIS DE TENUE DE COMPTE
</BANKTRANLIST>
<LEDGERBAL><BALAMT>56315000.00<DTASOF>20260410120000
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>
`;

/** CAMT.053, l'ISO 20022 que les banques de l'UEMOA commencent à donner. */
const CAMT_053 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">
  <BkToCstmrStmt>
    <Stmt>
      <Id>2026-04-521100</Id>
      <Acct><Id><IBAN>BJ5306101001000012345678901</IBAN></Id><Ccy>XOF</Ccy></Acct>
      <Bal>
        <Tp><CdOrPrtry><Cd>OPBK</Cd></CdOrPrtry></Tp>
        <Amt Ccy="XOF">55000000</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Dt><Dt>2026-04-01</Dt></Dt>
      </Bal>
      <Bal>
        <Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp>
        <Amt Ccy="XOF">56315000</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Dt><Dt>2026-04-30</Dt></Dt>
      </Bal>
      <Ntry>
        <Amt Ccy="XOF">1170000</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <BookgDt><Dt>2026-04-02</Dt></BookgDt>
        <ValDt><Dt>2026-04-03</Dt></ValDt>
        <NtryRef>2026040200034</NtryRef>
        <NtryDtls><TxDtls>
          <Refs><EndToEndId>RG-2026-004</EndToEndId></Refs>
          <RmtInf><Ustrd>VIREMENT EMIS FRS PORT AUTONOME</Ustrd></RmtInf>
        </TxDtls></NtryDtls>
      </Ntry>
      <Ntry>
        <Amt Ccy="XOF">2500000</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <BookgDt><Dt>2026-04-05</Dt></BookgDt>
        <NtryRef>2026040500099</NtryRef>
        <NtryDtls><TxDtls>
          <Refs><ChqNb>100234</ChqNb></Refs>
          <RmtInf><Ustrd>REMISE CHEQUE CLIENT &amp; SOGEMA</Ustrd></RmtInf>
        </TxDtls></NtryDtls>
      </Ntry>
      <Ntry>
        <Amt Ccy="XOF">15000</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <BookgDt><Dt>2026-04-10</Dt></BookgDt>
        <AddtlNtryInf>FRAIS DE TENUE DE COMPTE</AddtlNtryInf>
      </Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>
`;

/* ------------------------------------------------------------------ */
/* Détection                                                           */
/* ------------------------------------------------------------------ */

describe("détection du format", () => {
  it("reconnaît le CSV, l'OFX et le CAMT.053 d'après le contenu", () => {
    expect(detecterFormatDeReleve(CSV_FRANCAIS, "releve.csv")).toBe("csv");
    expect(detecterFormatDeReleve(OFX_SGML, "releve.ofx")).toBe("ofx");
    expect(detecterFormatDeReleve(CAMT_053, "camt053.xml")).toBe("camt053");
    // Le contenu prime sur l'extension : un CAMT nommé .csv se lit comme du XML.
    expect(detecterFormatDeReleve(CAMT_053, "releve.csv")).toBe("camt053");
  });

  it("refuse ce qui n'est pas un relevé, en disant quoi", () => {
    expect(() => detecterFormatDeReleve("", "releve.csv")).toThrow(/fichier est vide/i);
    expect(() => detecterFormatDeReleve(CSV_FRANCAIS, "releve.ofx")).toThrow(/n'en contient pas la structure/i);
    expect(() => detecterFormatDeReleve('<?xml version="1.0"?><Document><Foo/></Document>', "x.xml")).toThrow(
      /aucune entrée <Ntry>/i
    );
  });
});

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

describe("lecture d'un CSV", () => {
  it("lit un relevé de banque de l'UEMOA : séparateur, milliers, solde, pied de fichier", () => {
    const lu = lire(CSV_FRANCAIS, "boa-2026-04.csv");

    expect(lu.format).toBe("csv");
    expect(lu.nomFichier).toBe("boa-2026-04.csv");
    expect(lu.lignes).toHaveLength(4);
    expect(lu.lignes.map((ligne) => ligne.montant)).toEqual([
      -xof("1170000"),
      xof("2500000"),
      -xof("15000"),
      -xof("7500")
    ]);
    expect(lu.lignes[0]!.date).toBe("2026-04-02" as DateCivile);
    expect(lu.lignes[0]!.reference).toBe("RG-2026-004");
    // Un libellé entre guillemets garde ses guillemets, le séparateur ne le coupe pas.
    expect(lu.lignes[1]!.libelle).toBe('REMISE CHEQUE CLIENT "SOGEMA"');
    // La dernière opération n'a pas de référence : elle reste vide, elle n'est pas inventée.
    expect(lu.lignes[3]!.reference).toBe("");
    expect(lu.dateDebut).toBe("2026-04-02" as DateCivile);
    expect(lu.dateFin).toBe("2026-04-30" as DateCivile);
    // Le solde d'ouverture se déduit du premier solde porté, moins l'opération qu'il suit.
    expect(lu.soldeDOuverture).toBe(xof("55000000"));
    expect(lu.soldeDeFin).toBe(xof("56307500"));
  });

  it("dit ce qu'il a reconnu, pour que l'utilisateur contrôle avant d'importer", () => {
    const lu = lire(CSV_FRANCAIS, "boa-2026-04.csv");
    const roles = Object.fromEntries(lu.correspondances.map((item) => [item.role, item.colonne]));

    expect(roles["Date d'opération"]).toBe("Date opération");
    expect(roles["Date de valeur"]).toBe("Date valeur");
    expect(roles["Libellé"]).toBe("Libellé");
    expect(roles["Référence"]).toBe("Référence");
    expect(roles["Montant"]).toBe("Montant");
    expect(roles["Solde"]).toBe("Solde");
    expect(roles["Séparateur"]).toBe("« ; »");
    expect(roles["Décimale"]).toBe("virgule");
    // La ligne de total n'est pas une opération : elle est écartée et annoncée.
    expect(lu.avertissements.join(" ")).toMatch(/Total des opérations/i);
  });

  it("lit un CSV anglo-saxon : virgule, décimale au point, dates ISO, .00 toléré en XOF", () => {
    const lu = lire(CSV_ANGLO_SAXON, "statement.csv");

    expect(lu.lignes).toHaveLength(2);
    expect(lu.lignes[0]!.montant).toBe(-xof("1170000"));
    expect(lu.lignes[1]!.montant).toBe(xof("2500000"));
    expect(lu.lignes[0]!.date).toBe("2026-04-02" as DateCivile);
    expect(lu.lignes[0]!.libelle).toBe("Transfer to supplier");
    expect(lu.soldeDOuverture).toBe(xof("55000000"));
    expect(lu.correspondances.some((item) => item.role === "Décimale" && item.colonne === "point")).toBe(true);
  });

  it("lit deux colonnes débit et crédit : une sortie devient un montant négatif", () => {
    const lu = lire(CSV_DEBIT_CREDIT, "releve.csv");

    expect(lu.lignes).toHaveLength(2);
    expect(lu.lignes[0]!.montant).toBe(-xof("250000"));
    expect(lu.lignes[1]!.montant).toBe(xof("400000"));
    expect(lu.correspondances.map((item) => item.role)).toContain("Débit (sortie)");
    expect(lu.correspondances.map((item) => item.role)).toContain("Crédit (entrée)");
  });

  it("lit une colonne de sens D/C", () => {
    const lu = lire(CSV_AVEC_SENS, "releve.csv");

    expect(lu.lignes.map((ligne) => ligne.montant)).toEqual([-xof("250000"), xof("400000")]);
  });

  it("déduit les colonnes d'un fichier sans en-tête, et le dit", () => {
    const lu = lire(CSV_SANS_EN_TETE, "releve.txt");

    expect(lu.lignes).toHaveLength(2);
    expect(lu.lignes[0]!.date).toBe("2026-04-05" as DateCivile);
    expect(lu.lignes[0]!.reference).toBe("CHQ-100234");
    expect(lu.lignes[0]!.libelle).toBe("Chèque émis au fournisseur PORT AUTONOME");
    expect(lu.lignes[0]!.montant).toBe(-xof("250000"));
    expect(lu.lignes[1]!.montant).toBe(xof("400000"));
    expect(lu.avertissements.join(" ")).toMatch(/Aucune ligne d'en-tête reconnue/i);
  });

  it("reconnaît des dates mois/jour quand le fichier le prouve", () => {
    const lu = lire(
      `Date;Libellé;Montant\n04/25/2026;Virement fournisseur;-1 170 000\n`,
      "releve.csv"
    );
    expect(lu.lignes[0]!.date).toBe("2026-04-25" as DateCivile);
  });

  it("refuse un montant avec des centimes dans une devise qui n'en a pas", () => {
    expect(() => lire(`Date;Libellé;Montant\n05/04/2026;Virement;-1 170 000,56\n`, "releve.csv")).toThrow(
      /n'en admet que 0/i
    );
  });

  it("cite la ligne en cause quand un montant n'est pas lisible", () => {
    expect(() => lire(`Date;Libellé;Montant\n05/04/2026;Virement;1 170 000\n06/04/2026;Chèque;à payer\n`, "r.csv")).toThrow(
      /Ligne 3.*à payer/su
    );
  });

  it("écarte une ligne sans montant et le dit, plutôt que de l'importer à zéro", () => {
    const lu = lire(`Date;Libellé;Montant\n05/04/2026;Virement;-1 000\n06/04/2026;Opération nulle;0\n`, "r.csv");
    expect(lu.lignes).toHaveLength(1);
    expect(lu.avertissements.join(" ")).toMatch(/aucun montant|montant nul/i);
  });

  it("refuse un fichier sans date d'opération", () => {
    expect(() => lire(`Libellé;Montant\nVirement;1 000\n`, "r.csv")).toThrow(/Aucune date d'opération/i);
  });

  it("refuse une date qui n'existe pas", () => {
    expect(() => lire(`Date;Libellé;Montant\n31/02/2026;Virement;1 000\n`, "r.csv")).toThrow(/n'existe pas/i);
  });

  it("refuse un sens qui n'est ni D ni C", () => {
    expect(() => lire(`Date;Montant;Sens\n05/04/2026;1 000;X\n`, "r.csv")).toThrow(/n'est ni D ni C/i);
  });
});

/* ------------------------------------------------------------------ */
/* OFX et CAMT.053                                                     */
/* ------------------------------------------------------------------ */

describe("lecture d'un OFX", () => {
  it("lit des opérations SGML non fermées, avec le compte et le solde de fin", () => {
    const lu = lire(OFX_SGML, "releve.ofx");

    expect(lu.format).toBe("ofx");
    expect(lu.lignes).toHaveLength(3);
    expect(lu.lignes.map((ligne) => ligne.montant)).toEqual([
      -xof("1170000"),
      xof("2500000"),
      -xof("15000")
    ]);
    expect(lu.lignes[0]!.date).toBe("2026-04-02" as DateCivile);

    // La référence reste celle de la banque (ici l'identifiant OFX) ; le mémo, qui porte la pièce
    // comptable, rejoint le libellé plutôt que d'être perdu.
    expect(lu.lignes[0]!.reference).toBe("2026040200034");
    expect(lu.lignes[0]!.libelle).toBe("VIREMENT EMIS FRS PORT AUTONOME — RG-2026-004");
    // Un numéro de chèque prime l'identifiant interne : c'est la référence qui pointe.
    expect(lu.lignes[1]!.reference).toBe("100234");
    expect(lu.lignes[1]!.libelle).toBe("REMISE CHEQUE CLIENT");
    expect(lu.compteBancaire).toBe("BJ5306101001000012345678901");
    expect(lu.soldeDeFin).toBe(xof("56315000"));
    expect(lu.soldeDOuverture).toBeNull();
  });

  it("refuse un OFX sans opération", () => {
    expect(() => lire(`OFXHEADER:100\n<OFX>\n<SIGNONMSGSRSV1><SONRS>\n</OFX>\n`, "vide.ofx")).toThrow(
      /aucune opération/i
    );
  });
});

describe("lecture d'un CAMT.053", () => {
  it("lit les entrées, le sens, les soldes d'ouverture et de clôture, l'IBAN et la devise", () => {
    const lu = lire(CAMT_053, "camt053.xml");

    expect(lu.format).toBe("camt053");
    expect(lu.lignes).toHaveLength(3);
    expect(lu.lignes.map((ligne) => ligne.montant)).toEqual([
      -xof("1170000"),
      xof("2500000"),
      -xof("15000")
    ]);
    expect(lu.lignes[0]!.date).toBe("2026-04-02" as DateCivile);
    expect(lu.lignes[0]!.libelle).toBe("VIREMENT EMIS FRS PORT AUTONOME");
    expect(lu.lignes[0]!.reference).toBe("RG-2026-004");
    // Une entité XML est rendue à son caractère, pas à son code.
    expect(lu.lignes[1]!.libelle).toBe("REMISE CHEQUE CLIENT & SOGEMA");
    expect(lu.lignes[1]!.reference).toBe("100234");
    // Une entrée sans détail de transaction garde son information additionnelle.
    expect(lu.lignes[2]!.libelle).toBe("FRAIS DE TENUE DE COMPTE");
    expect(lu.soldeDOuverture).toBe(xof("55000000"));
    expect(lu.soldeDeFin).toBe(xof("56315000"));
    expect(lu.compteBancaire).toBe("BJ5306101001000012345678901");
    expect(lu.deviseDuFichier).toBe("XOF");
  });

  it("refuse une entrée dont le sens n'est ni CRDT ni DBIT", () => {
    const casse = CAMT_053.replace("<CdtDbtInd>DBIT</CdtDbtInd>", "<CdtDbtInd>XX</CdtDbtInd>");
    expect(() => lire(casse, "camt053.xml")).toThrow(/ni CRDT ni DBIT/i);
  });

  it("refuse un CAMT sans entrée", () => {
    expect(() =>
      lire(
        `<?xml version="1.0"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02"><BkToCstmrStmt><Stmt><Id>1</Id></Stmt></BkToCstmrStmt></Document>`,
        "camt053.xml"
      )
    ).toThrow(/aucune entrée <Ntry>/i);
  });
});

/* ------------------------------------------------------------------ */
/* De la lecture au relevé                                             */
/* ------------------------------------------------------------------ */

describe("la demande de relevé produite par une lecture", () => {
  it("borne le relevé sur les dates lues et nomme le relevé quand rien n'est dit", () => {
    const lu = lire(CSV_FRANCAIS, "boa-2026-04.csv");
    const demande = demandeDeReleveDepuisImport(lu, { compte: "521100", soldeDOuverture: lu.soldeDOuverture! });

    expect(demande.compte).toBe("521100");
    expect(demande.dateDebut).toBe("2026-04-02" as DateCivile);
    expect(demande.dateFin).toBe("2026-04-30" as DateCivile);
    expect(demande.soldeDOuverture).toBe(xof("55000000"));
    expect(demande.lignes).toHaveLength(4);
    expect(demande.libelle).toMatch(/^Relevé importé/i);
    // Une opération sans référence garde un libellé, et une ligne sans libellé en reçoit un daté.
    expect(demande.lignes.every((ligne) => ligne.libelle.trim() !== "")).toBe(true);
  });

  it("refuse d'importer sans solde d'ouverture quand le fichier n'en porte pas", () => {
    const lu = lire(OFX_SGML, "releve.ofx");
    expect(() => demandeDeReleveDepuisImport(lu, { compte: "521100" })).toThrow(
      /ne porte pas de solde d'ouverture/i
    );
  });

  it("refuse de tronquer un relevé : une opération hors de la période demandée arrête l'import", () => {
    const lu = lire(CSV_FRANCAIS, "boa-2026-04.csv");
    expect(() =>
      demandeDeReleveDepuisImport(lu, {
        compte: "521100",
        du: "2026-04-05" as DateCivile,
        au: "2026-04-30" as DateCivile,
        soldeDOuverture: xof("55000000")
      })
    ).toThrow(/hors de la période demandée/i);
  });

  it("reconnaît un doublon à la date, la référence et le montant, pas au libellé", () => {
    const cle = cleDeDoublon({
      date: "2026-04-02" as DateCivile,
      reference: "rg-2026-004",
      montant: -xof("1170000")
    });
    expect(
      cleDeDoublon({
        date: "2026-04-02" as DateCivile,
        reference: "RG-2026-004",
        montant: -xof("1170000")
      })
    ).toBe(cle);
    expect(
      cleDeDoublon({
        date: "2026-04-03" as DateCivile,
        reference: "RG-2026-004",
        montant: -xof("1170000")
      })
    ).not.toBe(cle);
  });
});

/* ------------------------------------------------------------------ */
/* Le service : l'import écrit, et n'écrit que ce qu'il faut           */
/* ------------------------------------------------------------------ */

describe("l'import par le service", () => {
  it("crée un relevé, garde sa provenance et la trace dans l'audit", async () => {
    const resultat = await service.importerReleve({
      compte: "521100",
      texte: CSV_FRANCAIS,
      nomFichier: "boa-2026-04.csv"
    });

    expect(resultat.releve.id).toBe("RELEVE-521100-2");
    expect(resultat.releve.lignes).toHaveLength(4);
    expect(resultat.releve.soldeDOuverture).toBe(xof("55000000"));
    expect(resultat.releve.source?.format).toBe("csv");
    expect(resultat.releve.source?.nomFichier).toBe("boa-2026-04.csv");
    expect(resultat.releve.source?.doublonsEcartes).toBe(0);
    expect(resultat.doublons).toEqual([]);
    expect(resultat.importe.lignes).toHaveLength(4);

    const audit = await service.pisteAudit();
    const trace = audit.find((evenement) => evenement.entiteIdentifiant === resultat.releve.id);
    expect(trace?.action).toBe("Relevé importé");
    expect(trace?.detail).toMatch(/boa-2026-04\.csv/i);
  });

  it("n'écrit rien quand le fichier est illisible", async () => {
    const avant = (await service.releves()).length;
    await expect(
      service.importerReleve({ compte: "521100", texte: `Date;Montant\n05/04/2026;illisible\n`, nomFichier: "x.csv" })
    ).rejects.toThrow(/n'est pas un montant/i);
    expect(await service.releves()).toHaveLength(avant);
  });

  it("écarte les opérations déjà importées et refuse un fichier entièrement connu", async () => {
    await service.importerReleve({ compte: "521100", texte: CSV_FRANCAIS, nomFichier: "boa-2026-04.csv" });

    // Le même fichier : rien n'est repris, et l'utilisateur l'apprend.
    await expect(
      service.importerReleve({ compte: "521100", texte: CSV_FRANCAIS, nomFichier: "boa-2026-04.csv" })
    ).rejects.toThrow(/figurent déjà dans un relevé du compte 521100/i);

    // Un fichier qui reprend une ligne connue et en apporte une nouvelle : seule la nouvelle entre.
    const suite = `Date opération;Libellé;Référence;Montant
02/04/2026;VIREMENT EMIS FRS PORT AUTONOME;RG-2026-004;-1 170 000
20/04/2026;PRELEVEMENT CNSS;CNSS-04;-84 000
`;
    const resultat = await service.importerReleve({
      compte: "521100",
      texte: suite,
      nomFichier: "suite.csv",
      // Le fichier ne porte pas de colonne de solde : l'ouverture est dite, elle n'est pas inventée.
      soldeDOuverture: "56307500"
    });
    expect(resultat.releve.lignes).toHaveLength(1);
    expect(resultat.releve.lignes[0]!.reference).toBe("CNSS-04");
    expect(resultat.doublons).toHaveLength(1);
    expect(resultat.releve.source?.doublonsEcartes).toBe(1);
    expect((await service.releves()).length).toBe(3);
  });

  it("donne à l'état de rapprochement un relevé importé comme un relevé saisi", async () => {
    const resultat = await service.importerReleve({
      compte: "521100",
      texte: CSV_FRANCAIS,
      nomFichier: "boa-2026-04.csv"
    });
    const etat = await service.etatDeRapprochement(resultat.releve.id);

    expect(etat.soldeDuReleve).toBe(xof("56307500"));
    // Le compte, lui, n'a pas bougé : un relevé ne comptabilise rien.
    expect(etat.soldeComptable).toBe(xof("55000000"));
    expect(etat.lignesNonPointees).toHaveLength(4);
    expect(etat.pointes).toHaveLength(0);
  });

  it("conserve la provenance d'un relevé importé dans une sauvegarde", async () => {
    await service.importerReleve({ compte: "521100", texte: CAMT_053, nomFichier: "camt053.xml" });

    const brut = JSON.parse(JSON.stringify(serialiserEtat(await service.lire()))) as ReturnType<
      typeof serialiserEtat
    >;
    const restaure = deserialiserEtat(brut);
    const releve = restaure.releves.find((item) => item.source !== undefined)!;

    expect(releve.source?.format).toBe("camt053");
    expect(releve.source?.compteBancaire).toBe("BJ5306101001000012345678901");
    expect(releve.source?.deviseDuFichier).toBe("XOF");
    expect(releve.lignes.map((ligne) => ligne.montant)).toEqual([
      -xof("1170000"),
      xof("2500000"),
      -xof("15000")
    ]);
  });

  it("accepte un solde d'ouverture saisi, qui prime sur celui du fichier", async () => {
    const resultat = await service.importerReleve({
      compte: "521100",
      texte: CSV_FRANCAIS,
      nomFichier: "boa-2026-04.csv",
      soldeDOuverture: "54000000"
    });
    expect(resultat.releve.soldeDOuverture).toBe(xof("54000000"));
  });

  it("refuse un relevé importé sur un compte qui n'est pas de trésorerie", async () => {
    await expect(
      service.importerReleve({ compte: "401100", texte: CSV_FRANCAIS, nomFichier: "boa.csv" })
    ).rejects.toThrow(/pas un compte de trésorerie/i);
  });
});

/* ------------------------------------------------------------------ */
/* Le relevé d'exemple                                                 */
/* ------------------------------------------------------------------ */

describe("le relevé d'exemple", () => {
  it("se relit exactement : mêmes dates, mêmes références, mêmes montants au sens de la banque", async () => {
    // Un règlement passé en banque en avril : le grand livre le connaît, l'exemple le rejoue.
    await posterLot(service, {
      journalCode: "BQ",
      date: "2026-04-02",
      piece: "RG-2026-004",
      libelle: "Règlement fournisseur PORT AUTONOME",
      lignes: [
        { compte: "401100-FOU01", libelle: "Règlement fournisseur", debit: "1170000" },
        { compte: "521100", libelle: "Banque — règlement fournisseur", credit: "1170000" }
      ],
      contrepartie: ""
    });
    const etat = await service.lire();

    const csv = exempleDeReleveCsv({
      compte: "521100",
      mouvements: etat.mouvements,
      du: "2026-04-01" as DateCivile,
      au: "2026-04-30" as DateCivile,
      soldeDOuverture: xof("55000000"),
      devise,
      // Ce que seule la banque connaît : des frais que la comptabilité n'a pas passés.
      separees: [
        {
          date: "2026-04-10" as DateCivile,
          libelle: "FRAIS DE TENUE DE COMPTE",
          reference: "FRAIS-04",
          montant: -xof("15000")
        }
      ]
    });

    const lu = lire(csv, "exemple.csv");
    expect(lu.lignes).toHaveLength(2);
    expect(lu.lignes[0]!.date).toBe("2026-04-02" as DateCivile);
    expect(lu.lignes[0]!.reference).toBe("RG-2026-004");
    // Un crédit du compte de trésorerie est une sortie d'argent : négatif au sens de la banque.
    expect(lu.lignes[0]!.montant).toBe(-xof("1170000"));
    expect(lu.lignes[1]!.reference).toBe("FRAIS-04");
    expect(lu.lignes[1]!.montant).toBe(-xof("15000"));
    expect(lu.soldeDOuverture).toBe(xof("55000000"));
    expect(lu.soldeDeFin).toBe(xof("53815000"));

    // Et l'exemple s'importe réellement : le rapprochement montre alors les frais à expliquer.
    const resultat = await service.importerReleve({
      compte: "521100",
      texte: csv,
      nomFichier: "exemple.csv",
      libelle: "Relevé d'exemple — avril 2026"
    });
    const rapprochement = await service.etatDeRapprochement(resultat.releve.id);
    expect(resultat.releve.libelle).toBe("Relevé d'exemple — avril 2026");
    expect(rapprochement.soldeDuReleve).toBe(xof("53815000"));
    expect(rapprochement.soldeComptable).toBe(xof("53830000"));
    expect(rapprochement.ecart).toBe(xof("15000"));
    // L'écart est entièrement composé : les frais figurent au relevé et pas au grand livre, la ligne
    // non pointée l'explique. Le rapprochement est conforme — mais il reste à comptabiliser les frais.
    expect(rapprochement.ecartRestant).toBe(ZERO);
    expect(rapprochement.conforme).toBe(true);
    expect(rapprochement.lignesNonPointees.map((ligne) => ligne.reference)).toContain("FRAIS-04");
  });

  it("ne retient que les mouvements du compte et de la période demandés", async () => {
    const etat = await service.lire();
    const csv = exempleDeReleveCsv({
      compte: "521100",
      mouvements: etat.mouvements,
      du: "2026-05-01" as DateCivile,
      au: "2026-05-31" as DateCivile,
      soldeDOuverture: ZERO,
      devise
    });
    // L'à-nouveau est au 1er janvier : hors de la fenêtre, il n'apparaît pas.
    expect(csv).not.toMatch(/solde d'ouverture/i);
    expect(csv).toMatch(/^Date opération;/m);
  });
});
