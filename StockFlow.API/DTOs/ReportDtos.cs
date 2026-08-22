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

public record DetailedReportItemDto(
    string Label,
    string? Barcode,
    decimal? Quantity,
    decimal? UnitPrice,
    decimal Total,
    string Type,           // "CashSale" | "DebitSale" | "Return" | "CreditReturn" | "Payment" | "Expense"
    string? CustomerName
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
