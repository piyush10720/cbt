#!/bin/bash

# CBT Platform Test Runner
# Runs both unit tests (Jest) and E2E tests (Playwright)

set -e  # Exit on error

echo "🧪 CBT Platform Test Suite"
echo "=========================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Check if .env file exists
if [ ! -f "backend/.env" ]; then
    print_status "$RED" "⚠️  Warning: backend/.env file not found"
    print_status "$YELLOW" "Please create a .env file with required environment variables"
fi

# Parse command line arguments
RUN_UNIT_TESTS=true
RUN_E2E_TESTS=true
RUN_IMAGE_CROPPER_TESTS=true

while [[ $# -gt 0 ]]; do
    case $1 in
        --unit-only)
            RUN_E2E_TESTS=false
            shift
            ;;
        --e2e-only)
            RUN_UNIT_TESTS=false
            RUN_IMAGE_CROPPER_TESTS=false
            shift
            ;;
        --image-cropper-only)
            RUN_UNIT_TESTS=false
            RUN_E2E_TESTS=false
            shift
            ;;
        --skip-unit)
            RUN_UNIT_TESTS=false
            shift
            ;;
        --skip-e2e)
            RUN_E2E_TESTS=false
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--unit-only] [--e2e-only] [--image-cropper-only] [--skip-unit] [--skip-e2e]"
            exit 1
            ;;
    esac
done

# Run Image Cropper Unit Tests
if [ "$RUN_IMAGE_CROPPER_TESTS" = true ]; then
    print_status "$YELLOW" "📦 Running Image Cropper Unit Tests..."
    echo ""
    cd backend
    npm test -- src/utils/__tests__/imageCropper.test.js --verbose
    cd ..
    echo ""
    print_status "$GREEN" "✅ Image Cropper tests completed"
    echo ""
fi

# Run Backend Unit Tests
if [ "$RUN_UNIT_TESTS" = true ]; then
    print_status "$YELLOW" "🔧 Running Backend Unit Tests (Jest)..."
    echo ""
    cd backend
    npm test -- --verbose --forceExit
    cd ..
    echo ""
    print_status "$GREEN" "✅ Backend unit tests completed"
    echo ""
fi

# Run E2E Tests
if [ "$RUN_E2E_TESTS" = true ]; then
    print_status "$YELLOW" "🌐 Running E2E Tests (Playwright)..."
    echo ""
    
    # Check if Playwright browsers are installed
    if ! npx playwright --version > /dev/null 2>&1; then
        print_status "$RED" "Playwright not found. Installing..."
        npm install -D @playwright/test playwright
    fi
    
    # Install Playwright browsers if needed
    print_status "$YELLOW" "📥 Ensuring Playwright browsers are installed..."
    npx playwright install chromium
    
    # Run Playwright tests
    npx playwright test --reporter=list,html
    
    echo ""
    print_status "$GREEN" "✅ E2E tests completed"
    echo ""
    print_status "$YELLOW" "📊 To view the HTML report, run: npx playwright show-report"
    echo ""
fi

# Summary
echo ""
print_status "$GREEN" "🎉 All tests completed successfully!"
echo ""

