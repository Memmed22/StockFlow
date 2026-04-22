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
            .Where(s => s.CustomerId.HasValue && ids.Contains(s.CustomerId.Value))
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

        var balance = sales.Sum(s => s.TotalAmount);

        var info = new CustomerDto(
            customer.Id, customer.Name, customer.PhoneNumber,
            customer.Description, balance, customer.CreatedAt);

        var transactions = sales.Select(s =>
        {
            List<CustomerTransactionItemDto>? items = null;
            if (s.Type == SaleType.CashSale || s.Type == SaleType.DebitSale)
            {
                items = s.Items.Select(i => new CustomerTransactionItemDto(
                    i.Product.Name, i.Quantity, i.FinalPrice, i.Quantity * i.FinalPrice)).ToList();
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

    private async Task<decimal> GetBalanceAsync(int customerId)
    {
        var amounts = await db.Sales
            .Where(s => s.CustomerId == customerId)
            .Select(s => s.TotalAmount)
            .ToListAsync();
        return amounts.Sum();
    }
}
