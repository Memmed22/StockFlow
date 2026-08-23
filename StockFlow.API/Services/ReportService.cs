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
            .Include(m => m.Customer)
            .Where(m => m.Type == MovementType.Return && m.CreatedAt >= fromDate && m.CreatedAt < toDate)
            .ToListAsync();

        var items = BuildDetailItems(sales, returns);

        // Summed from the sale record itself (not its line items) so a per-sale
        // cart-level discount is correctly netted out of the reported total.
        var cashSalesTotal  = sales.Where(s => s.Type == SaleType.CashSale).Sum(s => s.TotalAmount);
        var debitSalesTotal = sales.Where(s => s.Type == SaleType.DebitSale).Sum(s => s.TotalAmount);
        var returnsTotal    = items.Where(i => i.Type == "Return").Sum(i => i.Total);
        var paymentsTotal   = items.Where(i => i.Type == "Payment").Sum(i => i.Total);
        var expensesTotal   = items.Where(i => i.Type == "Expense").Sum(i => i.Total);
        var creditReturnsTotal = items.Where(i => i.Type == "CreditReturn").Sum(i => i.Total);
        // Credit-settled returns never touch the register, so they're excluded here (informational only).
        var cashTotal       = cashSalesTotal + paymentsTotal + returnsTotal + expensesTotal;

        return new DetailedReportDto(
            items,
            new DetailedReportSummaryDto(cashSalesTotal, debitSalesTotal, paymentsTotal, returnsTotal, expensesTotal, creditReturnsTotal, cashTotal));
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
            .Include(m => m.Customer)
            .Where(m => m.Type == MovementType.Return && m.CreatedAt > from && m.CreatedAt <= to)
            .ToListAsync();

        var items = new List<DetailedReportItemDto>();
        items.AddRange(sales.Where(s => s.Type == SaleType.OpeningCash)
            .Select(o => new DetailedReportItemDto("Opening Cash", null, null, null, o.TotalAmount, "OpeningCash", null, o.CreatedAt)));
        items.AddRange(BuildDetailItems(sales, returns));
        items = items.OrderBy(i => i.CreatedAt).ToList();

        var openingCash    = sales.Where(s => s.Type == SaleType.OpeningCash).Sum(s => s.TotalAmount);
        var cashSalesTotal  = sales.Where(s => s.Type == SaleType.CashSale).Sum(s => s.TotalAmount);
        var debitSalesTotal = sales.Where(s => s.Type == SaleType.DebitSale).Sum(s => s.TotalAmount);
        var paymentsTotal   = items.Where(i => i.Type == "Payment").Sum(i => i.Total);
        var returnsTotal    = items.Where(i => i.Type == "Return").Sum(i => i.Total);
        var expensesTotal   = items.Where(i => i.Type == "Expense").Sum(i => i.Total);
        var creditReturnsTotal = items.Where(i => i.Type == "CreditReturn").Sum(i => i.Total);

        return new ClosingDetailDto(
            closing.Id, closing.User.Username,
            closing.FromDate, closing.ToDate, closing.CreatedAt, closing.Note,
            openingCash, cashSalesTotal, debitSalesTotal, paymentsTotal, returnsTotal, expensesTotal,
            creditReturnsTotal,
            closing.ExpectedCash, closing.CountedCash, closing.Difference,
            items);
    }

    public async Task<CurrentPeriodDetailDto> GetCurrentPeriodDetailAsync()
    {
        var fromDate = await db.CashClosings
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => (DateTime?)c.ToDate)
            .FirstOrDefaultAsync() ?? DateTime.MinValue;
        var toDate = DateTime.UtcNow;

        var sales = await db.Sales
            .Include(s => s.Items).ThenInclude(i => i.Product)
            .Include(s => s.Customer)
            .Where(s => s.CreatedAt > fromDate && s.CreatedAt <= toDate)
            .ToListAsync();

        var returns = await db.StockMovements
            .Include(m => m.Product)
            .Include(m => m.Customer)
            .Where(m => m.Type == MovementType.Return && m.CreatedAt > fromDate && m.CreatedAt <= toDate)
            .ToListAsync();

        var items = BuildDetailItems(sales, returns).OrderBy(i => i.CreatedAt).ToList();

        var openingCash     = sales.Where(s => s.Type == SaleType.OpeningCash).Sum(s => s.TotalAmount);
        var cashSalesTotal  = sales.Where(s => s.Type == SaleType.CashSale).Sum(s => s.TotalAmount);
        var debitSalesTotal = sales.Where(s => s.Type == SaleType.DebitSale).Sum(s => s.TotalAmount);
        var paymentsTotal   = items.Where(i => i.Type == "Payment").Sum(i => i.Total);
        var returnsTotal    = items.Where(i => i.Type == "Return").Sum(i => i.Total);
        var expensesTotal   = items.Where(i => i.Type == "Expense").Sum(i => i.Total);
        var creditReturnsTotal = items.Where(i => i.Type == "CreditReturn").Sum(i => i.Total);

        return new CurrentPeriodDetailDto(
            openingCash, cashSalesTotal, debitSalesTotal, paymentsTotal, returnsTotal, expensesTotal, creditReturnsTotal, items);
    }

    // Builds cash/debit sale, return, payment, and expense line items for a detail/closing view.
    private static List<DetailedReportItemDto> BuildDetailItems(List<Sale> sales, List<StockMovement> returns)
    {
        var items = new List<DetailedReportItemDto>();

        // Line items sharing one Sale (a single POS/customer-detail checkout, however many
        // products it contained) are bundled into one group so the UI shows one row per
        // transaction rather than one row per product — matching how a cashier thinks about it.
        foreach (var sale in sales.Where(s => s.Type == SaleType.CashSale || s.Type == SaleType.DebitSale))
        {
            var type = sale.Type == SaleType.CashSale ? "CashSale" : "DebitSale";
            var lines = sale.Items.Select(si => new DetailedReportLineDto(
                si.Product.Name, si.Product.Barcode, si.Quantity, si.FinalPrice, si.Quantity * si.FinalPrice)).ToList();
            if (lines.Count <= 1)
            {
                var single = lines.FirstOrDefault();
                items.Add(new DetailedReportItemDto(
                    single?.Label ?? type, single?.Barcode, single?.Quantity, single?.UnitPrice,
                    single?.Total ?? sale.TotalAmount,
                    type, sale.Customer?.Name, sale.CreatedAt));
            }
            else
            {
                items.Add(new DetailedReportItemDto(
                    lines[0].Label, null, null, null,
                    lines.Sum(l => l.Total),
                    type, sale.Customer?.Name, sale.CreatedAt, lines));
            }
        }

        // Group by SaleId so a bulk return (several products settled in one submission)
        // shows as one row too. Falls back to a per-movement group for any pre-migration
        // Return rows that predate the SaleId column and never got one.
        foreach (var group in returns.GroupBy(r => r.SaleId ?? -r.Id))
        {
            var groupReturns = group.ToList();
            var lines = groupReturns.Select(r =>
            {
                var unitPrice = r.ReturnPrice ?? 0m;
                return new DetailedReportLineDto(r.Product.Name, r.Product.Barcode, -r.Quantity, unitPrice, -(r.Quantity * unitPrice));
            }).ToList();
            var first = groupReturns[0];
            var type = first.IsCreditReturn ? "CreditReturn" : "Return";
            if (lines.Count <= 1)
            {
                items.Add(new DetailedReportItemDto(
                    lines[0].Label, lines[0].Barcode, lines[0].Quantity, lines[0].UnitPrice, lines[0].Total,
                    type, first.Customer?.Name, first.CreatedAt));
            }
            else
            {
                items.Add(new DetailedReportItemDto(
                    lines[0].Label, null, null, null,
                    lines.Sum(l => l.Total),
                    type, first.Customer?.Name, first.CreatedAt, lines));
            }
        }

        foreach (var p in sales.Where(s => s.Type == SaleType.Payment))
        {
            items.Add(new DetailedReportItemDto(
                "Payment received", null, null, null,
                Math.Abs(p.TotalAmount), "Payment", p.Customer?.Name, p.CreatedAt));
        }

        foreach (var e in sales.Where(s => s.Type == SaleType.Expense))
        {
            items.Add(new DetailedReportItemDto(
                e.Note ?? "Expense", null, null, null,
                e.TotalAmount, "Expense", null, e.CreatedAt));
        }

        return items;
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
