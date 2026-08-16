using Microsoft.EntityFrameworkCore;
using StockFlow.API.DTOs;
using StockFlow.API.Models;
using StockFlow.API.Services;
using Xunit;

namespace StockFlow.API.Tests;

public class SaleServiceTests : SqliteInMemoryTestBase
{
    private SaleService CreateService() => new(Db);

    [Fact]
    public async Task CreateSale_ReducesStock_ByExactQuantitySold()
    {
        var user = await SeedUserAsync();
        var product = await SeedProductAsync(sellingPrice: 10m);
        await AddMovementAsync(product.Id, MovementType.StockIn, 20);

        var (sale, error) = await CreateService().CreateSaleAsync(new CreateSaleDto(
            user.Id, 0, [new CartItemDto(product.Id, 5, null, 0)]));

        Assert.Null(error);
        Assert.NotNull(sale);
        Assert.Equal(15, await CurrentStockAsync(product.Id));
    }

    [Fact]
    public async Task CreateSale_SellingExactlyAllStock_Succeeds_LeavesZero()
    {
        var user = await SeedUserAsync();
        var product = await SeedProductAsync();
        await AddMovementAsync(product.Id, MovementType.StockIn, 10);

        var (sale, error) = await CreateService().CreateSaleAsync(new CreateSaleDto(
            user.Id, 0, [new CartItemDto(product.Id, 10, null, 0)]));

        Assert.Null(error);
        Assert.NotNull(sale);
        Assert.Equal(0, await CurrentStockAsync(product.Id));
    }

    [Fact]
    public async Task CreateSale_MoreThanAvailableStock_Fails_AndStockUnchanged()
    {
        var user = await SeedUserAsync();
        var product = await SeedProductAsync();
        await AddMovementAsync(product.Id, MovementType.StockIn, 5);

        var (sale, error) = await CreateService().CreateSaleAsync(new CreateSaleDto(
            user.Id, 0, [new CartItemDto(product.Id, 6, null, 0)]));

        Assert.Null(sale);
        Assert.NotNull(error);
        Assert.Equal(5, await CurrentStockAsync(product.Id));
        Assert.Equal(0, await Db.Sales.CountAsync());
        Assert.Equal(1, await Db.StockMovements.CountAsync()); // only the original StockIn
    }

    // Regression test: a single sale used to check each cart line against the
    // database's stock figure independently, so two lines for the same product
    // could each pass a check against the same un-decremented number and jointly
    // oversell it. Requesting quantities must now be aggregated per product first.
    [Fact]
    public async Task CreateSale_DuplicateProductLines_ThatJointlyExceedStock_IsRejected()
    {
        var user = await SeedUserAsync();
        var product = await SeedProductAsync();
        await AddMovementAsync(product.Id, MovementType.StockIn, 172);

        var (sale, error) = await CreateService().CreateSaleAsync(new CreateSaleDto(
            user.Id, 0,
            [
                new CartItemDto(product.Id, 100, null, 0),
                new CartItemDto(product.Id, 100, null, 0),
            ]));

        Assert.Null(sale);
        Assert.NotNull(error);
        Assert.Equal(172, await CurrentStockAsync(product.Id));
        Assert.Equal(0, await Db.Sales.CountAsync());
    }

    [Fact]
    public async Task CreateSale_DuplicateProductLines_WithinStock_Succeeds_AndDecrementsByTotal()
    {
        var user = await SeedUserAsync();
        var product = await SeedProductAsync();
        await AddMovementAsync(product.Id, MovementType.StockIn, 172);

        var (sale, error) = await CreateService().CreateSaleAsync(new CreateSaleDto(
            user.Id, 0,
            [
                new CartItemDto(product.Id, 80, null, 0),
                new CartItemDto(product.Id, 80, null, 0),
            ]));

        Assert.Null(error);
        Assert.NotNull(sale);
        Assert.Equal(2, sale!.Items.Count);
        Assert.Equal(12, await CurrentStockAsync(product.Id));
    }

    [Fact]
    public async Task CreateSale_MultipleDifferentProducts_EachDecrementedIndependently()
    {
        var user = await SeedUserAsync();
        var productA = await SeedProductAsync(name: "A", barcode: "A1");
        var productB = await SeedProductAsync(name: "B", barcode: "B1");
        await AddMovementAsync(productA.Id, MovementType.StockIn, 10);
        await AddMovementAsync(productB.Id, MovementType.StockIn, 10);

        var (sale, error) = await CreateService().CreateSaleAsync(new CreateSaleDto(
            user.Id, 0,
            [
                new CartItemDto(productA.Id, 3, null, 0),
                new CartItemDto(productB.Id, 7, null, 0),
            ]));

        Assert.Null(error);
        Assert.NotNull(sale);
        Assert.Equal(7, await CurrentStockAsync(productA.Id));
        Assert.Equal(3, await CurrentStockAsync(productB.Id));
    }

    [Fact]
    public async Task CreateSale_DebitSale_WithoutCustomer_Fails()
    {
        var user = await SeedUserAsync();
        var product = await SeedProductAsync();
        await AddMovementAsync(product.Id, MovementType.StockIn, 10);

        var (sale, error) = await CreateService().CreateSaleAsync(new CreateSaleDto(
            user.Id, 0, [new CartItemDto(product.Id, 1, null, 0)], Type: 1, CustomerId: null));

        Assert.Null(sale);
        Assert.NotNull(error);
        Assert.Equal(10, await CurrentStockAsync(product.Id));
    }

    [Fact]
    public async Task CreateSale_UnknownProduct_Fails_WithNoSideEffects()
    {
        var user = await SeedUserAsync();

        var (sale, error) = await CreateService().CreateSaleAsync(new CreateSaleDto(
            user.Id, 0, [new CartItemDto(999, 1, null, 0)]));

        Assert.Null(sale);
        Assert.NotNull(error);
        Assert.Equal(0, await Db.Sales.CountAsync());
        Assert.Equal(0, await Db.StockMovements.CountAsync());
    }

    [Fact]
    public async Task CreateSale_TotalAmount_SubtractsCartLevelDiscount()
    {
        var user = await SeedUserAsync();
        var product = await SeedProductAsync(sellingPrice: 100m);
        await AddMovementAsync(product.Id, MovementType.StockIn, 10);

        var (sale, error) = await CreateService().CreateSaleAsync(new CreateSaleDto(
            user.Id, DiscountAmount: 8m, [new CartItemDto(product.Id, 1, null, 0)]));

        Assert.Null(error);
        Assert.NotNull(sale);
        Assert.Equal(92m, sale!.TotalAmount);
    }
}
