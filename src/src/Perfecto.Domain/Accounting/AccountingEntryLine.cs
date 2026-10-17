using Perfecto.Domain.Common;

namespace Perfecto.Domain.Accounting;

public sealed class AccountingEntryLine
{
    private AccountingEntryLine()
    {
    }

    internal AccountingEntryLine(string accountCode, string label, decimal debit, decimal credit)
    {
        AccountCode = string.IsNullOrWhiteSpace(accountCode)
            ? throw new DomainRuleException("Le compte est obligatoire.")
            : accountCode.Trim();
        Label = string.IsNullOrWhiteSpace(label)
            ? throw new DomainRuleException("Le libellé de ligne est obligatoire.")
            : label.Trim();

        if (debit < 0 || credit < 0)
        {
            throw new DomainRuleException("Les montants ne peuvent pas être négatifs.");
        }

        if ((debit == 0 && credit == 0) || (debit > 0 && credit > 0))
        {
            throw new DomainRuleException("Une ligne doit porter un débit ou un crédit, exclusivement.");
        }

        Id = Guid.NewGuid();
        Debit = decimal.Round(debit, 2, MidpointRounding.ToEven);
        Credit = decimal.Round(credit, 2, MidpointRounding.ToEven);
    }

    public Guid Id { get; private set; }
    public Guid AccountingEntryId { get; private set; }
    public string AccountCode { get; private set; } = string.Empty;
    public string Label { get; private set; } = string.Empty;
    public decimal Debit { get; private set; }
    public decimal Credit { get; private set; }
}
