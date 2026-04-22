namespace StockFlow.API.DTOs;

public record CartItemDto(
    int ProductId,
    decimal Quantity,
    decimal? FinalPrice,
    decimal DiscountAmount
);

public record CreateSaleDto(
    int UserId,
    decimal DiscountAmount,
    List<CartItemDto> Items,
    int Type = 0,
    int? CustomerId = null
);

public record SaleItemDto(
    int ProductId,
    string ProductName,
    decimal Quantity,
    decimal BasePrice,
    decimal FinalPrice,
    decimal DiscountAmount
);

public record SaleDto(
    int Id,
    int UserId,
    string Username,
    int? CustomerId,
    string? CustomerName,
    int Type,
    decimal TotalAmount,
    decimal DiscountAmount,
    DateTime CreatedAt,
    List<SaleItemDto> Items
);
