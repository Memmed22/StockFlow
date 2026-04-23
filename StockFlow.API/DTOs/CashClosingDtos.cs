namespace StockFlow.API.DTOs;

public record CashClosingPreviewDto(
    DateTime FromDate,
    DateTime ToDate,
    decimal ExpectedCash
);

public record CreateCashClosingDto(
    int UserId,
    decimal CountedCash,
    string? Note
);

public record CashClosingDto(
    int Id,
    string Username,
    DateTime FromDate,
    DateTime ToDate,
    decimal ExpectedCash,
    decimal CountedCash,
    decimal Difference,
    string? Note,
    DateTime CreatedAt
);
