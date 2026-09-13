namespace StockFlow.API.Services;

// Periodically backs up this shop's local DB to Azure Blob Storage (see CloudSyncService).
// Runs outside any request scope, so it resolves a scoped CloudSyncService/AppDbContext
// per tick via IServiceScopeFactory.
public class CloudSyncBackgroundService(IServiceScopeFactory scopeFactory, IConfiguration config) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            // Let startup/migration settle before the first cycle.
            await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        var intervalHours = config.GetValue("Sync:IntervalHours", 4);
        using var timer = new PeriodicTimer(TimeSpan.FromHours(intervalHours > 0 ? intervalHours : 4));

        do
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var sync = scope.ServiceProvider.GetRequiredService<CloudSyncService>();
                await sync.RunSyncCycleAsync(stoppingToken);
            }
            catch
            {
                // CloudSyncService already records failures internally in sync-status.json —
                // an unhandled exception escaping here would silently kill this hosted service
                // for the rest of the process's life. Never let that happen.
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
