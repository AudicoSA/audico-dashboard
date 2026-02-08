# Social Media Agent - Complete Documentation

## Overview

The Social Media Agent is an AI-powered service that automatically generates, manages, and schedules social media content for a home automation and smart home technology retailer. It uses Claude AI with Retrieval-Augmented Generation (RAG) from the Supabase product catalog to create contextually rich, platform-optimized content.

## Features

✅ **AI Content Generation** - Uses Claude 3.5 Sonnet for high-quality social media posts
✅ **RAG from Product Catalog** - Retrieves relevant products from Supabase to enrich content
✅ **Multi-Platform Support** - Optimized content for Facebook, Instagram, Twitter, LinkedIn, TikTok, YouTube
✅ **Smart Home Focus** - Targets 25+ home automation and smart home keywords
✅ **Approval Workflow** - Integrates with squad_tasks for human review before publishing
✅ **Scheduled Posting** - Automatic publishing at scheduled times
✅ **Bulk Generation** - Create multiple posts at once for content planning
✅ **Activity Logging** - All actions logged to squad_messages

## Architecture

### File Structure

```
services/agents/
├── social-agent.ts      # Main agent class with all functionality
├── types.ts             # TypeScript type definitions
├── utils.ts             # Helper functions and constants
├── example.ts           # Usage examples
├── index.ts             # Exports
└── README.md            # Service documentation

app/api/social-agent/
├── route.ts             # Main API endpoint
└── scheduled/
    └── route.ts         # Cron endpoint for automated posting

supabase/migrations/
├── 003_schema_extensions.sql   # social_posts table
└── 004_products_catalog.sql    # products table with sample data
```

### Database Schema

#### social_posts
```sql
CREATE TABLE social_posts (
    id UUID PRIMARY KEY,
    platform TEXT NOT NULL CHECK (platform IN (...)),
    content TEXT NOT NULL,
    media_urls TEXT[],
    status TEXT NOT NULL CHECK (status IN ('draft', 'scheduled', 'published', 'failed')),
    scheduled_for TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    post_url TEXT,
    engagement JSONB DEFAULT '{"likes": 0, "comments": 0, "shares": 0}',
    created_by TEXT REFERENCES squad_agents(name),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### products
```sql
CREATE TABLE products (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    brand TEXT,
    price DECIMAL(10, 2),
    features TEXT[],
    tags TEXT[],
    image_url TEXT,
    sku TEXT UNIQUE,
    stock_quantity INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Setup

### 1. Install Dependencies

```bash
npm install @anthropic-ai/sdk
```

Already included in package.json.

### 2. Environment Variables

Add to your `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Anthropic Claude API
ANTHROPIC_API_KEY=your_anthropic_api_key

# Cron Security (optional)
CRON_SECRET=your_cron_secret
```

### 3. Database Migration

Run the SQL migrations in Supabase:

```sql
-- Run 003_schema_extensions.sql (if not already run)
-- This creates the social_posts table

-- Run 004_products_catalog.sql
-- This creates the products table with sample smart home products
```

### 4. Verify Setup

```bash
npm run dev
```

Test the API:
```bash
curl http://localhost:3001/api/social-agent \
  -H "Content-Type: application/json" \
  -d '{"action": "get_scheduled"}'
```

## API Usage

### Generate a Single Post

```bash
curl -X POST http://localhost:3001/api/social-agent \
  -H "Content-Type: application/json" \
  -d '{
    "action": "generate_post",
    "platform": "instagram",
    "keywords": ["smart home", "home automation", "smart lighting"],
    "scheduledFor": "2024-02-10T10:00:00Z",
    "productQuery": "smart lighting"
  }'
```

Response:
```json
{
  "postId": "uuid",
  "taskId": "uuid"
}
```

### Approve Post

```bash
curl -X POST http://localhost:3001/api/social-agent \
  -H "Content-Type: application/json" \
  -d '{
    "action": "approve_post",
    "postId": "uuid",
    "scheduledFor": "2024-02-10T10:00:00Z"
  }'
```

### Reject Post

```bash
curl -X POST http://localhost:3001/api/social-agent \
  -H "Content-Type: application/json" \
  -d '{
    "action": "reject_post",
    "postId": "uuid",
    "reason": "Content needs more product details"
  }'
```

### Generate Bulk Posts (7 posts for the week)

```bash
curl -X POST http://localhost:3001/api/social-agent \
  -H "Content-Type: application/json" \
  -d '{
    "action": "generate_bulk",
    "count": 7
  }'
```

### Schedule Weekly Posts

```bash
curl -X POST http://localhost:3001/api/social-agent \
  -H "Content-Type: application/json" \
  -d '{
    "action": "schedule_weekly"
  }'
```

### Get Scheduled Posts

```bash
curl http://localhost:3001/api/social-agent
```

### Publish Post (Manual)

```bash
curl -X POST http://localhost:3001/api/social-agent \
  -H "Content-Type: application/json" \
  -d '{
    "action": "publish_post",
    "postId": "uuid"
  }'
```

## Programmatic Usage

```typescript
import { socialAgent } from '@/services/agents/social-agent'

// Generate a single post
const postId = await socialAgent.createPostDraft(
  'facebook',
  ['smart home', 'home automation'],
  new Date('2024-02-10T10:00:00Z'),
  'smart speakers'
)

// Create approval task
const taskId = await socialAgent.createApprovalTask(postId)

// Approve post
await socialAgent.approvePost(postId, new Date('2024-02-10T10:00:00Z'))

// Reject post
await socialAgent.rejectPost(postId, 'Needs more emojis')

// Generate bulk posts
const postIds = await socialAgent.generateBulkPosts(7)

// Schedule weekly posts
await socialAgent.scheduleWeeklyPosts()

// Get scheduled posts
const posts = await socialAgent.getScheduledPosts()

// Publish post
await socialAgent.publishPost(postId)

// Mark post as failed
await socialAgent.markPostFailed(postId, 'API error')

// Search products
const products = await socialAgent.searchProducts('sonos')
```

## Workflow

### Content Generation Flow

1. **Trigger** → API call or scheduled job
2. **Product Fetch** → Retrieves relevant products from catalog
3. **Prompt Construction** → Builds platform-specific prompt with:
   - Target keywords
   - Platform guidelines
   - Product context
   - Brand voice
4. **Claude Generation** → Calls Claude API to generate content
5. **Draft Creation** → Saves to `social_posts` table with status 'draft'
6. **Task Creation** → Creates approval task in `squad_tasks`
7. **Notification** → Logs to `squad_messages` for team visibility

### Approval Flow

1. **Review** → Human reviews post in dashboard
2. **Decision** → Approve or Reject
3. **If Approved**:
   - Status updated to 'scheduled'
   - `scheduled_for` timestamp set
   - Task marked complete
4. **If Rejected**:
   - Metadata updated with reason
   - Task marked complete
   - Agent can regenerate if needed

### Publishing Flow

1. **Cron Job** → Calls `/api/social-agent/scheduled` every hour
2. **Fetch Posts** → Gets posts scheduled for next hour
3. **Publish** → Updates status to 'published'
4. **Error Handling** → If fails, status set to 'failed' with error details
5. **Logging** → All actions logged to `squad_messages`

## Platform Guidelines

### Facebook
- **Max Length**: 63,206 characters
- **Recommended**: 400 characters
- **Hashtags**: 5 max
- **Style**: Conversational, emojis, CTA

### Instagram
- **Max Length**: 2,200 characters
- **Recommended**: 300 characters
- **Hashtags**: 30 max (3-5 recommended)
- **Style**: Visual-focused, short sentences, emoji-rich

### Twitter/X
- **Max Length**: 280 characters
- **Recommended**: 280 characters
- **Hashtags**: 2 max
- **Style**: Concise, engaging hook

### LinkedIn
- **Max Length**: 3,000 characters
- **Recommended**: 1,300 characters
- **Hashtags**: 5 max
- **Style**: Professional, value-driven, business benefits

### TikTok
- **Max Length**: 2,200 characters
- **Recommended**: 150 characters
- **Hashtags**: 10 max (3-5 recommended)
- **Style**: Short, trendy, youth-oriented

### YouTube
- **Max Length**: 5,000 characters
- **Recommended**: 1,000 characters
- **Hashtags**: 15 max
- **Style**: Keyword-rich, timestamps, links

## Target Keywords

The agent targets these 25+ smart home keywords:

- smart home
- home automation
- smart lighting
- smart security
- voice control
- smart speakers
- connected home
- IoT devices
- smart thermostat
- home assistant
- smart locks
- smart cameras
- wireless home
- automated living
- smart devices
- intelligent home
- home control
- smart entertainment
- multiroom audio
- smart switches
- smart plugs
- motion sensors
- smart blinds
- smart garage
- energy monitoring

## Scheduled Jobs

### Hourly Publishing Job

Set up a cron job or use Vercel Cron:

```bash
# Every hour
0 * * * * curl -X POST https://your-domain.com/api/social-agent/scheduled \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

**Vercel vercel.json:**
```json
{
  "crons": [
    {
      "path": "/api/social-agent/scheduled",
      "schedule": "0 * * * *"
    }
  ]
}
```

### Weekly Content Generation

Set up a weekly job to generate bulk posts:

```bash
# Every Monday at 9 AM
0 9 * * 1 curl -X POST https://your-domain.com/api/social-agent \
  -H "Content-Type: application/json" \
  -d '{"action": "schedule_weekly"}'
```

## Sample Products

The migration includes 12 sample smart home products:

1. Sonos One SL - Smart Speaker
2. Philips Hue Starter Kit - Smart Lighting
3. Google Nest Hub Max - Smart Display
4. Ring Video Doorbell Pro 2 - Smart Security
5. ecobee SmartThermostat - Smart Climate
6. Samsung SmartThings Hub - Smart Hub
7. Yale Assure Lock SL - Smart Lock
8. TP-Link Kasa Smart Plug - Smart Plug
9. Arlo Pro 4 Camera - Smart Security
10. Lutron Caseta Dimmer Kit - Smart Lighting
11. Amazon Echo Show 10 - Smart Display
12. Netatmo Smart Doorbell - Smart Security

## Error Handling

The agent includes comprehensive error handling:

- **API Errors**: Caught and logged with descriptive messages
- **Database Errors**: Graceful fallbacks with error logging
- **Claude Errors**: Retry logic and fallback content
- **Validation**: Input validation on all API endpoints
- **Failed Posts**: Automatically marked with error details

## Monitoring

Monitor the agent through:

1. **squad_messages** - All agent activity logged
2. **squad_tasks** - Approval workflow tracking
3. **social_posts.metadata** - Generation details and errors
4. **API Logs** - Request/response logging

## Future Enhancements

- [ ] Direct integration with social media APIs (Meta, Twitter, etc.)
- [ ] Image generation with DALL-E or Midjourney
- [ ] A/B testing for content variations
- [ ] Engagement analytics and learning
- [ ] Automated hashtag research
- [ ] Competitor content analysis
- [ ] Multi-language support
- [ ] Video content generation
- [ ] Sentiment analysis
- [ ] Content calendar visualization

## Troubleshooting

### "Failed to generate post content"
- Check ANTHROPIC_API_KEY is set correctly
- Verify API key has sufficient credits
- Check Claude API rate limits

### "Post not found"
- Verify post ID exists in social_posts table
- Check Supabase connection

### "Failed to save post draft"
- Check Supabase permissions
- Verify social_posts table exists
- Check RLS policies

### "Products not found"
- Run 004_products_catalog.sql migration
- Check products table has data
- Verify Supabase connection

## Support

For issues or questions:
1. Check the logs in squad_messages
2. Review API response errors
3. Verify environment variables
4. Check database migrations are complete

## License

Proprietary - Audico Dashboard
