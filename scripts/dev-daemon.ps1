param(
  [ValidateSet('ensure', 'start', 'stop', 'status', 'watch', 'install', 'uninstall')]
  [string]$Action = 'ensure',
  [int]$Port = 9999
)

# ASCII only. Windows PowerShell 5.1 reads BOM-less files as ANSI, so non-ASCII
# comment bytes corrupt quote parsing and the script fails to parse at all.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$logPath = Join-Path $root 'tmp\dev9999.log'
$runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$runName = "rpg-zzu-dev-$Port"

function Test-Up {
  # Health check runs through curl.exe on purpose. Both System.Net.Http and
  # Invoke-WebRequest fail the TLS handshake against our self-signed cert on
  # Windows PowerShell 5.1 (measured: "underlying connection was closed") while
  # curl returns 200. A false negative here is dangerous: the watchdog would
  # kill and restart a perfectly healthy server every cycle.
  $curl = Join-Path $env:SystemRoot 'System32\curl.exe'
  if (-not (Test-Path $curl)) { $curl = 'curl.exe' }
  $code = & $curl '-sk' '-m' '5' '-o' 'NUL' '-w' '%{http_code}' "https://127.0.0.1:$Port/" 2>$null
  return ($LASTEXITCODE -eq 0 -and $code -eq '200')
}

function Get-ViteProcesses {
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine -like '*vite*' -and $_.CommandLine -like "*--port $Port*" }
}

function Stop-Daemon {
  foreach ($p in Get-ViteProcesses) {
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Milliseconds 600
}

function Start-Daemon {
  # Launch node directly. Going through npm/cmd wrappers stacks four processes
  # sharing one console, and a single console-close event kills them all -- that
  # is why the daemon kept dying on every shell teardown.
  $viteBin = Join-Path $root 'node_modules\vite\bin\vite.js'
  if (-not (Test-Path $viteBin)) { throw "vite not found: $viteBin" }
  New-Item -ItemType Directory -Force -Path (Split-Path $logPath) | Out-Null
  $viteArgs = @($viteBin, '--configLoader', 'runner', '--host', '0.0.0.0', '--port', "$Port", '--strictPort')
  Start-Process -FilePath 'node' -ArgumentList $viteArgs -WorkingDirectory $root `
    -WindowStyle Hidden -RedirectStandardOutput $logPath -RedirectStandardError "$logPath.err"
}

switch ($Action) {
  'status' {
    Write-Output ('responding: ' + (Test-Up))
    foreach ($p in @(Get-ViteProcesses)) {
      Write-Output ('  pid ' + $p.ProcessId + ' parent ' + $p.ParentProcessId)
    }
  }
  'stop' { Stop-Daemon; Write-Output 'stopped' }
  'start' { Stop-Daemon; Start-Daemon; Write-Output 'started' }
  'ensure' {
    if (Test-Up) { Write-Output 'already up' } else { Stop-Daemon; Start-Daemon; Write-Output 'restarted' }
  }
  'watch' {
    while ($true) {
      if (-not (Test-Up)) {
        Stop-Daemon
        Start-Daemon
        $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
        Add-Content -Path (Join-Path $root 'tmp\dev-watchdog.log') -Value "$stamp restarted dev server"
      }
      Start-Sleep -Seconds 20
    }
  }
  'install' {
    # Register-ScheduledTask needs admin and fails with 0x80070005 here, so use
    # the HKCU Run key, which works with plain user rights.
    $ps = (Get-Command powershell.exe).Source
    $script = Join-Path $root 'scripts\dev-daemon.ps1'
    $q = [char]34
    $cmd = $q + $ps + $q + ' -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ' + $q + $script + $q + " -Action watch -Port $Port"
    Set-ItemProperty -Path $runKey -Name $runName -Value $cmd
    Write-Output ('installed: ' + $runName)
  }
  'uninstall' {
    Remove-ItemProperty -Path $runKey -Name $runName -ErrorAction SilentlyContinue
    Write-Output ('uninstalled: ' + $runName)
  }
}
