using Microsoft.AspNetCore.Mvc;
using StockFlow.API.Filters;
using StockFlow.API.Services;

namespace StockFlow.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[RequireAdmin]
public class ReportsController(ReportService reportService) : ControllerBase
{
    [HttpGet("daily-sales")]
    public async Task<IActionResult> DailySales([FromQuery] DateTime? from, [FromQuery] DateTime? to)
        => Ok(await reportService.GetDailySalesAsync(from, to));

    [HttpGet("sales-per-user")]
    public async Task<IActionResult> SalesPerUser([FromQuery] DateTime? from, [FromQuery] DateTime? to)
        => Ok(await reportService.GetSalesPerUserAsync(from, to));

    [HttpGet("stock")]
    public async Task<IActionResult> StockReport()
        => Ok(await reportService.GetStockReportAsync());

    [HttpGet("detailed")]
    public async Task<IActionResult> DetailedReport([FromQuery] DateTime? from, [FromQuery] DateTime? to)
        => Ok(await reportService.GetDetailedReportAsync(from, to));
}
