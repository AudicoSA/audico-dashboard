#!/bin/bash

# Predictive Quote System Test Script
# Usage: ./scripts/test-predictive-quotes.sh

echo "======================================"
echo "Predictive Quote System Test"
echo "======================================"
echo ""

# Check if running locally or on Vercel
if [ -z "$VERCEL_URL" ]; then
    BASE_URL="http://localhost:3001"
    echo "Testing locally at $BASE_URL"
else
    BASE_URL="https://$VERCEL_URL"
    echo "Testing on Vercel at $BASE_URL"
fi

echo ""
echo "1. Triggering predictive quote analysis..."
echo "--------------------------------------"

RESPONSE=$(curl -s -X POST "$BASE_URL/api/predictive-quotes/trigger" \
  -H "Content-Type: application/json")

echo "$RESPONSE" | jq '.'

if [ $? -eq 0 ]; then
    echo "✓ Analysis triggered successfully"
    
    # Extract metrics from response
    OPPORTUNITIES=$(echo "$RESPONSE" | jq -r '.opportunities_found')
    HIGH_CONF=$(echo "$RESPONSE" | jq -r '.high_confidence_count')
    MED_CONF=$(echo "$RESPONSE" | jq -r '.medium_confidence_count')
    QUOTES=$(echo "$RESPONSE" | jq -r '.quotes_generated')
    TASKS=$(echo "$RESPONSE" | jq -r '.tasks_created')
    
    echo ""
    echo "Results Summary:"
    echo "  - Opportunities Found: $OPPORTUNITIES"
    echo "  - High Confidence (>80%): $HIGH_CONF"
    echo "  - Medium Confidence (60-80%): $MED_CONF"
    echo "  - Quotes Generated: $QUOTES"
    echo "  - Review Tasks Created: $TASKS"
else
    echo "✗ Analysis failed"
    exit 1
fi

echo ""
echo "2. Access the system:"
echo "--------------------------------------"
echo "Opportunities List: $BASE_URL/predictive-quotes"
echo "Analytics Dashboard: $BASE_URL/squad/analytics/predictive-quotes"
echo ""

echo "======================================"
echo "Test Complete"
echo "======================================"
