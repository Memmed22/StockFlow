namespace StockFlow.API.DTOs;

public record CashClosingPreviewDto(
    DateTime FromDate,
    DateTime ToDate,
    decimal ExpectedCash,
    decimal CreditReturnsTotal
);

public record CreateExpenseDto(int UserId, decimal Amount, string Description);

public record RecordCashPaymentDto(int UserId, decimal Amount);

public record OpeningCashStatusDto(bool HasOpeningCash, decimal? Amount);

public record CreateOpeningCashDto(int UserId, decimal Amount);

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

public record CurrentPeriodDetailDto(
    decimal OpeningCash,
    decimal CashSalesTotal,
    decimal DebitSalesTotal,
    decimal PaymentsTotal,
    decimal ReturnsTotal,
    decimal ExpensesTotal,
    decimal CreditReturnsTotal,
    List<DetailedReportItemDto> Items
);
