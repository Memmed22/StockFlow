using Microsoft.AspNetCore.Mvc;
using StockFlow.API.DTOs;
using StockFlow.API.Filters;
using StockFlow.API.Services;

namespace StockFlow.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UsersController(UserService userService) : ControllerBase
{
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto dto)
    {
        var result = await userService.LoginAsync(dto);
        return result == null ? Unauthorized(new { error = "Invalid credentials." }) : Ok(result);
    }

    [HttpPost]
    [RequireAdmin]
    public async Task<IActionResult> Create([FromBody] CreateUserDto dto)
    {
        var (user, error) = await userService.CreateUserAsync(dto);
        if (error != null) return BadRequest(new { error });
        return Ok(user);
    }

    [HttpGet]
    [RequireAdmin]
    public async Task<IActionResult> GetAll()
        => Ok(await userService.GetAllAsync());

    [HttpDelete("{id:int}")]
    [RequireAdmin]
    public async Task<IActionResult> Delete(int id)
    {
        var deleted = await userService.DeleteAsync(id);
        return deleted ? NoContent() : NotFound();
    }
}
