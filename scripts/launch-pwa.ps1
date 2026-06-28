$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$port = 4285
$baseUrl = "http://127.0.0.1:$port"
$appUrl = "$baseUrl/"
$logDir = Join-Path $projectRoot ".omo\evidence\pwa"
$logPath = Join-Path $logDir "desktop-launch.log"
$stdoutPath = Join-Path $logDir "desktop-preview.stdout.log"
$stderrPath = Join-Path $logDir "desktop-preview.stderr.log"

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Write-LaunchLog {
  param([string] $Message)
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -Path $logPath -Value "[$timestamp] $Message"
}

function Show-LaunchError {
  param([string] $Message)
  Write-LaunchLog "ERROR: $Message"
  try {
    $shell = New-Object -ComObject WScript.Shell
    $shell.Popup($Message, 8, "RPG ZZU PWA", 16) | Out-Null
  } catch {
    Write-Host $Message
  }
}

function Get-PwaManifest {
  try {
    $response = Invoke-WebRequest -Uri "$baseUrl/manifest.webmanifest" -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -ne 200) {
      return $null
    }
    $content = $response.Content
    if ($content -is [byte[]]) {
      $content = [System.Text.Encoding]::UTF8.GetString($content)
    }
    return $content | ConvertFrom-Json
  } catch {
    return $null
  }
}

function Test-PwaServer {
  $manifest = Get-PwaManifest
  return $null -ne $manifest -and $manifest.name -eq "RPG ZZU" -and $manifest.display -eq "standalone"
}

function Get-BrowserPath {
  $candidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
  )
  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }
  return $null
}

try {
  Write-LaunchLog "Launch requested for $appUrl"
  Push-Location $projectRoot

  if (!(Test-Path (Join-Path $projectRoot "dist\index.html"))) {
    Write-LaunchLog "dist missing; running npm run build"
    $build = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "build") -WorkingDirectory $projectRoot -WindowStyle Hidden -Wait -PassThru
    if ($build.ExitCode -ne 0) {
      Show-LaunchError "RPG ZZU build failed. See $logPath"
      exit $build.ExitCode
    }
  }

  if (!(Test-PwaServer)) {
    Write-LaunchLog "Starting production preview on port $port"
    Start-Process -FilePath "npm.cmd" `
      -ArgumentList @("run", "preview", "--", "--host", "127.0.0.1", "--port", "$port", "--strictPort") `
      -WorkingDirectory $projectRoot `
      -WindowStyle Hidden `
      -RedirectStandardOutput $stdoutPath `
      -RedirectStandardError $stderrPath | Out-Null

    $ready = $false
    for ($attempt = 0; $attempt -lt 120; $attempt++) {
      Start-Sleep -Milliseconds 250
      if (Test-PwaServer) {
        $ready = $true
        break
      }
    }
    if (!$ready) {
      Show-LaunchError "RPG ZZU preview did not start on $appUrl. See $stderrPath"
      exit 1
    }
  }

  $browserPath = Get-BrowserPath
  if ($null -eq $browserPath) {
    Show-LaunchError "Chrome or Edge was not found."
    exit 1
  }

  Write-LaunchLog "Opening app mode with $browserPath"
  Start-Process -FilePath $browserPath -ArgumentList @("--app=$appUrl")
} catch {
  Show-LaunchError $_.Exception.Message
  exit 1
} finally {
  Pop-Location
}
