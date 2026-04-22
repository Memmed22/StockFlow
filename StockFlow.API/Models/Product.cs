namespace StockFlow.API.Models;

public enum UnitType
{
    Quantity,
    Meter,
    SquareMeter,
    Liter
}

public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Barcode { get; set; } = string.Empty;
    public decimal SellingPrice { get; set; }
    public decimal? BuyingPrice { get; set; }
    public UnitType UnitType { get; set; } = UnitType.Quantity;
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<StockMovement> StockMovements { get; set; } = [];
    public ICollection<SaleItem> SaleItems { get; set; } = [];
}
