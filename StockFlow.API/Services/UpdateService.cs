using System.Diagnostics;
using System.IO.Compression;
using System.Net.Http.Json;
using System.Reflection;
using System.Text.Json.Serialization;
using StockFlow.API.DTOs;

namespace StockFlow.API.Services;

public class UpdateService(IConfiguration config, IHostApplicationLifetime lifetime)
{
    private static readonly HttpClient _client = CreateClient();

    private static HttpClient CreateClient()
    {
        var client = new HttpClient();
        client.DefaultRequestHeaders.UserAgent.ParseAdd("StockFlow-UpdateChecker");
        return client;
    }

    public async Task<(UpdateCheckResultDto? result, string? error)> CheckForUpdateAsync()
    {
        var owner = config["Update:GithubOwner"];
        var repo = config["Update:GithubRepo"];
        if (string.IsNullOrWhiteSpace(owner) || string.IsNullOrWhiteSpace(repo))
            return (null, "Update source not configured.");

        try
        {
            var response = await _client.GetAsync($"https://api.github.com/repos/{owner}/{repo}/releases/latest");
            if (!response.IsSuccessStatusCode)
                return (null, $"GitHub API error: {response.StatusCode}");

            var release = await response.Content.ReadFromJsonAsync<GithubRelease>();
            if (release == null) return (null, "Could not read release info.");

            var asset = release.Assets.FirstOrDefault(a => a.Name.EndsWith(".zip", StringComparison.OrdinalIgnoreCase));
            var latestVersion = release.TagName.TrimStart('v', 'V');
            var currentVersion = GetCurrentVersion();

            return (new UpdateCheckResultDto(currentVersion, latestVersion, IsNewer(latestVersion, currentVersion),
                release.Body, asset?.BrowserDownloadUrl), null);
        }
        catch (Exception ex)
        {
            return (null, $"Exception: {ex.Message}");
        }
    }

    // Windows locks a running exe's own files, so the app can't overwrite itself directly.
    // Instead it downloads/extracts the new build, hands off to a detached PowerShell helper
    // that waits for this process to exit, backs up + robocopies the new files in (excluding
    // data\, same as the manual update.bat), then restarts the exe.
    public async Task<(bool ok, string? error)> ApplyUpdateAsync(string downloadUrl)
    {
        try
        {
            var installDir = AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
            var workDir = Path.Combine(Path.GetTempPath(), $"stockflow_update_{Guid.NewGuid():N}");
            var extractedDir = Path.Combine(workDir, "extracted");
            Directory.CreateDirectory(extractedDir);

            var zipPath = Path.Combine(workDir, "update.zip");
            var bytes = await _client.GetByteArrayAsync(downloadUrl);
            await File.WriteAllBytesAsync(zipPath, bytes);
            ZipFile.ExtractToDirectory(zipPath, extractedDir);

            var backupDir = Path.Combine(
                Path.GetFullPath(Path.Combine(installDir, "..")),
                "StockFlow_Backups",
                $"v{GetCurrentVersion()}_{DateTime.Now:yyyyMMdd_HHmmss}");

            var scriptPath = Path.Combine(workDir, "apply_update.ps1");
            var script = $@"
$ErrorActionPreference = 'SilentlyContinue'
while (Get-Process -Id {Environment.ProcessId} -ErrorAction SilentlyContinue) {{ Start-Sleep -Milliseconds 500 }}
Start-Sleep -Seconds 1
robocopy '{installDir}' '{backupDir}' /e /xd data /xf update.bat | Out-Null
robocopy '{extractedDir}' '{installDir}' /e /xd data /xf update.bat | Out-Null
Start-Process -FilePath (Join-Path '{installDir}' 'StockFlow.API.exe')
Remove-Item -Recurse -Force '{workDir}' -ErrorAction SilentlyContinue
";
            await File.WriteAllTextAsync(scriptPath, script);

            Process.Start(new ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = $"-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"{scriptPath}\"",
                UseShellExecute = true,
                CreateNoWindow = true,
            });

            // Respond to the HTTP request first, then shut down so the helper script's
            // robocopy isn't blocked by this process still holding its own files open.
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

    private static string GetCurrentVersion()
    {
        var info = Assembly.GetExecutingAssembly()
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;
        if (string.IsNullOrWhiteSpace(info)) return "0.0.0";

        // Strip semver build metadata (e.g. a "+<git-sha>" suffix MSBuild may still add) —
        // it's not meaningful for version comparison.
        var plusIndex = info.IndexOf('+');
        return plusIndex >= 0 ? info[..plusIndex] : info;
    }

    private static bool IsNewer(string latest, string current)
    {
        if (Version.TryParse(latest, out var l) && Version.TryParse(current, out var c))
            return l > c;
        return !string.Equals(latest, current, StringComparison.OrdinalIgnoreCase);
    }

    private record GithubAsset(
        [property: JsonPropertyName("name")] string Name,
        [property: JsonPropertyName("browser_download_url")] string BrowserDownloadUrl);

    private record GithubRelease(
        [property: JsonPropertyName("tag_name")] string TagName,
        [property: JsonPropertyName("body")] string? Body,
        [property: JsonPropertyName("assets")] List<GithubAsset> Assets);
}
