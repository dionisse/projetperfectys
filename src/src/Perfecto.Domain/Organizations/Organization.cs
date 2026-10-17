using Perfecto.Domain.Common;

namespace Perfecto.Domain.Organizations;

public sealed class Organization
{
    private Organization()
    {
    }

    private Organization(Guid id, string code, string name, string baseCurrency, DateTimeOffset createdAt)
    {
        Id = id;
        Code = NormalizeCode(code);
        Name = RequireText(name, "La raison sociale est obligatoire.");
        BaseCurrency = NormalizeCurrency(baseCurrency);
        CreatedAt = createdAt;
        UpdatedAt = createdAt;
        IsActive = true;
    }

    public Guid Id { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string TaxIdentifier { get; private set; } = string.Empty;
    public string BaseCurrency { get; private set; } = "XOF";
    public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    public static Organization Create(string code, string name, string baseCurrency, DateTimeOffset now) =>
        new(Guid.NewGuid(), code, name, baseCurrency, now);

    public void UpdateIdentity(string name, string? taxIdentifier, string baseCurrency, DateTimeOffset now)
    {
        Name = RequireText(name, "La raison sociale est obligatoire.");
        TaxIdentifier = taxIdentifier?.Trim() ?? string.Empty;
        BaseCurrency = NormalizeCurrency(baseCurrency);
        UpdatedAt = now;
    }

    public void Deactivate(DateTimeOffset now)
    {
        IsActive = false;
        UpdatedAt = now;
    }

    private static string NormalizeCode(string value)
    {
        var normalized = RequireText(value, "Le code société est obligatoire.").ToUpperInvariant();
        if (normalized.Length is < 2 or > 12)
        {
            throw new DomainRuleException("Le code société doit contenir entre 2 et 12 caractères.");
        }

        return normalized;
    }

    private static string NormalizeCurrency(string value)
    {
        var normalized = RequireText(value, "La devise de base est obligatoire.").ToUpperInvariant();
        if (normalized.Length != 3)
        {
            throw new DomainRuleException("La devise doit être un code ISO de trois caractères.");
        }

        return normalized;
    }

    private static string RequireText(string value, string message)
    {
        var normalized = value?.Trim() ?? string.Empty;
        return normalized.Length == 0 ? throw new DomainRuleException(message) : normalized;
    }
}
