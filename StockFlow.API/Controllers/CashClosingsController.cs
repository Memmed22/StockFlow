using Microsoft.AspNetCore.Mvc;
using StockFlow.API.DTOs;
using StockFlow.API.Services;

namespace StockFlow.API.Controllers;

[ApiController]
[Route("api/cashclosings")]
public class CashClosingsController(CashClosingService cashClosingService) : ControllerBase
{
    [HttpGet("opening/status")]
    public async Task<IActionResult> OpeningStatus()
        => Ok(await cashClosingService.GetOpeningStatusAsync());

    [HttpPost("opening")]
    public async Task<IActionResult> CreateOpening([FromBody] CreateOpeningCashDto dto)
    {
        var (ok, error) = await cashClosingService.CreateOpeningCashAsync(dto);
        if (!ok) return BadRequest(new { error });
        return Ok();
    }

    [HttpGet("preview")]
    public async Task<IActionResult> Preview()
        => Ok(await cashClosingService.GetPreviewAsync());

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCashClosingDto dto)
    {
        var (result, telegramError) = await cashClosingService.CreateClosingAsync(dto);
        if (result == null) return BadRequest(new { error = telegramError });
        return Ok(new { closing = result, telegramError });
    }

    [HttpPost("telegram/test")]
    public async Task<IActionResult> TelegramTest()
    {
        var error = await cashClosingService.SendTestAsync();
        return Ok(new { sent = error == null, error });
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
        => Ok(await cashClosingService.GetAllAsync());
}
