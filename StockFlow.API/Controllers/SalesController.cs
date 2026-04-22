using Microsoft.AspNetCore.Mvc;
using StockFlow.API.DTOs;
using StockFlow.API.Services;

namespace StockFlow.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SalesController(SaleService saleService) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> CreateSale([FromBody] CreateSaleDto dto)
    {
        var (sale, error) = await saleService.CreateSaleAsync(dto);
        if (error != null) return BadRequest(new { error });
        return CreatedAtAction(nameof(GetById), new { id = sale!.Id }, sale);
    }

    [HttpGet]
    public async Task<IActionResult> GetSales([FromQuery] DateTime? date)
        => Ok(await saleService.GetSalesAsync(date));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var sale = await saleService.GetByIdAsync(id);
        return sale == null ? NotFound() : Ok(sale);
    }
}
