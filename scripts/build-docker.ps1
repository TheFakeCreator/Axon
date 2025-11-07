# ==============================================
# Axon Docker Build Script (PowerShell)
# ==============================================

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Building Axon Docker Image" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Configuration
$IMAGE_NAME = if ($env:IMAGE_NAME) { $env:IMAGE_NAME } else { "axon-api" }
$VERSION = if ($env:VERSION) { $env:VERSION } else { "latest" }
$PLATFORM = if ($env:PLATFORM) { $env:PLATFORM } else { "linux/amd64" }

Write-Host "Configuration:"
Write-Host "  Image: ${IMAGE_NAME}:${VERSION}"
Write-Host "  Platform: $PLATFORM"
Write-Host ""

# Check if Docker is running
try {
    docker info | Out-Null
    Write-Host "✓ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "Error: Docker is not running" -ForegroundColor Red
    Write-Host "Please start Docker Desktop and try again"
    exit 1
}

# Build the image
Write-Host ""
Write-Host "Building Docker image..." -ForegroundColor Yellow

docker build `
    --platform $PLATFORM `
    -t "${IMAGE_NAME}:${VERSION}" `
    -t "${IMAGE_NAME}:latest" `
    --progress=plain `
    .

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Docker build failed" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Docker image built successfully" -ForegroundColor Green

# Display image info
Write-Host ""
Write-Host "Image Information:"
docker images $IMAGE_NAME --format "table {{.Repository}}`t{{.Tag}}`t{{.Size}}`t{{.CreatedAt}}"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Docker build completed!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "Next steps:"
Write-Host "  Test locally: docker run -p 3000:3000 ${IMAGE_NAME}:${VERSION}"
Write-Host "  Test with compose: docker-compose up"
Write-Host "  Push to registry: docker push ${IMAGE_NAME}:${VERSION}"
