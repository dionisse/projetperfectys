using Perfecto.Domain.Common;

namespace Perfecto.Domain.Auditing;

public sealed class AuditEvent
{
    private AuditEvent()
    {
    }

    private AuditEvent(
        Guid organizationId,
        string actor,
        string action,
        string entityType,
        string entityId,
        DateTimeOffset occurredAt,
        string details)
    {
        if (organizationId == Guid.Empty)
        {
            throw new DomainRuleException("L'organisation est obligatoire pour tracer une opération.");
        }

        Id = Guid.NewGuid();
        OrganizationId = organizationId;
        Actor = Require(actor, "L'acteur est obligatoire.");
        Action = Require(action, "L'action est obligatoire.");
        EntityType = Require(entityType, "Le type d'entité est obligatoire.");
        EntityId = Require(entityId, "L'identifiant de l'entité est obligatoire.");
        OccurredAt = occurredAt;
        Details = details?.Trim() ?? string.Empty;
    }

    public Guid Id { get; private set; }
    public Guid OrganizationId { get; private set; }
    public string Actor { get; private set; } = string.Empty;
    public string Action { get; private set; } = string.Empty;
    public string EntityType { get; private set; } = string.Empty;
    public string EntityId { get; private set; } = string.Empty;
    public DateTimeOffset OccurredAt { get; private set; }
    public string Details { get; private set; } = string.Empty;

    public static AuditEvent Record(
        Guid organizationId,
        string actor,
        string action,
        string entityType,
        string entityId,
        DateTimeOffset occurredAt,
        string details = "") =>
        new(organizationId, actor, action, entityType, entityId, occurredAt, details);

    private static string Require(string value, string message)
    {
        var normalized = value?.Trim() ?? string.Empty;
        return normalized.Length == 0 ? throw new DomainRuleException(message) : normalized;
    }
}
