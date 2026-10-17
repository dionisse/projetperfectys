using Perfecto.Domain.Accounting;
using Perfecto.Domain.Common;

namespace Perfecto.Domain.Tests;

public sealed class FiscalYearTests
{
    [Fact]
    public void FiscalYear_FollowsDraftOpenClosedLifecycle()
    {
        var now = DateTimeOffset.UtcNow;
        var year = FiscalYear.Create(
            Guid.NewGuid(),
            "Exercice 2026",
            new DateOnly(2026, 1, 1),
            new DateOnly(2026, 12, 31),
            "SYSCOHADA-R",
            now);

        Assert.Equal(FiscalYearStatus.Draft, year.Status);
        year.Open(now.AddMinutes(1));
        Assert.Equal(FiscalYearStatus.Open, year.Status);
        year.Close(now.AddMinutes(2));
        Assert.Equal(FiscalYearStatus.Closed, year.Status);
    }

    [Fact]
    public void FiscalYear_RejectsInvertedDates()
    {
        Assert.Throws<DomainRuleException>(() => FiscalYear.Create(
            Guid.NewGuid(),
            "Exercice invalide",
            new DateOnly(2026, 12, 31),
            new DateOnly(2026, 1, 1),
            "SYSCOHADA-R",
            DateTimeOffset.UtcNow));
    }
}
