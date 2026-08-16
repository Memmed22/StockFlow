using Microsoft.EntityFrameworkCore;
using StockFlow.API.DTOs;
using StockFlow.API.Models;
using StockFlow.API.Services;
using Xunit;

namespace StockFlow.API.Tests;

public class ReturnServiceTests : SqliteInMemoryTestBase
{
    private ReturnService CreateService() => new(Db);

    [Fact]
    public async Task ProcessReturn_IncreasesStock_ByQuantityReturned()
    {
        var user = await SeedUserAsync();
        var product = await SeedProductAsync(sellingPrice: 50m);
        await AddMovementAsync(product.Id, MovementType.StockIn, 10);
        await AddMovementAsync(product.Id, MovementType.Sale, 3); // stock now 7

        var (movement, error) = await CreateService().ProcessReturnAsync(
            new ReturnDto(product.Id, Quantity: 2, BasePrice: 50m, ReturnPrice: 50m, Note: null, UserId: user.Id));

        Assert.Null(error);
        Assert.NotNull(movement);
        Assert.Equal(9, await CurrentStockAsync(product.Id));
    }

    // Regression test: returns used to only create a cash-register Sale record when
    // linked to a customer, so a walk-in (no customer) return never reduced Expected
    // Cash at closing time even though real cash left the register. Every return must
    // now create a Sale row regardless of whether a customer is attached.
    [Fact]
    public async Task ProcessReturn_WithoutCustomer_StillCreatesSaleRow_ForCashRegisterTracking()
    {
        var user = await SeedUserAsync();
        var product = await SeedProductAsync(sellingPrice: 50m);
        await AddMovementAsync(product.Id, MovementType.StockIn, 10);

        var (movement, error) = await CreateService().ProcessReturnAsync(
            new ReturnDto(product.Id, Quantity: 1, BasePrice: 50m, ReturnPrice: 40m, Note: null,
                CustomerId: null, UserId: user.Id));

        Assert.Null(error);
        Assert.NotNull(movement);

        var sale = await Db.Sales.SingleAsync();
        Assert.Equal(SaleType.Return, sale.Type);
        Assert.Null(sale.CustomerId);
        Assert.Equal(-40m, sale.TotalAmount);
    }

    [Fact]
    public async Task ProcessReturn_WithCustomer_LinksSaleToCustomer_AndReducesBalance()
    {
        var user = await SeedUserAsync();
        var product = await SeedProductAsync(sellingPrice: 50m);
        var customer = await SeedCustomerAsync();
        await AddMovementAsync(product.Id, MovementType.StockIn, 10);

        await CreateService().ProcessReturnAsync(
            new ReturnDto(product.Id, Quantity: 1, BasePrice: 50m, ReturnPrice: 50m, Note: null,
                CustomerId: customer.Id, UserId: user.Id));

        var sale = await Db.Sales.SingleAsync();
        Assert.Equal(customer.Id, sale.CustomerId);
        Assert.Equal(-50m, sale.TotalAmount);
    }

    [Fact]
    public async Task ProcessReturn_ZeroOrNegativeQuantity_Fails_NoMovementCreated()
    {
        var user = await SeedUserAsync();
        var product = await SeedProductAsync();

        var (movement, error) = await CreateService().ProcessReturnAsync(
            new ReturnDto(product.Id, Quantity: 0, BasePrice: 10m, ReturnPrice: 10m, Note: null, UserId: user.Id));

        Assert.Null(movement);
        Assert.NotNull(error);
        Assert.Equal(0, await Db.StockMovements.CountAsync());
    }

    [Fact]
    public async Task ProcessReturn_UnknownProduct_Fails()
    {
        var user = await SeedUserAsync();

        var (movement, error) = await CreateService().ProcessReturnAsync(
            new ReturnDto(999, Quantity: 1, BasePrice: 10m, ReturnPrice: 10m, Note: null, UserId: user.Id));

        Assert.Null(movement);
        Assert.NotNull(error);
    }

    [Fact]
    public async Task ProcessReturn_UnknownUser_Fails_NoSideEffects()
    {
        var product = await SeedProductAsync();

        var (movement, error) = await CreateService().ProcessReturnAsync(
            new ReturnDto(product.Id, Quantity: 1, BasePrice: 10m, ReturnPrice: 10m, Note: null, UserId: 999));

        Assert.Null(movement);
        Assert.NotNull(error);
        Assert.Equal(0, await Db.StockMovements.CountAsync());
        Assert.Equal(0, await Db.Sales.CountAsync());
    }
}
