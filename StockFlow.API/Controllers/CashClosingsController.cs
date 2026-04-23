using Microsoft.AspNetCore.Mvc;
using StockFlow.API.DTOs;
using StockFlow.API.Services;

namespace StockFlow.API.Controllers;

[ApiController]
[Route("api/cashclosings")]
public class CashClosingsController(CashClosingService cashClosingService) : ControllerBase
{
    [HttpGet("preview")]
    public async Task<IActionResult> Preview()
        => Ok(await cashClosingService.GetPreviewAsync());

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCashClosingDto dto)
    {
        var (result, error) = await cashClosingService.CreateClosingAsync(dto);
        if (error != null) return BadRequest(new { error });
        return Ok(result);
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
        => Ok(await cashClosingService.GetAllAsync());
}
