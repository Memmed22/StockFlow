namespace StockFlow.API.Models;

public class ProductHistory
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public string FieldName { get; set; } = string.Empty;
    public string? OldValue { get; set; }
    public string? NewValue { get; set; }
    public int? ChangedByUserId { get; set; }
    public DateTime ChangedAt { get; set; } = DateTime.UtcNow;

    public Product Product { get; set; } = null!;
    public User? ChangedByUser { get; set; }
}
