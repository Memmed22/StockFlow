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
}
