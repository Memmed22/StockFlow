namespace StockFlow.API.DTOs;

public record UpdateCheckResultDto(string CurrentVersion, string LatestVersion, bool UpdateAvailable, string? ReleaseNotes, string? DownloadUrl);

public record ApplyUpdateDto(string DownloadUrl);
