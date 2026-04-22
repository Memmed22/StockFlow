namespace StockFlow.API.DTOs;

public record CreateCustomerDto(string Name, string PhoneNumber, string? Description);

public record CustomerDto(int Id, string Name, string PhoneNumber, string? Description, decimal Balance, DateTime CreatedAt);

public record CustomerTransactionItemDto(string ProductName, decimal Quantity, decimal UnitPrice, decimal Total);

public record CustomerTransactionDto(int Id, string Type, decimal Amount, DateTime CreatedAt, List<CustomerTransactionItemDto>? Items);

public record CustomerDetailDto(CustomerDto Info, List<CustomerTransactionDto> Transactions);

public record RecordPaymentDto(int UserId, decimal Amount);
