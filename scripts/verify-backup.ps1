param([Parameter(Mandatory=$true)][string]$BackupDirectory)

$ErrorActionPreference = "Stop"
$manifestPath = Join-Path $BackupDirectory "manifest.json"
if (-not (Test-Path $manifestPath)) { throw "manifest.json não encontrado." }

$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$failed = @()
foreach ($entry in $manifest) {
  $file = Join-Path $BackupDirectory $entry.file
  if (-not (Test-Path $file)) { $failed += "$($entry.file): ausente"; continue }
  $hash = (Get-FileHash $file -Algorithm SHA256).Hash.ToLower()
  if ($hash -ne $entry.sha256) { $failed += "$($entry.file): hash diferente" }
}

foreach ($required in @("roles.sql", "schema.sql", "data.sql")) {
  if (-not (Test-Path (Join-Path $BackupDirectory $required))) { $failed += "$required: obrigatório" }
}

if ($failed.Count) {
  $failed | ForEach-Object { Write-Error $_ }
  exit 1
}
Write-Host "Backup íntegro conforme o manifesto." -ForegroundColor Green
