# AGENTS.md

## Commands

**Setup**: `npm install`  
**Dev Server**: `npm run dev` (runs on port 3001)  
**Build**: `npm run build`  
**Lint**: `npm run lint`  
**Tests**: No test framework configured

## Tech Stack

- **Next.js 16** with App Router and TypeScript
- **React 19** with React Server Components
- **Tailwind CSS v4** for styling
- **Supabase** for database and auth
- **Radix UI** for accessible components
- **Lucide React** for icons

## Architecture

- `/app` - Next.js App Router pages and routes
- `/components` - Shared React components
- `/lib` - Utility functions and shared logic
- `/public` - Static assets
- `/supabase` - Supabase configuration
- `/services` - Agent orchestration and automation services
  - `/agents` - Individual agent implementations
  - `/integrations` - Third-party service integrations
  - `/workflows` - Automated workflow implementations

## Automated Workflows

### Visual Content Automation

Located in `services/workflows/visual-content-automation.ts`, this module provides:

1. **generateWeeklySocialVisuals()** - Daily at 9 AM
   - Identifies upcoming social posts (next 7 days) needing visuals
   - Generates platform-optimized infographics via NotebookLM
   - Attaches visuals to posts automatically

2. **generateMonthlyNewsletterAssets()** - Weekly on Mondays at 10 AM
   - Creates slide deck for newsletter campaigns
   - Generates infographic for social sharing
   - Uses SEO insights and product data

3. **generateResellerOnboardingKit(resellerId)** - On reseller approval
   - Triggered automatically when reseller status changes to 'active'
   - Creates personalized slide deck with:
     - Company branding placeholder
     - Product catalog with reseller pricing
     - Pricing tier visualization
     - Order history and upgrade path
   - Stored in reseller metadata for easy access

### API Endpoints

**Manual Workflow Triggers:**
- `POST /api/workflows/visual-automation`
  - Actions: `generate_social_visuals`, `generate_newsletter_assets`, `generate_reseller_kit`

**Webhooks:**
- `POST /api/webhooks/reseller-approved` - Auto-triggered by database changes

See `services/workflows/README.md` for detailed documentation.
