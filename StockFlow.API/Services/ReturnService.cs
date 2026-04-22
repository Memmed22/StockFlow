using StockFlow.API.Data;
using StockFlow.API.DTOs;
using StockFlow.API.Models;

namespace StockFlow.API.Services;

public class ReturnService(AppDbContext db)
{
    public async Task<(StockMovementDto? movement, string? error)> ProcessReturnAsync(ReturnDto dto)
    {
        var product = await db.Products.FindAsync(dto.ProductId);
        if (product == null) return (null, "Product not found.");
        if (dto.Quantity <= 0) return (null, "Quantity must be greater than zero.");
        if (dto.ReturnPrice < 0) return (null, "Return price cannot be negative.");

        var movement = new StockMovement
        {
            ProductId = dto.ProductId,
            Type = MovementType.Return,
            Quantity = dto.Quantity,
            BasePrice = dto.BasePrice,
            ReturnPrice = dto.ReturnPrice,
            Note = dto.Note ?? "Customer return"
        };

        db.StockMovements.Add(movement);

        if (dto.CustomerId.HasValue && dto.UserId > 0)
        {
            var returnAmount = -(dto.Quantity * dto.ReturnPrice);
            db.Sales.Add(new Sale
            {
                UserId = dto.UserId,
                CustomerId = dto.CustomerId.Value,
                Type = SaleType.Return,
                TotalAmount = returnAmount,
                DiscountAmount = 0,
                CreatedAt = DateTime.UtcNow
            });
        }

        await db.SaveChangesAsync();

        return (new StockMovementDto(
            movement.Id, product.Id, product.Name, product.Barcode,
            "Return", movement.Quantity, movement.Note, movement.CreatedAt), null);
    }
}
