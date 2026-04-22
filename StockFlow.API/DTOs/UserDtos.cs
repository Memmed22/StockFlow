namespace StockFlow.API.DTOs;

public record LoginDto(string Username, string Password);

public record CreateUserDto(string Username, string Password, string Role = "Cashier");

public record UserDto(int Id, string Username, string Role);

public record LoginResponseDto(int Id, string Username, string Role);

public record ReturnDto(int ProductId, decimal Quantity, decimal BasePrice, decimal ReturnPrice, string? Note, int? CustomerId = null, int UserId = 0);
