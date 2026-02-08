# Agent Services

This directory contains autonomous agent services that automate various business processes.

## Available Agents

### Social Media Agent

A comprehensive social media content generation and management service using Claude AI with RAG (Retrieval-Augmented Generation) from the Supabase product catalog.

**Features:**
- **AI-Powered Content Generation**: Uses Claude 3.5 Sonnet to generate platform-specific social media content
- **RAG from Product Catalog**: Retrieves relevant product information from Supabase to create contextually rich posts
- **Multi-Platform Support**: Generates content optimized for Facebook, Instagram, Twitter, LinkedIn, TikTok, and YouTube
- **Smart Home Keyword Targeting**: Focuses on home automation and smart home technology keywords
- **Approval Workflow**: Creates tasks in the squad system requiring approval before publishing
- **Scheduled Posting**: Supports scheduling posts for future publication
- **Bulk Generation**: Can generate multiple posts at once for content planning

**API Endpoints:**
- `/api/social-agent` - Main endpoint for CRUD operations
- `/api/social-agent/scheduled` - Cron endpoint for automated posting

**See [Social Media Agent Documentation](#social-media-agent-detailed) below for detailed usage.**

### Marketing Agent

The Marketing Agent is a comprehensive service that automates marketing tasks including reseller onboarding, pricing calculations, newsletter generation, and influencer outreach.

**Features:**
- **Reseller Signup Processing**: Verifies business details via Google Places API
- **Reseller Pricing Calculator**: Calculates reseller prices at cost + 10%
- **Newsletter Generation**: Uses Claude (Anthropic) to generate engaging newsletters with SEO-driven content
- **Influencer Discovery**: Searches across Twitter, Instagram, YouTube, and LinkedIn for tech influencers

**API Endpoints:**
- `POST /api/agents/marketing` - Execute marketing actions
- `GET /api/agents/marketing` - Query marketing data

**See [Marketing Agent Documentation](#marketing-agent-detailed) below for detailed usage.**

---

## Social Media Agent (Detailed)

### Architecture

#### Core Components

1. **SocialMediaAgent Class** (`services/agents/social-agent.ts`)
   - Main service class handling all social media operations
   - Integrates with Supabase for data persistence
   - Uses Anthropic's Claude API for content generation

2. **Database Tables**
   - `social_posts` - Stores all social media posts and drafts
   - `products` - Product catalog for RAG context
   - `squad_tasks` - Approval workflow tasks
   - `squad_messages` - Activity logging

### API Usage

#### Generate a Single Post

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

#### Approve a Post

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

#### Generate Bulk Posts

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

### Direct Service Usage

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
```

### Target Keywords

The social agent focuses on home automation and smart home keywords:
- smart home, home automation, smart lighting, smart security
- voice control, smart speakers, connected home, IoT devices
- smart thermostat, home assistant, smart locks, smart cameras

### Platform Guidelines

- **Facebook**: 1-2 paragraphs, conversational, emojis, CTA
- **Instagram**: Visual-focused, 3-5 hashtags, emoji-rich, short sentences
- **Twitter**: Under 280 chars, 1-2 hashtags, engaging hook
- **LinkedIn**: Professional tone, 2-3 paragraphs, business benefits
- **TikTok**: Short, trendy, youth-oriented, 3-5 hashtags
- **YouTube**: Keyword-rich description, timestamps, links

---

## Marketing Agent (Detailed)

### Features

#### 1. Reseller Signup Processing
- **Business Verification**: Verifies business details via Google Places API
- **Status Management**: Automatically approves or flags applications for review
- **Data Storage**: Stores verification results in `reseller_applications` table

#### 2. Reseller Pricing Calculator
- **Cost-Plus Pricing**: Calculates reseller prices at cost + 10%
- **Product Catalog Integration**: Fetches products from Supabase `products` table
- **Margin Calculation**: Computes profit margins for each product

#### 3. Newsletter Generation
- **AI-Powered Content**: Uses Claude (Anthropic) to generate engaging newsletters
- **SEO-Driven**: Analyzes trending keywords from `seo_audits` data
- **Product Integration**: Features top products with pricing
- **Brevo-Ready**: Outputs HTML format compatible with Brevo.com

#### 4. Influencer Discovery
- **Multi-Platform Search**: Searches across Twitter, Instagram, YouTube, and LinkedIn
- **Engagement Metrics**: Calculates engagement rates for each influencer
- **Task Creation**: Stores opportunities as tasks in `squad_tasks` table
- **Niche Targeting**: Supports custom niche searches (tech, audio, smart home, etc.)

### API Endpoints

#### POST /api/agents/marketing

##### Process Reseller Signup
```json
{
  "action": "process_reseller_signup",
  "applicationId": "uuid-here"
}
```

##### Calculate Reseller Pricing
```json
{
  "action": "calculate_reseller_pricing"
}
```

##### Generate Newsletter
```json
{
  "action": "generate_newsletter"
}
```

##### Find and Store Influencers
```json
{
  "action": "find_influencers",
  "niches": ["tech", "audio", "smart home"]
}
```

##### Run Complete Workflow
```json
{
  "action": "run_workflow"
}
```

#### GET /api/agents/marketing

- `GET /api/agents/marketing?action=get_trending_products&limit=10`
- `GET /api/agents/marketing?action=calculate_reseller_pricing`

### Programmatic Usage

```typescript
import MarketingAgent from '@/services/agents/marketing-agent'

const agent = new MarketingAgent()

// Process a reseller application
await agent.processResellerSignup('application-uuid')

// Generate newsletter
const newsletter = await agent.generateNewsletterDraft()

// Find influencers and create tasks
await agent.findAndStoreInfluencers(['tech', 'audio'])

// Run complete workflow
await agent.runMarketingWorkflow()
```

### Database Tables

- `reseller_applications` - Reseller signup data
- `products` - Product catalog with cost/price
- `seo_audits` - SEO data with trending keywords
- `squad_tasks` - Task management
- `squad_messages` - Activity logging

---

## Environment Variables

Required environment variables for all agents:

```bash
# Supabase (Required for all agents)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Anthropic Claude API (Required for both agents)
ANTHROPIC_API_KEY=your_anthropic_api_key

# Cron Security (Optional for social agent)
CRON_SECRET=your_cron_secret

# Marketing Agent Specific APIs
GOOGLE_PLACES_API_KEY=your_key_here
TWITTER_BEARER_TOKEN=your_token_here
INSTAGRAM_ACCESS_TOKEN=your_token_here
INSTAGRAM_USER_ID=your_user_id_here
YOUTUBE_API_KEY=your_key_here
LINKEDIN_ACCESS_TOKEN=your_token_here
```

## Activity Logging

All agents log operations to `squad_messages` table with structured data:

```typescript
{
  from_agent: 'social' | 'marketing',
  message: 'Operation description',
  data: {
    event_type: 'operation_type',
    timestamp: '2024-01-01T00:00:00Z',
    // Additional context
  }
}
```

## Error Handling

- **Graceful Degradation**: Missing API keys result in warnings, not failures
- **Transaction Safety**: Database operations use proper error handling
- **Activity Logging**: All major operations are logged for audit trail
- **Detailed Errors**: API returns detailed error messages in response
