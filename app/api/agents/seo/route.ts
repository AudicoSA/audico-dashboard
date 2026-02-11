/**
 * SEO Agent API Endpoint
 *
 * Provides REST API access to all SEO Agent capabilities:
 * - Product SEO audits
 * - Schema.org compliance
 * - Core Web Vitals monitoring
 * - AI Search Optimization (GEO)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { seoHandler } from '@/services/execution-handlers/seo-handler'
import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * POST /api/agents/seo
 *
 * Execute an SEO action
 *
 * Request body:
 * {
 *   "action": "audit_products" | "audit_schema" | "generate_schema" |
 *             "check_vitals" | "check_vitals_single" |
 *             "analyze_geo" | "analyze_geo_single" | "optimize_content" |
 *             "generate_eeat" | "apply_fixes" | "full_audit",
 *   "productIds": [number],  // Optional: specific product IDs
 *   "urls": [string],        // Required for vitals/GEO checks
 *   "limit": number,         // Optional: max items to process (default 50)
 *   "applyFixes": boolean,   // Optional: apply changes to database
 *   "productName": string,   // Required for optimize_content, generate_eeat
 *   "content": string,       // Required for optimize_content, generate_eeat
 *   "category": string,      // Optional for generate_eeat
 *   "targetKeywords": [string] // Optional for optimize_content
 * }
 */
export async function POST(request: NextRequest) {
  // Verify request is from authorized source
  if (!verifyCronRequest(request)) {
    return unauthorizedResponse()
  }

  try {
    const body = await request.json()
    const { action, productIds, urls, limit, applyFixes, productName, content, category, targetKeywords } = body

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      )
    }

    // Create a task-like object for the handler
    const task = {
      id: crypto.randomUUID(),
      title: `SEO: ${action}`,
      description: `API request for SEO action: ${action}`,
      status: 'in_progress' as const,
      assigned_agent: 'seo-agent',
      priority: 'medium' as const,
      created_at: new Date().toISOString(),
      metadata: {
        action,
        productIds,
        urls,
        limit: limit || 50,
        applyFixes: applyFixes || false,
        productName,
        content,
        category,
        targetKeywords
      }
    }

    // Log the request
    await supabase.from('agent_logs').insert({
      agent: 'seo-agent',
      level: 'info',
      event_type: 'api_request',
      context: { action, productIds, urls, limit }
    })

    // Execute the SEO action
    const result = await seoHandler(task)

    // Log result
    await supabase.from('agent_logs').insert({
      agent: 'seo-agent',
      level: result.success ? 'info' : 'error',
      event_type: 'api_response',
      context: {
        action,
        success: result.success,
        tokens_used: result.tokens_used,
        error: result.error
      }
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: result.data,
        tokens_used: result.tokens_used,
        deliverable_url: result.deliverable_url
      })
    } else {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('SEO API error:', error)

    await supabase.from('agent_logs').insert({
      agent: 'seo-agent',
      level: 'error',
      event_type: 'api_error',
      context: { error: error.message }
    })

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/agents/seo
 *
 * Get SEO health summary and recent audits
 */
export async function GET(request: NextRequest) {
  // Verify request is from authorized source
  if (!verifyCronRequest(request)) {
    return unauthorizedResponse()
  }

  try {
    // Get recent SEO audits
    const { data: recentAudits, error: auditsError } = await supabase
      .from('seo_audits')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    // Get recent vitals
    const { data: recentVitals, error: vitalsError } = await supabase
      .from('seo_vitals')
      .select('*')
      .order('measured_at', { ascending: false })
      .limit(10)

    // Get recent schema audits
    const { data: recentSchemaAudits, error: schemaError } = await supabase
      .from('seo_schema_audits')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    // Get recent GEO analyses
    const { data: recentGeoAnalyses, error: geoError } = await supabase
      .from('seo_geo_analysis')
      .select('*')
      .order('analyzed_at', { ascending: false })
      .limit(10)

    // Calculate summary statistics
    const summary = {
      audits: {
        count: recentAudits?.length || 0,
        avg_score: recentAudits && recentAudits.length > 0
          ? Math.round(recentAudits.reduce((sum, a) => sum + (a.score || 0), 0) / recentAudits.length)
          : 0
      },
      vitals: {
        count: recentVitals?.length || 0,
        avg_performance: recentVitals && recentVitals.length > 0
          ? Math.round(recentVitals.reduce((sum, v) => sum + (v.performance_score || 0), 0) / recentVitals.length)
          : 0,
        good: recentVitals?.filter(v => v.status === 'good').length || 0,
        needs_improvement: recentVitals?.filter(v => v.status === 'needs-improvement').length || 0,
        poor: recentVitals?.filter(v => v.status === 'poor').length || 0
      },
      schemas: {
        count: recentSchemaAudits?.length || 0,
        with_product_schema: recentSchemaAudits?.filter(s => s.has_product_schema).length || 0,
        without_product_schema: recentSchemaAudits?.filter(s => !s.has_product_schema).length || 0
      },
      geo: {
        count: recentGeoAnalyses?.length || 0,
        avg_visibility_score: recentGeoAnalyses && recentGeoAnalyses.length > 0
          ? Math.round(recentGeoAnalyses.reduce((sum, g) => sum + (g.ai_visibility_score || 0), 0) / recentGeoAnalyses.length)
          : 0
      }
    }

    return NextResponse.json({
      summary,
      recent_audits: recentAudits || [],
      recent_vitals: recentVitals || [],
      recent_schema_audits: recentSchemaAudits || [],
      recent_geo_analyses: recentGeoAnalyses || []
    })
  } catch (error: any) {
    console.error('SEO API GET error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
