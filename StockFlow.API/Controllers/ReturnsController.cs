using Microsoft.AspNetCore.Mvc;
using StockFlow.API.DTOs;
using StockFlow.API.Services;

namespace StockFlow.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReturnsController(ReturnService returnService) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> ProcessReturn([FromBody] ReturnDto dto)
    {
        var (movement, error) = await returnService.ProcessReturnAsync(dto);
        if (error != null) return BadRequest(new { error });
        return Ok(movement);
    }
}
