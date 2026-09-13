using System.Diagnostics;
using System.Text;
using System.Text.Json;
using Azure.Storage.Blobs;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using StockFlow.API.Data;
using StockFlow.API.DTOs;

namespace StockFlow.API.Services;

// One-way, backup-only cloud sync: this shop's local SQLite DB -> Azure Blob Storage.
// The running app never reads from the cloud during normal operation — only during an
// explicit, admin-triggered restore. Each shop/customer gets its own container
// ("customer-{CustomerId}") inside one shared Azure Storage account, so multiple shops
// sold with this app never collide or see each other's backups.
public class CloudSyncService(AppDbContext db, IConfiguration config, IHostApplicationLifetime lifetime)
{
    // Guards a full sync/restore cycle so a manual "sync now" and the background timer
    // can never run concurrently against the same DB/status file.
    private static readonly SemaphoreSlim _cycleLock = new(1, 1);

    public async Task RunSyncCycleAsync(CancellationToken ct = default)
    {
        if (!await _cycleLock.WaitAsync(0, ct))
            return; // a cycle is already in flight — skip this trigger rather than queueing up

        try
        {
            var status = await LoadStatusAsync();
            status.LastAttemptUtc = DateTime.UtcNow;
            string? snapshotPath = null;

            try
            {
                var dbPath = GetDbPath();
                var tmpDir = Path.Combine(Path.GetDirectoryName(dbPath)!, "tmp");
                Directory.CreateDirectory(tmpDir);

                var timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
                snapshotPath = Path.Combine(tmpDir, $"snapshot_{timestamp}.db");
                await CreateSnapshotAsync(dbPath, snapshotPath);

                var containerClient = GetContainerClient();
                await containerClient.CreateIfNotExistsAsync(cancellationToken: ct);

                var snapshotBlobName = $"snapshots/stockflow_{timestamp}.db";
                await using (var stream = File.OpenRead(snapshotPath))
                    await containerClient.GetBlobClient(snapshotBlobName).UploadAsync(stream, overwrite: true, cancellationToken: ct);

                await using (var stream = File.OpenRead(snapshotPath))
                    await containerClient.GetBlobClient("latest.db").UploadAsync(stream, overwrite: true, cancellationToken: ct);

                await PruneOldSnapshotsAsync(containerClient, ct);

                status.LastSuccessUtc = DateTime.UtcNow;
                status.LastError = null;
                status.ConsecutiveFailures = 0;
                status.LastSuccessBlobName = snapshotBlobName;
            }
            catch (Exception ex)
            {
                // Offline / misconfigured / Azure error — record and retry next interval.
                // Never let this escape: the background loop must keep retrying forever.
                status.LastError = ex.Message;
                status.ConsecutiveFailures++;
            }
            finally
            {
                if (snapshotPath != null && File.Exists(snapshotPath))
                {
                    try { File.Delete(snapshotPath); } catch { /* best effort cleanup */ }
                }
                await SaveStatusAsync(status);
            }
        }
        finally
        {
            _cycleLock.Release();
        }
    }

    public async Task<SyncStatusDto> GetStatusAsync()
    {
        var status = await LoadStatusAsync();
        var failureThreshold = config.GetValue("Sync:FailureThreshold", 3);
        var staleAfterHours = config.GetValue("Sync:StaleAfterHours", 12);
        var intervalHours = config.GetValue("Sync:IntervalHours", 4);
        var degraded = EvaluateDegraded(status, failureThreshold, staleAfterHours, intervalHours, DateTime.UtcNow);
        return new SyncStatusDto(status.LastSuccessUtc, status.LastAttemptUtc, degraded, status.LastError, status.ConsecutiveFailures);
    }

    public async Task<List<SnapshotInfoDto>> ListSnapshotsAsync()
    {
        var containerClient = GetContainerClient();
        var result = new List<SnapshotInfoDto>();
        await foreach (var item in containerClient.GetBlobsAsync(prefix: "snapshots/"))
            result.Add(new SnapshotInfoDto(item.Name, item.Properties.CreatedOn?.UtcDateTime, item.Properties.ContentLength));

        return result.OrderByDescending(s => s.BlobName, StringComparer.Ordinal).ToList();
    }

    // Mirrors UpdateService.ApplyUpdateAsync's technique: Windows locks a running exe's own
    // open files (including the SQLite db), so the swap must happen from a detached process
    // after this one exits.
    public async Task<(bool ok, string? error)> RestoreAsync(string? blobName)
    {
        try
        {
            var targetBlobName = string.IsNullOrWhiteSpace(blobName) ? "latest.db" : blobName;
            var containerClient = GetContainerClient();
            var blobClient = containerClient.GetBlobClient(targetBlobName);
            if (!await blobClient.ExistsAsync())
                return (false, $"Snapshot '{targetBlobName}' not found in cloud storage.");

            var dbPath = GetDbPath();
            var tmpDir = Path.Combine(Path.GetDirectoryName(dbPath)!, "tmp");
            Directory.CreateDirectory(tmpDir);

            var downloadPath = Path.Combine(tmpDir, $"restore_{DateTime.UtcNow:yyyyMMdd_HHmmss}.db");
            await blobClient.DownloadToAsync(downloadPath);

            var installDir = AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
            var scriptPath = Path.Combine(tmpDir, $"apply_restore_{Guid.NewGuid():N}.ps1");

            // Also removes any -wal/-shm sidecars left by the *previous* live database — a
            // VACUUM INTO snapshot has none of its own, but stale sidecars from the DB being
            // replaced must not be reapplied on top of the restored file.
            var script = $@"
$ErrorActionPreference = 'SilentlyContinue'
while (Get-Process -Id {Environment.ProcessId} -ErrorAction SilentlyContinue) {{ Start-Sleep -Milliseconds 500 }}
Start-Sleep -Seconds 1
Remove-Item -Force '{dbPath}-wal' -ErrorAction SilentlyContinue
Remove-Item -Force '{dbPath}-shm' -ErrorAction SilentlyContinue
Copy-Item -Force '{downloadPath}' '{dbPath}'
Remove-Item -Force '{downloadPath}' -ErrorAction SilentlyContinue
Start-Process -FilePath (Join-Path '{installDir}' 'StockFlow.API.exe')
Remove-Item -Force '{scriptPath}' -ErrorAction SilentlyContinue
";
            await File.WriteAllTextAsync(scriptPath, script);

            Process.Start(new ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = $"-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"{scriptPath}\"",
                UseShellExecute = true,
                CreateNoWindow = true,
            });

            // Respond to the HTTP request first, then shut down so the helper script's file
            // swap isn't blocked by this process still holding stockflow.db open.
            _ = Task.Run(async () =>
            {
                await Task.Delay(1500);
                lifetime.StopApplication();
            });

            return (true, null);
        }
        catch (Exception ex)
        {
            return (false, $"Exception: {ex.Message}");
        }
    }

    // --- Pure logic (unit-testable without touching Azure/filesystem) ---

    public static bool EvaluateDegraded(SyncStatusFile status, int failureThreshold, int staleAfterHours, int intervalHours, DateTime nowUtc)
    {
        // Grace period: a fresh install hasn't had a chance to complete a first sync yet.
        if (status.LastSuccessUtc == null && nowUtc - status.FirstSeenUtc < TimeSpan.FromHours(Math.Max(intervalHours, 1)))
            return false;

        if (status.ConsecutiveFailures >= failureThreshold) return true;
        if (status.LastSuccessUtc == null) return true; // grace period elapsed, still no success
        if (nowUtc - status.LastSuccessUtc.Value > TimeSpan.FromHours(staleAfterHours)) return true;

        return false;
    }

    public static IEnumerable<string> SelectBlobsToPrune(IEnumerable<(string Name, DateTime CreatedUtc)> existing, int retainCount)
    {
        if (retainCount < 0) retainCount = 0;

        // The blob name embeds a fixed-width "yyyyMMdd_HHmmss" timestamp, so ordinal string
        // order is equivalent to chronological order — no need to trust blob-store metadata.
        return existing
            .OrderByDescending(b => b.Name, StringComparer.Ordinal)
            .Skip(retainCount)
            .Select(b => b.Name)
            .ToList();
    }

    public static string SanitizeContainerName(string? customerId)
    {
        if (string.IsNullOrWhiteSpace(customerId))
            throw new InvalidOperationException("Sync:CustomerId is not configured.");

        var sb = new StringBuilder();
        foreach (var ch in customerId.Trim().ToLowerInvariant())
        {
            if (char.IsLetterOrDigit(ch) || ch == '-') sb.Append(ch);
            else if (ch is '_' or ' ' or '.') sb.Append('-');
        }

        var cleaned = sb.ToString().Trim('-');
        if (cleaned.Length == 0)
            throw new InvalidOperationException("Sync:CustomerId contains no valid characters for an Azure container name.");

        var name = $"customer-{cleaned}";
        if (name.Length > 63) name = name[..63].TrimEnd('-');
        if (name.Length < 3) name = name.PadRight(3, '0');
        return name;
    }

    // --- Internals ---

    private async Task PruneOldSnapshotsAsync(BlobContainerClient containerClient, CancellationToken ct)
    {
        var retain = config.GetValue("Sync:RetainedSnapshots", 30);
        var blobs = new List<(string Name, DateTime CreatedUtc)>();
        await foreach (var item in containerClient.GetBlobsAsync(prefix: "snapshots/", cancellationToken: ct))
            blobs.Add((item.Name, item.Properties.CreatedOn?.UtcDateTime ?? DateTime.MinValue));

        foreach (var name in SelectBlobsToPrune(blobs, retain))
            await containerClient.DeleteBlobIfExistsAsync(name, cancellationToken: ct);
    }

    private static async Task CreateSnapshotAsync(string dbPath, string snapshotPath)
    {
        if (File.Exists(snapshotPath)) File.Delete(snapshotPath);

        // A dedicated connection (not AppDbContext's own) — VACUUM INTO cannot run inside a
        // transaction, and this sidesteps any ambient transaction EF might have open. It
        // produces a single, fully consistent, self-contained snapshot with no -wal/-shm
        // sidecars, regardless of the live DB's current journal mode.
        var csb = new SqliteConnectionStringBuilder { DataSource = dbPath };
        await using var conn = new SqliteConnection(csb.ToString());
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "VACUUM INTO $path";
        cmd.Parameters.AddWithValue("$path", snapshotPath);
        await cmd.ExecuteNonQueryAsync();
    }

    private BlobContainerClient GetContainerClient()
    {
        var connStr = config["Sync:AzureStorageConnectionString"];
        if (string.IsNullOrWhiteSpace(connStr) || connStr == "YOUR_AZURE_STORAGE_CONNECTION_STRING")
            throw new InvalidOperationException("Sync:AzureStorageConnectionString is not configured.");

        var containerName = SanitizeContainerName(config["Sync:CustomerId"]);
        var serviceClient = new BlobServiceClient(connStr);
        return serviceClient.GetBlobContainerClient(containerName);
    }

    private string GetDbPath()
    {
        var connStr = db.Database.GetConnectionString()
            ?? throw new InvalidOperationException("Database connection string is not available.");
        return new SqliteConnectionStringBuilder(connStr).DataSource;
    }

    private string GetStatusFilePath() => Path.Combine(Path.GetDirectoryName(GetDbPath())!, "sync-status.json");

    private async Task<SyncStatusFile> LoadStatusAsync()
    {
        var path = GetStatusFilePath();
        if (!File.Exists(path)) return new SyncStatusFile();

        try
        {
            var json = await File.ReadAllTextAsync(path);
            return JsonSerializer.Deserialize<SyncStatusFile>(json) ?? new SyncStatusFile();
        }
        catch
        {
            return new SyncStatusFile();
        }
    }

    private async Task SaveStatusAsync(SyncStatusFile status)
    {
        var path = GetStatusFilePath();
        var tmpPath = path + ".tmp";
        var json = JsonSerializer.Serialize(status, new JsonSerializerOptions { WriteIndented = true });
        await File.WriteAllTextAsync(tmpPath, json);
        File.Move(tmpPath, path, overwrite: true);
    }
}
