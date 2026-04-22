namespace StockFlow.API.Models;

public enum MovementType
{
    StockIn,
    Sale,
    Return
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

    public Product Product { get; set; } = null!;
}
