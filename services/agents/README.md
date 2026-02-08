# Social Media Agent Service

A comprehensive social media content generation and management service using Claude AI with RAG (Retrieval-Augmented Generation) from the Supabase product catalog.

## Features

- **AI-Powered Content Generation**: Uses Claude 3.5 Sonnet to generate platform-specific social media content
- **RAG from Product Catalog**: Retrieves relevant product information from Supabase to create contextually rich posts
- **Multi-Platform Support**: Generates content optimized for Facebook, Instagram, Twitter, LinkedIn, TikTok, and YouTube
- **Smart Home Keyword Targeting**: Focuses on home automation and smart home technology keywords
- **Approval Workflow**: Creates tasks in the squad system requiring approval before publishing
- **Scheduled Posting**: Supports scheduling posts for future publication
- **Bulk Generation**: Can generate multiple posts at once for content planning

## Architecture

### Core Components

1. **SocialMediaAgent Class** (`services/agents/social-agent.ts`)
   - Main service class handling all social media operations
   - Integrates with Supabase for data persistence
   - Uses Anthropic's Claude API for content generation

2. **API Endpoints**
   - `/api/social-agent` - Main endpoint for CRUD operations
   - `/api/social-agent/scheduled` - Cron endpoint for automated posting

3. **Database Tables**
   - `social_posts` - Stores all social media posts and drafts
   - `products` - Product catalog for RAG context
   - `squad_tasks` - Approval workflow tasks
   - `squad_messages` - Activity logging

## API Usage

### Generate a Single Post

```typescript
POST /api/social-agent
{
  "action": "generate_post",
  "platform": "instagram",
  "keywords": ["smart home", "home automation", "smart lighting"],
  "scheduledFor": "2024-02-10T10:00:00Z", // optional
  "productQuery": "smart lighting" // optional
}

Response:
{
  "postId": "uuid",
  "taskId": "uuid"
}
```

### Approve a Post

```typescript
POST /api/social-agent
{
  "action": "approve_post",
  "postId": "uuid",
  "scheduledFor": "2024-02-10T10:00:00Z" // optional
}

Response:
{
  "success": true
}
```

### Reject a Post

```typescript
POST /api/social-agent
{
  "action": "reject_post",
  "postId": "uuid",
  "reason": "Content needs more product details"
}

Response:
{
  "success": true
}
```

### Generate Bulk Posts

```typescript
POST /api/social-agent
{
  "action": "generate_bulk",
  "count": 7 // generates 7 posts
}

Response:
{
  "postIds": ["uuid1", "uuid2", ...],
  "count": 7
}
```

### Schedule Weekly Posts

```typescript
POST /api/social-agent
{
  "action": "schedule_weekly"
}

Response:
{
  "success": true
}
```

### Get Scheduled Posts

```typescript
GET /api/social-agent

Response:
{
  "posts": [
    {
      "id": "uuid",
      "platform": "facebook",
      "content": "...",
      "scheduled_for": "2024-02-10T10:00:00Z",
      ...
    }
  ]
}
```

### Publish Post (Automated)

```typescript
POST /api/social-agent
{
  "action": "publish_post",
  "postId": "uuid"
}

Response:
{
  "success": true
}
```

## Direct Service Usage

You can also import and use the service directly:

```typescript
import { socialAgent } from '@/services/agents/social-agent'

// Generate a post
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

// Generate bulk posts
const postIds = await socialAgent.generateBulkPosts(7)

// Schedule weekly posts
await socialAgent.scheduleWeeklyPosts()
```

## Workflow

1. **Content Generation**
   - Agent fetches relevant products from catalog based on query or random selection
   - Constructs prompt with platform guidelines and product context
   - Claude generates platform-optimized content

2. **Draft Creation**
   - Post saved to `social_posts` table with status 'draft'
   - Metadata includes target keywords and referenced products
   - Activity logged to `squad_messages`

3. **Approval Workflow**
   - Task created in `squad_tasks` table
   - Assigned to Jarvis (orchestrator)
   - Mentions Kenny flag set for review

4. **Approval/Rejection**
   - Approved: Post status updated, scheduled if date provided
   - Rejected: Metadata updated with reason, task closed

5. **Scheduled Publishing**
   - Cron job calls `/api/social-agent/scheduled`
   - Fetches posts scheduled for next hour
   - Updates status to 'published' or 'failed'

## Environment Variables

Required environment variables:

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

## Target Keywords

The agent focuses on these home automation and smart home keywords:

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

## Platform Guidelines

Each platform has specific content guidelines:

- **Facebook**: 1-2 paragraphs, conversational, emojis, CTA
- **Instagram**: Visual-focused, 3-5 hashtags, emoji-rich, short sentences
- **Twitter**: Under 280 chars, 1-2 hashtags, engaging hook
- **LinkedIn**: Professional tone, 2-3 paragraphs, business benefits
- **TikTok**: Short, trendy, youth-oriented, 3-5 hashtags
- **YouTube**: Keyword-rich description, timestamps, links

## Database Schema

### social_posts

```sql
CREATE TABLE social_posts (
    id UUID PRIMARY KEY,
    platform TEXT NOT NULL,
    content TEXT NOT NULL,
    media_urls TEXT[],
    status TEXT NOT NULL, -- 'draft', 'scheduled', 'published', 'failed'
    scheduled_for TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    post_url TEXT,
    engagement JSONB,
    created_by TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

### products

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
    -- ... more fields
);
```

## Scheduled Jobs

Set up a cron job to call the scheduled endpoint:

```bash
# Every hour
curl -X POST https://your-domain.com/api/social-agent/scheduled \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

Or use Vercel Cron:

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

## Future Enhancements

- Integration with actual social media APIs (Meta, Twitter, etc.)
- Image generation using DALL-E or Midjourney
- A/B testing for content variations
- Engagement analytics and optimization
- Automated hashtag research
- Competitor content analysis
- Multi-language support
