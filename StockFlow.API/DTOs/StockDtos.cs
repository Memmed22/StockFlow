namespace StockFlow.API.DTOs;

public record StockInDto(int ProductId, decimal Quantity, string? Note);

public record StockAdjustmentDto(int ProductId, decimal CorrectQuantity, string? Note);

public record StockMovementDto(
    int Id,
    int ProductId,
    string ProductName,
    string Barcode,
    string Type,
    decimal Quantity,
    string? Note,
    DateTime CreatedAt
);

public record PagedResult<T>(
    IReadOnlyList<T> Items,
    int TotalCount,
    int Page,
    int PageSize
);
