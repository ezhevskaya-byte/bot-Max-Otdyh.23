# Запуск backend + Cloudflare Tunnel для MAX webhook
# Использование: .\scripts\start-dev.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Stopping old processes on port 3000..."
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

Write-Host "Проверка токена MAX..."
node --env-file=.env scripts/check-max-bot.mjs 2>&1 | Select-Object -Last 8
if ($LASTEXITCODE -ne 0) {
  Write-Host "ОШИБКА: токен в .env недействителен. Обновите MAX_BOT_TOKEN в кабинете MAX."
  exit 1
}

Write-Host "Starting npm start (with .env)..."
Start-Process -FilePath "node" -ArgumentList "--env-file=.env", "backend/src/index.js" -WorkingDirectory $root -WindowStyle Normal

Start-Sleep -Seconds 2

Write-Host "Starting cloudflared tunnel -> http://127.0.0.1:3000"
Write-Host "Скопируйте URL из вывода cloudflared и выполните:"
Write-Host "  npm run register:max-webhook -- https://ВАШ-URL.trycloudflare.com/webhook/max"
Write-Host ""

& cloudflared tunnel --url http://127.0.0.1:3000
