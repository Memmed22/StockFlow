using Microsoft.AspNetCore.Mvc;
using StockFlow.API.DTOs;
using StockFlow.API.Filters;
using StockFlow.API.Services;

namespace StockFlow.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CustomersController(CustomerService customerService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? search)
        => Ok(await customerService.GetAllAsync(search));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var result = await customerService.GetByIdAsync(id);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPost]
    [RequireAdmin]
    public async Task<IActionResult> Create([FromBody] CreateCustomerDto dto)
    {
        var (customer, error) = await customerService.CreateAsync(dto);
        if (error != null) return BadRequest(new { error });
        return CreatedAtAction(nameof(GetById), new { id = customer!.Id }, customer);
    }

    [HttpGet("{id:int}/purchased/{productId:int}")]
    public async Task<IActionResult> HasPurchasedProduct(int id, int productId)
    {
        var (purchased, lastPrice) = await customerService.GetProductPurchaseInfoAsync(id, productId);
        return Ok(new CustomerPurchaseCheckDto(purchased, lastPrice));
    }

    [HttpPost("{id:int}/payment")]
    public async Task<IActionResult> RecordPayment(int id, [FromBody] RecordPaymentDto dto)
    {
        var (customer, error) = await customerService.RecordPaymentAsync(id, dto);
        if (error != null) return BadRequest(new { error });
        return Ok(customer);
    }

    [HttpDelete("{id:int}")]
    [RequireAdmin]
    public async Task<IActionResult> Delete(int id)
    {
        var (ok, error) = await customerService.DeleteAsync(id);
        if (!ok) return BadRequest(new { error });
        return Ok();
    }
}
