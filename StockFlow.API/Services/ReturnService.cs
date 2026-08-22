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
        if (dto.SettleAsCredit && !dto.CustomerId.HasValue)
            return (null, "Select a customer to settle a return as store credit.");
        var user = await db.Users.FindAsync(dto.UserId);
        if (user == null) return (null, "User not found.");

        var isCreditSettlement = dto.CustomerId.HasValue && dto.SettleAsCredit;

        // Cash settlement pays the customer from the register, so it reduces expected
        // cash but leaves their account balance untouched. Credit settlement does the
        // opposite: no cash moves, but it reduces (or overpays into credit) their balance.
        var returnAmount = -(dto.Quantity * dto.ReturnPrice);
        var sale = new Sale
        {
            UserId = dto.UserId,
            CustomerId = dto.CustomerId,
            Type = isCreditSettlement ? SaleType.CreditReturn : SaleType.Return,
            TotalAmount = returnAmount,
            DiscountAmount = 0,
            CreatedAt = DateTime.UtcNow
        };
        db.Sales.Add(sale);

        var movement = new StockMovement
        {
            ProductId = dto.ProductId,
            Type = MovementType.Return,
            Quantity = dto.Quantity,
            BasePrice = dto.BasePrice,
            ReturnPrice = dto.ReturnPrice,
            Note = dto.Note ?? "Customer return",
            CustomerId = dto.CustomerId,
            IsCreditReturn = isCreditSettlement,
            Sale = sale
        };

        db.StockMovements.Add(movement);

        await db.SaveChangesAsync();

        return (new StockMovementDto(
            movement.Id, product.Id, product.Name, product.Barcode,
            "Return", movement.Quantity, movement.Note, movement.CreatedAt), null);
    }
}
