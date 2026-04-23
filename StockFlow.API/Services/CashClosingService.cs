using Microsoft.EntityFrameworkCore;
using StockFlow.API.Data;
using StockFlow.API.DTOs;
using StockFlow.API.Models;

namespace StockFlow.API.Services;

public class CashClosingService(AppDbContext db, TelegramService telegram)
{
    public async Task<CashClosingPreviewDto> GetPreviewAsync()
    {
        var fromDate = await GetFromDateAsync();
        var toDate = DateTime.UtcNow;
        var (_, _, _, _, expected) = await GetBreakdownAsync(fromDate, toDate);
        return new CashClosingPreviewDto(fromDate, toDate, expected);
    }

    public async Task<(CashClosingDto? dto, string? error)> CreateClosingAsync(CreateCashClosingDto dto)
    {
        var user = await db.Users.FindAsync(dto.UserId);
        if (user == null) return (null, "User not found.");
        if (dto.CountedCash < 0) return (null, "Counted cash cannot be negative.");

        var fromDate = await GetFromDateAsync();
        var toDate = DateTime.UtcNow;
        var (opening, cashSales, payments, returns, expected) = await GetBreakdownAsync(fromDate, toDate);
        var diff = dto.CountedCash - expected;

        var closing = new CashClosing
        {
            UserId = dto.UserId,
            FromDate = fromDate,
            ToDate = toDate,
            ExpectedCash = expected,
            CountedCash = dto.CountedCash,
            Difference = diff,
            Note = dto.Note,
            CreatedAt = toDate
        };

        db.CashClosings.Add(closing);
        await db.SaveChangesAsync();

        var result = new CashClosingDto(
            closing.Id, user.Username, closing.FromDate, closing.ToDate,
            closing.ExpectedCash, closing.CountedCash, closing.Difference,
            closing.Note, closing.CreatedAt);

        var telegramError = await telegram.SendMessageAsync(
            BuildReport(result, opening, cashSales, payments, returns));

        // telegramError is non-null only for diagnostics; closing itself always succeeds
        return (result, telegramError);
    }

    public async Task<OpeningCashStatusDto> GetOpeningStatusAsync()
    {
        var fromDate = await GetFromDateAsync();
        var opening = await db.Sales
            .Where(s => s.Type == SaleType.OpeningCash && s.CreatedAt > fromDate)
            .Select(s => (decimal?)s.TotalAmount)
            .FirstOrDefaultAsync();
        return new OpeningCashStatusDto(opening.HasValue, opening);
    }

    public async Task<(bool ok, string? error)> CreateOpeningCashAsync(CreateOpeningCashDto dto)
    {
        var user = await db.Users.FindAsync(dto.UserId);
        if (user == null) return (false, "User not found.");
        if (dto.Amount < 0) return (false, "Opening cash cannot be negative.");

        var fromDate = await GetFromDateAsync();
        var alreadyExists = await db.Sales
            .AnyAsync(s => s.Type == SaleType.OpeningCash && s.CreatedAt > fromDate);
        if (alreadyExists) return (false, "Opening cash already recorded for this period.");

        db.Sales.Add(new Sale
        {
            UserId = dto.UserId,
            Type = SaleType.OpeningCash,
            TotalAmount = dto.Amount,
            DiscountAmount = 0,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        return (true, null);
    }

    public Task<string?> SendTestAsync() =>
        telegram.SendMessageAsync("✅ StockFlow Telegram test — connection OK!");

    public async Task<List<CashClosingDto>> GetAllAsync()
    {
        return await db.CashClosings
            .Include(c => c.User)
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new CashClosingDto(
                c.Id, c.User.Username, c.FromDate, c.ToDate,
                c.ExpectedCash, c.CountedCash, c.Difference,
                c.Note, c.CreatedAt))
            .ToListAsync();
    }

    private async Task<DateTime> GetFromDateAsync()
    {
        var last = await db.CashClosings
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => (DateTime?)c.ToDate)
            .FirstOrDefaultAsync();
        return last ?? DateTime.MinValue;
    }

    // Returns (openingCash, cashSales, paymentsReceived, returnsGiven, expected)
    // cashSales/opening: positive. paymentsReceived: positive (negated storage). returnsGiven: positive.
    // expected = opening + cashSales + paymentsReceived - returnsGiven
    private async Task<(decimal opening, decimal cashSales, decimal payments, decimal returns, decimal expected)>
        GetBreakdownAsync(DateTime from, DateTime to)
    {
        var items = await db.Sales
            .Where(s => s.CreatedAt > from && s.CreatedAt <= to &&
                        (s.Type == SaleType.OpeningCash || s.Type == SaleType.CashSale ||
                         s.Type == SaleType.Return     || s.Type == SaleType.Payment))
            .Select(s => new { s.Type, s.TotalAmount })
            .ToListAsync();

        var opening   = items.Where(x => x.Type == SaleType.OpeningCash).Sum(x => x.TotalAmount);
        var cashSales = items.Where(x => x.Type == SaleType.CashSale).Sum(x => x.TotalAmount);
        var payments  = items.Where(x => x.Type == SaleType.Payment).Sum(x => -x.TotalAmount);
        var returns   = items.Where(x => x.Type == SaleType.Return).Sum(x => -x.TotalAmount);
        var expected  = items.Sum(x => x.Type == SaleType.Payment ? -x.TotalAmount : x.TotalAmount);

        return (opening, cashSales, payments, returns, expected);
    }

    private static string BuildReport(CashClosingDto c,
        decimal opening, decimal cashSales, decimal payments, decimal returns)
    {
        var fromStr = c.FromDate == DateTime.MinValue
            ? "Beginning of records"
            : c.FromDate.ToLocalTime().ToString("yyyy-MM-dd");
        var toStr   = c.ToDate.ToLocalTime().ToString("yyyy-MM-dd HH:mm");
        var sep     = "---------------------";
        var diff    = c.Difference;
        var diffStr = $"{(diff >= 0 ? "+" : "")}{diff:F2} ₾";

        var lines = new System.Text.StringBuilder();
        lines.AppendLine("📊 Cash Closing Report");
        lines.AppendLine();
        lines.AppendLine($"🗓 From: {fromStr}");
        lines.AppendLine($"🗓 To:   {toStr}");
        lines.AppendLine($"👤 Cashier: {c.Username}");
        lines.AppendLine();
        lines.AppendLine(sep);
        lines.AppendLine();
        lines.AppendLine($"💰 Opening Cash: {opening:F2} ₾");
        lines.AppendLine();
        lines.AppendLine($"💵 Cash Sales:  {cashSales:F2} ₾");
        lines.AppendLine($"💳 Payments:    {payments:F2} ₾");
        lines.AppendLine($"🔁 Returns:    -{returns:F2} ₾");
        lines.AppendLine();
        lines.AppendLine(sep);
        lines.AppendLine();
        lines.AppendLine($"📦 Expected: {c.ExpectedCash:F2} ₾");
        lines.AppendLine($"💵 Counted:  {c.CountedCash:F2} ₾");
        lines.AppendLine();
        lines.AppendLine($"{(diff != 0 ? "⚠️" : "✅")} Difference: {diffStr}");

        if (diff != 0)
        {
            lines.AppendLine();
            lines.AppendLine("⚠️ ATTENTION: Cash mismatch detected");
        }

        if (!string.IsNullOrWhiteSpace(c.Note))
        {
            lines.AppendLine();
            lines.AppendLine(sep);
            lines.AppendLine($"📝 Note: {c.Note}");
        }

        return lines.ToString().TrimEnd();
    }
}
