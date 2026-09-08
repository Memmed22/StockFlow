using Microsoft.EntityFrameworkCore;
using StockFlow.API.DTOs;
using StockFlow.API.Models;
using StockFlow.API.Services;
using Xunit;

namespace StockFlow.API.Tests;

// These tests pin down the stock-quantity formula shared across ProductService,
// StockService, and ReportService: every movement type adds to stock except Sale,
// which subtracts. If that formula ever drifts between call sites, the app would show
// different stock numbers on different screens for the exact same product.
public class ProductServiceTests : SqliteInMemoryTestBase
{
    private ProductService CreateService() => new(Db);

    [Fact]
    public async Task StockQuantity_WithNoMovements_IsZero()
    {
        var product = await SeedProductAsync();

        var dto = await CreateService().GetByIdAsync(product.Id);

        Assert.Equal(0, dto!.StockQuantity);
    }

    [Fact]
    public async Task StockQuantity_CombinesStockInSaleReturnAndAdjustment_Correctly()
    {
        var product = await SeedProductAsync();
        await AddMovementAsync(product.Id, MovementType.StockIn, 100);
        await AddMovementAsync(product.Id, MovementType.Sale, 30);
        await AddMovementAsync(product.Id, MovementType.Return, 5);
        await AddMovementAsync(product.Id, MovementType.Adjustment, -10);

        // 100 - 30 + 5 - 10 = 65
        var dto = await CreateService().GetByIdAsync(product.Id);

        Assert.Equal(65, dto!.StockQuantity);
    }

    [Fact]
    public async Task GetAllAsync_ReportsIndependentStockPerProduct()
    {
        var a = await SeedProductAsync(name: "A", barcode: "A1");
        var b = await SeedProductAsync(name: "B", barcode: "B1");
        await AddMovementAsync(a.Id, MovementType.StockIn, 40);
        await AddMovementAsync(a.Id, MovementType.Sale, 15);
        await AddMovementAsync(b.Id, MovementType.StockIn, 7);

        var all = await CreateService().GetAllAsync(null);

        Assert.Equal(25, all.Single(p => p.Id == a.Id).StockQuantity);
        Assert.Equal(7, all.Single(p => p.Id == b.Id).StockQuantity);
    }

    [Fact]
    public async Task InventoryValue_ExcludesProductsWithZeroOrNegativeStock()
    {
        var inStock = await SeedProductAsync(name: "InStock", barcode: "IS1", sellingPrice: 20m, buyingPrice: 10m);
        var soldOut = await SeedProductAsync(name: "SoldOut", barcode: "SO1", sellingPrice: 20m, buyingPrice: 10m);
        await AddMovementAsync(inStock.Id, MovementType.StockIn, 4);
        await AddMovementAsync(soldOut.Id, MovementType.StockIn, 4);
        await AddMovementAsync(soldOut.Id, MovementType.Sale, 4);

        var value = await CreateService().GetInventoryValueAsync();

        Assert.Equal(4 * 10m, value.TotalBuyingValue);
        Assert.Equal(4 * 20m, value.TotalSellingValue);
    }

    [Fact]
    public async Task UpdateAsync_NoFieldsChanged_WritesNoHistory()
    {
        var product = await SeedProductAsync(name: "Widget", barcode: "0001", sellingPrice: 10m, buyingPrice: 5m);

        var (dto, error) = await CreateService().UpdateAsync(product.Id,
            new UpdateProductDto("Widget", "0001", 10m, 5m, UnitType.Quantity, null), changedByUserId: null);

        Assert.Null(error);
        Assert.NotNull(dto);
        Assert.Empty(await Db.ProductHistory.ToListAsync());
    }

    [Fact]
    public async Task UpdateAsync_ChangedFields_WritesOnlyThoseFieldsWithOldAndNewValues()
    {
        var user = await SeedUserAsync();
        var product = await SeedProductAsync(name: "Widget", barcode: "0001", sellingPrice: 10m, buyingPrice: 5m);

        var (dto, error) = await CreateService().UpdateAsync(product.Id,
            new UpdateProductDto("Gadget", "0001", 15m, 5m, UnitType.Quantity, null), changedByUserId: user.Id);

        Assert.Null(error);
        Assert.NotNull(dto);
        var history = await Db.ProductHistory.Where(h => h.ProductId == product.Id).ToListAsync();
        Assert.Equal(2, history.Count);

        var nameChange = Assert.Single(history, h => h.FieldName == "Name");
        Assert.Equal("Widget", nameChange.OldValue);
        Assert.Equal("Gadget", nameChange.NewValue);
        Assert.Equal(user.Id, nameChange.ChangedByUserId);

        var priceChange = Assert.Single(history, h => h.FieldName == "SellingPrice");
        Assert.Equal("10.00", priceChange.OldValue);
        Assert.Equal("15.00", priceChange.NewValue);
    }

    [Fact]
    public async Task UpdateAsync_AllFieldsChanged_WritesOneRowPerField()
    {
        var product = await SeedProductAsync(name: "Widget", barcode: "0001", sellingPrice: 10m, buyingPrice: 5m, unitType: UnitType.Quantity);

        var (dto, error) = await CreateService().UpdateAsync(product.Id,
            new UpdateProductDto("Gadget", "0002", 20m, 8m, UnitType.Meter, "new desc"), changedByUserId: null);

        Assert.Null(error);
        Assert.NotNull(dto);
        var history = await Db.ProductHistory.Where(h => h.ProductId == product.Id).ToListAsync();
        Assert.Equal(6, history.Count);
        Assert.Equal(["Name", "Barcode", "SellingPrice", "BuyingPrice", "UnitType", "Description"],
            history.Select(h => h.FieldName).ToArray());
    }

    [Fact]
    public async Task UpdateAsync_BarcodeConflict_FailsAndWritesNoHistory()
    {
        await SeedProductAsync(name: "Other", barcode: "TAKEN");
        var product = await SeedProductAsync(name: "Widget", barcode: "0001");

        var (dto, error) = await CreateService().UpdateAsync(product.Id,
            new UpdateProductDto("Widget", "TAKEN", 10m, 5m, UnitType.Quantity, null), changedByUserId: null);

        Assert.Null(dto);
        Assert.NotNull(error);
        Assert.Empty(await Db.ProductHistory.ToListAsync());
    }

    [Fact]
    public async Task GetHistoryAsync_MergesStockMovementsAndFieldUpdates_NewestFirst()
    {
        var product = await SeedProductAsync();
        Db.StockMovements.Add(new StockMovement
        {
            ProductId = product.Id, Type = MovementType.StockIn, Quantity = 10,
            CreatedAt = new DateTime(2026, 1, 1)
        });
        Db.ProductHistory.Add(new ProductHistory
        {
            ProductId = product.Id, FieldName = "Name", OldValue = "A", NewValue = "B",
            ChangedAt = new DateTime(2026, 1, 2)
        });
        Db.StockMovements.Add(new StockMovement
        {
            ProductId = product.Id, Type = MovementType.Sale, Quantity = 2,
            CreatedAt = new DateTime(2026, 1, 3)
        });
        await Db.SaveChangesAsync();

        var result = await CreateService().GetHistoryAsync(product.Id, page: 1, pageSize: 20);

        Assert.Equal(3, result.TotalCount);
        Assert.Equal(["Sale", "FieldUpdate", "StockIn"], result.Items.Select(i => i.EventType).ToArray());
    }

    [Fact]
    public async Task GetHistoryAsync_ExcludesOtherProductsEntries()
    {
        var a = await SeedProductAsync(name: "A", barcode: "A1");
        var b = await SeedProductAsync(name: "B", barcode: "B1");
        Db.StockMovements.Add(new StockMovement { ProductId = a.Id, Type = MovementType.StockIn, Quantity = 5 });
        Db.StockMovements.Add(new StockMovement { ProductId = b.Id, Type = MovementType.StockIn, Quantity = 9 });
        await Db.SaveChangesAsync();

        var result = await CreateService().GetHistoryAsync(a.Id, page: 1, pageSize: 20);

        Assert.Equal(1, result.TotalCount);
        Assert.Equal(5, result.Items.Single().Quantity);
    }

    [Fact]
    public async Task GetHistoryAsync_Paginates()
    {
        var product = await SeedProductAsync();
        for (var i = 0; i < 5; i++)
            Db.StockMovements.Add(new StockMovement
            {
                ProductId = product.Id, Type = MovementType.StockIn, Quantity = i + 1,
                CreatedAt = new DateTime(2026, 1, 1).AddMinutes(i)
            });
        await Db.SaveChangesAsync();

        var page1 = await CreateService().GetHistoryAsync(product.Id, page: 1, pageSize: 2);
        var page2 = await CreateService().GetHistoryAsync(product.Id, page: 2, pageSize: 2);

        Assert.Equal(5, page1.TotalCount);
        Assert.Equal(2, page1.Items.Count);
        Assert.Equal(2, page2.Items.Count);
        Assert.NotEqual(page1.Items[0].Timestamp, page2.Items[0].Timestamp);
    }

    [Fact]
    public async Task GetHistoryAsync_MovementEntries_IncludeStockBeforeAndAfter()
    {
        var product = await SeedProductAsync();
        await AddMovementAsync(product.Id, MovementType.StockIn, 10); // 0 -> 10
        await AddMovementAsync(product.Id, MovementType.Sale, 4);     // 10 -> 6
        await AddMovementAsync(product.Id, MovementType.Return, 2);   // 6 -> 8

        var result = await CreateService().GetHistoryAsync(product.Id, page: 1, pageSize: 20);

        var byType = result.Items.ToDictionary(i => i.EventType);
        Assert.Equal(("6", "8"), (byType["Return"].OldValue, byType["Return"].NewValue));
        Assert.Equal(("10", "6"), (byType["Sale"].OldValue, byType["Sale"].NewValue));
        Assert.Equal(("0", "10"), (byType["StockIn"].OldValue, byType["StockIn"].NewValue));
    }

    [Fact]
    public async Task GetHistoryAsync_IncludesChangedByUsername_ForFieldUpdates()
    {
        var user = await SeedUserAsync(username: "alice");
        var product = await SeedProductAsync();
        Db.ProductHistory.Add(new ProductHistory
        {
            ProductId = product.Id, FieldName = "Name", OldValue = "A", NewValue = "B", ChangedByUserId = user.Id
        });
        await Db.SaveChangesAsync();

        var result = await CreateService().GetHistoryAsync(product.Id, page: 1, pageSize: 20);

        Assert.Equal("alice", result.Items.Single().ChangedByUsername);
    }
}
