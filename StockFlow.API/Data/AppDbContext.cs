using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using StockFlow.API.Models;

namespace StockFlow.API.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();
    public DbSet<Sale> Sales => Set<Sale>();
    public DbSet<SaleItem> SaleItems => Set<SaleItem>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<CashClosing> CashClosings => Set<CashClosing>();
    public DbSet<Company> Companies => Set<Company>();
    public DbSet<ProductHistory> ProductHistory => Set<ProductHistory>();

    // SQLite has no timezone-aware datetime type, so EF Core reads every DateTime back
    // as Kind=Unspecified even though every value in this app is written via
    // DateTime.UtcNow. System.Text.Json then serializes it without a "Z" suffix, and
    // the browser's `new Date(...)` treats that as local time instead of converting
    // from UTC — silently shifting every timestamp shown in the UI by the browser's
    // UTC offset. Marking the value as UTC on read (write is a no-op) fixes this for
    // every DateTime column in the database, not just the ones touched here.
    private static readonly ValueConverter<DateTime, DateTime> UtcDateTimeConverter = new(
        v => v,
        v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

    private static readonly ValueConverter<DateTime?, DateTime?> UtcNullableDateTimeConverter = new(
        v => v,
        v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v);

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                if (property.ClrType == typeof(DateTime))
                    property.SetValueConverter(UtcDateTimeConverter);
                else if (property.ClrType == typeof(DateTime?))
                    property.SetValueConverter(UtcNullableDateTimeConverter);
            }
        }

        modelBuilder.Entity<Product>()
            .HasIndex(p => p.Barcode)
            .IsUnique();

        modelBuilder.Entity<Product>()
            .HasIndex(p => p.Name);

        modelBuilder.Entity<User>()
            .HasIndex(u => u.Username)
            .IsUnique();

        modelBuilder.Entity<Product>()
            .Property(p => p.SellingPrice)
            .HasColumnType("TEXT");

        modelBuilder.Entity<Product>()
            .Property(p => p.BuyingPrice)
            .HasColumnType("TEXT");

        modelBuilder.Entity<SaleItem>()
            .Property(s => s.BasePrice)
            .HasColumnType("TEXT");

        modelBuilder.Entity<SaleItem>()
            .Property(s => s.FinalPrice)
            .HasColumnType("TEXT");

        modelBuilder.Entity<SaleItem>()
            .Property(s => s.DiscountAmount)
            .HasColumnType("TEXT");

        modelBuilder.Entity<Sale>()
            .Property(s => s.TotalAmount)
            .HasColumnType("TEXT");

        modelBuilder.Entity<Sale>()
            .Property(s => s.DiscountAmount)
            .HasColumnType("TEXT");

        modelBuilder.Entity<StockMovement>()
            .Property(m => m.Quantity)
            .HasColumnType("TEXT");

        modelBuilder.Entity<StockMovement>()
            .Property(m => m.BasePrice)
            .HasColumnType("TEXT");

        modelBuilder.Entity<StockMovement>()
            .Property(m => m.ReturnPrice)
            .HasColumnType("TEXT");

        modelBuilder.Entity<SaleItem>()
            .Property(i => i.Quantity)
            .HasColumnType("TEXT");

        modelBuilder.Entity<StockMovement>()
            .HasIndex(m => m.CreatedAt);

        modelBuilder.Entity<CashClosing>()
            .Property(c => c.ExpectedCash)
            .HasColumnType("TEXT");

        modelBuilder.Entity<CashClosing>()
            .Property(c => c.CountedCash)
            .HasColumnType("TEXT");

        modelBuilder.Entity<CashClosing>()
            .Property(c => c.Difference)
            .HasColumnType("TEXT");

        modelBuilder.Entity<CashClosing>()
            .HasIndex(c => c.CreatedAt);

        modelBuilder.Entity<Customer>()
            .HasIndex(c => c.Name);

        modelBuilder.Entity<Customer>()
            .HasIndex(c => c.PhoneNumber);

        modelBuilder.Entity<Sale>()
            .HasOne(s => s.Customer)
            .WithMany(c => c.Sales)
            .HasForeignKey(s => s.CustomerId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<StockMovement>()
            .HasOne(m => m.Customer)
            .WithMany()
            .HasForeignKey(m => m.CustomerId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<StockMovement>()
            .HasOne(m => m.Sale)
            .WithMany()
            .HasForeignKey(m => m.SaleId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<StockMovement>()
            .HasOne(m => m.Company)
            .WithMany()
            .HasForeignKey(m => m.CompanyId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Company>()
            .HasIndex(c => c.Code)
            .IsUnique();

        modelBuilder.Entity<Company>()
            .HasIndex(c => c.Name);

        modelBuilder.Entity<ProductHistory>()
            .HasIndex(h => new { h.ProductId, h.ChangedAt });

        modelBuilder.Entity<ProductHistory>()
            .HasOne(h => h.ChangedByUser)
            .WithMany()
            .HasForeignKey(h => h.ChangedByUserId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
