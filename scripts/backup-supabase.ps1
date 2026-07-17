param(
  [string]$DatabaseUrl = $env:SUPABASE_DB_URL,
  [string]$OutputRoot = ".\backups",
  [switch]$SkipStorage
)

$ErrorActionPreference = "Stop"

if (-not $DatabaseUrl) {
  throw "Defina SUPABASE_DB_URL somente nesta sessão do terminal. Não salve a senha no projeto."
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker Desktop não foi encontrado. O Supabase CLI usa Docker para gerar o dump."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$output = Join-Path $OutputRoot "bafafa-$timestamp"
New-Item -ItemType Directory -Force -Path $output | Out-Null

Write-Host "Gerando backup do banco em $output" -ForegroundColor Cyan
& "$env:USERPROFILE\.bun\bin\bun.exe" x supabase@latest db dump --db-url $DatabaseUrl -f (Join-Path $output "roles.sql") --role-only
if ($LASTEXITCODE -ne 0) { throw "Falha no backup de roles." }
& "$env:USERPROFILE\.bun\bin\bun.exe" x supabase@latest db dump --db-url $DatabaseUrl -f (Join-Path $output "schema.sql")
if ($LASTEXITCODE -ne 0) { throw "Falha no backup do schema." }
& "$env:USERPROFILE\.bun\bin\bun.exe" x supabase@latest db dump --db-url $DatabaseUrl -f (Join-Path $output "data.sql") --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
if ($LASTEXITCODE -ne 0) { throw "Falha no backup dos dados." }

if (-not $SkipStorage) {
  $storageRoot = Join-Path $output "storage"
  New-Item -ItemType Directory -Force -Path $storageRoot | Out-Null
  Write-Host "Copiando objetos do Storage. O projeto precisa estar vinculado pelo Supabase CLI." -ForegroundColor Cyan
  foreach ($bucket in @("avatars", "event-images")) {
    $destination = Join-Path $storageRoot $bucket
    New-Item -ItemType Directory -Force -Path $destination | Out-Null
    & "$env:USERPROFILE\.bun\bin\bun.exe" x supabase@latest storage cp "ss:///$bucket" $destination -r --experimental --linked
    if ($LASTEXITCODE -ne 0) {
      Write-Warning "Não foi possível copiar o bucket $bucket. O backup do banco foi mantido."
    }
  }
}

$manifest = @()
Get-ChildItem $output -Recurse -File | ForEach-Object {
  $hash = Get-FileHash $_.FullName -Algorithm SHA256
  $manifest += [pscustomobject]@{
    file = $_.FullName.Substring((Resolve-Path $output).Path.Length + 1)
    bytes = $_.Length
    sha256 = $hash.Hash.ToLower()
  }
}
$manifest | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 (Join-Path $output "manifest.json")

Write-Host "Backup concluído: $output" -ForegroundColor Green
Write-Host "Copie esta pasta para um local externo e não a envie ao GitHub." -ForegroundColor Yellow
