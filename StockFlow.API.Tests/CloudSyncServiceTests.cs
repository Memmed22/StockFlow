using StockFlow.API.DTOs;
using StockFlow.API.Services;

namespace StockFlow.API.Tests;

// Covers CloudSyncService's pure logic only — degraded/healthy evaluation, retention
// pruning selection, and container-name sanitization — without touching Azure or the
// filesystem (those are exercised manually; see the plan's verification section).
public class CloudSyncServiceTests
{
    [Fact]
    public void EvaluateDegraded_FreshInstall_WithinGracePeriod_IsHealthy()
    {
        var status = new SyncStatusFile { FirstSeenUtc = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) };
        var now = status.FirstSeenUtc.AddHours(1); // interval is 4h — well within grace

        Assert.False(CloudSyncService.EvaluateDegraded(status, failureThreshold: 3, staleAfterHours: 12, intervalHours: 4, now));
    }

    [Fact]
    public void EvaluateDegraded_FreshInstall_GraceElapsed_NoSuccessYet_IsDegraded()
    {
        var status = new SyncStatusFile { FirstSeenUtc = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) };
        var now = status.FirstSeenUtc.AddHours(5); // past the 4h interval, still no success

        Assert.True(CloudSyncService.EvaluateDegraded(status, failureThreshold: 3, staleAfterHours: 12, intervalHours: 4, now));
    }

    [Fact]
    public void EvaluateDegraded_ConsecutiveFailuresAtThreshold_IsDegraded()
    {
        var status = new SyncStatusFile
        {
            FirstSeenUtc = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            LastSuccessUtc = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            ConsecutiveFailures = 3,
        };
        var now = status.LastSuccessUtc.Value.AddHours(1);

        Assert.True(CloudSyncService.EvaluateDegraded(status, failureThreshold: 3, staleAfterHours: 12, intervalHours: 4, now));
    }

    [Fact]
    public void EvaluateDegraded_BelowFailureThreshold_RecentSuccess_IsHealthy()
    {
        var status = new SyncStatusFile
        {
            FirstSeenUtc = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            LastSuccessUtc = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            ConsecutiveFailures = 2,
        };
        var now = status.LastSuccessUtc.Value.AddHours(1);

        Assert.False(CloudSyncService.EvaluateDegraded(status, failureThreshold: 3, staleAfterHours: 12, intervalHours: 4, now));
    }

    [Fact]
    public void EvaluateDegraded_StaleSinceLastSuccess_IsDegraded_EvenWithNoRecordedFailures()
    {
        // The PC itself was off overnight — no failed attempts logged, but backups are stale.
        var status = new SyncStatusFile
        {
            FirstSeenUtc = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            LastSuccessUtc = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            ConsecutiveFailures = 0,
        };
        var now = status.LastSuccessUtc.Value.AddHours(13);

        Assert.True(CloudSyncService.EvaluateDegraded(status, failureThreshold: 3, staleAfterHours: 12, intervalHours: 4, now));
    }

    [Fact]
    public void SelectBlobsToPrune_KeepsNewestByName_PrunesRest()
    {
        var blobs = new[]
        {
            ("snapshots/stockflow_20260101_000000.db", new DateTime(2026, 1, 1)),
            ("snapshots/stockflow_20260102_000000.db", new DateTime(2026, 1, 2)),
            ("snapshots/stockflow_20260103_000000.db", new DateTime(2026, 1, 3)),
            ("snapshots/stockflow_20260104_000000.db", new DateTime(2026, 1, 4)),
        };

        var toPrune = CloudSyncService.SelectBlobsToPrune(blobs, retainCount: 2).ToList();

        Assert.Equal(2, toPrune.Count);
        Assert.Contains("snapshots/stockflow_20260101_000000.db", toPrune);
        Assert.Contains("snapshots/stockflow_20260102_000000.db", toPrune);
    }

    [Fact]
    public void SelectBlobsToPrune_FewerThanRetainCount_PrunesNothing()
    {
        var blobs = new[] { ("snapshots/stockflow_20260101_000000.db", new DateTime(2026, 1, 1)) };

        var toPrune = CloudSyncService.SelectBlobsToPrune(blobs, retainCount: 30);

        Assert.Empty(toPrune);
    }

    [Theory]
    [InlineData("acme-shop", "customer-acme-shop")]
    [InlineData("Acme Shop 2", "customer-acme-shop-2")]
    [InlineData("shop_01", "customer-shop-01")]
    public void SanitizeContainerName_ProducesValidLowercaseHyphenName(string customerId, string expected)
    {
        Assert.Equal(expected, CloudSyncService.SanitizeContainerName(customerId));
    }

    [Fact]
    public void SanitizeContainerName_MissingCustomerId_Throws()
    {
        Assert.Throws<InvalidOperationException>(() => CloudSyncService.SanitizeContainerName(""));
    }
}
