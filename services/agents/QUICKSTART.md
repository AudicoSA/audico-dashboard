# Social Media Agent - Quick Start Guide

## 5-Minute Setup

### 1. Install Dependencies
```bash
npm install
```

The `@anthropic-ai/sdk` is already in package.json.

### 2. Set Environment Variables

Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ANTHROPIC_API_KEY=your_anthropic_api_key
CRON_SECRET=your_random_secret
```

### 3. Run Database Migrations

In Supabase SQL Editor, run:
```sql
-- 1. Run 003_schema_extensions.sql (if not done)
-- 2. Run 004_products_catalog.sql
```

### 4. Start Dev Server
```bash
npm run dev
```

### 5. Test It!

Generate your first post:
```bash
curl -X POST http://localhost:3001/api/social-agent \
  -H "Content-Type: application/json" \
  -d '{
    "action": "generate_post",
    "platform": "instagram",
    "keywords": ["smart home", "home automation"]
  }'
```

## Common Use Cases

### Generate a Week of Content
```bash
curl -X POST http://localhost:3001/api/social-agent \
  -H "Content-Type: application/json" \
  -d '{"action": "schedule_weekly"}'
```

### Check Scheduled Posts
```bash
curl http://localhost:3001/api/social-agent
```

### Approve a Post
```bash
curl -X POST http://localhost:3001/api/social-agent \
  -H "Content-Type: application/json" \
  -d '{
    "action": "approve_post",
    "postId": "YOUR_POST_ID",
    "scheduledFor": "2024-02-10T10:00:00Z"
  }'
```

## What It Does

1. ✅ Fetches relevant products from your catalog
2. ✅ Generates AI-powered social media content
3. ✅ Creates approval tasks in your squad system
4. ✅ Schedules posts for automatic publishing
5. ✅ Logs all activity for team visibility

## Next Steps

- Read the full documentation: `SOCIAL_AGENT.md`
- Check the service README: `services/agents/README.md`
- View code examples: `services/agents/example.ts`
- Set up automated cron jobs for publishing

## Need Help?

Check the troubleshooting section in `SOCIAL_AGENT.md`.
