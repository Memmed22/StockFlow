namespace StockFlow.API.DTOs;

public record SyncStatusDto(DateTime? LastSuccessUtc, DateTime? LastAttemptUtc, bool Degraded, string? LastError, int ConsecutiveFailures);

public record SnapshotInfoDto(string BlobName, DateTime? CreatedUtc, long? SizeBytes);

public record RestoreRequestDto(string? BlobName);

// Persisted as data/sync-status.json — a file, not an EF Core entity, so it survives a full DB
// restore (which replaces stockflow.db wholesale) and doesn't mix operational metadata into the
// business schema.
public class SyncStatusFile
{
    public DateTime FirstSeenUtc { get; set; } = DateTime.UtcNow;
    public DateTime? LastAttemptUtc { get; set; }
    public DateTime? LastSuccessUtc { get; set; }
    public string? LastError { get; set; }
    public int ConsecutiveFailures { get; set; }
    public string? LastSuccessBlobName { get; set; }
}
