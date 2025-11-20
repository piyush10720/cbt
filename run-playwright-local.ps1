# Run Playwright E2E Tests with Existing Servers
# Assumes backend and frontend are already running

Write-Host "🎭 Running Playwright E2E Tests (Local)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if servers are running
Write-Host "📡 Checking if servers are running..." -ForegroundColor Yellow

$backendRunning = $false
$frontendRunning = $false

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/debug/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        $backendRunning = $true
        Write-Host "✅ Backend server is running on http://localhost:3001" -ForegroundColor Green
    }
} catch {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5000/api/debug/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $backendRunning = $true
            Write-Host "✅ Backend server is running on http://localhost:5000" -ForegroundColor Green
            Write-Host "⚠️  Note: Backend is on port 5000, not 3001. Update BACKEND_URL if needed." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "❌ Backend server is NOT running!" -ForegroundColor Red
    }
}

try {
    $response = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        $frontendRunning = $true
        Write-Host "✅ Frontend server is running on http://localhost:5173" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Frontend server is NOT running!" -ForegroundColor Red
}

Write-Host ""

if (-not $backendRunning -or -not $frontendRunning) {
    Write-Host "⚠️  One or more servers are not running." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To start servers:" -ForegroundColor Cyan
    Write-Host "  Terminal 1: cd backend && npm start" -ForegroundColor White
    Write-Host "  Terminal 2: cd frontend && npm run dev" -ForegroundColor White
    Write-Host ""
    
    $continue = Read-Host "Do you want to continue anyway? (y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        Write-Host "Exiting..." -ForegroundColor Yellow
        exit 1
    }
}

# Check if test PDFs exist
Write-Host "📄 Checking for test PDFs..." -ForegroundColor Yellow

$questionPdf = "backend\uploads\CS12025.pdf"
$answerKeyPdf = "backend\uploads\CS1_Keys.pdf"

if (Test-Path $questionPdf) {
    Write-Host "✅ Question paper found: $questionPdf" -ForegroundColor Green
} else {
    Write-Host "❌ Question paper NOT found: $questionPdf" -ForegroundColor Red
}

if (Test-Path $answerKeyPdf) {
    Write-Host "✅ Answer key found: $answerKeyPdf" -ForegroundColor Green
} else {
    Write-Host "❌ Answer key NOT found: $answerKeyPdf" -ForegroundColor Red
}

Write-Host ""

# Run Playwright tests
Write-Host "🚀 Running Playwright tests..." -ForegroundColor Yellow
Write-Host "   (This may take 3-5 minutes for PDF parsing and image extraction)" -ForegroundColor Gray
Write-Host ""

npx playwright test --config=playwright.config.local.ts --reporter=list

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Tests completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 To view the HTML report:" -ForegroundColor Cyan
    Write-Host "   npx playwright show-report" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "❌ Some tests failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "📊 To view the HTML report:" -ForegroundColor Cyan
    Write-Host "   npx playwright show-report" -ForegroundColor White
}

Write-Host ""

