using Microsoft.EntityFrameworkCore;
using StockFlow.API.Data;
using StockFlow.API.DTOs;
using StockFlow.API.Models;

namespace StockFlow.API.Services;

public class StockService(AppDbContext db)
{
    public async Task<(StockMovementDto? movement, string? error)> StockInAsync(StockInDto dto)
    {
        var product = await db.Products.FindAsync(dto.ProductId);
        if (product == null) return (null, "Product not found.");
        if (dto.Quantity <= 0) return (null, "Quantity must be greater than zero.");

        var priceError = ApplyPriceUpdate(product, dto.BuyingPrice, dto.SellingPrice);
        if (priceError != null) return (null, priceError);

        var movement = new StockMovement
        {
            ProductId = dto.ProductId,
            Type = MovementType.StockIn,
            Quantity = dto.Quantity,
            BasePrice = dto.BuyingPrice ?? product.BuyingPrice,
            Note = dto.Note
        };

        db.StockMovements.Add(movement);
        await db.SaveChangesAsync();

        return (new StockMovementDto(
            movement.Id, product.Id, product.Name, product.Barcode,
            "StockIn", movement.Quantity, movement.Note, movement.CreatedAt), null);
    }

    public async Task<(BulkStockInResultDto? result, string? error)> BulkStockInAsync(BulkStockInDto dto)
    {
        if (dto.Items == null || dto.Items.Count == 0)
            return (null, "Purchase must have at least one item.");
        var user = await db.Users.FindAsync(dto.UserId);
        if (user == null) return (null, "User not found.");

        Company? company = null;
        if (dto.CompanyId.HasValue)
        {
            company = await db.Companies.FindAsync(dto.CompanyId.Value);
            if (company == null) return (null, "Company not found.");
        }

        var productIds = dto.Items.Select(i => i.ProductId).Distinct().ToList();
        var products = await db.Products
            .Where(p => productIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id);

        foreach (var line in dto.Items)
        {
            if (!products.TryGetValue(line.ProductId, out var product))
                return (null, $"Product {line.ProductId} not found.");
            if (line.Quantity <= 0) return (null, $"Invalid quantity for product {product.Name}.");
            if (line.BuyingPrice <= 0) return (null, $"Buying price must be greater than zero for {product.Name}.");
            if (line.SellingPrice.HasValue && line.SellingPrice <= 0)
                return (null, $"Selling price must be greater than zero for {product.Name}.");
        }

        var totalCost = dto.Items.Sum(i => i.Quantity * i.BuyingPrice);

        // Linked via the movements' SaleId (not a composed Note) so the client can localize
        // "Stock purchase — {company}" itself instead of receiving fixed English text.
        Sale? expenseSale = null;
        if (dto.PayFromRegister)
        {
            expenseSale = new Sale
            {
                UserId = dto.UserId,
                Type = SaleType.Expense,
                TotalAmount = -totalCost,
                DiscountAmount = 0,
                CreatedAt = DateTime.UtcNow
            };
            db.Sales.Add(expenseSale);
        }

        var movements = new List<StockMovement>();
        foreach (var line in dto.Items)
        {
            var product = products[line.ProductId];
            ApplyPriceUpdate(product, line.BuyingPrice, line.SellingPrice);

            movements.Add(new StockMovement
            {
                ProductId = line.ProductId,
                Type = MovementType.StockIn,
                Quantity = line.Quantity,
                BasePrice = line.BuyingPrice,
                CompanyId = dto.CompanyId,
                Sale = expenseSale
            });
        }
        db.StockMovements.AddRange(movements);

        await db.SaveChangesAsync();

        var movementDtos = movements.Select(m => new StockMovementDto(
            m.Id, m.ProductId, products[m.ProductId].Name, products[m.ProductId].Barcode,
            "StockIn", m.Quantity, m.Note, m.CreatedAt)).ToList();

        return (new BulkStockInResultDto(movementDtos, totalCost, dto.PayFromRegister), null);
    }

    // Updates the product's buying/selling price when a caller-supplied value differs from
    // what's on file — a stock-in is often the moment a supplier's price change is discovered.
    private static string? ApplyPriceUpdate(Product product, decimal? buyingPrice, decimal? sellingPrice)
    {
        if (buyingPrice.HasValue && buyingPrice <= 0) return "Buying price must be greater than zero.";
        if (sellingPrice.HasValue && sellingPrice <= 0) return "Selling price must be greater than zero.";

        if (buyingPrice.HasValue && buyingPrice != product.BuyingPrice)
            product.BuyingPrice = buyingPrice.Value;
        if (sellingPrice.HasValue && sellingPrice != product.SellingPrice)
            product.SellingPrice = sellingPrice.Value;

        return null;
    }

    public async Task<(StockMovementDto? movement, string? error)> AdjustStockAsync(StockAdjustmentDto dto)
    {
        var product = await db.Products.FindAsync(dto.ProductId);
        if (product == null) return (null, "Product not found.");
        if (dto.CorrectQuantity < 0) return (null, "Correct quantity cannot be negative.");

        var movements = await db.StockMovements
            .Where(m => m.ProductId == dto.ProductId)
            .Select(m => new { m.Type, m.Quantity })
            .ToListAsync();
        var currentStock = movements.Sum(m => m.Type == MovementType.Sale ? -m.Quantity : m.Quantity);

        var adjustment = dto.CorrectQuantity - currentStock;

        var movement = new StockMovement
        {
            ProductId = dto.ProductId,
            Type = MovementType.Adjustment,
            Quantity = adjustment,
            Note = dto.Note
        };

        db.StockMovements.Add(movement);
        await db.SaveChangesAsync();

        return (new StockMovementDto(
            movement.Id, product.Id, product.Name, product.Barcode,
            "Adjustment", adjustment, movement.Note, movement.CreatedAt), null);
    }

    public async Task<PagedResult<StockMovementDto>> GetMovementsAsync(
        string? query, int page, int pageSize)
    {
        var q = db.StockMovements
            .Include(m => m.Product)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(query))
            q = q.Where(m =>
                EF.Functions.Like(m.Product.Name, $"%{query}%") ||
                EF.Functions.Like(m.Product.Barcode, $"%{query}%"));

        var totalCount = await q.CountAsync();

        var items = await q
            .OrderByDescending(m => m.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(m => new StockMovementDto(
                m.Id, m.ProductId, m.Product.Name, m.Product.Barcode,
                m.Type.ToString(), m.Quantity, m.Note, m.CreatedAt))
            .ToListAsync();

        return new PagedResult<StockMovementDto>(items, totalCount, page, pageSize);
    }
}
