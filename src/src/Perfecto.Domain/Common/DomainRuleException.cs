namespace Perfecto.Domain.Common;

public sealed class DomainRuleException(string message) : InvalidOperationException(message);
