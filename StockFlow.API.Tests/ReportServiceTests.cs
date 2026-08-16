using StockFlow.API.Models;
using StockFlow.API.Services;
using Xunit;

namespace StockFlow.API.Tests;

// Regression coverage for a real reported discrepancy: a sale's line items sum to
// its subtotal, but the sale itself may carry an extra cart-level DiscountAmount
// (TotalAmount = subtotal - DiscountAmount). Any report that summed item totals
// instead of the sale's own TotalAmount would overstate cash collected by the sum
// of every discount applied that period — which is exactly what made "Cash Sales"
// on the Cash Close activity tab disagree with the authoritative Expected Cash.
public class ReportServiceTests : SqliteInMemoryTestBase
{
    private ReportService CreateService() => new(Db);

    private async Task<Sale> SeedDiscountedCashSaleAsync(int userId, int productId, decimal discountAmount)
    {
        var sale = new Sale
        {
            UserId = userId,
            Type = SaleType.CashSale,
            DiscountAmount = discountAmount,
            TotalAmount = 100m - discountAmount, // two 50-each items, minus the cart discount
            CreatedAt = DateTime.UtcNow,
            Items =
            [
                new SaleItem { ProductId = productId, Quantity = 2, BasePrice = 50m, FinalPrice = 50m, DiscountAmount = 0 },
            ],
        };
        Db.Sales.Add(sale);
        await Db.SaveChangesAsync();
        return sale;
    }

    [Fact]
    public async Task GetCurrentPeriodDetail_CashSalesTotal_NetsOutCartLevelDiscount()
    {
        var user = await SeedUserAsync();
        var product = await SeedProductAsync(sellingPrice: 50m);
        await SeedDiscountedCashSaleAsync(user.Id, product.Id, discountAmount: 20m);

        var detail = await CreateService().GetCurrentPeriodDetailAsync();

        // Line items still show the pre-discount subtotal (100), but the summary
        // total actually collected must reflect the discount (80), not 100.
        Assert.Equal(80m, detail.CashSalesTotal);
    }

    [Fact]
    public async Task GetDetailedReport_CashSalesTotal_NetsOutCartLevelDiscount()
    {
        var user = await SeedUserAsync();
        var product = await SeedProductAsync(sellingPrice: 50m);
        await SeedDiscountedCashSaleAsync(user.Id, product.Id, discountAmount: 20m);

        var today = DateTime.UtcNow.Date;
        var report = await CreateService().GetDetailedReportAsync(today, today.AddDays(1));

        Assert.Equal(80m, report.Summary.CashSalesTotal);
    }

    [Fact]
    public async Task GetClosingDetail_CashSalesTotal_NetsOutCartLevelDiscount()
    {
        var user = await SeedUserAsync();
        var product = await SeedProductAsync(sellingPrice: 50m);

        var closing = new CashClosing
        {
            UserId = user.Id,
            FromDate = DateTime.UtcNow.AddMinutes(-10),
            ToDate = DateTime.UtcNow.AddMinutes(10),
            ExpectedCash = 80m,
            CountedCash = 80m,
            Difference = 0m,
        };
        Db.CashClosings.Add(closing);
        await Db.SaveChangesAsync();

        await SeedDiscountedCashSaleAsync(user.Id, product.Id, discountAmount: 20m);

        var detail = await CreateService().GetClosingDetailAsync(closing.Id);

        Assert.Equal(80m, detail!.CashSalesTotal);
    }
}
