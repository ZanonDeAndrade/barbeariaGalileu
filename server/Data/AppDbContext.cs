using BarbeariaGalileu.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace BarbeariaGalileu.Server.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public DbSet<Appointment> Appointments => Set<Appointment>();
    public DbSet<BlockedSlot> BlockedSlots => Set<BlockedSlot>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Appointment>(entity =>
        {
            entity.ToTable("Appointment");
            entity.Property(p => p.Id).HasColumnName("id");
            entity.Property(p => p.CustomerName)
                .HasColumnName("customerName")
                .HasMaxLength(120)
                .IsRequired();
            entity.Property(p => p.CustomerPhone)
                .HasColumnName("customerPhone")
                .HasMaxLength(30)
                .IsRequired();
            entity.Property(p => p.HaircutType)
                .HasColumnName("haircutType")
                .HasMaxLength(60)
                .IsRequired();
            entity.Property(p => p.Notes)
                .HasColumnName("notes")
                .HasMaxLength(280);
            entity.Property(p => p.StartTime)
                .HasColumnName("startTime")
                .HasConversion(
                    value => value,
                    value => DateTime.SpecifyKind(value, DateTimeKind.Utc));
            entity.Property(p => p.DurationMinutes)
                .HasColumnName("durationMinutes")
                .HasDefaultValue(60);
            entity.Property(p => p.CreatedAt)
                .HasColumnName("createdAt")
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasConversion(
                    value => value,
                    value => DateTime.SpecifyKind(value, DateTimeKind.Utc));
            entity.Property(p => p.UpdatedAt)
                .HasColumnName("updatedAt")
                .HasConversion(
                    value => value,
                    value => DateTime.SpecifyKind(value, DateTimeKind.Utc));
            entity.HasIndex(p => p.StartTime).IsUnique();
        });

        modelBuilder.Entity<BlockedSlot>(entity =>
        {
            entity.ToTable("BlockedSlot");
            entity.Property(p => p.Id).HasColumnName("id");
            entity.Property(p => p.StartTime)
                .HasColumnName("startTime")
                .HasConversion(
                    value => value,
                    value => DateTime.SpecifyKind(value, DateTimeKind.Utc));
            entity.Property(p => p.Reason)
                .HasColumnName("reason")
                .HasMaxLength(140);
            entity.Property(p => p.CreatedAt)
                .HasColumnName("createdAt")
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasConversion(
                    value => value,
                    value => DateTime.SpecifyKind(value, DateTimeKind.Utc));
            entity.HasIndex(p => p.StartTime).IsUnique();
        });
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        UpdateTimestamps();
        return base.SaveChangesAsync(cancellationToken);
    }

    public override int SaveChanges()
    {
        UpdateTimestamps();
        return base.SaveChanges();
    }

    private void UpdateTimestamps()
    {
        var utcNow = DateTime.UtcNow;

        foreach (var entry in ChangeTracker.Entries<Appointment>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAt = utcNow;
                entry.Entity.UpdatedAt = utcNow;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = utcNow;
            }
        }

        foreach (var entry in ChangeTracker.Entries<BlockedSlot>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAt = utcNow;
            }
        }
    }
}
