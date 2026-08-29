namespace StockFlow.API.DTOs;

public record DailySalesReportDto(
    DateTime Date,
    decimal TotalRevenue,
    int TransactionCount
);

public record UserSalesReportDto(
    int UserId,
    string Username,
    decimal TotalRevenue,
    int TransactionCount
);

public record StockReportItemDto(
    int ProductId,
    string ProductName,
    string Barcode,
    decimal Quantity
);

public record DetailedReportLineDto(
    string Label,
    string? Barcode,
    decimal? Quantity,
    decimal? UnitPrice,
    decimal Total
);

// A group's own Label/Barcode/Quantity/UnitPrice are null when it bundles more than one
// line under Items (e.g. a single POS/bulk-return checkout with several products) — the
// group only carries a summed Total then, and the per-product breakdown lives in Items.
public record DetailedReportItemDto(
    string? Label,
    string? Barcode,
    decimal? Quantity,
    decimal? UnitPrice,
    decimal Total,
    string Type,           // "CashSale" | "DebitSale" | "Return" | "CreditReturn" | "Payment" | "Expense"
    string? CustomerName,
    DateTime CreatedAt,
    List<DetailedReportLineDto>? Items = null,
    string? CompanyName = null  // set for a stock-purchase Expense; lets the client compose "Stock purchase — {company}"
);

public record DetailedReportSummaryDto(
    decimal CashSalesTotal,
    decimal DebitSalesTotal,
    decimal PaymentsTotal,
    decimal ReturnsTotal,
    decimal ExpensesTotal,
    decimal CreditReturnsTotal,
    decimal CashTotal
);

public record DetailedReportDto(
    List<DetailedReportItemDto> Items,
    DetailedReportSummaryDto Summary
);

public record ClosingDetailDto(
    int Id,
    string Username,
    DateTime FromDate,
    DateTime ToDate,
    DateTime CreatedAt,
    string? Note,
    decimal OpeningCash,
    decimal CashSalesTotal,
    decimal DebitSalesTotal,
    decimal PaymentsTotal,
    decimal ReturnsTotal,
    decimal ExpensesTotal,
    decimal CreditReturnsTotal,
    decimal ExpectedCash,
    decimal CountedCash,
    decimal Difference,
    List<DetailedReportItemDto> Items
);
