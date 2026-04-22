using Microsoft.EntityFrameworkCore;
using StockFlow.API.Data;
using StockFlow.API.DTOs;
using StockFlow.API.Models;

namespace StockFlow.API.Services;

public class ProductService(AppDbContext db)
{
    public async Task<List<ProductDto>> GetAllAsync(string? search)
    {
        var query = db.Products.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var lower = search.Trim().ToLower();
            query = query.Where(p => p.Name.ToLower().Contains(lower) || p.Barcode.ToLower().Contains(lower));
        }

        var products = await query.ToListAsync();
        var result = new List<ProductDto>();

        foreach (var p in products)
        {
            var stock = await GetStockQuantity(p.Id);
            result.Add(MapToDto(p, stock));
        }

        return result;
    }

    public async Task<ProductDto?> GetByIdAsync(int id)
    {
        var p = await db.Products.FindAsync(id);
        if (p == null) return null;
        return MapToDto(p, await GetStockQuantity(p.Id));
    }

    public async Task<ProductDto?> GetByBarcodeAsync(string barcode)
    {
        var p = await db.Products.FirstOrDefaultAsync(x => x.Barcode == barcode);
        if (p == null) return null;
        return MapToDto(p, await GetStockQuantity(p.Id));
    }

    public async Task<(ProductDto? product, string? error)> CreateAsync(CreateProductDto dto)
    {
        if (await db.Products.AnyAsync(p => p.Barcode == dto.Barcode))
            return (null, "Barcode already exists.");

        var product = new Product
        {
            Name = dto.Name,
            Barcode = dto.Barcode,
            SellingPrice = dto.SellingPrice,
            BuyingPrice = dto.BuyingPrice,
            UnitType = dto.UnitType,
            Description = dto.Description
        };

        db.Products.Add(product);
        await db.SaveChangesAsync();
        return (MapToDto(product, 0), null);
    }

    public async Task<(ProductDto? product, string? error)> UpdateAsync(int id, UpdateProductDto dto)
    {
        var product = await db.Products.FindAsync(id);
        if (product == null) return (null, "Product not found.");

        if (await db.Products.AnyAsync(p => p.Barcode == dto.Barcode && p.Id != id))
            return (null, "Barcode already exists.");

        product.Name = dto.Name;
        product.Barcode = dto.Barcode;
        product.SellingPrice = dto.SellingPrice;
        product.BuyingPrice = dto.BuyingPrice;
        product.UnitType = dto.UnitType;
        product.Description = dto.Description;

        await db.SaveChangesAsync();
        return (MapToDto(product, await GetStockQuantity(id)), null);
    }

    public async Task<List<ProductSearchDto>> SearchAsync(string query, int limit = 20)
    {
        var q = query.Trim();
        var lower = q.ToLower();
        return await db.Products
            .Where(p => p.Name.ToLower().Contains(lower) || p.Barcode.ToLower().Contains(lower))
            .Take(limit)
            .Select(p => new ProductSearchDto(p.Id, p.Name, p.Barcode, p.SellingPrice, p.UnitType))
            .ToListAsync();
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var product = await db.Products.FindAsync(id);
        if (product == null) return false;
        db.Products.Remove(product);
        await db.SaveChangesAsync();
        return true;
    }

    private async Task<decimal> GetStockQuantity(int productId)
    {
        var movements = await db.StockMovements
            .Where(m => m.ProductId == productId)
            .Select(m => new { m.Type, m.Quantity })
            .ToListAsync();
        return movements.Sum(m => m.Type == MovementType.Sale ? -m.Quantity : m.Quantity);
    }

    private static ProductDto MapToDto(Product p, decimal stock) => new(
        p.Id, p.Name, p.Barcode, p.SellingPrice, p.BuyingPrice, p.UnitType, p.Description, stock);
}
