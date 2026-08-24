namespace StockFlow.API.DTOs;

public record CreateCompanyDto(string Name, string Code, string? ContactPerson, string? PhoneNumber, string? Description);

public record UpdateCompanyDto(string Name, string Code, string? ContactPerson, string? PhoneNumber, string? Description);

public record CompanyDto(int Id, string Name, string Code, string? ContactPerson, string? PhoneNumber, string? Description, DateTime CreatedAt);
