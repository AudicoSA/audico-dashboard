# Vercel Deployment Guide

This guide covers deploying the multi-agent dashboard to Vercel with cron jobs, rate limiting, and Supabase connectivity checks.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Vercel CLI**: Install with `npm i -g vercel`
3. **Supabase Instance**: Ensure your Supabase database is set up with required tables
4. **Gmail API Credentials**: OAuth2 credentials for email agent
5. **Vercel KV Database**: Create a KV database in your Vercel project for rate limiting

## Environment Variables

Set these in your Vercel project settings (Settings → Environment Variables):

### Required Variables

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Gmail API Configuration
GMAIL_CLIENT_ID=your_gmail_client_id
GMAIL_CLIENT_SECRET=your_gmail_client_secret
GMAIL_REDIRECT_URI=https://your-domain.vercel.app/api/auth/gmail/callback
GMAIL_REFRESH_TOKEN=your_gmail_refresh_token

# Backend API (if applicable)
NEXT_PUBLIC_API_URL=https://your-backend-api.com
BACKEND_URL=https://your-backend-api.com

# Vercel KV (automatically set when you create a KV database)
KV_REST_API_URL=your_kv_url
KV_REST_API_TOKEN=your_kv_token
KV_REST_API_READ_ONLY_TOKEN=your_kv_read_only_token

# Cron Secret (generate a secure random string)
CRON_SECRET=your_secure_random_string
```

### Setting Environment Variables via CLI

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
# ... repeat for all variables
```

## Vercel KV Setup

1. Go to your Vercel project dashboard
2. Navigate to **Storage** → **Create Database** → **KV**
3. Name your database (e.g., "agent-rate-limiter")
4. Click **Create**
5. The environment variables will be automatically added to your project

## Cron Job Configuration

The `vercel.json` file defines the following cron jobs:

| Cron Job | Path | Schedule | Description |
|----------|------|----------|-------------|
| Email Poll | `/api/agents/email/poll` | Every 15 minutes | Polls Gmail for new messages |
| Email Classify | `/api/agents/email/classify` | Every 20 minutes | Classifies unprocessed emails |
| Stock Check | `/api/cron/stock/check` | Every 6 hours | Checks stock/price changes |
| Analytics Update | `/api/cron/analytics/update` | Daily at midnight | Updates analytics metrics |
| Maintenance Cleanup | `/api/cron/maintenance/cleanup` | Daily at 2 AM | Cleans up old logs |

## Rate Limits

Default rate limits per agent (24-hour window):

- **email_poll**: 96 executions/day (every 15 min)
- **email_classify**: 72 executions/day (every 20 min)
- **email_respond**: 50 executions/day
- **stock_check**: 4 executions/day (every 6 hours)
- **analytics_update**: 1 execution/day
- **maintenance_cleanup**: 1 execution/day

Rate limits are configured in `lib/rate-limiter.ts`.

## Pre-Deployment Checks

Before deploying, run the verification script:

```bash
npm run verify-deployment
```

This checks:
- All required environment variables are set
- Supabase connectivity
- Required database tables exist

## Deployment Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Add Vercel KV Package

```bash
npm install @vercel/kv
```

### 3. Add TypeScript Execution (for scripts)

```bash
npm install -D tsx
```

### 4. Link to Vercel Project

```bash
vercel link
```

### 5. Pull Environment Variables (Optional)

```bash
vercel env pull .env.local
```

### 6. Run Pre-Deployment Checks

```bash
npm run verify-deployment
```

### 7. Deploy to Production

```bash
vercel --prod
```

## Post-Deployment Verification

### Test Cron Endpoints

Each cron endpoint requires authentication. Test manually:

```bash
# Set your CRON_SECRET
CRON_SECRET="your_cron_secret"

# Test email poll
curl -X POST https://your-domain.vercel.app/api/agents/email/poll \
  -H "Authorization: Bearer $CRON_SECRET"

# Test stock check
curl https://your-domain.vercel.app/api/cron/stock/check \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Check Cron Job Logs

1. Go to Vercel Dashboard → Your Project
2. Navigate to **Deployments** → Select latest deployment
3. Click **Functions** → Select cron function
4. View logs and execution history

### Monitor Rate Limits

Check Vercel KV database to monitor rate limit usage:

```bash
# Using Vercel KV CLI
vercel kv get rate-limit:email_poll
```

## Troubleshooting

### Cron Jobs Not Running

- Verify cron jobs are enabled in `vercel.json`
- Check that `CRON_SECRET` environment variable is set
- Ensure endpoints return 200 status codes
- Review function logs in Vercel dashboard

### Rate Limit Issues

- Check KV database connection
- Verify `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set
- Review rate limit configuration in `lib/rate-limiter.ts`

### Supabase Connection Errors

- Verify `NEXT_PUBLIC_SUPABASE_URL` and keys are correct
- Check Supabase project is active
- Ensure required tables exist:
  - `squad_messages`
  - `email_logs`
  - `email_classifications`
  - `price_change_queue`
  - `agent_logs`

### Gmail API Issues

- Verify OAuth2 credentials are valid
- Check `GMAIL_REFRESH_TOKEN` is not expired
- Ensure Gmail API is enabled in Google Cloud Console
- Verify redirect URI matches Vercel domain

## Monitoring and Maintenance

### View Agent Execution Logs

Agent executions are logged to:
1. **Supabase**: `squad_messages` and `agent_logs` tables
2. **Vercel KV**: `agent-log:*` keys (24-hour retention)
3. **Vercel Functions**: Function logs in dashboard

### Adjust Rate Limits

Edit `lib/rate-limiter.ts` and redeploy:

```typescript
export const AGENT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  email_poll: {
    agentName: 'email_poll',
    maxExecutions: 96, // Change this
    windowSeconds: 86400,
  },
  // ...
}
```

### Update Cron Schedules

Edit `vercel.json` and redeploy:

```json
{
  "crons": [
    {
      "path": "/api/agents/email/poll",
      "schedule": "*/30 * * * *"  // Change to every 30 minutes
    }
  ]
}
```

## Security Best Practices

1. **Never commit secrets**: Use environment variables only
2. **Rotate credentials**: Regularly update API keys and tokens
3. **Monitor usage**: Set up alerts for unusual activity
4. **Use CRON_SECRET**: Protect cron endpoints from unauthorized access
5. **Limit permissions**: Use Supabase service role key only where necessary

## Cost Optimization

- **Vercel KV**: Free tier includes 256 MB storage, 100k operations/day
- **Cron Jobs**: Free tier includes 100 hours/month of serverless function execution
- **Adjust schedules**: Reduce frequency if approaching limits
- **Monitor usage**: Check Vercel dashboard regularly

## Support

For issues:
1. Check Vercel function logs
2. Review Supabase logs
3. Verify environment variables
4. Run `npm run verify-deployment` locally
5. Check rate limit status in KV database
