using Microsoft.EntityFrameworkCore;
using StockFlow.API.Data;
using StockFlow.API.DTOs;
using StockFlow.API.Models;

namespace StockFlow.API.Services;

public class SaleService(AppDbContext db)
{
    public async Task<(SaleDto? sale, string? error)> CreateSaleAsync(CreateSaleDto dto)
    {
        var user = await db.Users.FindAsync(dto.UserId);
        if (user == null) return (null, "User not found.");

        if (dto.Items == null || dto.Items.Count == 0)
            return (null, "Sale must have at least one item.");

        var saleType = dto.Type == 1 ? SaleType.DebitSale : SaleType.CashSale;

        if (saleType == SaleType.DebitSale && !dto.CustomerId.HasValue)
            return (null, "Customer is required for debit sales.");

        if (dto.CustomerId.HasValue)
        {
            var customer = await db.Customers.FindAsync(dto.CustomerId.Value);
            if (customer == null) return (null, "Customer not found.");
        }

        var productIds = dto.Items.Select(i => i.ProductId).Distinct().ToList();
        var products = await db.Products
            .Where(p => productIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id);

        foreach (var item in dto.Items)
        {
            if (!products.ContainsKey(item.ProductId)) return (null, $"Product {item.ProductId} not found.");
            if (item.Quantity <= 0) return (null, $"Invalid quantity for product {products[item.ProductId].Name}.");
        }

        // Aggregate requested quantity per product so multiple cart lines for the
        // same product are checked against available stock together, not independently
        // (checking each line separately against the same un-decremented stock figure
        // could let a cart oversell a product across its own lines).
        var requestedByProduct = dto.Items
            .GroupBy(i => i.ProductId)
            .ToDictionary(g => g.Key, g => g.Sum(i => i.Quantity));

        foreach (var (productId, requestedQuantity) in requestedByProduct)
        {
            var movements = await db.StockMovements
                .Where(m => m.ProductId == productId)
                .Select(m => new { m.Type, m.Quantity })
                .ToListAsync();
            var currentStock = movements.Sum(m => m.Type == MovementType.Sale ? -m.Quantity : m.Quantity);

            if (currentStock < requestedQuantity)
                return (null, $"Insufficient stock for {products[productId].Name}. Available: {currentStock}.");
        }

        var saleItems = dto.Items.Select(item =>
        {
            var product = products[item.ProductId];
            return new SaleItem
            {
                ProductId = item.ProductId,
                Quantity = item.Quantity,
                BasePrice = product.SellingPrice,
                FinalPrice = item.FinalPrice ?? product.SellingPrice,
                DiscountAmount = item.DiscountAmount
            };
        }).ToList();

        var sale = new Sale
        {
            UserId = dto.UserId,
            Type = saleType,
            CustomerId = dto.CustomerId,
            DiscountAmount = dto.DiscountAmount,
            CreatedAt = DateTime.UtcNow,
            TotalAmount = saleItems.Sum(i => i.FinalPrice * i.Quantity) - dto.DiscountAmount,
            Items = saleItems
        };

        // Both saves must succeed or fail together — otherwise a sale could be recorded
        // without its stock ever being decremented (or vice versa).
        await using var transaction = await db.Database.BeginTransactionAsync();

        db.Sales.Add(sale);
        await db.SaveChangesAsync();

        foreach (var item in saleItems)
        {
            db.StockMovements.Add(new StockMovement
            {
                ProductId = item.ProductId,
                Type = MovementType.Sale,
                Quantity = item.Quantity,
                Note = $"Sale #{sale.Id}"
            });
        }
        await db.SaveChangesAsync();

        await transaction.CommitAsync();

        return (await GetSaleDtoAsync(sale.Id), null);
    }

    public async Task<List<SaleDto>> GetSalesAsync(DateTime? date)
    {
        var query = db.Sales
            .Include(s => s.User)
            .Include(s => s.Customer)
            .Include(s => s.Items).ThenInclude(i => i.Product)
            .AsQueryable();

        if (date.HasValue)
        {
            var start = date.Value.Date;
            var end = start.AddDays(1);
            query = query.Where(s => s.CreatedAt >= start && s.CreatedAt < end);
        }

        var sales = await query.OrderByDescending(s => s.CreatedAt).ToListAsync();
        return sales.Select(MapToDto).ToList();
    }

    public async Task<SaleDto?> GetByIdAsync(int id)
    {
        return await GetSaleDtoAsync(id);
    }

    private async Task<SaleDto?> GetSaleDtoAsync(int id)
    {
        var sale = await db.Sales
            .Include(s => s.User)
            .Include(s => s.Customer)
            .Include(s => s.Items).ThenInclude(i => i.Product)
            .FirstOrDefaultAsync(s => s.Id == id);

        return sale == null ? null : MapToDto(sale);
    }

    private static SaleDto MapToDto(Sale sale) => new(
        sale.Id,
        sale.UserId,
        sale.User.Username,
        sale.CustomerId,
        sale.Customer?.Name,
        (int)sale.Type,
        sale.TotalAmount,
        sale.DiscountAmount,
        sale.CreatedAt,
        sale.Items.Select(i => new SaleItemDto(
            i.ProductId, i.Product.Name, i.Quantity,
            i.BasePrice, i.FinalPrice, i.DiscountAmount)).ToList()
    );
}
