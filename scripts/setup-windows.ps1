param(
  [string]$DataDir = "D:\project\personal-music-stack-data",
  [switch]$SkipPnpmInstall
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$BinDir = Join-Path $Root "bin"
$CollectorDir = Join-Path $Root "services\collector"
$CollectorConfig = Join-Path $CollectorDir "config.json"
$CollectorConfigExample = Join-Path $CollectorDir "config.example.json"
$NavidromeDir = Join-Path $Root "services\navidrome"
$CookiesDir = Join-Path $DataDir "cookies"
$LibraryDir = Join-Path $DataDir "library"

function Write-Step($Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Ensure-Dir($Path) {
  New-Item -ItemType Directory -Force -Path $Path | Out-Null
}

function Download-File($Url, $Destination) {
  Ensure-Dir (Split-Path -Parent $Destination)
  Write-Host "Downloading $Url"
  Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $Destination
}

function Get-GitHubLatestRelease($Repo) {
  $Url = "https://api.github.com/repos/$Repo/releases/latest"
  Invoke-RestMethod -Headers @{ "User-Agent" = "personal-music-setup" } -Uri $Url
}

function Find-CommandPath($Name) {
  $Command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($Command) { return $Command.Source }
  return $null
}

Write-Step "Creating folders"
Ensure-Dir $BinDir
Ensure-Dir $NavidromeDir
Ensure-Dir $CookiesDir
Ensure-Dir $LibraryDir

Write-Step "Preparing node.exe"
$NodeTarget = Join-Path $BinDir "node.exe"
if (-not (Test-Path $NodeTarget)) {
  $NodeSource = Find-CommandPath "node.exe"
  if (-not $NodeSource) {
    throw "node.exe was not found on PATH. Install Node.js first, then rerun this script."
  }
  Copy-Item -LiteralPath $NodeSource -Destination $NodeTarget -Force
  Write-Host "Copied $NodeSource -> $NodeTarget"
} else {
  Write-Host "node.exe already exists"
}

Write-Step "Preparing yt-dlp.exe"
$YtDlpTarget = Join-Path $BinDir "yt-dlp.exe"
if (-not (Test-Path $YtDlpTarget)) {
  Download-File "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" $YtDlpTarget
} else {
  Write-Host "yt-dlp.exe already exists"
}

Write-Step "Preparing ffmpeg.exe"
$FfmpegTarget = Join-Path $BinDir "ffmpeg.exe"
if (-not (Test-Path $FfmpegTarget)) {
  $FfmpegSource = Find-CommandPath "ffmpeg.exe"
  if ($FfmpegSource) {
    Copy-Item -LiteralPath $FfmpegSource -Destination $FfmpegTarget -Force
    Write-Host "Copied $FfmpegSource -> $FfmpegTarget"
  } else {
    $FfmpegZip = Join-Path $env:TEMP "personal-music-ffmpeg.zip"
    $FfmpegExtract = Join-Path $env:TEMP "personal-music-ffmpeg"
    if (Test-Path $FfmpegExtract) { Remove-Item -LiteralPath $FfmpegExtract -Recurse -Force }
    Download-File "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip" $FfmpegZip
    Expand-Archive -LiteralPath $FfmpegZip -DestinationPath $FfmpegExtract -Force
    $FoundFfmpeg = Get-ChildItem -Path $FfmpegExtract -Recurse -Filter "ffmpeg.exe" | Select-Object -First 1
    if (-not $FoundFfmpeg) { throw "ffmpeg.exe was not found in downloaded archive." }
    Copy-Item -LiteralPath $FoundFfmpeg.FullName -Destination $FfmpegTarget -Force
    Remove-Item -LiteralPath $FfmpegZip -Force
    Remove-Item -LiteralPath $FfmpegExtract -Recurse -Force
  }
} else {
  Write-Host "ffmpeg.exe already exists"
}

Write-Step "Preparing Navidrome"
$NavidromeTarget = Join-Path $NavidromeDir "navidrome.exe"
if (-not (Test-Path $NavidromeTarget)) {
  $Release = Get-GitHubLatestRelease "navidrome/navidrome"
  $Asset = $Release.assets | Where-Object { $_.name -match "Windows.*(x86_64|amd64).*\.zip$" } | Select-Object -First 1
  if (-not $Asset) { throw "Could not find Navidrome Windows x64 zip in latest release." }
  $NavZip = Join-Path $env:TEMP $Asset.name
  Download-File $Asset.browser_download_url $NavZip
  Expand-Archive -LiteralPath $NavZip -DestinationPath $NavidromeDir -Force
  Remove-Item -LiteralPath $NavZip -Force
} else {
  Write-Host "navidrome.exe already exists"
}

Write-Step "Writing collector config"
if (Test-Path $CollectorConfigExample) {
  $Config = Get-Content -Raw -LiteralPath $CollectorConfigExample | ConvertFrom-Json
} else {
  $Config = [PSCustomObject]@{}
}

$Config | Add-Member -NotePropertyName host -NotePropertyValue "0.0.0.0" -Force
$Config | Add-Member -NotePropertyName port -NotePropertyValue 8787 -Force
$Config | Add-Member -NotePropertyName musicDir -NotePropertyValue $LibraryDir -Force
$Config | Add-Member -NotePropertyName ytdlpPath -NotePropertyValue $YtDlpTarget -Force
$Config | Add-Member -NotePropertyName audioFormat -NotePropertyValue "mp3" -Force
$Config | Add-Member -NotePropertyName audioQuality -NotePropertyValue "0" -Force
$Config | Add-Member -NotePropertyName maxJobs -NotePropertyValue 50 -Force
$Config | Add-Member -NotePropertyName ffmpegPath -NotePropertyValue $FfmpegTarget -Force
$Config | Add-Member -NotePropertyName cookies -NotePropertyValue ([PSCustomObject]@{
  bilibili = Join-Path $CookiesDir "bilibili.txt"
}) -Force
$Config | Add-Member -NotePropertyName navidrome -NotePropertyValue ([PSCustomObject]@{
  baseUrl = ""
  username = ""
  password = ""
}) -Force

$Config | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $CollectorConfig -Encoding UTF8

if (-not $SkipPnpmInstall) {
  Write-Step "Installing npm dependencies"
  Push-Location $Root
  try {
    pnpm install
  } finally {
    Pop-Location
  }
} else {
  Write-Host "Skipping pnpm install"
}

Write-Step "Done"
Write-Host "Data directory: $DataDir"
Write-Host "Bilibili cookies path: $(Join-Path $CookiesDir 'bilibili.txt')"
Write-Host ""
Write-Host "Run the desktop app in development:"
Write-Host "  pnpm app"
Write-Host ""
Write-Host "Build the unpacked app:"
Write-Host "  pnpm dist"
