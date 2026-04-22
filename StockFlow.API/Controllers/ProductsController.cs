using Microsoft.AspNetCore.Mvc;
using StockFlow.API.DTOs;
using StockFlow.API.Filters;
using StockFlow.API.Services;

namespace StockFlow.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProductsController(ProductService productService) : ControllerBase
{
    [HttpGet]
    [RequireAdmin]
    public async Task<IActionResult> GetAll([FromQuery] string? search)
        => Ok(await productService.GetAllAsync(search));

    [HttpGet("search")]
    [RequireAdmin]
    public async Task<IActionResult> Search([FromQuery] string query)
    {
        if (string.IsNullOrWhiteSpace(query)) return Ok(Array.Empty<object>());
        return Ok(await productService.SearchAsync(query));
    }

    [HttpGet("{id:int}")]
    [RequireAdmin]
    public async Task<IActionResult> GetById(int id)
    {
        var product = await productService.GetByIdAsync(id);
        return product == null ? NotFound() : Ok(product);
    }

    [HttpGet("barcode/{barcode}")]
    public async Task<IActionResult> GetByBarcode(string barcode)
    {
        var product = await productService.GetByBarcodeAsync(barcode);
        return product == null ? NotFound() : Ok(product);
    }

    [HttpPost]
    [RequireAdmin]
    public async Task<IActionResult> Create([FromBody] CreateProductDto dto)
    {
        var (product, error) = await productService.CreateAsync(dto);
        if (error != null) return BadRequest(new { error });
        return CreatedAtAction(nameof(GetById), new { id = product!.Id }, product);
    }

    [HttpPut("{id:int}")]
    [RequireAdmin]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateProductDto dto)
    {
        var (product, error) = await productService.UpdateAsync(id, dto);
        if (error != null) return BadRequest(new { error });
        return product == null ? NotFound() : Ok(product);
    }

    [HttpDelete("{id:int}")]
    [RequireAdmin]
    public async Task<IActionResult> Delete(int id)
    {
        var deleted = await productService.DeleteAsync(id);
        return deleted ? NoContent() : NotFound();
    }
}
