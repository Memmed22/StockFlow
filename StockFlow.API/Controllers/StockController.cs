using Microsoft.AspNetCore.Mvc;
using StockFlow.API.DTOs;
using StockFlow.API.Filters;
using StockFlow.API.Services;

namespace StockFlow.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[RequireAdmin]
public class StockController(StockService stockService) : ControllerBase
{
    [HttpPost("in")]
    public async Task<IActionResult> StockIn([FromBody] StockInDto dto)
    {
        var (movement, error) = await stockService.StockInAsync(dto);
        if (error != null) return BadRequest(new { error });
        return Ok(movement);
    }

    [HttpGet("movements")]
    public async Task<IActionResult> GetMovements(
        [FromQuery] string? query,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 20;

        return Ok(await stockService.GetMovementsAsync(query, page, pageSize));
    }
}
