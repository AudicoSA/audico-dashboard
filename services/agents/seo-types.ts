/**
 * SEO Agent Enhanced Types
 *
 * TypeScript interfaces for Schema.org markup, Core Web Vitals,
 * and AI Search Optimization (GEO) features.
 */

// ============================================
// Schema.org Markup Types
// ============================================

export interface ProductSchemaLD {
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

export interface BreadcrumbListLD {
  "@context": "https://schema.org"
  "@type": "BreadcrumbList"
  itemListElement: {
    "@type": "ListItem"
    position: number
    name: string
    item: string
  }[]
}

export interface OrganizationSchemaLD {
  "@context": "https://schema.org"
  "@type": "Organization"
  name: string
  url: string
  logo?: string
  contactPoint?: {
    "@type": "ContactPoint"
    telephone: string
    contactType: string
  }
  sameAs?: string[]
}

export interface DetectedSchema {
  type: string
  format: "JSON-LD" | "Microdata" | "RDFa"
  valid: boolean
  errors?: string[]
  data?: Record<string, any>
}

export interface SchemaAuditResult {
  product_id: number
  url: string
  has_product_schema: boolean
  has_breadcrumb_schema: boolean
  has_organization_schema: boolean
  has_review_schema: boolean
  detected_schemas: DetectedSchema[]
  missing_required_fields: string[]
  validation_errors: string[]
  generated_schema?: ProductSchemaLD
  recommendations: string[]
  audited_at: Date
}

// ============================================
// Core Web Vitals Types
// ============================================

export interface CoreWebVitalsResult {
  url: string
  product_id?: number

  // Core Web Vitals
  lcp: number      // Largest Contentful Paint (ms) - target: <2500
  inp: number      // Interaction to Next Paint (ms) - target: <200
  cls: number      // Cumulative Layout Shift - target: <0.1

  // Additional metrics
  fcp: number      // First Contentful Paint (ms)
  ttfb: number     // Time to First Byte (ms)
  si: number       // Speed Index

  // Scoring
  performance_score: number  // 0-100
  status: 'good' | 'needs-improvement' | 'poor'

  // Issues and recommendations
  issues: VitalsIssue[]
  recommendations: string[]
  measured_at: Date
}

export interface VitalsIssue {
  metric: string
  value: number
  threshold: number
  impact: 'high' | 'medium' | 'low'
  description?: string
}

export interface VitalsSummary {
  avg_lcp: number
  avg_inp: number
  avg_cls: number
  avg_performance: number
  pages_good: number
  pages_needs_improvement: number
  pages_poor: number
  total_pages: number
}

// ============================================
// AI Search Optimization (GEO) Types
// ============================================

export interface GEOAnalysisResult {
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

  recommendations: GEORecommendation[]
  analyzed_at: Date
}

export interface GEORecommendation {
  priority: 'high' | 'medium' | 'low'
  action: string
  rationale: string
  example?: string
}

export interface GEOOptimizationResult {
  optimized_content: string
  changes_made: string[]
  estimated_score_improvement: number
}

// ============================================
// SEO Handler Types
// ============================================

export interface SEOTask {
  id: string
  metadata: {
    action: string
    productIds?: number[]
    urls?: string[]
    limit?: number
    applyFixes?: boolean
  }
}

export interface SEOExecutionResult {
  success: boolean
  data?: any
  error?: string
  tokens_used?: number
}

// ============================================
// SEO Schedules Configuration
// ============================================

export interface SEOScheduleConfig {
  cron: string
  action: string
  config: {
    limit?: number
    urls?: string[]
  }
}

export interface SEOSchedules {
  VITALS_CHECK: SEOScheduleConfig
  SCHEMA_AUDIT: SEOScheduleConfig
  FULL_AUDIT: SEOScheduleConfig
  GEO_ANALYSIS: SEOScheduleConfig
}
