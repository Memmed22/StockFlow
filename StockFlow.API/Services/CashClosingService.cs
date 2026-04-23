using Microsoft.EntityFrameworkCore;
using StockFlow.API.Data;
using StockFlow.API.DTOs;
using StockFlow.API.Models;

namespace StockFlow.API.Services;

public class CashClosingService(AppDbContext db)
{
    public async Task<CashClosingPreviewDto> GetPreviewAsync()
    {
        var fromDate = await GetFromDateAsync();
        var toDate = DateTime.UtcNow;
        var expected = await CalcExpectedCashAsync(fromDate, toDate);
        return new CashClosingPreviewDto(fromDate, toDate, expected);
    }

    public async Task<(CashClosingDto? dto, string? error)> CreateClosingAsync(CreateCashClosingDto dto)
    {
        var user = await db.Users.FindAsync(dto.UserId);
        if (user == null) return (null, "User not found.");
        if (dto.CountedCash < 0) return (null, "Counted cash cannot be negative.");

        var fromDate = await GetFromDateAsync();
        var toDate = DateTime.UtcNow;
        var expected = await CalcExpectedCashAsync(fromDate, toDate);
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

        return (new CashClosingDto(
            closing.Id, user.Username, closing.FromDate, closing.ToDate,
            closing.ExpectedCash, closing.CountedCash, closing.Difference,
            closing.Note, closing.CreatedAt), null);
    }

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

    // Returns the end of the last closing, or DateTime.MinValue if no closings exist
    private async Task<DateTime> GetFromDateAsync()
    {
        var last = await db.CashClosings
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => (DateTime?)c.ToDate)
            .FirstOrDefaultAsync();
        return last ?? DateTime.MinValue;
    }

    private async Task<decimal> CalcExpectedCashAsync(DateTime from, DateTime to)
    {
        // Cash in: CashSale (positive TotalAmount)
        // Cash in: Payment (TotalAmount stored negative, negate to get positive)
        // Cash out: Return (TotalAmount stored negative)
        var items = await db.Sales
            .Where(s => s.CreatedAt > from && s.CreatedAt <= to &&
                        (s.Type == SaleType.CashSale ||
                         s.Type == SaleType.Return ||
                         s.Type == SaleType.Payment))
            .Select(s => new { s.Type, s.TotalAmount })
            .ToListAsync();

        return items.Sum(s => s.Type == SaleType.Payment ? -s.TotalAmount : s.TotalAmount);
    }
}
