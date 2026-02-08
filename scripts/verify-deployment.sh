#!/bin/bash

set -e

echo "🚀 Starting deployment verification..."

echo ""
echo "📋 Checking environment variables..."
REQUIRED_VARS=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"
  "GMAIL_CLIENT_ID"
  "GMAIL_CLIENT_SECRET"
  "GMAIL_REFRESH_TOKEN"
)

MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    MISSING_VARS+=("$var")
    echo "   ❌ $var is not set"
  else
    echo "   ✅ $var is set"
  fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
  echo ""
  echo "❌ Missing required environment variables:"
  printf '   - %s\n' "${MISSING_VARS[@]}"
  echo ""
  echo "Please set these variables in Vercel dashboard or .env.local"
  exit 1
fi

echo ""
echo "🔍 Checking Supabase connectivity..."
npx tsx scripts/check-supabase.ts

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ All deployment checks passed!"
  echo ""
  echo "You can now deploy with: vercel --prod"
  exit 0
else
  echo ""
  echo "❌ Deployment checks failed"
  exit 1
fi
