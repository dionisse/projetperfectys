using Microsoft.EntityFrameworkCore;
using Perfecto.Domain.Accounting;
using Perfecto.Domain.Auditing;
using Perfecto.Domain.Organizations;

namespace Perfecto.Infrastructure.Persistence;

public sealed class PerfectoDbContext(DbContextOptions<PerfectoDbContext> options) : DbContext(options)
{
    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<FiscalYear> FiscalYears => Set<FiscalYear>();
    public DbSet<AccountingEntry> AccountingEntries => Set<AccountingEntry>();
    public DbSet<AccountingEntryLine> AccountingEntryLines => Set<AccountingEntryLine>();
    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();
    internal DbSet<OutboxRecord> OutboxRecords => Set<OutboxRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Organization>(entity =>
        {
            entity.ToTable("organizations");
            entity.HasKey(item => item.Id);
            entity.HasIndex(item => item.Code).IsUnique();
            entity.Property(item => item.Code).HasMaxLength(12);
            entity.Property(item => item.Name).HasMaxLength(200);
            entity.Property(item => item.TaxIdentifier).HasMaxLength(80);
            entity.Property(item => item.BaseCurrency).HasMaxLength(3);
        });

        modelBuilder.Entity<FiscalYear>(entity =>
        {
            entity.ToTable("fiscal_years");
            entity.HasKey(item => item.Id);
            entity.HasIndex(item => new { item.OrganizationId, item.Label }).IsUnique();
            entity.Property(item => item.Label).HasMaxLength(80);
            entity.Property(item => item.AccountingProfileCode).HasMaxLength(30);
            entity.Property(item => item.Status).HasConversion<string>().HasMaxLength(20);
        });

        modelBuilder.Entity<AccountingEntry>(entity =>
        {
            entity.ToTable("accounting_entries");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.JournalCode).HasMaxLength(12);
            entity.Property(item => item.Reference).HasMaxLength(80);
            entity.Property(item => item.Status).HasConversion<string>().HasMaxLength(20);
            entity.HasMany(item => item.Lines)
                .WithOne()
                .HasForeignKey(item => item.AccountingEntryId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AccountingEntryLine>(entity =>
        {
            entity.ToTable("accounting_entry_lines");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.AccountCode).HasMaxLength(30);
            entity.Property(item => item.Label).HasMaxLength(240);
            entity.Property(item => item.Debit).HasPrecision(18, 2);
            entity.Property(item => item.Credit).HasPrecision(18, 2);
        });

        modelBuilder.Entity<AuditEvent>(entity =>
        {
            entity.ToTable("audit_events");
            entity.HasKey(item => item.Id);
            entity.HasIndex(item => new { item.OrganizationId, item.OccurredAt });
            entity.Property(item => item.Actor).HasMaxLength(120);
            entity.Property(item => item.Action).HasMaxLength(80);
            entity.Property(item => item.EntityType).HasMaxLength(120);
            entity.Property(item => item.EntityId).HasMaxLength(120);
            entity.Property(item => item.Details).HasMaxLength(2_000);
        });

        modelBuilder.Entity<OutboxRecord>(entity =>
        {
            entity.ToTable("sync_outbox");
            entity.HasKey(item => item.Id);
            entity.HasIndex(item => new { item.CompletedAt, item.CreatedAt });
            entity.Property(item => item.OperationType).HasMaxLength(120);
            entity.Property(item => item.Payload).HasColumnType("TEXT");
        });
    }
}
