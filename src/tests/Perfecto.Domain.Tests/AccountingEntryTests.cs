using Perfecto.Domain.Accounting;
using Perfecto.Domain.Common;

namespace Perfecto.Domain.Tests;

public sealed class AccountingEntryTests
{
    [Fact]
    public void Post_AcceptsBalancedEntryAndMakesItImmutable()
    {
        var entry = AccountingEntry.Create(
            Guid.NewGuid(),
            "ACH",
            new DateOnly(2026, 1, 15),
            "FAC-001",
            DateTimeOffset.UtcNow);
        entry.AddLine("601100", "Achat de marchandises", 100_000m, 0m);
        entry.AddLine("401100", "Fournisseur", 0m, 100_000m);

        entry.Post(DateTimeOffset.UtcNow);

        Assert.Equal(AccountingEntryStatus.Posted, entry.Status);
        Assert.True(entry.IsBalanced);
        Assert.Equal(100_000m, entry.TotalDebit);
        Assert.Throws<DomainRuleException>(() =>
            entry.AddLine("445100", "Taxe", 0m, 1m));
    }

    [Fact]
    public void Post_RejectsUnbalancedEntry()
    {
        var entry = AccountingEntry.Create(
            Guid.NewGuid(),
            "OD",
            new DateOnly(2026, 2, 1),
            "OD-001",
            DateTimeOffset.UtcNow);
        entry.AddLine("601100", "Charge", 25_000m, 0m);
        entry.AddLine("401100", "Fournisseur", 0m, 20_000m);

        Assert.Throws<DomainRuleException>(() => entry.Post(DateTimeOffset.UtcNow));
        Assert.Equal(AccountingEntryStatus.Draft, entry.Status);
    }

    [Theory]
    [InlineData(100, 100)]
    [InlineData(0, 0)]
    [InlineData(-1, 0)]
    public void AddLine_RejectsInvalidDebitCreditPair(decimal debit, decimal credit)
    {
        var entry = AccountingEntry.Create(
            Guid.NewGuid(),
            "OD",
            new DateOnly(2026, 2, 1),
            "OD-002",
            DateTimeOffset.UtcNow);

        Assert.Throws<DomainRuleException>(() => entry.AddLine("601100", "Ligne", debit, credit));
    }
}
