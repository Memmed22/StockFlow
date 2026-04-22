using Microsoft.EntityFrameworkCore;
using StockFlow.API.Data;
using StockFlow.API.DTOs;
using StockFlow.API.Models;

namespace StockFlow.API.Services;

public class UserService(AppDbContext db)
{
    public async Task<LoginResponseDto?> LoginAsync(LoginDto dto)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Username == dto.Username);
        if (user == null) return null;
        if (!BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash)) return null;
        return new LoginResponseDto(user.Id, user.Username, user.Role);
    }

    public async Task<(UserDto? user, string? error)> CreateUserAsync(CreateUserDto dto)
    {
        if (await db.Users.AnyAsync(u => u.Username == dto.Username))
            return (null, "Username already exists.");

        var user = new User
        {
            Username = dto.Username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
            Role = dto.Role
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();
        return (new UserDto(user.Id, user.Username, user.Role), null);
    }

    public async Task<List<UserDto>> GetAllAsync()
    {
        return await db.Users
            .Select(u => new UserDto(u.Id, u.Username, u.Role))
            .ToListAsync();
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var user = await db.Users.FindAsync(id);
        if (user == null) return false;
        db.Users.Remove(user);
        await db.SaveChangesAsync();
        return true;
    }
}
