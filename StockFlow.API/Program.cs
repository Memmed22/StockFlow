using Microsoft.EntityFrameworkCore;
using StockFlow.API.Data;
using StockFlow.API.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")
        ?? "Data Source=stockflow.db"));

builder.Services.AddScoped<ProductService>();
builder.Services.AddScoped<StockService>();
builder.Services.AddScoped<SaleService>();
builder.Services.AddScoped<ReturnService>();
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<ReportService>();
builder.Services.AddScoped<CustomerService>();

builder.Services.AddControllers();
builder.Services.AddCors(opt =>
    opt.AddDefaultPolicy(p => p
        .WithOrigins("http://localhost:5173")
        .AllowAnyMethod()
        .AllowAnyHeader()));

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
    SeedData(db);
}

app.UseExceptionHandler(err => err.Run(async ctx => {
    ctx.Response.StatusCode = 500;
    ctx.Response.ContentType = "application/json";
    var ex = ctx.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>();
    await ctx.Response.WriteAsJsonAsync(new { error = ex?.Error.Message ?? "Internal server error" });
}));

app.UseCors();
app.MapControllers();
app.Run("http://localhost:5000");

static void SeedData(AppDbContext db)
{
    if (!db.Users.Any())
    {
        db.Users.Add(new StockFlow.API.Models.User
        {
            Username = "admin",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123"),
            Role = "Admin"
        });
        db.SaveChanges();
    }
}
