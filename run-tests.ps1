# CBT Platform Test Runner (PowerShell version for Windows)
# Runs both unit tests (Jest) and E2E tests (Playwright)
#
# Usage:
#   .\run-tests.ps1                    # Run all tests
#   .\run-tests.ps1 -UnitOnly          # Run unit tests only
#   .\run-tests.ps1 -E2EOnly           # Run E2E tests only
#   .\run-tests.ps1 -ImageCropperOnly  # Run image cropper tests only
#   .\run-tests.ps1 -SkipUnit          # Skip unit tests
#   .\run-tests.ps1 -SkipE2E           # Skip E2E tests

param(
    [switch]$UnitOnly,
    [switch]$E2EOnly,
    [switch]$ImageCropperOnly,
    [switch]$SkipUnit,
    [switch]$SkipE2E
)

Write-Host "🧪 CBT Platform Test Suite" -ForegroundColor Cyan
Write-Host "==========================" -ForegroundColor Cyan
Write-Host ""

# Check if .env file exists
if (-not (Test-Path "backend\.env")) {
    Write-Host "⚠️  Warning: backend\.env file not found" -ForegroundColor Yellow
    Write-Host "Please create a .env file with required environment variables" -ForegroundColor Yellow
}

# Determine which tests to run
$RunUnitTests = -not $E2EOnly -and -not $ImageCropperOnly -and -not $SkipUnit
$RunE2ETests = -not $UnitOnly -and -not $ImageCropperOnly -and -not $SkipE2E
$RunImageCropperTests = -not $UnitOnly -and -not $E2EOnly

# Run Image Cropper Unit Tests
if ($RunImageCropperTests) {
    Write-Host "📦 Running Image Cropper Unit Tests..." -ForegroundColor Yellow
    Write-Host ""
    Push-Location backend
    npm test -- src/utils/__tests__/imageCropper.test.js --verbose
    if ($LASTEXITCODE -ne 0) {
        Pop-Location
        Write-Host "❌ Image Cropper tests failed" -ForegroundColor Red
        exit 1
    }
    Pop-Location
    Write-Host ""
    Write-Host "✅ Image Cropper tests completed" -ForegroundColor Green
    Write-Host ""
}

# Run Backend Unit Tests
if ($RunUnitTests) {
    Write-Host "🔧 Running Backend Unit Tests (Jest)..." -ForegroundColor Yellow
    Write-Host ""
    Push-Location backend
    npm test -- --verbose --forceExit
    if ($LASTEXITCODE -ne 0) {
        Pop-Location
        Write-Host "❌ Backend unit tests failed" -ForegroundColor Red
        exit 1
    }
    Pop-Location
    Write-Host ""
    Write-Host "✅ Backend unit tests completed" -ForegroundColor Green
    Write-Host ""
}

# Run E2E Tests
if ($RunE2ETests) {
    Write-Host "🌐 Running E2E Tests (Playwright)..." -ForegroundColor Yellow
    Write-Host ""
    
    # Check if Playwright is installed
    $playwrightInstalled = $null -ne (Get-Command npx -ErrorAction SilentlyContinue)
    if (-not $playwrightInstalled) {
        Write-Host "Playwright not found. Installing..." -ForegroundColor Red
        npm install -D @playwright/test playwright
    }
    
    # Install Playwright browsers if needed
    Write-Host "📥 Ensuring Playwright browsers are installed..." -ForegroundColor Yellow
    npx playwright install chromium
    
    # Run Playwright tests
    npx playwright test --reporter=list,html
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ E2E tests failed" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "✅ E2E tests completed" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 To view the HTML report, run: npx playwright show-report" -ForegroundColor Yellow
    Write-Host ""
}

# Summary
Write-Host ""
Write-Host "🎉 All tests completed successfully!" -ForegroundColor Green
Write-Host ""

