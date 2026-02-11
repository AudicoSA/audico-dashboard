/**
 * SEO GEO Module - AI Search Optimization
 *
 * Optimizes content for visibility in AI assistants like ChatGPT, Perplexity,
 * and Google AI Overviews. Analyzes E-E-A-T signals and content structure.
 */

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import type {
  GEOAnalysisResult,
  GEORecommendation,
  GEOOptimizationResult
} from './seo-types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

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
 * Fetch and clean page content for analysis
 */
async function fetchPageContent(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Audico SEO Agent/1.0'
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`)
  }

  const html = await response.text()

  // Extract main content area (remove scripts, styles, nav, footer)
  let content = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return content
}

/**
 * Analyze page content for AI search readiness (GEO)
 */
export async function analyzeAISearchReadiness(
  url: string,
  productId?: number,
  content?: string
): Promise<GEOAnalysisResult> {
  await logToSquadMessages(
    'seo_agent',
    `Analyzing AI search readiness for ${url}`,
    { action: 'geo_analysis_start', url }
  )

  try {
    // Fetch page content if not provided
    if (!content) {
      content = await fetchPageContent(url)
    }

    // Limit content for API call
    const truncatedContent = content.substring(0, 8000)

    const prompt = `Analyze this product page content for AI search optimization (GEO - Generative Engine Optimization).

Content:
${truncatedContent}

Evaluate how well this content would be cited by AI assistants like ChatGPT, Perplexity, and Google AI Overviews.

Respond with JSON ONLY (no markdown, no explanation):
{
  "ai_visibility_score": <0-100 score based on how likely AI would cite this content>,
  "content_structure": {
    "has_clear_headings": <boolean - well-organized sections>,
    "has_structured_data": <boolean - specs, lists, tables>,
    "has_citations": <boolean - references sources>,
    "has_statistics": <boolean - includes numbers/data>,
    "reading_level": "<basic|intermediate|advanced>",
    "word_count": <approximate count>
  },
  "ai_search_signals": {
    "authoritative_claims": <count of expert/authority statements>,
    "factual_statements": <count of verifiable facts>,
    "actionable_content": <boolean - clear CTAs>,
    "comparison_friendly": <boolean - easy to compare>,
    "question_answering": <boolean - answers common questions>
  },
  "eeat_signals": {
    "experience_indicators": ["list of first-hand knowledge signals found"],
    "expertise_indicators": ["list of professional credentials/knowledge signals"],
    "authority_indicators": ["list of industry recognition signals"],
    "trust_indicators": ["list of security/transparency signals"]
  },
  "recommendations": [
    {
      "priority": "<high|medium|low>",
      "action": "What specific action to take",
      "rationale": "Why this helps AI visibility",
      "example": "Example implementation if applicable"
    }
  ]
}

Focus on what makes content citable by AI assistants. Consider:
- Clear, factual statements AI can quote
- Well-structured specifications for comparison
- Answers to common customer questions
- Authority signals that build trust
- Content that serves user intent directly`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    // Clean and parse JSON response
    let cleanJson = responseText.trim()
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const analysis = JSON.parse(cleanJson)

    const result: GEOAnalysisResult = {
      url,
      product_id: productId,
      ai_visibility_score: analysis.ai_visibility_score,
      content_structure: analysis.content_structure,
      ai_search_signals: analysis.ai_search_signals,
      eeat_signals: analysis.eeat_signals,
      recommendations: analysis.recommendations || [],
      analyzed_at: new Date()
    }

    await logToSquadMessages(
      'seo_agent',
      `GEO analysis complete for ${url}: Score ${result.ai_visibility_score}/100`,
      { action: 'geo_analysis_complete', url, score: result.ai_visibility_score }
    )

    return result
  } catch (error: any) {
    await logToSquadMessages(
      'seo_agent',
      `GEO analysis failed for ${url}: ${error.message}`,
      { action: 'geo_analysis_error', url, error: error.message }
    )
    throw error
  }
}

/**
 * Optimize content for AI search visibility
 */
export async function optimizeContentForAI(
  content: string,
  productName: string,
  targetKeywords: string[]
): Promise<GEOOptimizationResult> {
  await logToSquadMessages(
    'seo_agent',
    `Optimizing content for AI visibility: ${productName}`,
    { action: 'geo_optimize_start', product: productName }
  )

  try {
    const prompt = `Optimize this product description for AI search visibility.

Product: ${productName}
Target Keywords: ${targetKeywords.join(', ')}

Current Content:
${content}

Rewrite to maximize citability by AI assistants like ChatGPT and Perplexity:
1. Include clear, factual statements that AI can directly quote
2. Add comparison-friendly specifications (bullet points, numbers)
3. Answer common customer questions inline
4. Include authoritative claims with context
5. Structure with clear, logical sections
6. Keep the tone professional but accessible

Respond with JSON ONLY:
{
  "optimized_content": "The rewritten content with all improvements",
  "changes_made": ["List each specific change made"],
  "estimated_score_improvement": <5-30 points expected improvement>
}`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    // Clean and parse JSON response
    let cleanJson = responseText.trim()
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const result = JSON.parse(cleanJson)

    await logToSquadMessages(
      'seo_agent',
      `Content optimized for ${productName}: ${result.changes_made.length} changes made`,
      { action: 'geo_optimize_complete', product: productName, changes: result.changes_made.length }
    )

    return {
      optimized_content: result.optimized_content,
      changes_made: result.changes_made,
      estimated_score_improvement: result.estimated_score_improvement
    }
  } catch (error: any) {
    await logToSquadMessages(
      'seo_agent',
      `Content optimization failed for ${productName}: ${error.message}`,
      { action: 'geo_optimize_error', product: productName, error: error.message }
    )
    throw error
  }
}

/**
 * Batch analyze multiple URLs for AI search readiness
 */
export async function batchAnalyzeGEO(
  urls: string[],
  productIds?: number[],
  limit: number = 20
): Promise<{
  results: GEOAnalysisResult[]
  summary: {
    total: number
    avg_score: number
    high_visibility: number
    low_visibility: number
    common_issues: string[]
  }
}> {
  const results: GEOAnalysisResult[] = []

  await logToSquadMessages(
    'seo_agent',
    `Starting batch GEO analysis for ${Math.min(urls.length, limit)} URLs`,
    { action: 'geo_batch_start', url_count: urls.length, limit }
  )

  for (let i = 0; i < Math.min(urls.length, limit); i++) {
    const url = urls[i]
    const productId = productIds?.[i]

    try {
      const result = await analyzeAISearchReadiness(url, productId)
      results.push(result)

      // Delay between API calls to avoid rate limits
      if (i < Math.min(urls.length, limit) - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    } catch (error: any) {
      console.error(`GEO analysis failed for ${url}:`, error.message)
      // Continue with other URLs
    }
  }

  // Calculate summary
  const avgScore = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + r.ai_visibility_score, 0) / results.length)
    : 0

  // Collect common issues from recommendations
  const issueCount: Record<string, number> = {}
  for (const result of results) {
    for (const rec of result.recommendations.filter(r => r.priority === 'high')) {
      issueCount[rec.action] = (issueCount[rec.action] || 0) + 1
    }
  }

  const commonIssues = Object.entries(issueCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([issue]) => issue)

  const summary = {
    total: results.length,
    avg_score: avgScore,
    high_visibility: results.filter(r => r.ai_visibility_score >= 70).length,
    low_visibility: results.filter(r => r.ai_visibility_score < 50).length,
    common_issues: commonIssues
  }

  await logToSquadMessages(
    'seo_agent',
    `Batch GEO analysis complete: ${results.length} URLs analyzed, avg score: ${avgScore}`,
    { action: 'geo_batch_complete', summary }
  )

  return { results, summary }
}

/**
 * Store GEO analysis results to Supabase
 */
export async function storeGEOResults(results: GEOAnalysisResult[]): Promise<string[]> {
  const storedIds: string[] = []

  try {
    for (const result of results) {
      const { data, error } = await supabase
        .from('seo_geo_analysis')
        .insert({
          url: result.url,
          product_id: result.product_id,
          ai_visibility_score: result.ai_visibility_score,
          content_structure: result.content_structure,
          ai_search_signals: result.ai_search_signals,
          eeat_signals: result.eeat_signals,
          recommendations: result.recommendations,
          analyzed_at: result.analyzed_at
        })
        .select('id')
        .single()

      if (error) {
        console.error(`Failed to store GEO result for ${result.url}:`, error.message)
      } else if (data) {
        storedIds.push(data.id)
      }
    }

    await logToSquadMessages(
      'seo_agent',
      `Stored ${storedIds.length} GEO analysis results`,
      { action: 'store_geo_complete', stored_ids: storedIds }
    )

    return storedIds
  } catch (error: any) {
    await logToSquadMessages(
      'seo_agent',
      `Failed to store GEO results: ${error.message}`,
      { action: 'store_geo_error', error: error.message }
    )
    throw error
  }
}

/**
 * Get latest GEO analysis for a product
 */
export async function getLatestGEOAnalysis(productId: number): Promise<GEOAnalysisResult | null> {
  const { data, error } = await supabase
    .from('seo_geo_analysis')
    .select('*')
    .eq('product_id', productId)
    .order('analyzed_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return null

  return {
    url: data.url,
    product_id: data.product_id,
    ai_visibility_score: data.ai_visibility_score,
    content_structure: data.content_structure,
    ai_search_signals: data.ai_search_signals,
    eeat_signals: data.eeat_signals,
    recommendations: data.recommendations || [],
    analyzed_at: new Date(data.analyzed_at)
  }
}

/**
 * Generate E-E-A-T enhancement suggestions for a product
 */
export async function generateEEATEnhancements(
  productName: string,
  currentContent: string,
  category: string
): Promise<{
  experience_additions: string[]
  expertise_additions: string[]
  authority_additions: string[]
  trust_additions: string[]
}> {
  await logToSquadMessages(
    'seo_agent',
    `Generating E-E-A-T enhancements for ${productName}`,
    { action: 'eeat_enhance_start', product: productName }
  )

  try {
    const prompt = `Generate E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) enhancements for this product page.

Product: ${productName}
Category: ${category}
Current Content: ${currentContent.substring(0, 2000)}

Suggest specific content additions to strengthen each E-E-A-T signal.
These suggestions should be realistic for an e-commerce audio-visual store (Audico Online).

Respond with JSON ONLY:
{
  "experience_additions": [
    "Specific content showing first-hand product experience (e.g., 'Our team has tested over 500 units of this model')"
  ],
  "expertise_additions": [
    "Specific content showing technical expertise (e.g., 'As certified audio engineers, we recommend...')"
  ],
  "authority_additions": [
    "Specific content showing industry authority (e.g., 'Recommended by leading AV professionals')"
  ],
  "trust_additions": [
    "Specific content building trust (e.g., '12-month warranty', 'Secure checkout', 'Official authorized dealer')"
  ]
}`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    let cleanJson = responseText.trim()
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const result = JSON.parse(cleanJson)

    await logToSquadMessages(
      'seo_agent',
      `E-E-A-T enhancements generated for ${productName}`,
      { action: 'eeat_enhance_complete', product: productName }
    )

    return result
  } catch (error: any) {
    await logToSquadMessages(
      'seo_agent',
      `E-E-A-T enhancement failed for ${productName}: ${error.message}`,
      { action: 'eeat_enhance_error', product: productName, error: error.message }
    )
    throw error
  }
}
