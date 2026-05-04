using Microsoft.EntityFrameworkCore;
using StockFlow.API.Data;
using StockFlow.API.Services;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: false);

// Store database in data/ subfolder so it survives application updates.
// If an old stockflow.db exists next to the exe (pre-update install), move it.
var dataDir = Path.Combine(AppContext.BaseDirectory, "data");
Directory.CreateDirectory(dataDir);
var dbPath = Path.Combine(dataDir, "stockflow.db");
var legacyDbPath = Path.Combine(AppContext.BaseDirectory, "stockflow.db");
if (File.Exists(legacyDbPath) && !File.Exists(dbPath))
    File.Move(legacyDbPath, dbPath);

builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseSqlite($"Data Source={dbPath}"));

builder.Services.AddScoped<ProductService>();
builder.Services.AddScoped<StockService>();
builder.Services.AddScoped<SaleService>();
builder.Services.AddScoped<ReturnService>();
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<ReportService>();
builder.Services.AddScoped<CustomerService>();
builder.Services.AddScoped<CashClosingService>();
builder.Services.AddScoped<TelegramService>();

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

// test me 

app.UseExceptionHandler(err => err.Run(async ctx => {
    ctx.Response.StatusCode = 500;
    ctx.Response.ContentType = "application/json";
    var ex = ctx.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>();
    await ctx.Response.WriteAsJsonAsync(new { error = ex?.Error.Message ?? "Internal server error" });
}));

app.UseDefaultFiles();
app.UseStaticFiles();
app.UseCors();
app.MapControllers();
app.MapFallbackToFile("index.html");
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
