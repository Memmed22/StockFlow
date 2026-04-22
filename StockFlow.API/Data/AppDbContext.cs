using Microsoft.EntityFrameworkCore;
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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
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
    }
}
