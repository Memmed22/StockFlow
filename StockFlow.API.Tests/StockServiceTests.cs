using Microsoft.EntityFrameworkCore;
using StockFlow.API.DTOs;
using StockFlow.API.Models;
using StockFlow.API.Services;
using Xunit;

namespace StockFlow.API.Tests;

public class StockServiceTests : SqliteInMemoryTestBase
{
    private StockService CreateService() => new(Db);

    [Fact]
    public async Task StockIn_IncreasesStock_ByQuantityAdded()
    {
        var product = await SeedProductAsync();
        await AddMovementAsync(product.Id, MovementType.StockIn, 5);

        var (movement, error) = await CreateService().StockInAsync(
            new StockInDto(product.Id, Quantity: 3, Note: null), changedByUserId: null);

        Assert.Null(error);
        Assert.NotNull(movement);
        Assert.Equal(8, await CurrentStockAsync(product.Id));
    }

    [Fact]
    public async Task StockIn_ZeroOrNegativeQuantity_Fails()
    {
        var product = await SeedProductAsync();

        var (movement, error) = await CreateService().StockInAsync(
            new StockInDto(product.Id, Quantity: 0, Note: null), changedByUserId: null);

        Assert.Null(movement);
        Assert.NotNull(error);
        Assert.Equal(0, await CurrentStockAsync(product.Id));
    }

    [Theory]
    [InlineData(20, 12)]  // correcting downward
    [InlineData(5, 12)]   // correcting upward
    [InlineData(0, 12)]   // correcting to zero
    [InlineData(12, 12)]  // already correct — no-op adjustment
    public async Task AdjustStock_SetsStockToExactCorrectQuantity(decimal startingStock, decimal correctQuantity)
    {
        var product = await SeedProductAsync();
        await AddMovementAsync(product.Id, MovementType.StockIn, startingStock);

        var (movement, error) = await CreateService().AdjustStockAsync(
            new StockAdjustmentDto(product.Id, CorrectQuantity: correctQuantity, Note: "recount"));

        Assert.Null(error);
        Assert.NotNull(movement);
        Assert.Equal(correctQuantity, await CurrentStockAsync(product.Id));
    }

    [Fact]
    public async Task AdjustStock_NegativeCorrectQuantity_Fails()
    {
        var product = await SeedProductAsync();
        await AddMovementAsync(product.Id, MovementType.StockIn, 10);

        var (movement, error) = await CreateService().AdjustStockAsync(
            new StockAdjustmentDto(product.Id, CorrectQuantity: -1, Note: null));

        Assert.Null(movement);
        Assert.NotNull(error);
        Assert.Equal(10, await CurrentStockAsync(product.Id));
    }

    [Fact]
    public async Task BulkStockIn_IncreasesStock_ByExactQuantityPerLine_PerProduct()
    {
        var user = await SeedUserAsync();
        var productA = await SeedProductAsync(name: "A", barcode: "A1");
        var productB = await SeedProductAsync(name: "B", barcode: "B1");
        await AddMovementAsync(productA.Id, MovementType.StockIn, 5);

        var (result, error) = await CreateService().BulkStockInAsync(new BulkStockInDto(
            user.Id, CompanyId: null,
            Items:
            [
                new StockInLineDto(productA.Id, Quantity: 3, BuyingPrice: 5m, SellingPrice: null),
                new StockInLineDto(productB.Id, Quantity: 8, BuyingPrice: 5m, SellingPrice: null)
            ],
            PayFromRegister: false));

        Assert.Null(error);
        Assert.NotNull(result);
        Assert.Equal(2, result!.Movements.Count);
        Assert.Equal(8, await CurrentStockAsync(productA.Id));
        Assert.Equal(8, await CurrentStockAsync(productB.Id));
    }

    [Fact]
    public async Task BulkStockIn_MultipleLinesForSameProduct_SumsIntoStock()
    {
        var user = await SeedUserAsync();
        var product = await SeedProductAsync();

        var (result, error) = await CreateService().BulkStockInAsync(new BulkStockInDto(
            user.Id, CompanyId: null,
            Items:
            [
                new StockInLineDto(product.Id, Quantity: 4, BuyingPrice: 5m, SellingPrice: null),
                new StockInLineDto(product.Id, Quantity: 6, BuyingPrice: 5m, SellingPrice: null)
            ],
            PayFromRegister: false));

        Assert.Null(error);
        Assert.NotNull(result);
        Assert.Equal(10, await CurrentStockAsync(product.Id));
    }

    [Fact]
    public async Task BulkStockIn_InvalidLine_Fails_AndLeavesStockUnchangedForAllLines()
    {
        var user = await SeedUserAsync();
        var productA = await SeedProductAsync(name: "A", barcode: "A1");
        var productB = await SeedProductAsync(name: "B", barcode: "B1");
        await AddMovementAsync(productA.Id, MovementType.StockIn, 5);
        await AddMovementAsync(productB.Id, MovementType.StockIn, 5);

        var (result, error) = await CreateService().BulkStockInAsync(new BulkStockInDto(
            user.Id, CompanyId: null,
            Items:
            [
                new StockInLineDto(productA.Id, Quantity: 3, BuyingPrice: 5m, SellingPrice: null),
                new StockInLineDto(productB.Id, Quantity: -1, BuyingPrice: 5m, SellingPrice: null) // invalid
            ],
            PayFromRegister: false));

        Assert.Null(result);
        Assert.NotNull(error);
        Assert.Equal(5, await CurrentStockAsync(productA.Id));
        Assert.Equal(5, await CurrentStockAsync(productB.Id));
    }

    [Fact]
    public async Task StockIn_WithChangedBuyingPrice_WritesProductHistoryRow()
    {
        var user = await SeedUserAsync();
        var product = await SeedProductAsync(buyingPrice: 5m, sellingPrice: 10m);

        var (movement, error) = await CreateService().StockInAsync(
            new StockInDto(product.Id, Quantity: 3, Note: null, BuyingPrice: 7m), changedByUserId: user.Id);

        Assert.Null(error);
        Assert.NotNull(movement);
        var change = Assert.Single(await Db.ProductHistory.Where(h => h.ProductId == product.Id).ToListAsync());
        Assert.Equal("BuyingPrice", change.FieldName);
        Assert.Equal("5.00", change.OldValue);
        Assert.Equal("7.00", change.NewValue);
        Assert.Equal(user.Id, change.ChangedByUserId);
    }

    [Fact]
    public async Task StockIn_WithSamePrice_WritesNoHistory()
    {
        var product = await SeedProductAsync(buyingPrice: 5m, sellingPrice: 10m);

        var (movement, error) = await CreateService().StockInAsync(
            new StockInDto(product.Id, Quantity: 3, Note: null, BuyingPrice: 5m), changedByUserId: null);

        Assert.Null(error);
        Assert.NotNull(movement);
        Assert.Empty(await Db.ProductHistory.ToListAsync());
    }

    [Fact]
    public async Task StockIn_WithNoPriceProvided_WritesNoHistory()
    {
        var product = await SeedProductAsync(buyingPrice: 5m, sellingPrice: 10m);

        var (movement, error) = await CreateService().StockInAsync(
            new StockInDto(product.Id, Quantity: 3, Note: null), changedByUserId: null);

        Assert.Null(error);
        Assert.NotNull(movement);
        Assert.Empty(await Db.ProductHistory.ToListAsync());
    }

    [Fact]
    public async Task StockIn_InvalidNewPrice_FailsAndWritesNoHistory()
    {
        var product = await SeedProductAsync(buyingPrice: 5m, sellingPrice: 10m);

        var (movement, error) = await CreateService().StockInAsync(
            new StockInDto(product.Id, Quantity: 3, Note: null, BuyingPrice: -1m), changedByUserId: null);

        Assert.Null(movement);
        Assert.NotNull(error);
        Assert.Empty(await Db.ProductHistory.ToListAsync());
    }

    [Fact]
    public async Task BulkStockIn_WithChangedPrices_WritesHistoryAttributedToDtoUserId()
    {
        var user = await SeedUserAsync();
        var product = await SeedProductAsync(buyingPrice: 5m, sellingPrice: 10m);

        var (result, error) = await CreateService().BulkStockInAsync(new BulkStockInDto(
            user.Id, CompanyId: null,
            Items: [new StockInLineDto(product.Id, Quantity: 4, BuyingPrice: 6m, SellingPrice: 12m)],
            PayFromRegister: false));

        Assert.Null(error);
        Assert.NotNull(result);
        var history = await Db.ProductHistory.Where(h => h.ProductId == product.Id).ToListAsync();
        Assert.Equal(2, history.Count);
        Assert.All(history, h => Assert.Equal(user.Id, h.ChangedByUserId));
        Assert.Contains(history, h => h.FieldName == "BuyingPrice" && h.OldValue == "5.00" && h.NewValue == "6.00");
        Assert.Contains(history, h => h.FieldName == "SellingPrice" && h.OldValue == "10.00" && h.NewValue == "12.00");
    }

    [Fact]
    public async Task BulkStockIn_MultipleLinesForSameProduct_TracksEachPriceChangeIndependently()
    {
        var user = await SeedUserAsync();
        var product = await SeedProductAsync(buyingPrice: 5m, sellingPrice: 10m);

        var (result, error) = await CreateService().BulkStockInAsync(new BulkStockInDto(
            user.Id, CompanyId: null,
            Items:
            [
                new StockInLineDto(product.Id, Quantity: 2, BuyingPrice: 6m, SellingPrice: null),
                new StockInLineDto(product.Id, Quantity: 3, BuyingPrice: 8m, SellingPrice: null)
            ],
            PayFromRegister: false));

        Assert.Null(error);
        Assert.NotNull(result);
        var history = await Db.ProductHistory
            .Where(h => h.ProductId == product.Id && h.FieldName == "BuyingPrice")
            .OrderBy(h => h.Id)
            .ToListAsync();
        Assert.Equal(2, history.Count);
        Assert.Equal(("5.00", "6.00"), (history[0].OldValue, history[0].NewValue));
        Assert.Equal(("6.00", "8.00"), (history[1].OldValue, history[1].NewValue));
    }
}
