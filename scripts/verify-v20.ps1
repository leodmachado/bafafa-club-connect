$ErrorActionPreference = "Stop"

Write-Host "BAFAFA CONNECT V20.0 | Verificacao local" -ForegroundColor Cyan

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$requiredFiles = @(
  "src\components\admin\commercial-dashboard.tsx",
  "src\components\customer\customer-journey.tsx",
  "src\lib\commercial.ts",
  "src\routes\fofocometro\`$eventId.tsx",
  "supabase\migrations\20260726120000_crm_funil_comercial_v20.sql",
  "docs\BAFAFA_CRM_FUNIL_COMERCIAL_V20_SETUP.sql",
  "docs\VERIFICAR_CRM_FUNIL_COMERCIAL_V20.sql"
)

foreach ($file in $requiredFiles) {
  if (-not (Test-Path $file)) {
    throw "Arquivo obrigatorio ausente: $file"
  }
}

$migrationHash = (Get-FileHash "supabase\migrations\20260726120000_crm_funil_comercial_v20.sql" -Algorithm SHA256).Hash
$setupHash = (Get-FileHash "docs\BAFAFA_CRM_FUNIL_COMERCIAL_V20_SETUP.sql" -Algorithm SHA256).Hash
if ($migrationHash -ne $setupHash) {
  throw "O SQL da migration e o SQL de instalacao manual estao diferentes. Nao prossiga."
}

$bun = Join-Path $env:USERPROFILE ".bun\bin\bun.exe"
if (-not (Test-Path $bun)) {
  throw "Bun nao encontrado em $bun"
}

Write-Host "1/3 Instalando dependencias..." -ForegroundColor Yellow
& $bun install
if ($LASTEXITCODE -ne 0) { throw "Falha no bun install." }

Write-Host "2/3 Verificando lint..." -ForegroundColor Yellow
& $bun run lint
if ($LASTEXITCODE -ne 0) { throw "Falha no lint." }

Write-Host "3/3 Gerando build de producao..." -ForegroundColor Yellow
& $bun run build
if ($LASTEXITCODE -ne 0) { throw "Falha no build." }

Write-Host "VERIFICACAO LOCAL CONCLUIDA" -ForegroundColor Green
Write-Host "Ainda e obrigatorio executar e verificar o SQL no Supabase antes do deploy." -ForegroundColor Cyan
