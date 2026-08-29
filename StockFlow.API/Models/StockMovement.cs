namespace StockFlow.API.Models;

public enum MovementType
{
    StockIn,
    Sale,
    Return,
    Adjustment
}

public class StockMovement
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public MovementType Type { get; set; }
    public decimal Quantity { get; set; }
    public decimal? BasePrice { get; set; }
    public decimal? ReturnPrice { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int? CustomerId { get; set; }
    public bool IsCreditReturn { get; set; }
    public int? SaleId { get; set; }
    public int? CompanyId { get; set; }

    public Product Product { get; set; } = null!;
    public Customer? Customer { get; set; }
    public Sale? Sale { get; set; }
    public Company? Company { get; set; }
}
