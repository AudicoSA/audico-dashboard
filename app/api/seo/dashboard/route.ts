/**
 * SEO Dashboard API Endpoint
 *
 * Returns SEO health summary data for the dashboard UI.
 * This endpoint is public (no cron auth) for dashboard access.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: NextRequest) {
  try {
    // Fetch all SEO data in parallel
    const [
      recentAuditsRes,
      recentVitalsRes,
      recentSchemaAuditsRes,
      recentGeoAnalysesRes
    ] = await Promise.all([
      supabase
        .from('seo_audits')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('seo_vitals')
        .select('*')
        .order('measured_at', { ascending: false })
        .limit(20),
      supabase
        .from('seo_schema_audits')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('seo_geo_analysis')
        .select('*')
        .order('analyzed_at', { ascending: false })
        .limit(20)
    ])

    const recentAudits = recentAuditsRes.data || []
    const recentVitals = recentVitalsRes.data || []
    const recentSchemaAudits = recentSchemaAuditsRes.data || []
    const recentGeoAnalyses = recentGeoAnalysesRes.data || []

    // Calculate summary statistics
    const summary = {
      audits: {
        count: recentAudits.length,
        avg_score: recentAudits.length > 0
          ? Math.round(recentAudits.reduce((sum, a) => sum + (a.score || 0), 0) / recentAudits.length)
          : 0
      },
      vitals: {
        count: recentVitals.length,
        avg_performance: recentVitals.length > 0
          ? Math.round(recentVitals.reduce((sum, v) => sum + (v.performance_score || 0), 0) / recentVitals.length)
          : 0,
        good: recentVitals.filter(v => v.status === 'good').length,
        needs_improvement: recentVitals.filter(v => v.status === 'needs-improvement').length,
        poor: recentVitals.filter(v => v.status === 'poor').length
      },
      schemas: {
        count: recentSchemaAudits.length,
        with_product_schema: recentSchemaAudits.filter(s => s.has_product_schema).length,
        without_product_schema: recentSchemaAudits.filter(s => !s.has_product_schema).length
      },
      geo: {
        count: recentGeoAnalyses.length,
        avg_visibility_score: recentGeoAnalyses.length > 0
          ? Math.round(recentGeoAnalyses.reduce((sum, g) => sum + (g.ai_visibility_score || 0), 0) / recentGeoAnalyses.length)
          : 0
      }
    }

    return NextResponse.json({
      summary,
      recent_audits: recentAudits,
      recent_vitals: recentVitals,
      recent_schema_audits: recentSchemaAudits,
      recent_geo_analyses: recentGeoAnalyses
    })
  } catch (error: any) {
    console.error('SEO Dashboard API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch SEO data' },
      { status: 500 }
    )
  }
}
