# Axon Setup Script for Windows
# Run this script to set up and start Axon

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Axon - Quick Setup Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check Docker
Write-Host "[1/6] Checking Docker..." -ForegroundColor Yellow
try {
    docker ps | Out-Null
    Write-Host "✓ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker is not running!" -ForegroundColor Red
    Write-Host "Please start Docker Desktop and run this script again." -ForegroundColor Red
    exit 1
}

# Step 2: Check if .env exists
Write-Host "[2/6] Checking environment configuration..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "✓ .env file exists" -ForegroundColor Green
} else {
    Write-Host "! Creating .env from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✓ .env file created" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠ IMPORTANT: Edit .env and add your OpenAI API key!" -ForegroundColor Yellow
    Write-Host "   Open .env file and set: OPENAI_API_KEY=sk-your-key-here" -ForegroundColor Yellow
    Write-Host ""
    $response = Read-Host "Press Enter to continue (you can add the API key later)"
}

# Step 3: Start infrastructure services
Write-Host "[3/6] Starting infrastructure services (MongoDB, Redis, Qdrant)..." -ForegroundColor Yellow
docker-compose -f docker/docker-compose.dev.yml up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Infrastructure services started" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to start infrastructure services" -ForegroundColor Red
    exit 1
}

# Wait for services to be ready
Write-Host "[4/6] Waiting for services to be ready (10 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Step 4: Check service health
Write-Host "[5/6] Checking service health..." -ForegroundColor Yellow

# Check MongoDB
try {
    docker exec axon-mongodb mongosh --quiet --eval "db.adminCommand('ping')" | Out-Null
    Write-Host "✓ MongoDB is healthy" -ForegroundColor Green
} catch {
    Write-Host "⚠ MongoDB is starting up..." -ForegroundColor Yellow
}

# Check Redis
try {
    docker exec axon-redis redis-cli ping | Out-Null
    Write-Host "✓ Redis is healthy" -ForegroundColor Green
} catch {
    Write-Host "⚠ Redis is starting up..." -ForegroundColor Yellow
}

# Check Qdrant
try {
    $response = Invoke-WebRequest -Uri "http://localhost:6333/healthz" -UseBasicParsing -TimeoutSec 2
    Write-Host "✓ Qdrant is healthy" -ForegroundColor Green
} catch {
    Write-Host "⚠ Qdrant is starting up..." -ForegroundColor Yellow
}

# Step 5: Install dependencies (if needed)
Write-Host "[6/6] Checking dependencies..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "✓ Dependencies already installed" -ForegroundColor Green
} else {
    Write-Host "! Installing dependencies (this may take a few minutes)..." -ForegroundColor Yellow
    pnpm install
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Dependencies installed" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Infrastructure Services:" -ForegroundColor Cyan
Write-Host "  • MongoDB:  http://localhost:27017" -ForegroundColor White
Write-Host "  • Redis:    http://localhost:6379" -ForegroundColor White
Write-Host "  • Qdrant:   http://localhost:6333" -ForegroundColor White
Write-Host ""

Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Build the application:" -ForegroundColor White
Write-Host "     pnpm build" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Start the API server:" -ForegroundColor White
Write-Host "     pnpm --filter @axon/api dev" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Test health endpoint:" -ForegroundColor White
Write-Host "     curl http://localhost:3000/health" -ForegroundColor Gray
Write-Host ""

Write-Host "To stop infrastructure services:" -ForegroundColor Cyan
Write-Host "  docker-compose -f docker/docker-compose.dev.yml down" -ForegroundColor Gray
Write-Host ""

Write-Host "For full documentation, see QUICKSTART.md" -ForegroundColor Yellow
Write-Host ""
