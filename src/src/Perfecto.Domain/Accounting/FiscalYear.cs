using Perfecto.Domain.Common;

namespace Perfecto.Domain.Accounting;

public enum FiscalYearStatus
{
    Draft,
    Open,
    Closed
}

public sealed class FiscalYear
{
    private FiscalYear()
    {
    }

    private FiscalYear(
        Guid id,
        Guid organizationId,
        string label,
        DateOnly startsOn,
        DateOnly endsOn,
        string accountingProfileCode,
        DateTimeOffset createdAt)
    {
        if (organizationId == Guid.Empty)
        {
            throw new DomainRuleException("L'organisation est obligatoire.");
        }

        if (endsOn < startsOn)
        {
            throw new DomainRuleException("La date de fin doit être postérieure à la date de début.");
        }

        Id = id;
        OrganizationId = organizationId;
        Label = string.IsNullOrWhiteSpace(label)
            ? throw new DomainRuleException("Le libellé de l'exercice est obligatoire.")
            : label.Trim();
        StartsOn = startsOn;
        EndsOn = endsOn;
        AccountingProfileCode = string.IsNullOrWhiteSpace(accountingProfileCode)
            ? throw new DomainRuleException("Le référentiel comptable est obligatoire.")
            : accountingProfileCode.Trim().ToUpperInvariant();
        Status = FiscalYearStatus.Draft;
        CreatedAt = createdAt;
    }

    public Guid Id { get; private set; }
    public Guid OrganizationId { get; private set; }
    public string Label { get; private set; } = string.Empty;
    public DateOnly StartsOn { get; private set; }
    public DateOnly EndsOn { get; private set; }
    public string AccountingProfileCode { get; private set; } = string.Empty;
    public FiscalYearStatus Status { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? OpenedAt { get; private set; }
    public DateTimeOffset? ClosedAt { get; private set; }

    public static FiscalYear Create(
        Guid organizationId,
        string label,
        DateOnly startsOn,
        DateOnly endsOn,
        string accountingProfileCode,
        DateTimeOffset now) =>
        new(Guid.NewGuid(), organizationId, label, startsOn, endsOn, accountingProfileCode, now);

    public void Open(DateTimeOffset now)
    {
        if (Status != FiscalYearStatus.Draft)
        {
            throw new DomainRuleException("Seul un exercice en préparation peut être ouvert.");
        }

        Status = FiscalYearStatus.Open;
        OpenedAt = now;
    }

    public void Close(DateTimeOffset now)
    {
        if (Status != FiscalYearStatus.Open)
        {
            throw new DomainRuleException("Seul un exercice ouvert peut être clôturé.");
        }

        Status = FiscalYearStatus.Closed;
        ClosedAt = now;
    }
}
