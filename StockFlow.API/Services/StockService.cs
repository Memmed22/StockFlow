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

        var movement = new StockMovement
        {
            ProductId = dto.ProductId,
            Type = MovementType.StockIn,
            Quantity = dto.Quantity,
            Note = dto.Note
        };

        db.StockMovements.Add(movement);
        await db.SaveChangesAsync();

        return (new StockMovementDto(
            movement.Id, product.Id, product.Name, product.Barcode,
            "StockIn", movement.Quantity, movement.Note, movement.CreatedAt), null);
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
