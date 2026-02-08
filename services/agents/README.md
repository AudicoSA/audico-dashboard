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

### SEO Agent

The SEO Agent provides comprehensive SEO auditing and content generation capabilities for OpenCart products.

**Features:**
- **Product Auditing**: Scans OpenCart products for missing or inadequate SEO content
- **Image Quality Analysis**: Checks product images for quality, resolution, and format
- **AI-Powered Content Generation**: Uses Claude AI to generate SEO-optimized product descriptions and meta tags
- **Audit Results Storage**: Stores audit results in Supabase `seo_audits` table
- **Automated Fixes**: Can automatically apply generated SEO content to products

**See [SEO Agent Documentation](#seo-agent-detailed) below for detailed usage.**

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

## SEO Agent (Detailed)

### Features

The SEO Agent service provides comprehensive SEO auditing and content generation capabilities for OpenCart products.

- **Product Auditing**: Scans OpenCart products for missing or inadequate SEO content
- **Image Quality Analysis**: Checks product images for quality, resolution, and format
- **AI-Powered Content Generation**: Uses Claude AI to generate SEO-optimized product descriptions and meta tags
- **Audit Results Storage**: Stores audit results in Supabase `seo_audits` table
- **Automated Fixes**: Can automatically apply generated SEO content to products

### Environment Variables

Add these to your `.env.local` file:

```bash
# OpenCart Database Configuration
OPENCART_DB_HOST=localhost
OPENCART_DB_PORT=3306
OPENCART_DB_USER=your_opencart_db_user
OPENCART_DB_PASSWORD=your_opencart_db_password
OPENCART_DB_NAME=your_opencart_db_name
OPENCART_BASE_URL=https://your-opencart-store.com

# Anthropic API Configuration
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Image Analysis API Configuration (Optional)
IMAGE_ANALYSIS_API_URL=https://your-image-analysis-api.com/analyze
IMAGE_ANALYSIS_API_KEY=your_image_analysis_api_key
```

### Usage

#### 1. Audit Products

```typescript
import { auditProductsSEO } from '@/services/agents/seo-agent'

// Audit all active products (limit 100)
const result = await auditProductsSEO()

// Audit specific products
const result = await auditProductsSEO([1, 2, 3, 4, 5])

// Audit with custom limit
const result = await auditProductsSEO(undefined, 50)
```

#### 2. Store Audit Results

```typescript
import { storeAuditResults } from '@/services/agents/seo-agent'

const auditIds = await storeAuditResults(audits, 'content')
```

#### 3. Generate and Apply SEO Fixes

```typescript
import { generateAndApplySEOFixes } from '@/services/agents/seo-agent'

// Generate SEO content without applying
const result = await generateAndApplySEOFixes(123, false)

// Generate and apply SEO content
const result = await generateAndApplySEOFixes(123, true)
```

#### 4. Run Full Audit with Storage

```typescript
import { runFullSEOAudit } from '@/services/agents/seo-agent'

const result = await runFullSEOAudit()
// Returns: { audits, summary, stored_audit_ids }
```

### Audit Scoring

Products are scored from 0-100 based on:

- **Missing Description** (-40 points)
- **Short Description** (-30 points)
- **Missing Main Image** (-30 points)
- **Missing Meta Title** (-15 points)
- **Missing Meta Description** (-15 points)
- **No Additional Images** (-15 points)
- **Suboptimal Meta Title Length** (-10 points)
- **Suboptimal Meta Description Length** (-10 points)
- **Missing Meta Keywords** (-10 points)
- **Poor Image Quality** (variable penalty)
- **Few Images** (-5 points)

### Issue Severity Levels

- **Critical**: Major SEO problems that must be fixed (e.g., missing description, no images)
- **High**: Important issues affecting SEO performance (e.g., missing meta tags, short content)
- **Medium**: Optimization opportunities (e.g., suboptimal meta tag lengths)
- **Low**: Minor improvements (e.g., could use more images)

### Audit Result Structure

```typescript
{
  product_id: number
  product_name: string
  sku: string
  score: number // 0-100
  issues: [
    {
      type: string
      severity: 'critical' | 'high' | 'medium' | 'low'
      field: string
      message: string
      current_value?: string
    }
  ]
  recommendations: [
    {
      type: 'content' | 'seo' | 'media'
      priority: 'high' | 'medium' | 'low'
      action: string
      details: string
      suggested_content?: string
    }
  ]
  image_analysis?: {
    url: string
    quality_score: number
    width?: number
    height?: number
    format?: string
    size_kb?: number
    issues: string[]
    recommendations: string[]
  }
}
```

### Database Schema

The service uses the `seo_audits` table in Supabase:

```sql
CREATE TABLE seo_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL,
    audit_type TEXT NOT NULL CHECK (audit_type IN ('full_site', 'page', 'technical', 'content', 'backlinks')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    score INTEGER CHECK (score >= 0 AND score <= 100),
    issues_found JSONB DEFAULT '[]'::jsonb,
    recommendations JSONB DEFAULT '[]'::jsonb,
    metrics JSONB DEFAULT '{}'::jsonb,
    performed_by TEXT REFERENCES squad_agents(name) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### OpenCart Database Tables Used

- `oc_product` - Main product data
- `oc_product_description` - Product descriptions and meta tags (by language)
- `oc_product_image` - Additional product images
- `oc_category_description` - Category names for context
- `oc_product_to_category` - Product-category relationships

### SEO Content Generation

The service uses Claude AI (claude-3-5-sonnet-20241022) to generate:

1. **Product Description**: 200-300 words with natural keyword integration
2. **Meta Title**: 50-60 characters optimized for search engines
3. **Meta Description**: 150-160 characters with call-to-action
4. **Meta Keywords**: 5-8 relevant keywords

### Image Analysis

When `IMAGE_ANALYSIS_API_URL` is configured, the service checks:

- Image resolution (minimum 800x800px recommended)
- File size (maximum 500KB recommended)
- Image format (JPG, PNG, WebP preferred)
- Image sharpness/quality

### Error Handling

All functions include comprehensive error handling and logging to `squad_messages` table:

- Database connection errors
- API failures (Claude, Image Analysis)
- Product not found errors
- Data validation errors

All errors are logged with context for debugging.

### Notes

- The service assumes OpenCart database uses `oc_` table prefix
- Language ID 1 is assumed to be the primary language
- Only active products (status = 1) are audited
- Image analysis is optional and gracefully degrades if not configured
- Claude API calls include fallback to basic content if API fails

---

## Environment Variables

Required environment variables for all agents:

```bash
# Supabase (Required for all agents)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Anthropic Claude API (Required for all agents)
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

# SEO Agent Specific (OpenCart Database)
OPENCART_DB_HOST=localhost
OPENCART_DB_PORT=3306
OPENCART_DB_USER=your_opencart_db_user
OPENCART_DB_PASSWORD=your_opencart_db_password
OPENCART_DB_NAME=your_opencart_db_name
OPENCART_BASE_URL=https://your-opencart-store.com

# SEO Agent Specific (Image Analysis - Optional)
IMAGE_ANALYSIS_API_URL=https://your-image-analysis-api.com/analyze
IMAGE_ANALYSIS_API_KEY=your_image_analysis_api_key
```

## Activity Logging

All agents log operations to `squad_messages` table with structured data:

```typescript
{
  from_agent: 'social' | 'marketing' | 'seo',
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
