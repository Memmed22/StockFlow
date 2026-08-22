using Microsoft.EntityFrameworkCore;
using StockFlow.API.Data;
using StockFlow.API.DTOs;
using StockFlow.API.Models;

namespace StockFlow.API.Services;

public class CustomerService(AppDbContext db)
{
    public async Task<List<CustomerDto>> GetAllAsync(string? search)
    {
        var query = db.Customers.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var lower = search.Trim().ToLower();
            query = query.Where(c => c.Name.ToLower().Contains(lower) || c.PhoneNumber.Contains(search.Trim()));
        }

        var customers = await query.OrderBy(c => c.Name).ToListAsync();

        var ids = customers.Select(c => c.Id).ToList();
        var allSales = await db.Sales
            .Where(s => s.CustomerId.HasValue && ids.Contains(s.CustomerId.Value)
                && (s.Type == SaleType.DebitSale || s.Type == SaleType.CreditReturn || s.Type == SaleType.Payment))
            .Select(s => new { s.CustomerId, s.TotalAmount })
            .ToListAsync();

        var balances = allSales
            .GroupBy(s => s.CustomerId!.Value)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.TotalAmount));

        return customers.Select(c => new CustomerDto(
            c.Id, c.Name, c.PhoneNumber, c.Description,
            balances.GetValueOrDefault(c.Id, 0m),
            c.CreatedAt)).ToList();
    }

    public async Task<CustomerDetailDto?> GetByIdAsync(int id)
    {
        var customer = await db.Customers.FindAsync(id);
        if (customer == null) return null;

        var sales = await db.Sales
            .Include(s => s.Items).ThenInclude(i => i.Product)
            .Where(s => s.CustomerId == id)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync();

        var returnSaleIds = sales
            .Where(s => s.Type == SaleType.Return || s.Type == SaleType.CreditReturn)
            .Select(s => s.Id)
            .ToList();
        var returnMovementsBySaleId = await db.StockMovements
            .Include(m => m.Product)
            .Where(m => m.SaleId.HasValue && returnSaleIds.Contains(m.SaleId.Value))
            .ToDictionaryAsync(m => m.SaleId!.Value);

        // Only debt-affecting transaction types count toward the outstanding balance:
        // a cash sale is paid in full immediately, and a cash-refunded return pays out
        // from the register rather than adjusting what the customer owes.
        var balance = sales
            .Where(s => s.Type == SaleType.DebitSale || s.Type == SaleType.CreditReturn || s.Type == SaleType.Payment)
            .Sum(s => s.TotalAmount);

        var info = new CustomerDto(
            customer.Id, customer.Name, customer.PhoneNumber,
            customer.Description, balance, customer.CreatedAt);

        var transactions = sales.Select(s =>
        {
            List<CustomerTransactionItemDto>? items = null;
            if (s.Type == SaleType.CashSale || s.Type == SaleType.DebitSale)
            {
                items = s.Items.Select(i => new CustomerTransactionItemDto(
                    i.Product.Name, i.Product.Barcode, i.Quantity, i.FinalPrice, i.Quantity * i.FinalPrice)).ToList();
            }
            else if ((s.Type == SaleType.Return || s.Type == SaleType.CreditReturn)
                && returnMovementsBySaleId.TryGetValue(s.Id, out var movement))
            {
                var unitPrice = movement.ReturnPrice ?? 0m;
                items = [new CustomerTransactionItemDto(movement.Product.Name, movement.Product.Barcode, movement.Quantity, unitPrice, movement.Quantity * unitPrice)];
            }
            return new CustomerTransactionDto(s.Id, s.Type.ToString(), s.TotalAmount, s.CreatedAt, items);
        }).ToList();

        return new CustomerDetailDto(info, transactions);
    }

    public async Task<(CustomerDto? dto, string? error)> CreateAsync(CreateCustomerDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return (null, "Customer name is required.");
        if (string.IsNullOrWhiteSpace(dto.PhoneNumber))
            return (null, "Phone number is required.");

        var customer = new Customer
        {
            Name = dto.Name.Trim(),
            PhoneNumber = dto.PhoneNumber.Trim(),
            Description = dto.Description?.Trim()
        };

        db.Customers.Add(customer);
        await db.SaveChangesAsync();

        return (new CustomerDto(customer.Id, customer.Name, customer.PhoneNumber,
            customer.Description, 0m, customer.CreatedAt), null);
    }

    public async Task<(CustomerDto? dto, string? error)> RecordPaymentAsync(int customerId, RecordPaymentDto dto)
    {
        var customer = await db.Customers.FindAsync(customerId);
        if (customer == null) return (null, "Customer not found.");
        if (dto.Amount <= 0) return (null, "Payment amount must be greater than zero.");

        db.Sales.Add(new Sale
        {
            UserId = dto.UserId,
            CustomerId = customerId,
            Type = SaleType.Payment,
            TotalAmount = -dto.Amount,
            DiscountAmount = 0,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var balance = await GetBalanceAsync(customerId);
        return (new CustomerDto(customer.Id, customer.Name, customer.PhoneNumber,
            customer.Description, balance, customer.CreatedAt), null);
    }

    public async Task<(bool ok, string? error)> DeleteAsync(int id)
    {
        var customer = await db.Customers.FindAsync(id);
        if (customer == null) return (false, "Customer not found.");

        // Keep purchase/return/payment history for reporting, just detach it from the
        // deleted customer (anonymize) so their outstanding balance no longer appears anywhere.
        await db.Sales
            .Where(s => s.CustomerId == id)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.CustomerId, (int?)null));
        await db.StockMovements
            .Where(m => m.CustomerId == id)
            .ExecuteUpdateAsync(m => m.SetProperty(x => x.CustomerId, (int?)null));

        db.Customers.Remove(customer);
        await db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool Purchased, decimal? LastPrice)> GetProductPurchaseInfoAsync(int customerId, int productId)
    {
        var lastPurchase = await db.Sales
            .Where(s => s.CustomerId == customerId && (s.Type == SaleType.CashSale || s.Type == SaleType.DebitSale))
            .SelectMany(s => s.Items, (s, i) => new { s.CreatedAt, i.ProductId, i.FinalPrice })
            .Where(x => x.ProductId == productId)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync();

        return (lastPurchase != null, lastPurchase?.FinalPrice);
    }

    private async Task<decimal> GetBalanceAsync(int customerId)
    {
        var amounts = await db.Sales
            .Where(s => s.CustomerId == customerId && s.Type != SaleType.CashSale)
            .Select(s => s.TotalAmount)
            .ToListAsync();
        return amounts.Sum();
    }
}
