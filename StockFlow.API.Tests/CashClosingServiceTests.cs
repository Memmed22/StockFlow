using Microsoft.Extensions.Configuration;
using StockFlow.API.DTOs;
using StockFlow.API.Models;
using StockFlow.API.Services;
using Xunit;

namespace StockFlow.API.Tests;

// Expected Cash is the number a cashier's till gets judged against at closing time, so
// its formula (what counts, what doesn't, and over which period) has to be exactly
// right. These tests pin down the same rule the user asked about directly: Cash Sales,
// Payments, Returns, and Opening Cash all move Expected Cash; Debit Sales never do,
// because no cash actually changes hands on a charge-account sale.
public class CashClosingServiceTests : SqliteInMemoryTestBase
{
    private CashClosingService CreateService()
    {
        var config = new ConfigurationBuilder().Build(); // no Telegram keys -> no-op, no network calls
        return new CashClosingService(Db, new TelegramService(config));
    }

    private async Task<int> AddSaleAsync(SaleType type, decimal totalAmount, int? userId = null)
    {
        var uid = userId ?? (await SeedUserAsync($"user-{Guid.NewGuid():N}")).Id;
        var sale = new Sale { UserId = uid, Type = type, TotalAmount = totalAmount, CreatedAt = DateTime.UtcNow };
        Db.Sales.Add(sale);
        await Db.SaveChangesAsync();
        return sale.Id;
    }

    [Fact]
    public async Task GetPreview_WithNoActivity_IsZero()
    {
        var preview = await CreateService().GetPreviewAsync();

        Assert.Equal(0m, preview.ExpectedCash);
    }

    [Fact]
    public async Task GetPreview_IncludesOpeningCashAndCashSales()
    {
        var user = await SeedUserAsync();
        await AddSaleAsync(SaleType.OpeningCash, 100m, user.Id);
        await AddSaleAsync(SaleType.CashSale, 250m, user.Id);

        var preview = await CreateService().GetPreviewAsync();

        Assert.Equal(350m, preview.ExpectedCash);
    }

    // Directly covers the user's question: a Debit Sale is a charge to the customer's
    // account, not cash received at the register, so it must never move Expected Cash.
    [Fact]
    public async Task GetPreview_ExcludesDebitSales()
    {
        var user = await SeedUserAsync();
        await AddSaleAsync(SaleType.OpeningCash, 100m, user.Id);
        await AddSaleAsync(SaleType.CashSale, 250m, user.Id);
        await AddSaleAsync(SaleType.DebitSale, 9999m, user.Id); // must be fully ignored

        var preview = await CreateService().GetPreviewAsync();

        Assert.Equal(350m, preview.ExpectedCash);
    }

    [Fact]
    public async Task GetPreview_SubtractsReturns()
    {
        var user = await SeedUserAsync();
        await AddSaleAsync(SaleType.OpeningCash, 100m, user.Id);
        await AddSaleAsync(SaleType.CashSale, 250m, user.Id);
        await AddSaleAsync(SaleType.Return, -40m, user.Id); // stored negative, cash leaves the register

        var preview = await CreateService().GetPreviewAsync();

        Assert.Equal(310m, preview.ExpectedCash);
    }

    [Fact]
    public async Task GetPreview_AddsPayments()
    {
        var user = await SeedUserAsync();
        await AddSaleAsync(SaleType.OpeningCash, 100m, user.Id);
        await AddSaleAsync(SaleType.Payment, -30m, user.Id); // stored negative (reduces customer debt), cash comes IN

        var preview = await CreateService().GetPreviewAsync();

        Assert.Equal(130m, preview.ExpectedCash);
    }

    [Fact]
    public async Task GetPreview_SubtractsExpenses()
    {
        var user = await SeedUserAsync();
        await AddSaleAsync(SaleType.OpeningCash, 100m, user.Id);
        await AddSaleAsync(SaleType.Expense, -15m, user.Id); // stored negative, cash leaves the register

        var preview = await CreateService().GetPreviewAsync();

        Assert.Equal(85m, preview.ExpectedCash);
    }

    // Mirrors the exact real-world figures reported: Opening 100, Cash Sales 1622,
    // Debit Sales 50 (ignored), Returns -152 -> Expected Cash 1570.
    [Fact]
    public async Task GetPreview_RealWorldScenario_MatchesReportedExpectedCash()
    {
        var user = await SeedUserAsync();
        await AddSaleAsync(SaleType.OpeningCash, 100m, user.Id);
        await AddSaleAsync(SaleType.CashSale, 1622m, user.Id);
        await AddSaleAsync(SaleType.DebitSale, 50m, user.Id);
        await AddSaleAsync(SaleType.Return, -152m, user.Id);

        var preview = await CreateService().GetPreviewAsync();

        Assert.Equal(1570m, preview.ExpectedCash);
    }

    [Fact]
    public async Task CreateClosing_StoresExpectedCountedAndDifference()
    {
        var user = await SeedUserAsync();
        await AddSaleAsync(SaleType.OpeningCash, 100m, user.Id);
        await AddSaleAsync(SaleType.CashSale, 300m, user.Id);

        var (closing, telegramError) = await CreateService().CreateClosingAsync(
            new CreateCashClosingDto(user.Id, CountedCash: 395m, Note: "short by 5"));

        Assert.NotNull(closing);
        Assert.Equal(400m, closing!.ExpectedCash);
        Assert.Equal(395m, closing.CountedCash);
        Assert.Equal(-5m, closing.Difference);
        Assert.Equal("Telegram not configured.", telegramError);
    }

    [Fact]
    public async Task CreateClosing_NegativeCountedCash_Fails()
    {
        var user = await SeedUserAsync();

        var (closing, error) = await CreateService().CreateClosingAsync(
            new CreateCashClosingDto(user.Id, CountedCash: -1m, Note: null));

        Assert.Null(closing);
        Assert.NotNull(error);
    }

    // After a closing, the next preview must only cover activity from that point on —
    // otherwise cash already accounted for in a prior closing would be double-counted.
    [Fact]
    public async Task AfterClosing_NextPreview_OnlyCoversActivitySinceThatClosing()
    {
        var user = await SeedUserAsync();
        await AddSaleAsync(SaleType.OpeningCash, 100m, user.Id);
        await AddSaleAsync(SaleType.CashSale, 200m, user.Id);
        var service = CreateService();
        await service.CreateClosingAsync(new CreateCashClosingDto(user.Id, CountedCash: 300m, Note: null));

        // New shift: only this sale should count toward the next Expected Cash.
        await AddSaleAsync(SaleType.CashSale, 50m, user.Id);

        var preview = await service.GetPreviewAsync();

        Assert.Equal(50m, preview.ExpectedCash);
    }

    [Fact]
    public async Task CreateOpeningCash_TwiceInSamePeriod_SecondCallFails()
    {
        var user = await SeedUserAsync();
        var service = CreateService();

        var (firstOk, _) = await service.CreateOpeningCashAsync(new CreateOpeningCashDto(user.Id, 100m));
        var (secondOk, error) = await service.CreateOpeningCashAsync(new CreateOpeningCashDto(user.Id, 50m));

        Assert.True(firstOk);
        Assert.False(secondOk);
        Assert.NotNull(error);
    }

    [Fact]
    public async Task GetOpeningStatus_ReflectsRecordedOpeningForCurrentPeriod()
    {
        var user = await SeedUserAsync();
        var service = CreateService();

        var before = await service.GetOpeningStatusAsync();
        await service.CreateOpeningCashAsync(new CreateOpeningCashDto(user.Id, 75m));
        var after = await service.GetOpeningStatusAsync();

        Assert.False(before.HasOpeningCash);
        Assert.True(after.HasOpeningCash);
        Assert.Equal(75m, after.Amount);
    }
}
