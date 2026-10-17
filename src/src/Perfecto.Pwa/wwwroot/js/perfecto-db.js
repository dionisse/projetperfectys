(() => {
    const databaseName = "perfecto-next";
    const databaseVersion = 2;
    const stores = ["accounts", "journals", "entries", "periods"];

    const starterAccounts = [
        ["101000", "Capital social", "1", "Capitaux", false],
        ["111000", "Report à nouveau", "1", "Capitaux", false],
        ["201000", "Frais d'établissement", "2", "Immobilisation", false],
        ["231000", "Bâtiments", "2", "Immobilisation", false],
        ["244000", "Matériel et mobilier", "2", "Immobilisation", false],
        ["311000", "Marchandises", "3", "Stock", false],
        ["401100", "Fournisseurs", "4", "Tiers", true],
        ["411100", "Clients", "4", "Tiers", true],
        ["443100", "TVA facturée", "4", "État", false],
        ["445200", "TVA récupérable sur achats", "4", "État", false],
        ["521100", "Banque locale", "5", "Trésorerie", false],
        ["571100", "Caisse siège social", "5", "Trésorerie", false],
        ["601100", "Achats de marchandises", "6", "Charge", false],
        ["661100", "Rémunérations directes versées au personnel", "6", "Charge", false],
        ["664100", "Charges sociales sur rémunérations", "6", "Charge", false],
        ["701100", "Ventes de marchandises", "7", "Produit", false],
        ["706100", "Services vendus", "7", "Produit", false],
        ["771000", "Intérêts de prêts", "7", "Produit financier", false]
    ].map(item => ({
        code: item[0], label: item[1], accountClass: item[2], accountType: item[3],
        allowsPosting: true, requiresThirdParty: item[4], isActive: true
    }));

    const starterJournals = [
        ["ACH", "Journal des achats", "Achats", null],
        ["VTE", "Journal des ventes", "Ventes", null],
        ["BQ1", "Banque principale", "Banque", "521100"],
        ["CAI", "Caisse siège", "Caisse", "571100"],
        ["OD", "Opérations diverses", "Opérations diverses", null],
        ["AN", "À-nouveaux", "À-nouveaux", null]
    ].map(item => ({ code: item[0], label: item[1], journalType: item[2], counterpartAccount: item[3], isActive: true }));

    const frenchMonths = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
    const starterPeriods = frenchMonths.map((label, index) => ({
        year: 2026,
        month: index + 1,
        label: `${label} 2026`,
        isClosed: false,
        closedAt: null
    }));

    const starterEntries = [
        createEntry("VTE", "2026-01-08", "FV-2026-001", "Vente au comptant", "Validée", [
            ["411100", "Clients", "Client comptant", 1180000, 0],
            ["701100", "Ventes de marchandises", "Vente de marchandises", 0, 1000000],
            ["443100", "TVA facturée", "TVA facturée", 0, 180000]
        ]),
        createEntry("ACH", "2026-01-12", "FA-2026-004", "Approvisionnement", "Validée", [
            ["601100", "Achats de marchandises", "Achat de marchandises", 400000, 0],
            ["445200", "TVA récupérable sur achats", "TVA récupérable", 72000, 0],
            ["401100", "Fournisseurs", "Fournisseur", 0, 472000]
        ]),
        createEntry("BQ1", "2026-01-18", "BQ-2026-003", "Règlement client", "Validée", [
            ["521100", "Banque locale", "Encaissement bancaire", 1180000, 0],
            ["411100", "Clients", "Règlement client", 0, 1180000]
        ]),
        createEntry("OD", "2026-02-01", "OD-2026-001", "Brouillon d'ajustement", "Brouillon", [
            ["601100", "Achats de marchandises", "Charge à régulariser", 25000, 0],
            ["401100", "Fournisseurs", "Fournisseur à confirmer", 0, 25000]
        ])
    ];

    function createEntry(journalCode, entryDate, reference, description, status, lines) {
        const now = new Date().toISOString();
        return {
            id: crypto.randomUUID(), journalCode, entryDate, reference, description, status,
            totalDebit: lines.reduce((sum, line) => sum + line[3], 0),
            totalCredit: lines.reduce((sum, line) => sum + line[4], 0),
            createdAt: now,
            postedAt: status === "Validée" ? now : null,
            lines: lines.map(line => ({
                id: crypto.randomUUID(), accountCode: line[0], accountLabel: line[1],
                label: line[2], debit: line[3], credit: line[4]
            }))
        };
    }

    function openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(databaseName, databaseVersion);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains("accounts")) db.createObjectStore("accounts", { keyPath: "code" });
                if (!db.objectStoreNames.contains("journals")) db.createObjectStore("journals", { keyPath: "code" });
                if (!db.objectStoreNames.contains("entries")) db.createObjectStore("entries", { keyPath: "id" });
                if (!db.objectStoreNames.contains("periods")) db.createObjectStore("periods", { keyPath: "month" });
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    function transaction(storeName, mode, action) {
        return openDatabase().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, mode);
            const store = tx.objectStore(storeName);
            const request = action(store);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            tx.oncomplete = () => db.close();
            tx.onerror = () => reject(tx.error);
        }));
    }

    async function seedStore(storeName, items) {
        const existing = await transaction(storeName, "readonly", store => store.count());
        if (existing > 0) return;
        const db = await openDatabase();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, "readwrite");
            const store = tx.objectStore(storeName);
            items.forEach(item => store.put(item));
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
        db.close();
    }

    window.perfectoDb = {
        initialize: async () => {
            const db = await openDatabase();
            db.close();
            await seedStore("accounts", starterAccounts);
            await seedStore("journals", starterJournals);
            await seedStore("entries", starterEntries);
            await seedStore("periods", starterPeriods);
            return true;
        },
        getAll: storeName => {
            if (!stores.includes(storeName)) throw new Error("Unknown PERFECTO store");
            return transaction(storeName, "readonly", store => store.getAll());
        },
        put: (storeName, value) => {
            if (!stores.includes(storeName)) throw new Error("Unknown PERFECTO store");
            return transaction(storeName, "readwrite", store => store.put(value));
        }
    };
})();
