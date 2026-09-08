using StockFlow.API.DTOs;
using StockFlow.API.Models;
using StockFlow.API.Services;
using Xunit;

namespace StockFlow.API.Tests;

// Exercises the actual services in the same sequence a real user would (Stock In ->
// Sale -> Return -> Correct Stock), rather than seeding StockMovement rows directly.
// The seeded-movement tests elsewhere pin down the summing formula; these pin down
// that each service call feeds into that formula correctly end to end, and that
// ProductService reports the exact same number every other screen would compute.
public class StockQuantityConsistencyTests : SqliteInMemoryTestBase
{
    [Fact]
    public async Task FullLifecycle_StockIn_Sale_Return_CorrectStock_ProducesExactFinalQuantity()
    {
        var user = await SeedUserAsync();
        var product = await SeedProductAsync(sellingPrice: 20m, buyingPrice: 10m);

        var stockService = new StockService(Db);
        var saleService = new SaleService(Db);
        var returnService = new ReturnService(Db);
        var productService = new ProductService(Db);

        // Stock In: +50
        var (stockIn, stockInError) = await stockService.StockInAsync(
            new StockInDto(product.Id, Quantity: 50, Note: null), changedByUserId: null);
        Assert.Null(stockInError);
        Assert.NotNull(stockIn);
        Assert.Equal(50, await CurrentStockAsync(product.Id));

        // Sale: -20
        var (sale, saleError) = await saleService.CreateSaleAsync(
            new CreateSaleDto(user.Id, 0, [new CartItemDto(product.Id, 20, null, 0)]));
        Assert.Null(saleError);
        Assert.NotNull(sale);
        Assert.Equal(30, await CurrentStockAsync(product.Id));

        // Return: +5
        var (returnMovement, returnError) = await returnService.ProcessReturnAsync(
            new ReturnDto(product.Id, Quantity: 5, BasePrice: 10m, ReturnPrice: 20m, Note: null, UserId: user.Id));
        Assert.Null(returnError);
        Assert.NotNull(returnMovement);
        Assert.Equal(35, await CurrentStockAsync(product.Id));

        // Correct Stock: recount finds 40 on the shelf
        var (adjustment, adjustError) = await stockService.AdjustStockAsync(
            new StockAdjustmentDto(product.Id, CorrectQuantity: 40, Note: "recount"));
        Assert.Null(adjustError);
        Assert.NotNull(adjustment);
        Assert.Equal(40, await CurrentStockAsync(product.Id));

        // Every other screen (Products list, reports, inventory value) reads through
        // ProductService — it must report the exact same number.
        var dto = await productService.GetByIdAsync(product.Id);
        Assert.Equal(40, dto!.StockQuantity);
    }

    [Fact]
    public async Task ConcurrentOperationsOnDifferentProducts_NeverCrossContaminateStock()
    {
        var user = await SeedUserAsync();
        var productA = await SeedProductAsync(name: "A", barcode: "A1");
        var productB = await SeedProductAsync(name: "B", barcode: "B1");

        var stockService = new StockService(Db);
        var saleService = new SaleService(Db);
        var returnService = new ReturnService(Db);

        await stockService.StockInAsync(new StockInDto(productA.Id, 100, null), null);
        await stockService.StockInAsync(new StockInDto(productB.Id, 200, null), null);

        await saleService.CreateSaleAsync(new CreateSaleDto(user.Id, 0, [new CartItemDto(productA.Id, 30, null, 0)]));
        await saleService.CreateSaleAsync(new CreateSaleDto(user.Id, 0, [new CartItemDto(productB.Id, 50, null, 0)]));

        await returnService.ProcessReturnAsync(
            new ReturnDto(productA.Id, Quantity: 10, BasePrice: 5m, ReturnPrice: 5m, Note: null, UserId: user.Id));

        await stockService.AdjustStockAsync(new StockAdjustmentDto(productB.Id, CorrectQuantity: 145, Note: "recount"));

        // A: 100 - 30 + 10 = 80 (never touched by B's correction)
        Assert.Equal(80, await CurrentStockAsync(productA.Id));
        // B: corrected directly to 145, independent of A's sale/return activity
        Assert.Equal(145, await CurrentStockAsync(productB.Id));
    }
}
