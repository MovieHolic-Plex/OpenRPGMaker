$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
if (-not $Root) { $Root = (Get-Location).Path }
Set-Location $Root
$DevDir = Join-Path $Root "output\dev"
New-Item -ItemType Directory -Force -Path $DevDir | Out-Null

function Stop-MatchingNode([string]$Pattern) {
  Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and ($_.CommandLine -match $Pattern) } |
    ForEach-Object {
      $procId = $_.ProcessId
      Write-Host "kill node pid=$procId ($Pattern)"
      & taskkill.exe /PID $procId /T /F 2>$null | Out-Null
    }
}

function Stop-PortHolders([int]$Port) {
  $lines = netstat -ano -p tcp 2>$null
  foreach ($line in $lines) {
    if ($line -match "LISTENING" -and $line -match ":$Port\s+") {
      $parts = @(($line -split "\s+") | Where-Object { $_ -ne "" })
      if ($parts.Count -lt 1) { continue }
      $holder = 0
      [void][int]::TryParse($parts[-1], [ref]$holder)
      if ($holder -gt 0) {
        Write-Host "kill port $Port holder pid=$holder"
        & taskkill.exe /PID $holder /T /F 2>$null | Out-Null
      }
    }
  }
}

Stop-MatchingNode "dev-keepalive-supervisor"
Stop-MatchingNode "dev-keepalive"
Stop-PortHolders 9999
Start-Sleep -Seconds 1

& node (Join-Path $Root "scripts\dev-keepalive-supervisor.mjs") --detach
if ($LASTEXITCODE -ne 0) {
  Write-Host "detach launch failed exit=$LASTEXITCODE"
  exit $LASTEXITCODE
}

$ok = $false
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Seconds 1
  try {
    $req = [System.Net.HttpWebRequest]::Create("http://127.0.0.1:9999/")
    $req.Timeout = 2000
    $resp = $req.GetResponse()
    $code = [int]$resp.StatusCode
    $resp.Close()
    if ($code -ge 200 -and $code -lt 500) {
      Write-Host "healthy :9999 status=$code after $($i+1)s"
      $ok = $true
      break
    }
  } catch {
    # keep waiting
  }
}

if (-not $ok) {
  Write-Host "WARN: :9999 not healthy yet"
  $log = Join-Path $DevDir "dev-keepalive.log"
  if (Test-Path $log) { Get-Content $log -Tail 50 }
  $slog = Join-Path $DevDir "dev-supervisor.log"
  if (Test-Path $slog) { Get-Content $slog -Tail 30 }
  exit 1
}

Write-Host "DONE"
exit 0
