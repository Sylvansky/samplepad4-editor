param(
  [string]$ProjectPath = "\\wsl.localhost\Ubuntu-24.04\home\sylvansky\dev\samplepad4-editor",
  [string]$LocalBuildPath = "$env:TEMP\samplepad4-editor-build"
)

$ErrorActionPreference = "Stop"

Write-Host "Building SamplePad4 Windows installer..." -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js is not installed on Windows. Install with: winget install OpenJS.NodeJS.LTS"
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue) -and -not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  throw "npm is not available. Reinstall Node.js LTS and reopen PowerShell."
}

if (-not (Test-Path $ProjectPath)) {
  throw "Project path not found: $ProjectPath"
}

if (Test-Path $LocalBuildPath) {
  Remove-Item -LiteralPath $LocalBuildPath -Recurse -Force
}

New-Item -ItemType Directory -Path $LocalBuildPath | Out-Null

Write-Host "Staging project to local path to avoid UNC build issues..." -ForegroundColor Yellow
robocopy "$ProjectPath" "$LocalBuildPath" /MIR /XD node_modules dist .git > $null
$robocopyExit = $LASTEXITCODE
if ($robocopyExit -ge 8) {
  throw "Failed to stage project. robocopy exit code: $robocopyExit"
}

$npmCmd = "npm.cmd"
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  $npmCmd = "npm"
}

Push-Location
try {
  Set-Location $LocalBuildPath

  Write-Host "Installing dependencies..." -ForegroundColor Yellow
  & $npmCmd install
  if ($LASTEXITCODE -ne 0) {
    throw "npm install failed with exit code $LASTEXITCODE"
  }

  Write-Host "Creating Windows installer..." -ForegroundColor Yellow
  & $npmCmd run dist:win
  if ($LASTEXITCODE -ne 0) {
    throw "npm run dist:win failed with exit code $LASTEXITCODE"
  }
}
finally {
  Pop-Location
}

$sourceDist = Join-Path $LocalBuildPath "dist"
$targetDist = Join-Path $ProjectPath "dist"

if (-not (Test-Path $sourceDist)) {
  throw "Build finished but dist folder was not found at $sourceDist"
}

New-Item -ItemType Directory -Path $targetDist -Force | Out-Null
robocopy "$sourceDist" "$targetDist" /E > $null
$distCopyExit = $LASTEXITCODE
if ($distCopyExit -ge 8) {
  throw "Failed to copy dist output back to project. robocopy exit code: $distCopyExit"
}

Write-Host "Build completed." -ForegroundColor Green
Write-Host "Installer location: $targetDist" -ForegroundColor Green
