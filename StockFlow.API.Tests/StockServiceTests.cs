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
            new StockInDto(product.Id, Quantity: 3, Note: null));

        Assert.Null(error);
        Assert.NotNull(movement);
        Assert.Equal(8, await CurrentStockAsync(product.Id));
    }

    [Fact]
    public async Task StockIn_ZeroOrNegativeQuantity_Fails()
    {
        var product = await SeedProductAsync();

        var (movement, error) = await CreateService().StockInAsync(
            new StockInDto(product.Id, Quantity: 0, Note: null));

        Assert.Null(movement);
        Assert.NotNull(error);
        Assert.Equal(0, await CurrentStockAsync(product.Id));
    }

    [Theory]
    [InlineData(20, 12)]  // correcting downward
    [InlineData(5, 12)]   // correcting upward
    [InlineData(0, 12)]   // correcting to zero
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
}
