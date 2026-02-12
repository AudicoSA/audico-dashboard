# SEO Agent Enhancement Plan: Integrating Claude-SEO Capabilities

> **Purpose:** This document provides a complete implementation guide for enhancing the Audico Dashboard's SEO Agent with advanced capabilities inspired by [claude-seo](https://github.com/AgriciDaniel/claude-seo).
>
> **Target:** audicoonline.co.za (OpenCart 3.8 e-commerce store)
>
> **Estimated Timeline:** 7 weeks

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Architecture](#current-architecture)
3. [Claude-SEO Features to Integrate](#claude-seo-features-to-integrate)
4. [Implementation Phases](#implementation-phases)
5. [Detailed Technical Specifications](#detailed-technical-specifications)
6. [Database Migrations](#database-migrations)
7. [API Endpoints](#api-endpoints)
8. [Jarvis Orchestrator Integration](#jarvis-orchestrator-integration)
9. [Token Budget & Scheduling](#token-budget--scheduling)
10. [Verification & Testing](#verification--testing)
11. [File Reference](#file-reference)

---

## Executive Summary

### What We're Building

Enhance the existing Jarvis-orchestrated SEO Agent to include:
- **Schema.org Product Markup** - Generate JSON-LD for rich Google snippets
- **Core Web Vitals Monitoring** - Track LCP, INP, CLS performance metrics
- **AI Search Optimization (GEO)** - Optimize for ChatGPT/Perplexity/Google AI visibility
- **E-E-A-T Content Analysis** - Evaluate content trust signals

### Architecture Decision

**Recommendation: TypeScript-Native Implementation** (not Python microservice)

Rationale:
- All existing agents (`seo-agent.ts`, `social-agent.ts`, `ads-agent.ts`, `marketing-agent.ts`) are TypeScript
- Direct integration with Supabase, OpenCart MySQL, and Jarvis orchestration
- Single Vercel deployment (no additional Railway Python service)
- Native access to token budgets and rate limiting

---

## Current Architecture

### Existing SEO Agent

**Location:** `services/agents/seo-agent.ts`

**Current Capabilities:**
```typescript
// Product-level SEO audits
export async function auditProductsSEO(productIds?: number[], limit?: number)

// AI content generation
async function generateSEOContent(productName, currentDescription, category, sku)

// Image quality analysis
async function analyzeImageQuality(imageUrl: string)

// Generate and optionally apply fixes
export async function generateAndApplySEOFixes(productId: number, options?)

// Store results to Supabase
export async function storeAuditResults(audits: ProductAuditResult[])
```

**Current Audit Checks:**
- Missing/short descriptions (critical/high)
- Missing/suboptimal meta titles (high/medium)
- Missing meta keywords (medium)
- Missing/poor quality images (critical/medium)
- Product scoring 0-100

**Connections:**
- OpenCart MySQL: `oc_product`, `oc_product_description`, `oc_product_image`
- Supabase: `seo_audits` table
- Claude API: Content generation

### Jarvis Orchestrator

**Location:** `app/api/agents/jarvis/orchestrate/route.ts`

**How SEO Tasks Are Created:**
```typescript
// Jarvis uses Claude to decide when to create SEO tasks
const prompt = `You are Jarvis, the orchestrator AI...
- SEO Agent: Audits OpenCart products for SEO improvements
...
Respond with JSON: { "tasks": [...], "reasoning": "..." }
`;
```

**Task Storage:** `squad_tasks` table with fields:
- `title`, `description`, `status` (new/in_progress/completed)
- `assigned_agent`, `priority`, `metadata`

### Execution Handler

**Location:** `services/execution-handlers/seo-handler.ts`

Currently handles task execution when Jarvis assigns SEO work.

---

## Claude-SEO Features to Integrate

### From the [claude-seo repository](https://github.com/AgriciDaniel/claude-seo):

| Feature | Priority | E-commerce Value |
|---------|----------|------------------|
| Schema.org Product Markup | **Tier 1** | Rich snippets show price, availability, reviews in Google |
| Core Web Vitals | **Tier 1** | Performance directly impacts SEO rankings |
| Technical SEO Audits | **Tier 1** | Page-level issues (vs current product-level) |
| AI Search Optimization (GEO) | **Tier 2** | Visibility in ChatGPT, Perplexity, Google AI Overviews |
| E-E-A-T Content Analysis | **Tier 2** | Trust signals per Google guidelines |
| Sitemap Analysis | **Tier 2** | Ensure all products indexed |
| Competitor Page Analysis | **Tier 3** | Compare vs local competitors |
| Programmatic SEO | **Tier 3** | Category page optimization |

---

## Implementation Phases

### Phase 1: Schema.org Markup (Weeks 1-2)

**Goal:** Generate and validate JSON-LD structured data for products

**New Types to Add:**

```typescript
// Add to services/agents/seo-agent.ts or new seo-types.ts

interface ProductSchemaLD {
  "@context": "https://schema.org"
  "@type": "Product"
  name: string
  description: string
  image: string[]
  sku: string
  mpn?: string
  brand?: {
    "@type": "Brand"
    name: string
  }
  offers: {
    "@type": "Offer"
    price: number
    priceCurrency: "ZAR"
    availability: "https://schema.org/InStock" | "https://schema.org/OutOfStock"
    url: string
    priceValidUntil?: string
  }
  aggregateRating?: {
    "@type": "AggregateRating"
    ratingValue: number
    reviewCount: number
  }
}

interface BreadcrumbListLD {
  "@context": "https://schema.org"
  "@type": "BreadcrumbList"
  itemListElement: {
    "@type": "ListItem"
    position: number
    name: string
    item: string
  }[]
}

interface SchemaAuditResult {
  product_id: number
  url: string
  has_product_schema: boolean
  has_breadcrumb_schema: boolean
  has_organization_schema: boolean
  detected_schemas: Array<{
    type: string
    format: "JSON-LD" | "Microdata" | "RDFa"
    valid: boolean
    errors?: string[]
  }>
  missing_required_fields: string[]
  generated_schema?: ProductSchemaLD
  recommendations: string[]
}
```

**New Functions:**

```typescript
// Detect existing schema on a page
export async function detectSchemaMarkup(url: string): Promise<DetectedSchema[]> {
  // 1. Fetch page HTML
  // 2. Parse <script type="application/ld+json"> blocks
  // 3. Check for Microdata (itemscope, itemtype, itemprop)
  // 4. Validate against schema.org specs
  // 5. Return detected schemas with validity status
}

// Generate Product schema from OpenCart data
export async function generateProductSchema(
  product: OpenCartProduct,
  description: OpenCartProductDescription,
  images: OpenCartProductImage[],
  reviews?: { rating: number; count: number }
): Promise<ProductSchemaLD> {
  const baseUrl = process.env.OPENCART_BASE_URL || 'https://audicoonline.co.za'

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: description.name,
    description: description.description.replace(/<[^>]*>/g, '').substring(0, 500),
    image: images.map(img => `${baseUrl}/image/${img.image}`),
    sku: product.sku || product.model,
    mpn: product.mpn || undefined,
    brand: product.manufacturer_id ? {
      "@type": "Brand",
      name: await getManufacturerName(product.manufacturer_id)
    } : undefined,
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "ZAR",
      availability: product.quantity > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: `${baseUrl}/index.php?route=product/product&product_id=${product.product_id}`
    },
    aggregateRating: reviews ? {
      "@type": "AggregateRating",
      ratingValue: reviews.rating,
      reviewCount: reviews.count
    } : undefined
  }
}

// Batch audit products for schema compliance
export async function auditSchemaCompliance(
  productIds?: number[],
  limit: number = 50
): Promise<{
  audits: SchemaAuditResult[]
  summary: {
    total: number
    with_schema: number
    without_schema: number
    with_errors: number
  }
}> {
  // 1. Get product URLs from OpenCart
  // 2. For each URL, detect existing schema
  // 3. Generate recommended schema if missing
  // 4. Return audit results
}

// Generate breadcrumb schema from category path
export async function generateBreadcrumbSchema(
  categoryPath: Array<{ name: string; url: string }>
): Promise<BreadcrumbListLD> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: categoryPath.map((cat, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: cat.name,
      item: cat.url
    }))
  }
}
```

---

### Phase 2: Core Web Vitals (Week 3)

**Goal:** Monitor page performance using Google PageSpeed Insights API

**New File:** `services/agents/seo-vitals.ts`

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface CoreWebVitalsResult {
  url: string
  product_id?: number
  // Core Web Vitals
  lcp: number      // Largest Contentful Paint (target: <2.5s)
  inp: number      // Interaction to Next Paint (target: <200ms)
  cls: number      // Cumulative Layout Shift (target: <0.1)
  // Additional metrics
  fcp: number      // First Contentful Paint
  ttfb: number     // Time to First Byte
  si: number       // Speed Index
  // Scoring
  performance_score: number  // 0-100
  status: 'good' | 'needs-improvement' | 'poor'
  // Issues and recommendations
  issues: Array<{
    metric: string
    value: number
    threshold: number
    impact: 'high' | 'medium' | 'low'
  }>
  recommendations: string[]
  measured_at: Date
}

// Use Google PageSpeed Insights API
export async function measureCoreWebVitals(url: string): Promise<CoreWebVitalsResult> {
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${apiKey}&category=performance&strategy=mobile`

  const response = await fetch(apiUrl)
  const data = await response.json()

  const metrics = data.lighthouseResult?.audits
  const fieldData = data.loadingExperience?.metrics

  return {
    url,
    lcp: fieldData?.LARGEST_CONTENTFUL_PAINT_MS?.percentile || metrics?.['largest-contentful-paint']?.numericValue,
    inp: fieldData?.INTERACTION_TO_NEXT_PAINT?.percentile || 0,
    cls: fieldData?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile || metrics?.['cumulative-layout-shift']?.numericValue,
    fcp: metrics?.['first-contentful-paint']?.numericValue,
    ttfb: metrics?.['server-response-time']?.numericValue,
    si: metrics?.['speed-index']?.numericValue,
    performance_score: Math.round(data.lighthouseResult?.categories?.performance?.score * 100),
    status: getVitalsStatus(fieldData),
    issues: extractIssues(metrics),
    recommendations: extractRecommendations(data.lighthouseResult?.audits),
    measured_at: new Date()
  }
}

// Batch audit for multiple URLs
export async function auditSiteVitals(
  urls: string[],
  limit: number = 20
): Promise<{
  results: CoreWebVitalsResult[]
  summary: {
    avg_lcp: number
    avg_cls: number
    avg_performance: number
    pages_good: number
    pages_poor: number
  }
}> {
  const results: CoreWebVitalsResult[] = []

  // Rate limit: PageSpeed API allows 25,000 queries/day free
  // Process sequentially with 1s delay to avoid rate limits
  for (const url of urls.slice(0, limit)) {
    try {
      const result = await measureCoreWebVitals(url)
      results.push(result)
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (error) {
      console.error(`Failed to measure ${url}:`, error)
    }
  }

  return {
    results,
    summary: calculateVitalsSummary(results)
  }
}

// Store vitals to Supabase
export async function storeVitalsResults(results: CoreWebVitalsResult[]): Promise<string[]> {
  const { data, error } = await supabase
    .from('seo_vitals')
    .insert(results.map(r => ({
      url: r.url,
      product_id: r.product_id,
      lcp: r.lcp,
      inp: r.inp,
      cls: r.cls,
      fcp: r.fcp,
      ttfb: r.ttfb,
      performance_score: r.performance_score,
      status: r.status,
      issues: r.issues,
      recommendations: r.recommendations,
      measured_at: r.measured_at
    })))
    .select('id')

  if (error) throw error
  return data.map(d => d.id)
}
```

**Environment Variable Required:**
```bash
GOOGLE_PAGESPEED_API_KEY=your_api_key_here
```

Get free API key from: https://developers.google.com/speed/docs/insights/v5/get-started

---

### Phase 3: Jarvis Integration & Handlers (Week 4)

**Goal:** Wire new SEO capabilities into Jarvis orchestration

#### 3.1 Update Execution Handler

**File:** `services/execution-handlers/seo-handler.ts`

```typescript
import { auditProductsSEO, generateAndApplySEOFixes, auditSchemaCompliance, generateProductSchema } from '@/services/agents/seo-agent'
import { measureCoreWebVitals, auditSiteVitals, storeVitalsResults } from '@/services/agents/seo-vitals'

interface SEOTask {
  id: string
  metadata: {
    action: string
    productIds?: number[]
    urls?: string[]
    limit?: number
    applyFixes?: boolean
  }
}

interface ExecutionResult {
  success: boolean
  data?: any
  error?: string
  tokens_used?: number
}

export async function seoHandler(task: SEOTask): Promise<ExecutionResult> {
  const { action, productIds, urls, limit = 50, applyFixes = false } = task.metadata || {}

  try {
    switch (action) {
      case 'audit_products':
        // Existing product SEO audit
        const auditResult = await auditProductsSEO(productIds, limit)
        return { success: true, data: auditResult, tokens_used: 1000 }

      case 'audit_schema':
        // NEW: Schema.org compliance audit
        const schemaResult = await auditSchemaCompliance(productIds, limit)
        return { success: true, data: schemaResult, tokens_used: 800 }

      case 'generate_schema':
        // NEW: Generate schema for products
        // Implementation: loop through products, generate and optionally inject schema
        return { success: true, data: { generated: 0 }, tokens_used: 500 }

      case 'check_vitals':
        // NEW: Core Web Vitals check
        if (!urls || urls.length === 0) {
          return { success: false, error: 'No URLs provided for vitals check' }
        }
        const vitalsResult = await auditSiteVitals(urls, limit)
        await storeVitalsResults(vitalsResult.results)
        return { success: true, data: vitalsResult, tokens_used: 50 }

      case 'check_vitals_single':
        // NEW: Single page vitals
        if (!urls || urls.length === 0) {
          return { success: false, error: 'No URL provided' }
        }
        const singleVitals = await measureCoreWebVitals(urls[0])
        return { success: true, data: singleVitals, tokens_used: 50 }

      case 'apply_fixes':
        // Existing: Apply SEO fixes to products
        if (!productIds || productIds.length === 0) {
          return { success: false, error: 'No product IDs provided' }
        }
        const fixResults = await Promise.all(
          productIds.map(id => generateAndApplySEOFixes(id, { applyFixes }))
        )
        return { success: true, data: fixResults, tokens_used: 1500 * productIds.length }

      case 'full_audit':
        // NEW: Comprehensive audit (products + schema + vitals)
        const [products, schemas, vitals] = await Promise.all([
          auditProductsSEO(productIds, limit),
          auditSchemaCompliance(productIds, limit),
          urls ? auditSiteVitals(urls, limit) : null
        ])
        return {
          success: true,
          data: { products, schemas, vitals },
          tokens_used: 2000
        }

      default:
        return { success: false, error: `Unknown SEO action: ${action}` }
    }
  } catch (error: any) {
    console.error('SEO handler error:', error)
    return { success: false, error: error.message }
  }
}
```

#### 3.2 Update Jarvis Orchestrator Prompt

**File:** `app/api/agents/jarvis/orchestrate/route.ts`

Find the prompt string and update the SEO Agent description:

```typescript
// BEFORE:
// - SEO Agent: Audits OpenCart products for SEO improvements

// AFTER:
const seoAgentDescription = `
- SEO Agent: Comprehensive SEO optimization for OpenCart products
  CAPABILITIES:
  • audit_products: Analyze product descriptions, meta tags, images (existing)
  • audit_schema: Check Schema.org markup compliance for rich snippets
  • generate_schema: Create Product JSON-LD for Google rich results
  • check_vitals: Monitor Core Web Vitals (LCP, INP, CLS) performance
  • apply_fixes: Apply AI-generated SEO improvements to products
  • full_audit: Complete SEO health check (products + schema + vitals)

  PRIORITY TRIGGERS:
  • Low product views → audit_products + apply_fixes
  • No rich snippets in Search Console → audit_schema + generate_schema
  • High bounce rate → check_vitals
  • New product batch uploaded → full_audit
`
```

#### 3.3 Update Token Estimates

**File:** `services/config.ts`

```typescript
export const AGENT_TOKEN_ESTIMATES = {
  // Existing...
  seo_audit: 1000,
  content_generation: 1500,

  // NEW SEO capabilities
  seo_schema_audit: 800,      // Mostly HTML parsing, minimal LLM
  seo_schema_generate: 500,   // Template-based with LLM refinement
  seo_vitals_check: 50,       // PageSpeed API only, no LLM
  seo_vitals_batch: 100,      // Multiple pages
  seo_geo_analysis: 1200,     // Full content analysis
  seo_eeat_analysis: 1000,    // Trust signal analysis
  seo_full_audit: 2000,       // Combined audit
}

export const AGENT_SCHEDULES = {
  // Existing...
  EMAIL_POLL: '*/5 * * * *',

  // NEW SEO schedules (off-peak hours SAST)
  SEO_VITALS_DAILY: '0 3 * * *',      // 3 AM daily - check top 20 product pages
  SEO_SCHEMA_WEEKLY: '0 4 * * 0',     // 4 AM Sunday - audit schema compliance
  SEO_FULL_WEEKLY: '0 5 * * 1',       // 5 AM Monday - comprehensive audit
}
```

---

### Phase 4: AI Search Optimization - GEO (Weeks 5-6)

**Goal:** Optimize content for visibility in AI assistants (ChatGPT, Perplexity, Google AI)

**New File:** `services/agents/seo-geo.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

interface GEOAnalysisResult {
  url: string
  product_id?: number
  ai_visibility_score: number  // 0-100

  content_structure: {
    has_clear_headings: boolean
    has_structured_data: boolean
    has_citations: boolean
    has_statistics: boolean
    reading_level: 'basic' | 'intermediate' | 'advanced'
    word_count: number
  }

  ai_search_signals: {
    authoritative_claims: number      // Count of expert/authority statements
    factual_statements: number        // Count of verifiable facts
    actionable_content: boolean       // Has clear calls-to-action
    comparison_friendly: boolean      // Easy to compare with alternatives
    question_answering: boolean       // Answers common questions
  }

  eeat_signals: {
    experience_indicators: string[]   // First-hand knowledge signals
    expertise_indicators: string[]    // Professional credentials
    authority_indicators: string[]    // Industry recognition
    trust_indicators: string[]        // Security, transparency
  }

  recommendations: Array<{
    priority: 'high' | 'medium' | 'low'
    action: string
    rationale: string
    example?: string
  }>
}

export async function analyzeAISearchReadiness(
  url: string,
  content?: string
): Promise<GEOAnalysisResult> {
  // 1. Fetch page content if not provided
  if (!content) {
    const response = await fetch(url)
    content = await response.text()
    // Strip HTML tags for analysis
    content = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  }

  // 2. Use Claude to analyze content
  const prompt = `Analyze this product page content for AI search optimization (GEO).

Content:
${content.substring(0, 8000)}

Evaluate and respond with JSON:
{
  "ai_visibility_score": <0-100>,
  "content_structure": {
    "has_clear_headings": <boolean>,
    "has_structured_data": <boolean>,
    "has_citations": <boolean>,
    "has_statistics": <boolean>,
    "reading_level": "<basic|intermediate|advanced>",
    "word_count": <number>
  },
  "ai_search_signals": {
    "authoritative_claims": <count>,
    "factual_statements": <count>,
    "actionable_content": <boolean>,
    "comparison_friendly": <boolean>,
    "question_answering": <boolean>
  },
  "eeat_signals": {
    "experience_indicators": ["..."],
    "expertise_indicators": ["..."],
    "authority_indicators": ["..."],
    "trust_indicators": ["..."]
  },
  "recommendations": [
    {
      "priority": "<high|medium|low>",
      "action": "What to do",
      "rationale": "Why it helps AI visibility",
      "example": "Example implementation"
    }
  ]
}

Focus on what makes content citable by AI assistants like ChatGPT and Perplexity.`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }]
  })

  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
  const analysis = JSON.parse(responseText)

  return {
    url,
    ...analysis
  }
}

export async function optimizeContentForAI(
  content: string,
  productName: string,
  targetKeywords: string[]
): Promise<{
  optimized_content: string
  changes_made: string[]
  estimated_score_improvement: number
}> {
  const prompt = `Optimize this product description for AI search visibility.

Product: ${productName}
Target Keywords: ${targetKeywords.join(', ')}

Current Content:
${content}

Rewrite to:
1. Include clear, factual statements that AI can cite
2. Add comparison-friendly specifications
3. Answer common customer questions inline
4. Include authoritative claims with context
5. Structure with clear sections

Respond with JSON:
{
  "optimized_content": "The rewritten content",
  "changes_made": ["List of specific changes"],
  "estimated_score_improvement": <5-30>
}`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }]
  })

  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
  return JSON.parse(responseText)
}
```

---

## Database Migrations

**New File:** `supabase/migrations/XXX_seo_enhanced.sql`

```sql
-- SEO Enhancement Tables Migration
-- Run after existing migrations

-- ============================================
-- 1. Core Web Vitals Tracking
-- ============================================
CREATE TABLE IF NOT EXISTS seo_vitals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL,
    product_id INTEGER,

    -- Core Web Vitals
    lcp DECIMAL(10, 2),           -- Largest Contentful Paint (ms)
    inp DECIMAL(10, 2),           -- Interaction to Next Paint (ms)
    cls DECIMAL(10, 4),           -- Cumulative Layout Shift

    -- Additional metrics
    fcp DECIMAL(10, 2),           -- First Contentful Paint (ms)
    ttfb DECIMAL(10, 2),          -- Time to First Byte (ms)
    si DECIMAL(10, 2),            -- Speed Index

    -- Scoring
    performance_score INTEGER CHECK (performance_score >= 0 AND performance_score <= 100),
    status TEXT CHECK (status IN ('good', 'needs-improvement', 'poor')),

    -- Details
    issues JSONB DEFAULT '[]'::jsonb,
    recommendations JSONB DEFAULT '[]'::jsonb,

    -- Timestamps
    measured_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for vitals
CREATE INDEX idx_seo_vitals_url ON seo_vitals(url);
CREATE INDEX idx_seo_vitals_product ON seo_vitals(product_id);
CREATE INDEX idx_seo_vitals_score ON seo_vitals(performance_score);
CREATE INDEX idx_seo_vitals_measured ON seo_vitals(measured_at DESC);
CREATE INDEX idx_seo_vitals_status ON seo_vitals(status);

-- ============================================
-- 2. Schema.org Markup Tracking
-- ============================================
CREATE TABLE IF NOT EXISTS seo_schema_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL,
    product_id INTEGER,

    -- Schema presence
    has_product_schema BOOLEAN DEFAULT false,
    has_breadcrumb_schema BOOLEAN DEFAULT false,
    has_organization_schema BOOLEAN DEFAULT false,
    has_review_schema BOOLEAN DEFAULT false,

    -- Detected schemas (array of {type, format, valid, errors})
    detected_schemas JSONB DEFAULT '[]'::jsonb,

    -- Issues
    missing_required_fields JSONB DEFAULT '[]'::jsonb,
    validation_errors JSONB DEFAULT '[]'::jsonb,

    -- Generated schema (if we created one)
    generated_schema JSONB,

    -- Application tracking
    applied_at TIMESTAMPTZ,
    applied_by TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for schema audits
CREATE INDEX idx_seo_schema_url ON seo_schema_audits(url);
CREATE INDEX idx_seo_schema_product ON seo_schema_audits(product_id);
CREATE INDEX idx_seo_schema_has_product ON seo_schema_audits(has_product_schema);
CREATE INDEX idx_seo_schema_applied ON seo_schema_audits(applied_at);

-- ============================================
-- 3. AI/GEO Optimization Tracking
-- ============================================
CREATE TABLE IF NOT EXISTS seo_geo_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL,
    product_id INTEGER,

    -- AI visibility scoring
    ai_visibility_score INTEGER CHECK (ai_visibility_score >= 0 AND ai_visibility_score <= 100),

    -- Content structure analysis
    content_structure JSONB DEFAULT '{}'::jsonb,

    -- AI search signals
    ai_search_signals JSONB DEFAULT '{}'::jsonb,

    -- E-E-A-T signals
    eeat_signals JSONB DEFAULT '{}'::jsonb,

    -- Recommendations
    recommendations JSONB DEFAULT '[]'::jsonb,

    -- Timestamps
    analyzed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for GEO analysis
CREATE INDEX idx_seo_geo_url ON seo_geo_analysis(url);
CREATE INDEX idx_seo_geo_product ON seo_geo_analysis(product_id);
CREATE INDEX idx_seo_geo_score ON seo_geo_analysis(ai_visibility_score);
CREATE INDEX idx_seo_geo_analyzed ON seo_geo_analysis(analyzed_at DESC);

-- ============================================
-- 4. Extend existing seo_audits table
-- ============================================

-- Add new audit types if constraint exists
DO $$
BEGIN
    -- Try to drop the old constraint
    ALTER TABLE seo_audits DROP CONSTRAINT IF EXISTS seo_audits_audit_type_check;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- Add updated constraint with new types
ALTER TABLE seo_audits ADD CONSTRAINT seo_audits_audit_type_check
CHECK (audit_type IN ('full_site', 'page', 'technical', 'content', 'backlinks', 'schema', 'vitals', 'geo', 'product'));

-- Add subtype column if not exists
ALTER TABLE seo_audits ADD COLUMN IF NOT EXISTS audit_subtype TEXT;

-- ============================================
-- 5. Summary/Dashboard Views
-- ============================================

-- Latest vitals per product
CREATE OR REPLACE VIEW seo_vitals_latest AS
SELECT DISTINCT ON (product_id)
    product_id,
    url,
    lcp,
    inp,
    cls,
    performance_score,
    status,
    measured_at
FROM seo_vitals
WHERE product_id IS NOT NULL
ORDER BY product_id, measured_at DESC;

-- Products without schema
CREATE OR REPLACE VIEW products_missing_schema AS
SELECT
    p.product_id,
    pd.name,
    s.has_product_schema,
    s.created_at as last_checked
FROM seo_schema_audits s
JOIN (SELECT product_id, MAX(created_at) as max_date FROM seo_schema_audits GROUP BY product_id) latest
    ON s.product_id = latest.product_id AND s.created_at = latest.max_date
RIGHT JOIN oc_product p ON s.product_id = p.product_id
LEFT JOIN oc_product_description pd ON p.product_id = pd.product_id AND pd.language_id = 1
WHERE s.has_product_schema = false OR s.has_product_schema IS NULL;

-- SEO health summary
CREATE OR REPLACE VIEW seo_health_summary AS
SELECT
    COUNT(*) as total_products,
    COUNT(CASE WHEN v.performance_score >= 90 THEN 1 END) as vitals_good,
    COUNT(CASE WHEN v.performance_score BETWEEN 50 AND 89 THEN 1 END) as vitals_needs_work,
    COUNT(CASE WHEN v.performance_score < 50 THEN 1 END) as vitals_poor,
    COUNT(CASE WHEN s.has_product_schema = true THEN 1 END) as has_schema,
    COUNT(CASE WHEN s.has_product_schema = false OR s.has_product_schema IS NULL THEN 1 END) as missing_schema,
    AVG(g.ai_visibility_score) as avg_ai_score
FROM oc_product p
LEFT JOIN seo_vitals_latest v ON p.product_id = v.product_id
LEFT JOIN seo_schema_audits s ON p.product_id = s.product_id
LEFT JOIN seo_geo_analysis g ON p.product_id = g.product_id
WHERE p.status = 1;
```

---

## API Endpoints

**New File:** `app/api/agents/seo/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { seoHandler } from '@/services/execution-handlers/seo-handler'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, productIds, urls, limit, applyFixes } = body

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      )
    }

    // Create a task-like object for the handler
    const task = {
      id: crypto.randomUUID(),
      metadata: {
        action,
        productIds,
        urls,
        limit: limit || 50,
        applyFixes: applyFixes || false
      }
    }

    // Log the request
    await supabase.from('agent_logs').insert({
      agent: 'seo-agent',
      level: 'info',
      event_type: 'api_request',
      context: { action, productIds, urls, limit }
    })

    // Execute
    const result = await seoHandler(task)

    // Log result
    await supabase.from('agent_logs').insert({
      agent: 'seo-agent',
      level: result.success ? 'info' : 'error',
      event_type: 'api_response',
      context: { action, success: result.success, tokens: result.tokens_used }
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: result.data,
        tokens_used: result.tokens_used
      })
    } else {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error('SEO API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  // Get SEO health summary
  try {
    const { data: summary } = await supabase
      .from('seo_health_summary')
      .select('*')
      .single()

    const { data: recentAudits } = await supabase
      .from('seo_audits')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    const { data: recentVitals } = await supabase
      .from('seo_vitals')
      .select('*')
      .order('measured_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      summary,
      recent_audits: recentAudits,
      recent_vitals: recentVitals
    })

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
```

**API Usage Examples:**

```bash
# Audit products
curl -X POST http://localhost:3000/api/agents/seo \
  -H "Content-Type: application/json" \
  -d '{"action": "audit_products", "limit": 20}'

# Check schema compliance
curl -X POST http://localhost:3000/api/agents/seo \
  -H "Content-Type: application/json" \
  -d '{"action": "audit_schema", "productIds": [1, 2, 3, 4, 5]}'

# Check Core Web Vitals
curl -X POST http://localhost:3000/api/agents/seo \
  -H "Content-Type: application/json" \
  -d '{"action": "check_vitals", "urls": ["https://audicoonline.co.za/product/123"]}'

# Full audit
curl -X POST http://localhost:3000/api/agents/seo \
  -H "Content-Type: application/json" \
  -d '{"action": "full_audit", "limit": 50}'

# Get SEO health summary
curl http://localhost:3000/api/agents/seo
```

---

## Token Budget & Scheduling

### Token Estimates by Action

| SEO Action | Tokens | LLM Calls | Notes |
|------------|--------|-----------|-------|
| `audit_products` | 1,000 | 1 | Per batch of ~50 products |
| `audit_schema` | 200 | 0 | HTML parsing only |
| `generate_schema` | 500 | 1 | Template + Claude refinement |
| `check_vitals` | 50 | 0 | PageSpeed API only |
| `check_vitals_batch` | 100 | 0 | Multiple pages |
| `analyze_geo` | 1,200 | 1 | Full content analysis |
| `optimize_content` | 1,500 | 1 | Content rewrite |
| `full_audit` | 2,000 | 2 | Combined audit |

### Recommended Schedule

```typescript
// In services/config.ts

export const SEO_SCHEDULES = {
  // Daily: Quick vitals check on top products (low token cost)
  VITALS_CHECK: {
    cron: '0 3 * * *',           // 3 AM SAST daily
    action: 'check_vitals',
    config: { limit: 20 }         // Top 20 product pages
  },

  // Weekly: Schema compliance audit
  SCHEMA_AUDIT: {
    cron: '0 4 * * 0',           // 4 AM Sunday
    action: 'audit_schema',
    config: { limit: 100 }
  },

  // Weekly: Full SEO audit
  FULL_AUDIT: {
    cron: '0 5 * * 1',           // 5 AM Monday
    action: 'full_audit',
    config: { limit: 50 }
  },

  // Monthly: GEO analysis (high token cost)
  GEO_ANALYSIS: {
    cron: '0 6 1 * *',           // 6 AM 1st of month
    action: 'analyze_geo',
    config: { limit: 20 }
  }
}
```

### Daily Token Budget

With 100,000 daily token budget:

| Schedule | Frequency | Tokens/Run | Monthly Tokens |
|----------|-----------|------------|----------------|
| Vitals Check | Daily | 100 | 3,000 |
| Schema Audit | Weekly | 400 | 1,600 |
| Full Audit | Weekly | 2,000 | 8,000 |
| GEO Analysis | Monthly | 24,000 | 24,000 |
| **Total** | | | **~36,600** |

Leaves ~63,400 tokens/month for on-demand requests and other agents.

---

## Verification & Testing

### 1. Schema Markup Verification

```typescript
// Test: Generate schema and validate
const schema = await generateProductSchema(product, description, images)

// Validate with Google's Rich Results Test
const testUrl = `https://search.google.com/test/rich-results?url=${encodeURIComponent(productUrl)}`

// Check in Supabase
const { data } = await supabase
  .from('seo_schema_audits')
  .select('*')
  .eq('product_id', productId)
  .single()

console.assert(data.has_product_schema === true, 'Schema should be detected')
```

### 2. Core Web Vitals Verification

```typescript
// Test: Measure vitals and compare with Google
const vitals = await measureCoreWebVitals('https://audicoonline.co.za/product/123')

console.log('LCP:', vitals.lcp, 'ms (target: <2500)')
console.log('INP:', vitals.inp, 'ms (target: <200)')
console.log('CLS:', vitals.cls, '(target: <0.1)')
console.log('Score:', vitals.performance_score, '/100')

// Compare with PageSpeed Insights web UI
console.log('Verify at: https://pagespeed.web.dev/report?url=' + encodeURIComponent(url))
```

### 3. Jarvis Integration Test

```typescript
// Trigger Jarvis orchestration
const response = await fetch('/api/agents/jarvis/orchestrate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
})

const result = await response.json()

// Check if SEO tasks were created
const { data: tasks } = await supabase
  .from('squad_tasks')
  .select('*')
  .eq('assigned_agent', 'seo-agent')
  .order('created_at', { ascending: false })
  .limit(5)

console.log('Recent SEO tasks:', tasks)
```

### 4. End-to-End Test Script

```bash
#!/bin/bash
# test-seo-enhanced.sh

echo "=== Testing SEO Agent Enhancement ==="

# 1. Test product audit
echo "1. Testing product audit..."
curl -s -X POST http://localhost:3000/api/agents/seo \
  -H "Content-Type: application/json" \
  -d '{"action": "audit_products", "limit": 5}' | jq '.success'

# 2. Test schema audit
echo "2. Testing schema audit..."
curl -s -X POST http://localhost:3000/api/agents/seo \
  -H "Content-Type: application/json" \
  -d '{"action": "audit_schema", "limit": 5}' | jq '.success'

# 3. Test vitals check
echo "3. Testing vitals check..."
curl -s -X POST http://localhost:3000/api/agents/seo \
  -H "Content-Type: application/json" \
  -d '{"action": "check_vitals", "urls": ["https://audicoonline.co.za"]}' | jq '.data.performance_score'

# 4. Test health summary
echo "4. Testing health summary..."
curl -s http://localhost:3000/api/agents/seo | jq '.summary'

echo "=== Tests Complete ==="
```

---

## File Reference

### Files to Create

| File | Purpose |
|------|---------|
| `services/agents/seo-vitals.ts` | Core Web Vitals module |
| `services/agents/seo-geo.ts` | AI search optimization module |
| `services/agents/seo-types.ts` | Shared TypeScript interfaces |
| `app/api/agents/seo/route.ts` | SEO API endpoint |
| `supabase/migrations/XXX_seo_enhanced.sql` | Database tables |

### Files to Modify

| File | Changes |
|------|---------|
| `services/agents/seo-agent.ts` | Add schema detection/generation functions |
| `services/execution-handlers/seo-handler.ts` | Add new action handlers |
| `app/api/agents/jarvis/orchestrate/route.ts` | Update SEO Agent description in prompt |
| `services/config.ts` | Add token estimates and schedules |

### Environment Variables to Add

```bash
# .env.local
GOOGLE_PAGESPEED_API_KEY=your_pagespeed_api_key
```

---

## Summary

This plan transforms the SEO Agent from a product-level auditor into a comprehensive SEO optimization system with:

1. **Schema.org markup** for Google rich snippets
2. **Core Web Vitals monitoring** for performance tracking
3. **AI search optimization** for ChatGPT/Perplexity visibility
4. **Automated scheduling** for continuous improvement
5. **Full Jarvis integration** for intelligent orchestration

The TypeScript-native approach maintains architectural consistency while adding powerful new capabilities from the claude-seo project.

**Estimated Timeline: 7 weeks**
**Estimated Token Budget Impact: ~37,000 tokens/month (37% of budget)**
