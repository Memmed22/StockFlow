using StockFlow.API.Models;

namespace StockFlow.API.DTOs;

public record CreateProductDto(
    string Name,
    string Barcode,
    decimal SellingPrice,
    decimal? BuyingPrice,
    UnitType UnitType,
    string? Description
);

public record UpdateProductDto(
    string Name,
    string Barcode,
    decimal SellingPrice,
    decimal? BuyingPrice,
    UnitType UnitType,
    string? Description
);

public record ProductDto(
    int Id,
    string Name,
    string Barcode,
    decimal SellingPrice,
    decimal? BuyingPrice,
    UnitType UnitType,
    string? Description,
    decimal StockQuantity
);

public record ProductSearchDto(
    int Id,
    string Name,
    string Barcode,
    decimal SellingPrice,
    UnitType UnitType
);
