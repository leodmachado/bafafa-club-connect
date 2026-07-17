$ErrorActionPreference = "Stop"

$Bun = "$env:USERPROFILE\.bun\bin\bun.exe"

if (-not (Test-Path $Bun)) {
  throw "Bun não encontrado em $Bun"
}

Write-Host "[1/3] Instalando dependências..."
& $Bun install
if ($LASTEXITCODE -ne 0) { throw "Falha no bun install" }

Write-Host "[2/3] Verificando lint..."
& $Bun run lint
if ($LASTEXITCODE -ne 0) { throw "O lint encontrou erros" }

Write-Host "[3/3] Gerando build de produção..."
& $Bun run build
if ($LASTEXITCODE -ne 0) { throw "Falha no build" }

Write-Host "V20.2 verificada: lint e build concluídos." -ForegroundColor Green
