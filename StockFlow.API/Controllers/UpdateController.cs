using Microsoft.AspNetCore.Mvc;
using StockFlow.API.DTOs;
using StockFlow.API.Filters;
using StockFlow.API.Services;

namespace StockFlow.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[RequireAdmin]
public class UpdateController(UpdateService updateService) : ControllerBase
{
    [HttpGet("check")]
    public async Task<IActionResult> Check()
    {
        var (result, error) = await updateService.CheckForUpdateAsync();
        if (error != null) return BadRequest(new { error });
        return Ok(result);
    }

    [HttpPost("apply")]
    public async Task<IActionResult> Apply([FromBody] ApplyUpdateDto dto)
    {
        var (ok, error) = await updateService.ApplyUpdateAsync(dto.DownloadUrl);
        if (!ok) return BadRequest(new { error });
        return Ok(new { message = "Update started, application will restart shortly." });
    }
}
