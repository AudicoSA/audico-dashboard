# Visual Content Automation Workflows

Automated workflows for generating visual content across social media, newsletters, and reseller onboarding.

## Overview

This module implements three primary automated workflows:
1. **Weekly Social Visuals** - Generates platform-optimized visuals for upcoming social posts
2. **Monthly Newsletter Assets** - Creates slide decks and infographics for newsletter campaigns
3. **Reseller Onboarding Kit** - Produces personalized presentation decks upon reseller approval

## Workflows

### 1. generateWeeklySocialVisuals()

**Purpose:** Identifies upcoming social posts needing visuals and generates platform-optimized infographics via NotebookLM.

**Schedule:** Daily at 9:00 AM (SOCIAL_VISUALS_DAILY: '0 9 * * *')

**Behavior:**
- Scans for social posts scheduled within the next 7 days
- Filters for posts without visual content
- Determines optimal visual type based on platform:
  - Instagram/Facebook/Twitter: Infographic
  - LinkedIn: Slide deck
  - YouTube/TikTok: Video overview
- Generates visuals using NotebookLM with post content and product context
- Attaches generated visuals to posts
- Creates squad task summarizing the workflow results

**Returns:**
```typescript
{
  success: boolean
  processed: number    // Total posts found
  generated: number    // Successfully generated visuals
  errors: Array<{
    postId: string
    error: string
  }>
}
```

### 2. generateMonthlyNewsletterAssets()

**Purpose:** Creates comprehensive visual assets for newsletter distribution campaigns.

**Schedule:** Weekly on Mondays at 10:00 AM (NEWSLETTER_ASSETS_WEEKLY: '0 10 * * 1')

**Behavior:**
- Checks for recent newsletter drafts
- If none found, generates a new newsletter using MarketingAgent
- Creates NotebookLM notebook with:
  - Newsletter content
  - SEO trending data
  - Product catalog information
- Generates two asset types:
  1. **Slide Deck** - Professional presentation for business audiences
  2. **Infographic** - Social-ready visual summary
- Uploads assets to storage and attaches to newsletter record
- Creates squad task documenting completion

**Returns:**
```typescript
{
  success: boolean
  newsletter_id?: string
  slide_deck_url?: string
  infographic_url?: string
  error?: string
}
```

### 3. generateResellerOnboardingKit(resellerId)

**Purpose:** Creates personalized onboarding materials for newly approved resellers.

**Triggers:**
- Automatic check every 6 hours for newly approved resellers
- Webhook on reseller approval via `/api/webhooks/reseller-approved`
- Manual trigger via API

**Behavior:**
- Fetches reseller profile and order history
- Calculates reseller-specific pricing for product catalog
- Identifies frequently ordered products for personalization
- Creates NotebookLM notebook with:
  - Reseller information
  - Customized product catalog with pricing
  - Pricing tier comparison
- Generates comprehensive slide deck including:
  - Cover slide with reseller branding placeholder
  - Pricing tier overview and benefits
  - Product catalog with margins
  - Upgrade path visualization
  - Order history summary
  - Contact information
- Uploads to storage and updates reseller metadata
- Creates squad task for delivery

**Returns:**
```typescript
{
  success: boolean
  slide_deck_url?: string
  artifact_id?: string
  error?: string
}
```

## Integration with Orchestrator

The workflows are integrated into the agent orchestrator at `services/orchestrator.ts`:

### Scheduled Jobs

```typescript
SOCIAL_VISUALS_DAILY: '0 9 * * *'      // Daily at 9 AM
NEWSLETTER_ASSETS_WEEKLY: '0 10 * * 1' // Mondays at 10 AM
reseller_kit_check: '0 */6 * * *'       // Every 6 hours
```

### Token Budget Management

Each workflow has token estimates for budget tracking:
- `visual_content_generation`: 2000 tokens
- `newsletter_assets`: 3000 tokens
- `reseller_kit`: 2500 tokens

The orchestrator checks token availability before executing workflows and tracks usage.

### Manual Execution

Workflows can be manually triggered via API endpoint:

**Endpoint:** `POST /api/workflows/visual-automation`

**Examples:**

```bash
# Generate social visuals
curl -X POST http://localhost:3001/api/workflows/visual-automation \
  -H "Content-Type: application/json" \
  -d '{"action": "generate_social_visuals"}'

# Generate newsletter assets
curl -X POST http://localhost:3001/api/workflows/visual-automation \
  -H "Content-Type: application/json" \
  -d '{"action": "generate_newsletter_assets"}'

# Generate reseller kit
curl -X POST http://localhost:3001/api/workflows/visual-automation \
  -H "Content-Type: application/json" \
  -d '{"action": "generate_reseller_kit", "resellerId": "abc123"}'
```

## Database Triggers

### Reseller Approval Webhook

Configure Supabase webhook to call `/api/webhooks/reseller-approved` when a reseller is approved:

1. Create Supabase webhook for `approved_resellers` table
2. Set trigger condition: `status = 'active'`
3. Set webhook URL: `https://your-domain.com/api/webhooks/reseller-approved`
4. Include payload: `{ type, record, old_record }`

The webhook will automatically trigger reseller kit generation when:
- A reseller status changes to 'active'
- No existing kit is present in metadata

## Dependencies

- `@supabase/supabase-js` - Database operations
- `services/integrations/notebooklm-service` - Visual content generation
- `services/agents/social-agent` - Social media operations
- `services/agents/marketing-agent` - Newsletter and reseller operations

## Storage Buckets

The workflows require these Supabase storage buckets:
- `notebooklm-visuals` - Social post visuals
- `marketing-assets` - Newsletter and reseller assets

## Error Handling

All workflows include comprehensive error handling:
- Individual item failures don't stop the entire workflow
- Errors are logged to `squad_messages`
- Failed operations are reported in workflow results
- Squad tasks are created with error flags for Kenny's attention

## Monitoring

Workflow activity is logged to the `squad_messages` table with:
- Event type for categorization
- Detailed context data
- Timestamps for audit trails
- Success/failure indicators

View workflow logs by filtering `from_agent = 'visual_automation'`.

## Future Enhancements

Potential improvements:
- A/B testing for visual variations
- Performance metrics tracking
- Automatic visual regeneration based on engagement
- Multi-language support for reseller kits
- Video generation for all platforms
- Brand kit integration for customized visuals
