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
    string Type,           // "CashSale" | "DebitSale" | "Return" | "Payment"
    string? CustomerName
);

public record DetailedReportSummaryDto(
    decimal CashSalesTotal,
    decimal DebitSalesTotal,
    decimal PaymentsTotal,
    decimal ReturnsTotal,
    decimal CashTotal
);

public record DetailedReportDto(
    List<DetailedReportItemDto> Items,
    DetailedReportSummaryDto Summary
);
