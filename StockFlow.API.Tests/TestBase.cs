using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using StockFlow.API.Data;
using StockFlow.API.Models;

namespace StockFlow.API.Tests;

// Runs every test against a real (in-memory) SQLite database via the actual
// AppDbContext/EF Core pipeline, rather than mocks — so foreign keys, decimal
// storage, and transaction behavior match production exactly.
public abstract class SqliteInMemoryTestBase : IDisposable
{
    private readonly SqliteConnection _connection;
    protected readonly AppDbContext Db;

    protected SqliteInMemoryTestBase()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .Options;

        Db = new AppDbContext(options);
        Db.Database.EnsureCreated();
    }

    protected async Task<User> SeedUserAsync(string username = "admin", string role = "Admin")
    {
        var user = new User { Username = username, PasswordHash = "x", Role = role };
        Db.Users.Add(user);
        await Db.SaveChangesAsync();
        return user;
    }

    protected async Task<Product> SeedProductAsync(
        string name = "Widget", string barcode = "0001", decimal sellingPrice = 10m,
        decimal? buyingPrice = 5m, UnitType unitType = UnitType.Quantity)
    {
        var product = new Product
        {
            Name = name,
            Barcode = barcode,
            SellingPrice = sellingPrice,
            BuyingPrice = buyingPrice,
            UnitType = unitType,
        };
        Db.Products.Add(product);
        await Db.SaveChangesAsync();
        return product;
    }

    protected async Task<Customer> SeedCustomerAsync(string name = "Customer", string phone = "0000000000")
    {
        var customer = new Customer { Name = name, PhoneNumber = phone };
        Db.Customers.Add(customer);
        await Db.SaveChangesAsync();
        return customer;
    }

    // Adds a raw StockMovement directly, bypassing service logic — used to set up
    // an initial stock position before exercising the code under test.
    protected async Task AddMovementAsync(int productId, MovementType type, decimal quantity)
    {
        Db.StockMovements.Add(new StockMovement { ProductId = productId, Type = type, Quantity = quantity });
        await Db.SaveChangesAsync();
    }

    // Mirrors the stock formula used throughout the app (ProductService, StockService,
    // ReportService): every movement type adds to stock except Sale, which subtracts.
    protected async Task<decimal> CurrentStockAsync(int productId)
    {
        var movements = await Db.StockMovements
            .Where(m => m.ProductId == productId)
            .Select(m => new { m.Type, m.Quantity })
            .ToListAsync();
        return movements.Sum(m => m.Type == MovementType.Sale ? -m.Quantity : m.Quantity);
    }

    public void Dispose()
    {
        Db.Dispose();
        _connection.Dispose();
    }
}
