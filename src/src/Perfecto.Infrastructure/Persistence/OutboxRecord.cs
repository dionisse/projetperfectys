namespace Perfecto.Infrastructure.Persistence;

internal sealed class OutboxRecord
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    public string OperationType { get; set; } = string.Empty;
    public string Payload { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public int AttemptCount { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
}
