using Perfecto.Application.Accounting;
using Perfecto.Contracts.Accounting;
using Perfecto.Domain.Common;

namespace Perfecto.Domain.Tests;

public sealed class AccountingServiceTests
{
    [Fact]
    public async Task StarterSnapshot_IsBalancedAndContainsExpectedCatalogs()
    {
        var service = new DemoAccountingService();

        var snapshot = await service.GetSnapshotAsync();

        Assert.Equal(18, snapshot.AccountCount);
        Assert.Equal(6, snapshot.JournalCount);
        Assert.Equal(3, snapshot.PostedEntryCount);
        Assert.Equal(1, snapshot.DraftEntryCount);
        Assert.Equal(snapshot.TotalDebitMovements, snapshot.TotalCreditMovements);
        Assert.NotEmpty(snapshot.TrialBalance);
    }

    [Fact]
    public async Task SaveEntry_PostsBalancedEntryAndUpdatesTrialBalance()
    {
        var service = new DemoAccountingService();
        var before = await service.GetSnapshotAsync();
        var request = BalancedRequest("OD-TEST-001");
        request.PostImmediately = true;

        var saved = await service.SaveEntryAsync(request);
        var after = await service.GetSnapshotAsync();

        Assert.Equal("Validée", saved.Status);
        Assert.Equal(100_000m, saved.TotalDebit);
        Assert.Equal(before.PostedEntryCount + 1, after.PostedEntryCount);
        Assert.Equal(before.TotalDebitMovements + 100_000m, after.TotalDebitMovements);
        Assert.Equal(after.TotalDebitMovements, after.TotalCreditMovements);
    }

    [Fact]
    public async Task SaveEntry_AllowsUnbalancedDraftButRejectsItsPosting()
    {
        var service = new DemoAccountingService();
        var request = BalancedRequest("OD-TEST-002");
        request.Lines[1].Credit = 90_000m;

        var draft = await service.SaveEntryAsync(request);
        Assert.Equal("Brouillon", draft.Status);

        request.Reference = "OD-TEST-003";
        request.PostImmediately = true;
        await Assert.ThrowsAsync<DomainRuleException>(() => service.SaveEntryAsync(request));
    }

    [Fact]
    public async Task SaveEntry_RejectsDuplicateReference()
    {
        var service = new DemoAccountingService();
        var request = BalancedRequest("OD-UNIQUE");
        await service.SaveEntryAsync(request);

        await Assert.ThrowsAsync<DomainRuleException>(() => service.SaveEntryAsync(request));
    }

    [Fact]
    public async Task CreateAccount_AddsSearchableAccountAndRejectsDuplicate()
    {
        var service = new DemoAccountingService();
        var request = new CreateGeneralAccountRequest
        {
            Code = "601200",
            Label = "Achats de matières premières",
            AccountType = "Charge"
        };

        var account = await service.CreateAccountAsync(request);
        var results = await service.GetAccountsAsync("matières");

        Assert.Equal("6", account.AccountClass);
        Assert.Single(results);
        await Assert.ThrowsAsync<DomainRuleException>(() => service.CreateAccountAsync(request));
    }

    [Fact]
    public async Task Reports_UsePostedEntriesOnlyAndKeepRunningBalances()
    {
        var service = new DemoAccountingService();

        var journal = await service.GetJournalLinesAsync();
        var ledger = await service.GetGeneralLedgerAsync();

        Assert.Equal(8, journal.Count);
        Assert.DoesNotContain(journal, line => line.Reference == "OD-2026-001");
        var client = Assert.Single(ledger, account => account.AccountCode == "411100");
        Assert.Equal(1_180_000m, client.TotalDebit);
        Assert.Equal(1_180_000m, client.TotalCredit);
        Assert.Equal(0m, client.ClosingBalance);
    }

    [Fact]
    public async Task PostEntry_ChangesBalancedDraftToImmutablePostedEntry()
    {
        var service = new DemoAccountingService();
        var draft = (await service.GetEntriesAsync()).Single(entry => entry.Reference == "OD-2026-001");

        var posted = await service.PostEntryAsync(draft.Id);

        Assert.Equal("Validée", posted.Status);
        Assert.NotNull(posted.PostedAt);
        Assert.Equal(4, (await service.GetSnapshotAsync()).PostedEntryCount);
    }

    [Fact]
    public async Task ClosedPeriod_RejectsNewEntryUntilReopened()
    {
        var service = new DemoAccountingService();
        await service.SetPeriodClosedAsync(3, true);
        var request = BalancedRequest("OD-CLOSED-001");

        await Assert.ThrowsAsync<DomainRuleException>(() => service.SaveEntryAsync(request));

        await service.SetPeriodClosedAsync(3, false);
        var saved = await service.SaveEntryAsync(request);
        Assert.Equal("Brouillon", saved.Status);
    }

    private static CreateAccountingEntryRequest BalancedRequest(string reference) => new()
    {
        JournalCode = "OD",
        EntryDate = new DateOnly(2026, 3, 1),
        Reference = reference,
        Description = "Test de saisie",
        Lines =
        [
            new AccountingEntryLineInput { AccountCode = "601100", Label = "Charge", Debit = 100_000m },
            new AccountingEntryLineInput { AccountCode = "401100", Label = "Fournisseur", Credit = 100_000m }
        ]
    };
}
