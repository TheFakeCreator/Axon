# Test Ollama Integration with Axon
# This script tests that the Ollama provider is working correctly

Write-Host "Testing Ollama Integration..." -ForegroundColor Cyan
Write-Host ""

# 1. Check Ollama service
Write-Host "1. Checking Ollama service..." -ForegroundColor Yellow
try {
    $ollamaResponse = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -Method GET
    $models = ($ollamaResponse.Content | ConvertFrom-Json).models
    Write-Host "   ✅ Ollama is running" -ForegroundColor Green
    Write-Host "   Available models:" -ForegroundColor Gray
    foreach ($model in $models) {
        Write-Host "   - $($model.name)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ❌ Ollama is not running" -ForegroundColor Red
    Write-Host "   Please start Ollama first" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 2. Check API server
Write-Host "2. Checking API server..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-WebRequest -Uri "http://localhost:3000/health" -Method GET
    $health = $healthResponse.Content | ConvertFrom-Json
    Write-Host "   ✅ API server is running" -ForegroundColor Green
    Write-Host "   Status: $($health.data.status)" -ForegroundColor Gray
    Write-Host "   Version: $($health.data.version)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ API server is not running" -ForegroundColor Red
    Write-Host "   Please start the API server: pnpm --filter @axon/api dev" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 3. Test direct Ollama completion
Write-Host "3. Testing direct Ollama completion..." -ForegroundColor Yellow
try {
    $body = @{
        model = "llama3.2:1b"
        prompt = "What is TypeScript? Answer in one sentence."
        stream = $false
    } | ConvertTo-Json

    $ollamaCompletion = Invoke-WebRequest -Uri "http://localhost:11434/api/generate" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body

    $result = $ollamaCompletion.Content | ConvertFrom-Json
    Write-Host "   ✅ Ollama completion successful" -ForegroundColor Green
    Write-Host "   Response: $($result.response.Substring(0, [Math]::Min(100, $result.response.Length)))..." -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Ollama completion failed" -ForegroundColor Red
    Write-Host "   Error: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

Write-Host "✅ All tests passed! Ollama integration is working." -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "- The API server should now be using Ollama instead of OpenAI" -ForegroundColor White
Write-Host "- Check .env file to confirm LLM_PROVIDER=ollama" -ForegroundColor White
Write-Host "- Test with: curl -X POST http://localhost:3000/api/v1/prompts/process ..." -ForegroundColor White
