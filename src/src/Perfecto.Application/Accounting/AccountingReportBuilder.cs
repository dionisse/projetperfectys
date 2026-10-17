using Perfecto.Contracts.Accounting;

namespace Perfecto.Application.Accounting;

public static class AccountingReportBuilder
{
    public static IReadOnlyList<JournalLineDto> BuildJournal(IReadOnlyList<AccountingEntryDto> entries) =>
        entries
            .Where(entry => entry.Status == "Validée")
            .OrderBy(entry => entry.EntryDate)
            .ThenBy(entry => entry.JournalCode)
            .ThenBy(entry => entry.Reference)
            .SelectMany(entry => entry.Lines.Select(line => new JournalLineDto(
                entry.EntryDate,
                entry.JournalCode,
                entry.Reference,
                line.AccountCode,
                line.AccountLabel,
                line.Label,
                line.Debit,
                line.Credit)))
            .ToList();

    public static IReadOnlyList<LedgerAccountDto> BuildGeneralLedger(IReadOnlyList<AccountingEntryDto> entries)
    {
        return BuildJournal(entries)
            .GroupBy(line => new { line.AccountCode, line.AccountLabel })
            .OrderBy(group => group.Key.AccountCode)
            .Select(group =>
            {
                decimal runningBalance = 0;
                var lines = group
                    .OrderBy(line => line.EntryDate)
                    .ThenBy(line => line.Reference)
                    .Select(line =>
                    {
                        runningBalance += line.Debit - line.Credit;
                        return new LedgerLineDto(
                            line.EntryDate,
                            line.JournalCode,
                            line.Reference,
                            line.Label,
                            line.Debit,
                            line.Credit,
                            runningBalance);
                    })
                    .ToList();

                return new LedgerAccountDto(
                    group.Key.AccountCode,
                    group.Key.AccountLabel,
                    lines.Sum(line => line.Debit),
                    lines.Sum(line => line.Credit),
                    runningBalance,
                    lines);
            })
            .ToList();
    }

    public static IReadOnlyList<AccountingPeriodDto> CreateOpenPeriods(int year) =>
        Enumerable.Range(1, 12)
            .Select(month => new AccountingPeriodDto(
                year,
                month,
                new DateOnly(year, month, 1).ToString("MMMM yyyy", System.Globalization.CultureInfo.GetCultureInfo("fr-FR")),
                false,
                null))
            .ToList();
}
