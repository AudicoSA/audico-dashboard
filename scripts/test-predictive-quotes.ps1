# Predictive Quote System Test Script (PowerShell)
# Usage: .\scripts\test-predictive-quotes.ps1

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Predictive Quote System Test" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Check if running locally or on Vercel
$BASE_URL = if ($env:VERCEL_URL) {
    "https://$env:VERCEL_URL"
} else {
    "http://localhost:3001"
}

Write-Host "Testing at $BASE_URL" -ForegroundColor Yellow
Write-Host ""

Write-Host "1. Triggering predictive quote analysis..." -ForegroundColor Green
Write-Host "--------------------------------------"

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/api/predictive-quotes/trigger" -Method POST -ContentType "application/json"
    
    $response | ConvertTo-Json -Depth 10 | Write-Host
    
    Write-Host ""
    Write-Host "✓ Analysis triggered successfully" -ForegroundColor Green
    Write-Host ""
    Write-Host "Results Summary:" -ForegroundColor Yellow
    Write-Host "  - Opportunities Found: $($response.opportunities_found)"
    Write-Host "  - High Confidence (>80%): $($response.high_confidence_count)"
    Write-Host "  - Medium Confidence (60-80%): $($response.medium_confidence_count)"
    Write-Host "  - Quotes Generated: $($response.quotes_generated)"
    Write-Host "  - Review Tasks Created: $($response.tasks_created)"
    
} catch {
    Write-Host "✗ Analysis failed" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "2. Access the system:" -ForegroundColor Green
Write-Host "--------------------------------------"
Write-Host "Opportunities List: $BASE_URL/predictive-quotes" -ForegroundColor Cyan
Write-Host "Analytics Dashboard: $BASE_URL/squad/analytics/predictive-quotes" -ForegroundColor Cyan
Write-Host ""

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Test Complete" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
