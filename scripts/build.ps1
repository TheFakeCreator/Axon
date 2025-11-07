# ==============================================
# Axon Build Script (PowerShell)
# ==============================================

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Building Axon Application" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Check if pnpm is installed
try {
    $pnpmVersion = pnpm -v
    Write-Host "✓ pnpm is installed ($pnpmVersion)" -ForegroundColor Green
} catch {
    Write-Host "Error: pnpm is not installed" -ForegroundColor Red
    Write-Host "Install with: npm install -g pnpm"
    exit 1
}

# Check Node.js version
$nodeVersion = (node -v).Substring(1).Split('.')[0]
if ([int]$nodeVersion -lt 20) {
    Write-Host "Error: Node.js 20+ is required" -ForegroundColor Red
    Write-Host "Current version: $(node -v)"
    exit 1
}

Write-Host "✓ Node.js version is compatible ($(node -v))" -ForegroundColor Green

# Clean previous build
Write-Host ""
Write-Host "Cleaning previous build..." -ForegroundColor Yellow

if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
if (Test-Path ".turbo") { Remove-Item -Recurse -Force ".turbo" }

Get-ChildItem -Path "packages" -Directory | ForEach-Object {
    $distPath = Join-Path $_.FullName "dist"
    if (Test-Path $distPath) {
        Remove-Item -Recurse -Force $distPath
    }
}

Get-ChildItem -Path "apps" -Directory | ForEach-Object {
    $distPath = Join-Path $_.FullName "dist"
    if (Test-Path $distPath) {
        Remove-Item -Recurse -Force $distPath
    }
}

Write-Host "✓ Clean complete" -ForegroundColor Green

# Install dependencies
Write-Host ""
Write-Host "Installing dependencies..." -ForegroundColor Yellow
pnpm install --frozen-lockfile

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to install dependencies" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Dependencies installed" -ForegroundColor Green

# Run linting
Write-Host ""
Write-Host "Running linting..." -ForegroundColor Yellow
pnpm run lint

if ($LASTEXITCODE -ne 0) {
    Write-Host "Warning: Linting found issues" -ForegroundColor Yellow
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne "y") {
        exit 1
    }
}

Write-Host "✓ Linting passed" -ForegroundColor Green

# Run type checking
Write-Host ""
Write-Host "Running type checking..." -ForegroundColor Yellow
pnpm run type-check

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Type checking failed" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Type checking passed" -ForegroundColor Green

# Build all packages
Write-Host ""
Write-Host "Building all packages..." -ForegroundColor Yellow
pnpm build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Build failed" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Build complete" -ForegroundColor Green

# Run tests (if --with-tests flag is provided)
if ($args -contains "--with-tests") {
    Write-Host ""
    Write-Host "Running tests..." -ForegroundColor Yellow
    pnpm test
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Tests failed" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✓ Tests passed" -ForegroundColor Green
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Build completed successfully!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan

# Display build info
Write-Host ""
Write-Host "Build Information:"
Write-Host "  Node.js: $(node -v)"
Write-Host "  pnpm: $(pnpm -v)"
Write-Host "  Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Build Docker image: .\scripts\build-docker.ps1"
Write-Host "  2. Run locally: pnpm dev"
Write-Host "  3. Deploy: .\scripts\deploy.ps1"
