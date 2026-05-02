using Microsoft.EntityFrameworkCore;
using StockFlow.API.Data;
using StockFlow.API.DTOs;
using StockFlow.API.Models;

namespace StockFlow.API.Services;

public class ReportService(AppDbContext db)
{
    public async Task<List<DailySalesReportDto>> GetDailySalesAsync(DateTime? from, DateTime? to)
    {
        var fromDate = (from ?? DateTime.UtcNow.Date).Date;
        var toDate = (to ?? DateTime.UtcNow.Date).Date.AddDays(1); // exclusive upper bound

        var sales = await db.Sales
            .Where(s => s.CreatedAt >= fromDate && s.CreatedAt < toDate
                && (s.Type == SaleType.CashSale || s.Type == SaleType.DebitSale))
            .ToListAsync();

        return sales
            .GroupBy(s => s.CreatedAt.Date)
            .Select(g => new DailySalesReportDto(g.Key, g.Sum(s => s.TotalAmount), g.Count()))
            .OrderByDescending(r => r.Date)
            .ToList();
    }

    public async Task<List<UserSalesReportDto>> GetSalesPerUserAsync(DateTime? from, DateTime? to)
    {
        var fromDate = (from ?? DateTime.UtcNow.Date.AddDays(-30)).Date;
        var toDate = (to ?? DateTime.UtcNow.Date).Date.AddDays(1);

        var sales = await db.Sales
            .Include(s => s.User)
            .Where(s => s.CreatedAt >= fromDate && s.CreatedAt < toDate
                && (s.Type == SaleType.CashSale || s.Type == SaleType.DebitSale))
            .ToListAsync();

        return sales
            .GroupBy(s => new { s.UserId, s.User.Username })
            .Select(g => new UserSalesReportDto(
                g.Key.UserId, g.Key.Username,
                g.Sum(s => s.TotalAmount), g.Count()))
            .OrderByDescending(r => r.TotalRevenue)
            .ToList();
    }

    public async Task<DetailedReportDto> GetDetailedReportAsync(DateTime? from, DateTime? to)
    {
        var fromDate = (from ?? DateTime.UtcNow.Date).Date;
        var toDate = (to ?? DateTime.UtcNow.Date).Date.AddDays(1);

        // Load cash/debit sales with their items, payment records, and expense records
        var sales = await db.Sales
            .Include(s => s.Items).ThenInclude(i => i.Product)
            .Include(s => s.Customer)
            .Where(s => s.CreatedAt >= fromDate && s.CreatedAt < toDate &&
                (s.Type == SaleType.CashSale || s.Type == SaleType.DebitSale ||
                 s.Type == SaleType.Payment  || s.Type == SaleType.Expense))
            .ToListAsync();

        // Load stock-level returns
        var returns = await db.StockMovements
            .Include(m => m.Product)
            .Where(m => m.Type == MovementType.Return && m.CreatedAt >= fromDate && m.CreatedAt < toDate)
            .ToListAsync();

        var items = new List<DetailedReportItemDto>();

        // Cash and debit sale line items
        foreach (var sale in sales.Where(s => s.Type == SaleType.CashSale || s.Type == SaleType.DebitSale))
        {
            var type = sale.Type == SaleType.CashSale ? "CashSale" : "DebitSale";
            foreach (var si in sale.Items)
            {
                items.Add(new DetailedReportItemDto(
                    si.Product.Name, si.Product.Barcode,
                    si.Quantity, si.FinalPrice,
                    si.Quantity * si.FinalPrice,
                    type, sale.Customer?.Name));
            }
        }

        // Stock return line items (always negative)
        foreach (var r in returns)
        {
            var unitPrice = r.ReturnPrice ?? 0m;
            items.Add(new DetailedReportItemDto(
                r.Product.Name, r.Product.Barcode,
                -r.Quantity, unitPrice,
                -(r.Quantity * unitPrice),
                "Return", null));
        }

        // Payment records — stored negative, shown positive
        foreach (var p in sales.Where(s => s.Type == SaleType.Payment))
        {
            var amount = Math.Abs(p.TotalAmount);
            items.Add(new DetailedReportItemDto(
                "Payment received", null, null, null,
                amount, "Payment", p.Customer?.Name));
        }

        // Expense records — stored as negative TotalAmount, shown as negative
        foreach (var e in sales.Where(s => s.Type == SaleType.Expense))
        {
            items.Add(new DetailedReportItemDto(
                e.Note ?? "Expense", null, null, null,
                e.TotalAmount, "Expense", null));
        }

        var cashSalesTotal  = items.Where(i => i.Type == "CashSale").Sum(i => i.Total);
        var debitSalesTotal = items.Where(i => i.Type == "DebitSale").Sum(i => i.Total);
        var returnsTotal    = items.Where(i => i.Type == "Return").Sum(i => i.Total);
        var paymentsTotal   = items.Where(i => i.Type == "Payment").Sum(i => i.Total);
        var expensesTotal   = items.Where(i => i.Type == "Expense").Sum(i => i.Total);
        var cashTotal       = cashSalesTotal + paymentsTotal + returnsTotal + expensesTotal;

        return new DetailedReportDto(
            items,
            new DetailedReportSummaryDto(cashSalesTotal, debitSalesTotal, paymentsTotal, returnsTotal, expensesTotal, cashTotal));
    }

    public async Task<List<CashClosingDto>> GetClosingsListAsync()
    {
        return await db.CashClosings
            .Include(c => c.User)
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new CashClosingDto(
                c.Id, c.User.Username, c.FromDate, c.ToDate,
                c.ExpectedCash, c.CountedCash, c.Difference, c.Note, c.CreatedAt))
            .ToListAsync();
    }

    public async Task<ClosingDetailDto?> GetClosingDetailAsync(int id)
    {
        var closing = await db.CashClosings
            .Include(c => c.User)
            .FirstOrDefaultAsync(c => c.Id == id);
        if (closing == null) return null;

        var from = closing.FromDate;
        var to = closing.ToDate;

        var sales = await db.Sales
            .Include(s => s.Items).ThenInclude(i => i.Product)
            .Include(s => s.Customer)
            .Where(s => s.CreatedAt > from && s.CreatedAt <= to)
            .ToListAsync();

        var returns = await db.StockMovements
            .Include(m => m.Product)
            .Where(m => m.Type == MovementType.Return && m.CreatedAt > from && m.CreatedAt <= to)
            .ToListAsync();

        var items = new List<DetailedReportItemDto>();

        foreach (var o in sales.Where(s => s.Type == SaleType.OpeningCash))
            items.Add(new DetailedReportItemDto("Opening Cash", null, null, null, o.TotalAmount, "OpeningCash", null));

        foreach (var sale in sales.Where(s => s.Type == SaleType.CashSale || s.Type == SaleType.DebitSale))
        {
            var type = sale.Type == SaleType.CashSale ? "CashSale" : "DebitSale";
            foreach (var si in sale.Items)
                items.Add(new DetailedReportItemDto(si.Product.Name, si.Product.Barcode, si.Quantity, si.FinalPrice, si.Quantity * si.FinalPrice, type, sale.Customer?.Name));
        }

        foreach (var r in returns)
        {
            var unitPrice = r.ReturnPrice ?? 0m;
            items.Add(new DetailedReportItemDto(r.Product.Name, r.Product.Barcode, -r.Quantity, unitPrice, -(r.Quantity * unitPrice), "Return", null));
        }

        foreach (var p in sales.Where(s => s.Type == SaleType.Payment))
            items.Add(new DetailedReportItemDto("Payment received", null, null, null, Math.Abs(p.TotalAmount), "Payment", p.Customer?.Name));

        foreach (var e in sales.Where(s => s.Type == SaleType.Expense))
            items.Add(new DetailedReportItemDto(e.Note ?? "Expense", null, null, null, e.TotalAmount, "Expense", null));

        var openingCash    = sales.Where(s => s.Type == SaleType.OpeningCash).Sum(s => s.TotalAmount);
        var cashSalesTotal  = items.Where(i => i.Type == "CashSale").Sum(i => i.Total);
        var debitSalesTotal = items.Where(i => i.Type == "DebitSale").Sum(i => i.Total);
        var paymentsTotal   = items.Where(i => i.Type == "Payment").Sum(i => i.Total);
        var returnsTotal    = items.Where(i => i.Type == "Return").Sum(i => i.Total);
        var expensesTotal   = items.Where(i => i.Type == "Expense").Sum(i => i.Total);

        return new ClosingDetailDto(
            closing.Id, closing.User.Username,
            closing.FromDate, closing.ToDate, closing.CreatedAt, closing.Note,
            openingCash, cashSalesTotal, debitSalesTotal, paymentsTotal, returnsTotal, expensesTotal,
            closing.ExpectedCash, closing.CountedCash, closing.Difference,
            items);
    }

    public async Task<List<StockReportItemDto>> GetStockReportAsync()
    {
        var products = await db.Products.ToListAsync();
        var allMovements = await db.StockMovements
            .Select(m => new { m.ProductId, m.Type, m.Quantity })
            .ToListAsync();

        var movementsByProduct = allMovements
            .GroupBy(m => m.ProductId)
            .ToDictionary(g => g.Key, g => g.ToList());

        return products
            .Select(p =>
            {
                var qty = movementsByProduct.TryGetValue(p.Id, out var mvs)
                    ? mvs.Sum(m => m.Type == MovementType.Sale ? -m.Quantity : m.Quantity)
                    : 0m;
                return new StockReportItemDto(p.Id, p.Name, p.Barcode, qty);
            })
            .OrderBy(r => r.ProductName)
            .ToList();
    }
}
