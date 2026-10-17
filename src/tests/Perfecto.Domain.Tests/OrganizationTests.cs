using Perfecto.Domain.Common;
using Perfecto.Domain.Organizations;

namespace Perfecto.Domain.Tests;

public sealed class OrganizationTests
{
    [Fact]
    public void Create_NormalizesCodeAndCurrency()
    {
        var organization = Organization.Create(" demo ", "Société Test", "xof", DateTimeOffset.UtcNow);

        Assert.Equal("DEMO", organization.Code);
        Assert.Equal("XOF", organization.BaseCurrency);
        Assert.True(organization.IsActive);
    }

    [Theory]
    [InlineData("")]
    [InlineData("A")]
    [InlineData("CODE-BEAUCOUP-TROP-LONG")]
    public void Create_RejectsInvalidCode(string code)
    {
        Assert.Throws<DomainRuleException>(() =>
            Organization.Create(code, "Société Test", "XOF", DateTimeOffset.UtcNow));
    }
}
