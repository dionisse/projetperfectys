using Perfecto.Contracts.Accounting;

namespace Perfecto.Application.Accounting;

public static class SyscohadaStarterCatalog
{
    public static IReadOnlyList<GeneralAccountDto> Accounts { get; } =
    [
        new("101000", "Capital social", "1", "Capitaux", true, false, true),
        new("111000", "Report à nouveau", "1", "Capitaux", true, false, true),
        new("201000", "Frais d'établissement", "2", "Immobilisation", true, false, true),
        new("231000", "Bâtiments", "2", "Immobilisation", true, false, true),
        new("244000", "Matériel et mobilier", "2", "Immobilisation", true, false, true),
        new("311000", "Marchandises", "3", "Stock", true, false, true),
        new("401100", "Fournisseurs", "4", "Tiers", true, true, true),
        new("411100", "Clients", "4", "Tiers", true, true, true),
        new("443100", "TVA facturée", "4", "État", true, false, true),
        new("445200", "TVA récupérable sur achats", "4", "État", true, false, true),
        new("521100", "Banque locale", "5", "Trésorerie", true, false, true),
        new("571100", "Caisse siège social", "5", "Trésorerie", true, false, true),
        new("601100", "Achats de marchandises", "6", "Charge", true, false, true),
        new("661100", "Rémunérations directes versées au personnel", "6", "Charge", true, false, true),
        new("664100", "Charges sociales sur rémunérations", "6", "Charge", true, false, true),
        new("701100", "Ventes de marchandises", "7", "Produit", true, false, true),
        new("706100", "Services vendus", "7", "Produit", true, false, true),
        new("771000", "Intérêts de prêts", "7", "Produit financier", true, false, true)
    ];

    public static IReadOnlyList<AccountingJournalDto> Journals { get; } =
    [
        new("ACH", "Journal des achats", "Achats", null, true),
        new("VTE", "Journal des ventes", "Ventes", null, true),
        new("BQ1", "Banque principale", "Banque", "521100", true),
        new("CAI", "Caisse siège", "Caisse", "571100", true),
        new("OD", "Opérations diverses", "Opérations diverses", null, true),
        new("AN", "À-nouveaux", "À-nouveaux", null, true)
    ];
}
