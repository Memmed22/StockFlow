using StockFlow.API.DTOs;
using StockFlow.API.Models;
using StockFlow.API.Services;
using Xunit;

namespace StockFlow.API.Tests;

// A customer can now be linked to a cash sale for history/tracking (POS lets the
// cashier attach a customer even when the sale type is Cash, not just Debit). Since
// cash is paid in full immediately, that link must show up in the customer's
// transaction history but must NOT count toward their outstanding balance — only
// unpaid debit sales (minus payments/returns) represent real debt.
public class CustomerServiceTests : SqliteInMemoryTestBase
{
    private CustomerService CreateService() => new(Db);
    private SaleService CreateSaleService() => new(Db);

    private async Task<Product> SeedSellableProductAsync(decimal price = 50m)
    {
        var product = await SeedProductAsync(sellingPrice: price);
        await AddMovementAsync(product.Id, MovementType.StockIn, 1000);
        return product;
    }

    [Fact]
    public async Task CashSale_LinkedToCustomer_DoesNotAffectBalance()
    {
        var user = await SeedUserAsync();
        var customer = await SeedCustomerAsync();
        var product = await SeedSellableProductAsync(50m);

        var (sale, error) = await CreateSaleService().CreateSaleAsync(new CreateSaleDto(
            user.Id, 0, [new CartItemDto(product.Id, 1, null, 0)], Type: 0, CustomerId: customer.Id));

        Assert.Null(error);
        Assert.NotNull(sale);

        var detail = await CreateService().GetByIdAsync(customer.Id);
        Assert.Equal(0m, detail!.Info.Balance);
        Assert.Single(detail.Transactions); // still recorded in their history
        Assert.Equal("CashSale", detail.Transactions[0].Type);
    }

    [Fact]
    public async Task DebitSale_LinkedToCustomer_IncreasesBalance()
    {
        var user = await SeedUserAsync();
        var customer = await SeedCustomerAsync();
        var product = await SeedSellableProductAsync(50m);

        await CreateSaleService().CreateSaleAsync(new CreateSaleDto(
            user.Id, 0, [new CartItemDto(product.Id, 1, null, 0)], Type: 1, CustomerId: customer.Id));

        var detail = await CreateService().GetByIdAsync(customer.Id);
        Assert.Equal(50m, detail!.Info.Balance);
    }

    [Fact]
    public async Task MixedCashAndDebitSales_OnlyDebitCountsTowardBalance()
    {
        var user = await SeedUserAsync();
        var customer = await SeedCustomerAsync();
        var product = await SeedSellableProductAsync(50m);
        var saleService = CreateSaleService();

        await saleService.CreateSaleAsync(new CreateSaleDto(
            user.Id, 0, [new CartItemDto(product.Id, 1, null, 0)], Type: 0, CustomerId: customer.Id)); // cash: +0
        await saleService.CreateSaleAsync(new CreateSaleDto(
            user.Id, 0, [new CartItemDto(product.Id, 1, null, 0)], Type: 1, CustomerId: customer.Id)); // debit: +50

        var all = await CreateService().GetAllAsync(null);
        Assert.Equal(50m, all.Single(c => c.Id == customer.Id).Balance);
    }

    [Fact]
    public async Task Payment_ReducesBalance_AfterDebitSale()
    {
        var user = await SeedUserAsync();
        var customer = await SeedCustomerAsync();
        var product = await SeedSellableProductAsync(100m);
        await CreateSaleService().CreateSaleAsync(new CreateSaleDto(
            user.Id, 0, [new CartItemDto(product.Id, 1, null, 0)], Type: 1, CustomerId: customer.Id));

        var (dto, error) = await CreateService().RecordPaymentAsync(customer.Id, new RecordPaymentDto(user.Id, 40m));

        Assert.Null(error);
        Assert.Equal(60m, dto!.Balance);
    }
}
