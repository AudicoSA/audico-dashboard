/**
 * SEO Vitals Module
 *
 * Monitors Core Web Vitals (LCP, INP, CLS) using Google PageSpeed Insights API.
 * Stores results to Supabase for tracking performance trends.
 */

import { createClient } from '@supabase/supabase-js'
import type {
  CoreWebVitalsResult,
  VitalsIssue,
  VitalsSummary
} from './seo-types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Core Web Vitals thresholds (Good/Needs Improvement/Poor)
const VITALS_THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },      // Largest Contentful Paint (ms)
  INP: { good: 200, poor: 500 },        // Interaction to Next Paint (ms)
  CLS: { good: 0.1, poor: 0.25 },       // Cumulative Layout Shift
  FCP: { good: 1800, poor: 3000 },      // First Contentful Paint (ms)
  TTFB: { good: 800, poor: 1800 },      // Time to First Byte (ms)
}

async function logToSquadMessages(fromAgent: string, message: string, data: any = null) {
  await supabase
    .from('squad_messages')
    .insert({
      from_agent: fromAgent,
      to_agent: null,
      message,
      task_id: null,
      data,
    })
}

/**
 * Determine vitals status based on Core Web Vitals
 */
function getVitalsStatus(lcp: number, cls: number, inp: number): 'good' | 'needs-improvement' | 'poor' {
  // Poor if any metric is in poor range
  if (lcp > VITALS_THRESHOLDS.LCP.poor ||
      cls > VITALS_THRESHOLDS.CLS.poor ||
      inp > VITALS_THRESHOLDS.INP.poor) {
    return 'poor'
  }

  // Good only if all metrics are in good range
  if (lcp <= VITALS_THRESHOLDS.LCP.good &&
      cls <= VITALS_THRESHOLDS.CLS.good &&
      inp <= VITALS_THRESHOLDS.INP.good) {
    return 'good'
  }

  return 'needs-improvement'
}

/**
 * Extract performance issues from metrics
 */
function extractIssues(metrics: Record<string, any>): VitalsIssue[] {
  const issues: VitalsIssue[] = []

  const metricChecks = [
    {
      key: 'largest-contentful-paint',
      name: 'LCP',
      threshold: VITALS_THRESHOLDS.LCP,
      unit: 'ms'
    },
    {
      key: 'cumulative-layout-shift',
      name: 'CLS',
      threshold: VITALS_THRESHOLDS.CLS,
      unit: ''
    },
    {
      key: 'first-contentful-paint',
      name: 'FCP',
      threshold: VITALS_THRESHOLDS.FCP,
      unit: 'ms'
    },
    {
      key: 'server-response-time',
      name: 'TTFB',
      threshold: VITALS_THRESHOLDS.TTFB,
      unit: 'ms'
    }
  ]

  for (const check of metricChecks) {
    const metric = metrics?.[check.key]
    if (metric?.numericValue !== undefined) {
      const value = metric.numericValue
      if (value > check.threshold.poor) {
        issues.push({
          metric: check.name,
          value,
          threshold: check.threshold.poor,
          impact: 'high',
          description: `${check.name} is ${Math.round(value)}${check.unit}, which is above the poor threshold of ${check.threshold.poor}${check.unit}`
        })
      } else if (value > check.threshold.good) {
        issues.push({
          metric: check.name,
          value,
          threshold: check.threshold.good,
          impact: 'medium',
          description: `${check.name} is ${Math.round(value)}${check.unit}, which needs improvement (target: <${check.threshold.good}${check.unit})`
        })
      }
    }
  }

  return issues
}

/**
 * Extract recommendations from Lighthouse audits
 */
function extractRecommendations(audits: Record<string, any>): string[] {
  const recommendations: string[] = []

  // Key audits that commonly have recommendations
  const relevantAudits = [
    'render-blocking-resources',
    'uses-responsive-images',
    'offscreen-images',
    'unminified-css',
    'unminified-javascript',
    'unused-css-rules',
    'unused-javascript',
    'uses-webp-images',
    'uses-optimized-images',
    'uses-text-compression',
    'uses-rel-preconnect',
    'server-response-time',
    'redirects',
    'uses-rel-preload',
    'efficient-animated-content',
    'duplicated-javascript',
    'legacy-javascript',
    'preload-lcp-image',
    'total-blocking-time',
    'dom-size',
    'critical-request-chains'
  ]

  for (const auditKey of relevantAudits) {
    const audit = audits?.[auditKey]
    if (audit && audit.score !== null && audit.score < 1 && audit.title) {
      // Only include audits that have potential savings
      const hasSavings = audit.numericValue > 0 ||
                         audit.details?.overallSavingsMs > 0 ||
                         audit.details?.overallSavingsBytes > 0

      if (hasSavings) {
        let recommendation = audit.title
        if (audit.details?.overallSavingsMs) {
          recommendation += ` (potential savings: ${Math.round(audit.details.overallSavingsMs)}ms)`
        }
        recommendations.push(recommendation)
      }
    }
  }

  return recommendations.slice(0, 10) // Limit to top 10 recommendations
}

/**
 * Measure Core Web Vitals for a single URL using Google PageSpeed Insights API
 */
export async function measureCoreWebVitals(
  url: string,
  productId?: number
): Promise<CoreWebVitalsResult> {
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY

  if (!apiKey) {
    throw new Error('GOOGLE_PAGESPEED_API_KEY not configured')
  }

  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${apiKey}&category=performance&strategy=mobile`

  await logToSquadMessages(
    'seo_agent',
    `Measuring Core Web Vitals for ${url}`,
    { action: 'vitals_measure_start', url }
  )

  try {
    const response = await fetch(apiUrl)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`PageSpeed API returned ${response.status}: ${errorText}`)
    }

    const data = await response.json()

    const metrics = data.lighthouseResult?.audits
    const fieldData = data.loadingExperience?.metrics

    // Extract Core Web Vitals (prefer field data if available, fallback to lab data)
    const lcp = fieldData?.LARGEST_CONTENTFUL_PAINT_MS?.percentile ||
                metrics?.['largest-contentful-paint']?.numericValue ||
                0

    const inp = fieldData?.INTERACTION_TO_NEXT_PAINT?.percentile || 0

    const cls = fieldData?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile !== undefined
      ? fieldData.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100
      : metrics?.['cumulative-layout-shift']?.numericValue || 0

    const fcp = metrics?.['first-contentful-paint']?.numericValue || 0
    const ttfb = metrics?.['server-response-time']?.numericValue || 0
    const si = metrics?.['speed-index']?.numericValue || 0

    const performanceScore = Math.round(
      (data.lighthouseResult?.categories?.performance?.score || 0) * 100
    )

    const status = getVitalsStatus(lcp, cls, inp)
    const issues = extractIssues(metrics)
    const recommendations = extractRecommendations(data.lighthouseResult?.audits)

    const result: CoreWebVitalsResult = {
      url,
      product_id: productId,
      lcp,
      inp,
      cls,
      fcp,
      ttfb,
      si,
      performance_score: performanceScore,
      status,
      issues,
      recommendations,
      measured_at: new Date()
    }

    await logToSquadMessages(
      'seo_agent',
      `Core Web Vitals measured: ${url} - Score: ${performanceScore}/100 (${status})`,
      { action: 'vitals_measure_complete', url, score: performanceScore, status }
    )

    return result
  } catch (error: any) {
    await logToSquadMessages(
      'seo_agent',
      `Failed to measure vitals for ${url}: ${error.message}`,
      { action: 'vitals_measure_error', url, error: error.message }
    )
    throw error
  }
}

/**
 * Audit Core Web Vitals for multiple URLs
 */
export async function auditSiteVitals(
  urls: string[],
  limit: number = 20,
  productIds?: number[]
): Promise<{
  results: CoreWebVitalsResult[]
  summary: VitalsSummary
}> {
  const results: CoreWebVitalsResult[] = []

  await logToSquadMessages(
    'seo_agent',
    `Starting site vitals audit for ${Math.min(urls.length, limit)} URLs`,
    { action: 'vitals_audit_start', url_count: urls.length, limit }
  )

  // Rate limit: PageSpeed API allows 25,000 queries/day free
  // Process sequentially with 1s delay to avoid rate limits
  for (let i = 0; i < Math.min(urls.length, limit); i++) {
    const url = urls[i]
    const productId = productIds?.[i]

    try {
      const result = await measureCoreWebVitals(url, productId)
      results.push(result)

      // Delay between requests (except for last one)
      if (i < Math.min(urls.length, limit) - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    } catch (error: any) {
      console.error(`Failed to measure ${url}:`, error.message)
      // Continue with other URLs
    }
  }

  const summary = calculateVitalsSummary(results)

  await logToSquadMessages(
    'seo_agent',
    `Site vitals audit completed: ${results.length} pages measured`,
    { action: 'vitals_audit_complete', summary }
  )

  return { results, summary }
}

/**
 * Calculate summary statistics from vitals results
 */
function calculateVitalsSummary(results: CoreWebVitalsResult[]): VitalsSummary {
  if (results.length === 0) {
    return {
      avg_lcp: 0,
      avg_inp: 0,
      avg_cls: 0,
      avg_performance: 0,
      pages_good: 0,
      pages_needs_improvement: 0,
      pages_poor: 0,
      total_pages: 0
    }
  }

  const sum = results.reduce(
    (acc, r) => ({
      lcp: acc.lcp + r.lcp,
      inp: acc.inp + r.inp,
      cls: acc.cls + r.cls,
      performance: acc.performance + r.performance_score
    }),
    { lcp: 0, inp: 0, cls: 0, performance: 0 }
  )

  return {
    avg_lcp: Math.round(sum.lcp / results.length),
    avg_inp: Math.round(sum.inp / results.length),
    avg_cls: Math.round((sum.cls / results.length) * 1000) / 1000,
    avg_performance: Math.round(sum.performance / results.length),
    pages_good: results.filter(r => r.status === 'good').length,
    pages_needs_improvement: results.filter(r => r.status === 'needs-improvement').length,
    pages_poor: results.filter(r => r.status === 'poor').length,
    total_pages: results.length
  }
}

/**
 * Store vitals results to Supabase
 */
export async function storeVitalsResults(results: CoreWebVitalsResult[]): Promise<string[]> {
  const storedIds: string[] = []

  try {
    for (const result of results) {
      const { data, error } = await supabase
        .from('seo_vitals')
        .insert({
          url: result.url,
          product_id: result.product_id,
          lcp: result.lcp,
          inp: result.inp,
          cls: result.cls,
          fcp: result.fcp,
          ttfb: result.ttfb,
          si: result.si,
          performance_score: result.performance_score,
          status: result.status,
          issues: result.issues,
          recommendations: result.recommendations,
          measured_at: result.measured_at
        })
        .select('id')
        .single()

      if (error) {
        console.error(`Failed to store vitals for ${result.url}:`, error.message)
      } else if (data) {
        storedIds.push(data.id)
      }
    }

    await logToSquadMessages(
      'seo_agent',
      `Stored ${storedIds.length} vitals results`,
      { action: 'store_vitals_complete', stored_ids: storedIds }
    )

    return storedIds
  } catch (error: any) {
    await logToSquadMessages(
      'seo_agent',
      `Failed to store vitals results: ${error.message}`,
      { action: 'store_vitals_error', error: error.message }
    )
    throw error
  }
}

/**
 * Get latest vitals for a product
 */
export async function getLatestVitals(productId: number): Promise<CoreWebVitalsResult | null> {
  const { data, error } = await supabase
    .from('seo_vitals')
    .select('*')
    .eq('product_id', productId)
    .order('measured_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return null

  return {
    url: data.url,
    product_id: data.product_id,
    lcp: data.lcp,
    inp: data.inp,
    cls: data.cls,
    fcp: data.fcp,
    ttfb: data.ttfb,
    si: data.si,
    performance_score: data.performance_score,
    status: data.status,
    issues: data.issues || [],
    recommendations: data.recommendations || [],
    measured_at: new Date(data.measured_at)
  }
}

/**
 * Get vitals trends for a URL over time
 */
export async function getVitalsTrend(
  url: string,
  days: number = 30
): Promise<CoreWebVitalsResult[]> {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data, error } = await supabase
    .from('seo_vitals')
    .select('*')
    .eq('url', url)
    .gte('measured_at', since.toISOString())
    .order('measured_at', { ascending: true })

  if (error || !data) return []

  return data.map(d => ({
    url: d.url,
    product_id: d.product_id,
    lcp: d.lcp,
    inp: d.inp,
    cls: d.cls,
    fcp: d.fcp,
    ttfb: d.ttfb,
    si: d.si,
    performance_score: d.performance_score,
    status: d.status,
    issues: d.issues || [],
    recommendations: d.recommendations || [],
    measured_at: new Date(d.measured_at)
  }))
}
