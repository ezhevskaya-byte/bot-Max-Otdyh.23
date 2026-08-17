# Освобождает порт 3000 (EADDRINUSE)
$port = if ($args[0]) { [int]$args[0] } else { 3000 }
$conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if (-not $conns) {
  Write-Host "Порт $port свободен."
  exit 0
}
$pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -gt 0 }
foreach ($pid in $pids) {
  Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
  Write-Host "Остановлен PID $pid (порт $port)"
}
Start-Sleep -Seconds 1
$left = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($left) { Write-Host "ВНИМАНИЕ: порт $port всё ещё занят"; exit 1 }
Write-Host "Порт $port свободен."
