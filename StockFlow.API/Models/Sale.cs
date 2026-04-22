namespace StockFlow.API.Models;

public enum SaleType { CashSale, DebitSale, Return, Payment }

public class Sale
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int? CustomerId { get; set; }
    public SaleType Type { get; set; } = SaleType.CashSale;
    public decimal TotalAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public Customer? Customer { get; set; }
    public ICollection<SaleItem> Items { get; set; } = [];
}
