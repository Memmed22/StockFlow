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

    public async Task<InventoryValueDto> GetInventoryValueAsync()
    {
        var products = await db.Products
            .Select(p => new { p.Id, p.BuyingPrice, p.SellingPrice })
            .ToListAsync();

        var movements = await db.StockMovements
            .Select(m => new { m.ProductId, m.Type, m.Quantity })
            .ToListAsync();

        var stockByProduct = movements
            .GroupBy(m => m.ProductId)
            .ToDictionary(g => g.Key, g => g.Sum(m => m.Type == MovementType.Sale ? -m.Quantity : m.Quantity));

        decimal totalBuying = 0, totalSelling = 0;
        foreach (var p in products)
        {
            var stock = stockByProduct.TryGetValue(p.Id, out var s) ? s : 0;
            if (stock <= 0) continue;
            totalBuying += stock * (p.BuyingPrice ?? 0);
            totalSelling += stock * p.SellingPrice;
        }

        return new InventoryValueDto(totalBuying, totalSelling);
    }

    public async Task<(ProductDto? product, string? error)> CreateAsync(CreateProductDto dto)
    {
        if (dto.BuyingPrice <= 0) return (null, "Buying price is required and must be greater than 0.");
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

    public async Task<(ProductDto? product, string? error)> UpdateAsync(int id, UpdateProductDto dto, int? changedByUserId)
    {
        if (dto.BuyingPrice <= 0) return (null, "Buying price is required and must be greater than 0.");
        var product = await db.Products.FindAsync(id);
        if (product == null) return (null, "Product not found.");

        if (await db.Products.AnyAsync(p => p.Barcode == dto.Barcode && p.Id != id))
            return (null, "Barcode already exists.");

        var historyRows = new List<ProductHistory>();
        void TrackChange(string field, string? oldVal, string? newVal)
        {
            if (oldVal == newVal) return;
            historyRows.Add(new ProductHistory
            {
                ProductId = id,
                FieldName = field,
                OldValue = oldVal,
                NewValue = newVal,
                ChangedByUserId = changedByUserId
            });
        }

        TrackChange("Name", product.Name, dto.Name);
        TrackChange("Barcode", product.Barcode, dto.Barcode);
        TrackChange("SellingPrice", product.SellingPrice.ToString("F2"), dto.SellingPrice.ToString("F2"));
        TrackChange("BuyingPrice", product.BuyingPrice?.ToString("F2"), dto.BuyingPrice.ToString("F2"));
        TrackChange("UnitType", product.UnitType.ToString(), dto.UnitType.ToString());
        TrackChange("Description", product.Description, dto.Description);

        product.Name = dto.Name;
        product.Barcode = dto.Barcode;
        product.SellingPrice = dto.SellingPrice;
        product.BuyingPrice = dto.BuyingPrice;
        product.UnitType = dto.UnitType;
        product.Description = dto.Description;

        if (historyRows.Count > 0) db.ProductHistory.AddRange(historyRows);

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

    // Movements and field-update history are two separate small, per-product-filtered
    // result sets — merging and paging them in memory is simpler than a raw SQL UNION
    // and cheap enough at this app's data volumes.
    public async Task<PagedResult<ProductHistoryEntryDto>> GetHistoryAsync(int productId, int page, int pageSize)
    {
        var movements = await db.StockMovements
            .Where(m => m.ProductId == productId)
            .Select(m => new ProductHistoryEntryDto(
                m.CreatedAt, m.Type.ToString(), null, m.Quantity, null, null, null, null))
            .ToListAsync();

        var fieldChanges = await db.ProductHistory
            .Where(h => h.ProductId == productId)
            .Select(h => new ProductHistoryEntryDto(
                h.ChangedAt, "FieldUpdate", h.FieldName, null, h.OldValue, h.NewValue,
                h.ChangedByUserId, h.ChangedByUser != null ? h.ChangedByUser.Username : null))
            .ToListAsync();

        var merged = movements.Concat(fieldChanges)
            .OrderByDescending(e => e.Timestamp)
            .ToList();

        var totalCount = merged.Count;
        var pageItems = merged.Skip((page - 1) * pageSize).Take(pageSize).ToList();

        return new PagedResult<ProductHistoryEntryDto>(pageItems, totalCount, page, pageSize);
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
