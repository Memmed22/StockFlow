namespace StockFlow.API.DTOs;

public record StockInDto(int ProductId, decimal Quantity, string? Note, decimal? BuyingPrice = null, decimal? SellingPrice = null);

public record StockAdjustmentDto(int ProductId, decimal CorrectQuantity, string? Note);

public record StockInLineDto(int ProductId, decimal Quantity, decimal BuyingPrice, decimal? SellingPrice);

public record BulkStockInDto(int UserId, int? CompanyId, List<StockInLineDto> Items, bool PayFromRegister);

public record BulkStockInResultDto(List<StockMovementDto> Movements, decimal TotalCost, bool RegisterDebited);

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
