# Pulls a StockFlow shop's cloud backup snapshot down to this machine, for offline
# inspection/debugging only — it never touches a running app installation.
#
# Every shop gets its own Azure Blob Storage container ("customer-{CustomerId}") inside one
# shared storage account (see StockFlow.API/Services/CloudSyncService.cs), so this is also the
# one tool that needs to pick *which* customer to pull from. It uses the Azure CLI ("az"),
# not the app's own connection string config, since it needs account-level access to browse
# every customer's container — the deployed shop app never has or needs that.
#
# Requires: Azure CLI (https://learn.microsoft.com/cli/azure/install-azure-cli), already
# logged in (`az login`) or given -ConnectionString explicitly.
#
# Usage:
#   .\pull-latest-snapshot.ps1 -ListCustomers -ConnectionString "<storage connection string>"
#   .\pull-latest-snapshot.ps1 -CustomerId acme-shop -ConnectionString "<storage connection string>"
#   .\pull-latest-snapshot.ps1 -CustomerId acme-shop -BlobName "snapshots/stockflow_20260910_120000.db" -OutFile ".\acme-snapshot.db" -ConnectionString "..."

param(
    [Parameter(Mandatory = $true)]
    [string]$ConnectionString,

    [switch]$ListCustomers,

    [string]$CustomerId,

    [string]$BlobName = "latest.db",

    [string]$OutFile
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Azure CLI ('az') not found. Install it from https://learn.microsoft.com/cli/azure/install-azure-cli" -ForegroundColor Red
    exit 1
}

if ($ListCustomers) {
    Write-Host "Containers in this storage account (one per customer/shop):" -ForegroundColor Cyan
    az storage container list --connection-string $ConnectionString --query "[?starts_with(name, 'customer-')].name" -o tsv
    exit 0
}

if (-not $CustomerId) {
    Write-Host "[ERROR] Pass -CustomerId <id>, or -ListCustomers to see available customers first." -ForegroundColor Red
    exit 1
}

# Mirrors CloudSyncService.SanitizeContainerName's rules (lowercase, alnum + hyphen only).
$sanitized = ($CustomerId.ToLower() -replace '[^a-z0-9-]', '-').Trim('-')
$containerName = "customer-$sanitized"

if (-not $OutFile) {
    $OutFile = ".\stockflow-snapshot_$($sanitized)_$(Get-Date -Format 'yyyyMMdd_HHmmss').db"
}

Write-Host "Downloading '$BlobName' from container '$containerName'..." -ForegroundColor Cyan
az storage blob download `
    --connection-string $ConnectionString `
    --container-name $containerName `
    --name $BlobName `
    --file $OutFile `
    --no-progress

if ($LASTEXITCODE -eq 0) {
    Write-Host "Saved to $OutFile" -ForegroundColor Green
    Write-Host "Open it with a SQLite browser, or drop it into a *stopped* local dev instance's data\ folder as stockflow.db." -ForegroundColor Gray
} else {
    Write-Host "[ERROR] Download failed — check the customer id, blob name, and connection string." -ForegroundColor Red
    exit 1
}
