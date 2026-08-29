using Microsoft.EntityFrameworkCore;
using StockFlow.API.Data;
using StockFlow.API.DTOs;
using StockFlow.API.Models;

namespace StockFlow.API.Services;

public class CompanyService(AppDbContext db)
{
    public async Task<List<CompanyDto>> GetAllAsync(string? search)
    {
        var query = db.Companies.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var lower = search.Trim().ToLower();
            query = query.Where(c => c.Name.ToLower().Contains(lower) || c.Code.ToLower().Contains(lower));
        }

        return await query
            .OrderBy(c => c.Name)
            .Select(c => new CompanyDto(c.Id, c.Name, c.Code, c.ContactPerson, c.PhoneNumber, c.Description, c.CreatedAt))
            .ToListAsync();
    }

    public async Task<CompanyDto?> GetByIdAsync(int id)
    {
        var c = await db.Companies.FindAsync(id);
        if (c == null) return null;
        return new CompanyDto(c.Id, c.Name, c.Code, c.ContactPerson, c.PhoneNumber, c.Description, c.CreatedAt);
    }

    public async Task<(CompanyDto? company, string? error)> CreateAsync(CreateCompanyDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) return (null, "Company name is required.");
        if (string.IsNullOrWhiteSpace(dto.Code)) return (null, "Company code is required.");
        if (await db.Companies.AnyAsync(c => c.Code == dto.Code))
            return (null, "Company code already exists.");

        var company = new Company
        {
            Name = dto.Name.Trim(),
            Code = dto.Code.Trim(),
            ContactPerson = dto.ContactPerson?.Trim(),
            PhoneNumber = dto.PhoneNumber?.Trim(),
            Description = dto.Description?.Trim()
        };

        db.Companies.Add(company);
        await db.SaveChangesAsync();

        return (new CompanyDto(company.Id, company.Name, company.Code, company.ContactPerson,
            company.PhoneNumber, company.Description, company.CreatedAt), null);
    }

    public async Task<(CompanyDto? company, string? error)> UpdateAsync(int id, UpdateCompanyDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) return (null, "Company name is required.");
        if (string.IsNullOrWhiteSpace(dto.Code)) return (null, "Company code is required.");

        var company = await db.Companies.FindAsync(id);
        if (company == null) return (null, "Company not found.");

        if (await db.Companies.AnyAsync(c => c.Code == dto.Code && c.Id != id))
            return (null, "Company code already exists.");

        company.Name = dto.Name.Trim();
        company.Code = dto.Code.Trim();
        company.ContactPerson = dto.ContactPerson?.Trim();
        company.PhoneNumber = dto.PhoneNumber?.Trim();
        company.Description = dto.Description?.Trim();

        await db.SaveChangesAsync();

        return (new CompanyDto(company.Id, company.Name, company.Code, company.ContactPerson,
            company.PhoneNumber, company.Description, company.CreatedAt), null);
    }

    public async Task<(bool ok, string? error)> DeleteAsync(int id)
    {
        var company = await db.Companies.FindAsync(id);
        if (company == null) return (false, "Company not found.");

        // Keep stock-in history for reporting, just detach it from the deleted company.
        await db.StockMovements
            .Where(m => m.CompanyId == id)
            .ExecuteUpdateAsync(m => m.SetProperty(x => x.CompanyId, (int?)null));

        db.Companies.Remove(company);
        await db.SaveChangesAsync();
        return (true, null);
    }
}
