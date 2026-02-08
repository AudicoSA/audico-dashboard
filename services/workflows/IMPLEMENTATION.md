# Visual Content Automation - Implementation Summary

## Files Created/Modified

### Core Workflow Implementation

**`services/workflows/visual-content-automation.ts`** (NEW)
- Main workflow module with three primary functions
- `generateWeeklySocialVisuals()` - Processes upcoming social posts
- `generateMonthlyNewsletterAssets()` - Creates newsletter visual assets
- `generateResellerOnboardingKit(resellerId)` - Generates personalized reseller materials

### Orchestrator Integration

**`services/orchestrator.ts`** (MODIFIED)
- Added import for visual content workflows
- Added scheduled jobs:
  - `social_visuals_daily` - Runs at 9 AM daily
  - `newsletter_assets_weekly` - Runs at 10 AM on Mondays
  - `reseller_kit_check` - Runs every 6 hours
- Added `executeVisualWorkflow()` method
- Added `checkNewlyApprovedResellers()` method
- Added `triggerResellerKitGeneration()` public method

**`services/config.ts`** (MODIFIED)
- Added workflow schedules to `AGENT_SCHEDULES`:
  - `SOCIAL_VISUALS_DAILY: '0 9 * * *'`
  - `NEWSLETTER_ASSETS_WEEKLY: '0 10 * * 1'`
- Added token estimates to `AGENT_TOKEN_ESTIMATES`:
  - `visual_content_generation: 2000`
  - `newsletter_assets: 3000`
  - `reseller_kit: 2500`

### API Endpoints

**`app/api/workflows/visual-automation/route.ts`** (NEW)
- POST endpoint for manual workflow triggers
- GET endpoint for workflow documentation
- Supports three actions:
  - `generate_social_visuals`
  - `generate_newsletter_assets`
  - `generate_reseller_kit`

**`app/api/webhooks/reseller-approved/route.ts`** (NEW)
- Webhook handler for Supabase database triggers
- Automatically triggers reseller kit generation on approval
- Validates reseller status and checks for existing kits

### Documentation

**`services/workflows/README.md`** (NEW)
- Comprehensive workflow documentation
- Usage examples and API documentation
- Integration guide with orchestrator
- Database trigger setup instructions
- Error handling and monitoring details

**`services/workflows/index.ts`** (NEW)
- Export file for workflow functions
- Enables clean imports from other modules

**`AGENTS.md`** (MODIFIED)
- Added architecture overview
- Added automated workflows section
- Added API endpoint documentation

**`services/workflows/IMPLEMENTATION.md`** (NEW - THIS FILE)
- Implementation summary and file overview

## Workflow Schedules

| Workflow | Schedule | Cron Expression | Purpose |
|----------|----------|----------------|---------|
| Social Visuals | Daily at 9 AM | `0 9 * * *` | Generate visuals for upcoming social posts |
| Newsletter Assets | Weekly Mondays 10 AM | `0 10 * * 1` | Create newsletter slide decks and infographics |
| Reseller Kit Check | Every 6 hours | `0 */6 * * *` | Check for newly approved resellers needing kits |

## Integration Points

### With Social Agent
- Uses `socialAgent.generateVisualContent()` to create post visuals
- Leverages existing NotebookLM integration
- Platform-specific visual type determination

### With Marketing Agent
- Uses `marketingAgent.generateNewsletterDraft()` when needed
- Uses `marketingAgent.generateNewsletterVisuals()` for asset creation
- Uses `marketingAgent.generateResellerKit()` for onboarding materials

### With NotebookLM Service
- Creates notebooks for each workflow
- Adds source documents with context
- Generates infographics, slide decks, and videos
- Downloads and stores artifacts

### With Supabase
- Queries social posts, newsletters, and resellers
- Updates records with generated content URLs
- Stores artifacts in appropriate storage buckets
- Logs all workflow activity to squad_messages

## Token Budget Management

Each workflow estimates token usage:
- **Social Visuals**: 2000 tokens per run
- **Newsletter Assets**: 3000 tokens per run  
- **Reseller Kit**: 2500 tokens per generation

The orchestrator checks token availability before execution and tracks actual usage.

## Error Handling

All workflows include:
- Try-catch blocks for each major operation
- Individual item error handling (doesn't stop entire workflow)
- Detailed error logging to squad_messages
- Squad task creation for high-visibility results
- Mention Kenny flag on errors for immediate attention

## Testing

To test the implementation:

1. **Test Social Visuals Workflow:**
```bash
curl -X POST http://localhost:3001/api/workflows/visual-automation \
  -H "Content-Type: application/json" \
  -d '{"action": "generate_social_visuals"}'
```

2. **Test Newsletter Assets Workflow:**
```bash
curl -X POST http://localhost:3001/api/workflows/visual-automation \
  -H "Content-Type: application/json" \
  -d '{"action": "generate_newsletter_assets"}'
```

3. **Test Reseller Kit Generation:**
```bash
curl -X POST http://localhost:3001/api/workflows/visual-automation \
  -H "Content-Type: application/json" \
  -d '{"action": "generate_reseller_kit", "resellerId": "your-reseller-id"}'
```

## Database Requirements

### Tables
- `social_posts` - Must have `visual_content_url` and `metadata` columns
- `newsletter_drafts` - Must have `metadata` column
- `approved_resellers` - Must have `metadata` column
- `notebooklm_notebooks` - For tracking notebook records
- `notebooklm_artifacts` - For tracking generated artifacts
- `squad_messages` - For workflow activity logging
- `squad_tasks` - For workflow result reporting

### Storage Buckets
- `notebooklm-visuals` - For social post visuals
- `marketing-assets` - For newsletter and reseller assets

### Webhook Configuration (Optional)
Set up Supabase webhook on `approved_resellers` table:
- Trigger: UPDATE where status changes to 'active'
- URL: `https://your-domain.com/api/webhooks/reseller-approved`
- Method: POST
- Payload: `{ type, record, old_record }`

## Monitoring

View workflow activity:
```sql
SELECT * FROM squad_messages 
WHERE from_agent = 'visual_automation' 
ORDER BY created_at DESC;
```

View workflow tasks:
```sql
SELECT * FROM squad_tasks 
WHERE assigned_agent = 'visual_automation' 
ORDER BY created_at DESC;
```

## Next Steps

1. Configure Supabase webhook for automatic reseller kit generation
2. Test workflows with real data
3. Monitor token usage and adjust estimates if needed
4. Consider adding metrics tracking for workflow performance
5. Implement A/B testing for visual variations
6. Add retry logic for failed visual generations
