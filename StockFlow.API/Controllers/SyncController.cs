using Microsoft.AspNetCore.Mvc;
using StockFlow.API.DTOs;
using StockFlow.API.Filters;
using StockFlow.API.Services;

namespace StockFlow.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SyncController(CloudSyncService syncService) : ControllerBase
{
    // Visible to any logged-in role — the health banner is informational, not an admin action.
    [HttpGet("status")]
    public async Task<IActionResult> Status() => Ok(await syncService.GetStatusAsync());

    [HttpPost("sync-now")]
    [RequireAdmin]
    public async Task<IActionResult> SyncNow()
    {
        await syncService.RunSyncCycleAsync(HttpContext.RequestAborted);
        return Ok(await syncService.GetStatusAsync());
    }

    [HttpGet("snapshots")]
    [RequireAdmin]
    public async Task<IActionResult> Snapshots() => Ok(await syncService.ListSnapshotsAsync());

    [HttpPost("restore")]
    [RequireAdmin]
    public async Task<IActionResult> Restore([FromBody] RestoreRequestDto? dto)
    {
        var (ok, error) = await syncService.RestoreAsync(dto?.BlobName);
        if (!ok) return BadRequest(new { error });
        return Ok(new { message = "Restore started, application will restart shortly." });
    }
}
