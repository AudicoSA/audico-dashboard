# Social Media Agent - Complete Documentation

## Overview

The Social Media Agent is an AI-powered service that automatically generates, manages, and schedules social media content for a home automation and smart home technology retailer. It uses Claude AI with Retrieval-Augmented Generation (RAG) from the Supabase product catalog to create contextually rich, platform-optimized content.

## Features

✅ **AI Content Generation** - Uses Claude 3.5 Sonnet for high-quality social media posts
✅ **RAG from Product Catalog** - Retrieves relevant products from Supabase to enrich content
✅ **Multi-Platform Support** - Optimized content for Facebook, Instagram, Twitter, LinkedIn, TikTok, YouTube
✅ **Smart Home Focus** - Targets 25+ home automation and smart home keywords
✅ **Visual Content Generation** - NotebookLM integration for infographics, slides, and video overviews
✅ **Platform-Specific Aspect Ratios** - Auto-detects and generates 16:9 (landscape) for LinkedIn/Facebook, 9:16 (portrait) for Instagram/TikTok
✅ **Visual Regeneration** - Refine visuals with custom prompts for perfect results
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
    visual_content_url TEXT,  -- New: NotebookLM generated visual URL
    status TEXT NOT NULL CHECK (status IN ('draft', 'scheduled', 'published', 'failed')),
    scheduled_for TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    post_url TEXT,
    engagement JSONB DEFAULT '{"likes": 0, "comments": 0, "shares": 0}',
    created_by TEXT REFERENCES squad_agents(name),
    metadata JSONB DEFAULT '{}',  -- Includes: notebooklm_notebook_id, notebooklm_artifact_id
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### notebooklm_notebooks
```sql
CREATE TABLE notebooklm_notebooks (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    notebook_id TEXT NOT NULL UNIQUE,
    purpose TEXT,
    sources_count INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### notebooklm_artifacts
```sql
CREATE TABLE notebooklm_artifacts (
    id UUID PRIMARY KEY,
    notebook_id UUID NOT NULL REFERENCES notebooklm_notebooks(id),
    artifact_type artifact_type NOT NULL,  -- 'infographic', 'slide_deck', 'video_overview'
    storage_path TEXT,
    generation_prompt TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    linked_social_post_id UUID REFERENCES social_posts(id),
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

# Google Cloud (for NotebookLM - optional, falls back to Python bridge if not set)
GOOGLE_CLOUD_PROJECT_ID=your_project_id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
NOTEBOOKLM_PYTHON_PATH=/path/to/notebooklm_bridge.py

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

-- Run 004_notebooklm_integration.sql
-- This creates notebooklm_notebooks and notebooklm_artifacts tables
-- Also adds visual_content_url to social_posts and creates storage bucket
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

### Generate Post with Visual Content

Generate a post with an automatic visual infographic:

```bash
curl -X POST http://localhost:3001/api/social-agent \
  -H "Content-Type: application/json" \
  -d '{
    "action": "generate_post",
    "platform": "instagram",
    "keywords": ["smart home", "home automation", "smart lighting"],
    "scheduledFor": "2024-02-10T10:00:00Z",
    "productQuery": "smart lighting",
    "generateVisual": true,
    "visualType": "infographic"
  }'
```

Response:
```json
{
  "postId": "uuid",
  "taskId": "uuid"
}
```

**Visual Types:**
- `infographic` - Static infographic (PNG)
- `slide_deck` - Multi-slide presentation
- `video_overview` - Short video overview (MP4)

### Generate Visual for Existing Post

Add visual content to an already created post:

```bash
curl -X POST http://localhost:3001/api/social-agent \
  -H "Content-Type: application/json" \
  -d '{
    "action": "generate_visual",
    "postId": "uuid",
    "visualType": "infographic"
  }'
```

Response:
```json
{
  "success": true,
  "visualUrl": "https://your-project.supabase.co/storage/v1/object/public/notebooklm-visuals/...",
  "artifactId": "infographic-1234567890"
}
```

### Regenerate Visual with Custom Prompt

Refine an existing visual with custom requirements:

```bash
curl -X POST http://localhost:3001/api/social-agent \
  -H "Content-Type: application/json" \
  -d '{
    "action": "regenerate_visual",
    "postId": "uuid",
    "customPrompt": "Make the design more modern and minimalist. Use blue and white color scheme. Add product photos."
  }'
```

Response:
```json
{
  "success": true,
  "visualUrl": "https://your-project.supabase.co/storage/v1/object/public/notebooklm-visuals/...",
  "artifactId": "infographic-9876543210"
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

// Generate a post with visual content
const postId = await socialAgent.createPostDraft(
  'instagram',
  ['smart home', 'IoT devices'],
  new Date('2024-02-10T10:00:00Z'),
  'smart lighting',
  true,  // generateVisual
  'infographic'  // visualType
)

// Generate visual content for existing post
const visualResult = await socialAgent.generateVisualContent(
  postId,
  'infographic'  // or 'slide_deck', 'video_overview'
)
if (visualResult.success) {
  console.log('Visual URL:', visualResult.visualUrl)
  console.log('Artifact ID:', visualResult.artifactId)
}

// Regenerate visual with custom prompt
const regenerateResult = await socialAgent.regenerateVisual(
  postId,
  'Make it more colorful with gradient backgrounds'
)
if (regenerateResult.success) {
  console.log('New Visual URL:', regenerateResult.visualUrl)
}

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

### Visual Content Generation Flow

1. **Initiate** → API call with `generateVisual: true` or `generate_visual` action
2. **Retrieve Context** → Fetches post content and product data
3. **Notebook Creation** → Creates or reuses NotebookLM notebook
4. **Add Sources** → Adds post content and product data as sources
5. **Detect Platform** → Determines aspect ratio (16:9 for LinkedIn/Facebook, 9:16 for Instagram/TikTok)
6. **Generate Artifact** → Calls NotebookLM API to create infographic/slides/video
7. **Download** → Downloads artifact to temporary directory
8. **Upload to Storage** → Uploads to Supabase `notebooklm-visuals` bucket
9. **Update Database** → Updates `social_posts.visual_content_url` and metadata
10. **Cleanup** → Removes temporary files
11. **Track Artifact** → Records in `notebooklm_artifacts` table for tracking

### Visual Regeneration Flow

1. **Retrieve Post** → Fetches existing post with notebook ID
2. **Custom Prompt** → Combines base prompt with custom requirements
3. **Generate New** → Creates new artifact with updated prompt
4. **Upload & Update** → Same as generation flow
5. **Metadata Update** → Records regeneration with custom prompt in metadata

## Platform Guidelines

### Facebook
- **Max Length**: 63,206 characters
- **Recommended**: 400 characters
- **Hashtags**: 5 max
- **Style**: Conversational, emojis, CTA
- **Visual Format**: 16:9 landscape (1920x1080)

### Instagram
- **Max Length**: 2,200 characters
- **Recommended**: 300 characters
- **Hashtags**: 30 max (3-5 recommended)
- **Style**: Visual-focused, short sentences, emoji-rich
- **Visual Format**: 9:16 portrait (1080x1920)

### Twitter/X
- **Max Length**: 280 characters
- **Recommended**: 280 characters
- **Hashtags**: 2 max
- **Style**: Concise, engaging hook
- **Visual Format**: 16:9 landscape (1920x1080)

### LinkedIn
- **Max Length**: 3,000 characters
- **Recommended**: 1,300 characters
- **Hashtags**: 5 max
- **Style**: Professional, value-driven, business benefits
- **Visual Format**: 16:9 landscape (1920x1080)

### TikTok
- **Max Length**: 2,200 characters
- **Recommended**: 150 characters
- **Hashtags**: 10 max (3-5 recommended)
- **Style**: Short, trendy, youth-oriented
- **Visual Format**: 9:16 portrait (1080x1920)

### YouTube
- **Max Length**: 5,000 characters
- **Recommended**: 1,000 characters
- **Hashtags**: 15 max
- **Style**: Keyword-rich, timestamps, links
- **Visual Format**: 16:9 landscape (1920x1080)

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
- [x] Visual content generation with NotebookLM (infographics, slides, videos) ✅
- [ ] A/B testing for content variations
- [ ] Engagement analytics and learning
- [ ] Automated hashtag research
- [ ] Competitor content analysis
- [ ] Multi-language support
- [ ] Advanced video editing and animations
- [ ] Sentiment analysis
- [ ] Content calendar visualization
- [ ] Automated visual A/B testing
- [ ] Dynamic product insertion in visuals

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

### "Failed to generate visual content"
- Check GOOGLE_CLOUD_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS are set
- Verify NotebookLM API access
- Check NOTEBOOKLM_PYTHON_PATH if using Python fallback
- Ensure notebooklm-visuals storage bucket exists
- Check storage bucket policies allow uploads

### "Failed to upload to storage"
- Verify notebooklm-visuals bucket exists in Supabase Storage
- Check storage bucket is public for read access
- Verify service role key has storage permissions
- Check file size limits (50MB default)

### "No notebook found for this post"
- Generate visual content first with generate_visual action
- Check notebooklm_notebooks table for records
- Verify post metadata contains notebooklm_notebook_id

## Support

For issues or questions:
1. Check the logs in squad_messages
2. Review API response errors
3. Verify environment variables
4. Check database migrations are complete

## License

Proprietary - Audico Dashboard
