/**
 * SEO Agent Execution Handler
 *
 * Handles all SEO-related task execution including:
 * - Product SEO audits
 * - Schema.org compliance audits
 * - Core Web Vitals monitoring
 * - AI Search Optimization (GEO)
 * - SEO fix application
 */

import type { Task } from '@/types/squad'
import {
  auditProductsSEO,
  generateAndApplySEOFixes,
  storeAuditResults,
  auditSchemaCompliance,
  storeSchemaAuditResults
} from '@/services/agents/seo-agent'
import {
  measureCoreWebVitals,
  auditSiteVitals,
  storeVitalsResults
} from '@/services/agents/seo-vitals'
import {
  analyzeAISearchReadiness,
  batchAnalyzeGEO,
  storeGEOResults,
  optimizeContentForAI,
  generateEEATEnhancements
} from '@/services/agents/seo-geo'

const DRY_RUN = process.env.AGENT_DRY_RUN === 'true'

interface SEOTaskMetadata {
  action: string
  productIds?: number[]
  urls?: string[]
  limit?: number
  applyFixes?: boolean
  productName?: string
  content?: string
  category?: string
  targetKeywords?: string[]
}

interface ExecutionResult {
  success: boolean
  data?: any
  deliverable_url?: string
  error?: string
  tokens_used?: number
}

/**
 * Execute SEO task based on action type
 */
export async function seoHandler(task: Task): Promise<ExecutionResult> {
  console.log('[SEO HANDLER] Executing task:', task.title)

  const metadata = (task.metadata || {}) as SEOTaskMetadata
  const { action, productIds, urls, limit = 50, applyFixes = false } = metadata

  if (DRY_RUN) {
    console.log('[DRY RUN] Would execute SEO action:', action, metadata)
    return {
      success: true,
      deliverable_url: '/seo-audits/dry-run-preview',
      tokens_used: 0
    }
  }

  try {
    switch (action) {
      // ============================================
      // Product SEO Audits (Existing)
      // ============================================
      case 'audit_products': {
        const auditResult = await auditProductsSEO(productIds, limit)
        await storeAuditResults(auditResult.audits)
        return {
          success: true,
          data: auditResult,
          deliverable_url: '/dashboard/seo/audits',
          tokens_used: 1000
        }
      }

      case 'apply_fixes': {
        if (!productIds || productIds.length === 0) {
          return { success: false, error: 'No product IDs provided for apply_fixes' }
        }

        const fixResults = []
        for (const productId of productIds.slice(0, limit)) {
          try {
            const result = await generateAndApplySEOFixes(productId, applyFixes)
            fixResults.push(result)
          } catch (error: any) {
            console.error(`Failed to apply fixes for product ${productId}:`, error.message)
          }
        }

        return {
          success: true,
          data: {
            products_processed: fixResults.length,
            applied: applyFixes,
            results: fixResults
          },
          deliverable_url: '/dashboard/seo/fixes',
          tokens_used: 1500 * fixResults.length
        }
      }

      // ============================================
      // Schema.org Compliance (New)
      // ============================================
      case 'audit_schema': {
        const schemaResult = await auditSchemaCompliance(productIds, limit)
        await storeSchemaAuditResults(schemaResult.audits)
        return {
          success: true,
          data: schemaResult,
          deliverable_url: '/dashboard/seo/schema',
          tokens_used: 200 // Mostly HTML parsing, minimal LLM
        }
      }

      case 'generate_schema': {
        // Generate schemas for products without them
        const schemaAudit = await auditSchemaCompliance(productIds, limit)
        const productsWithoutSchema = schemaAudit.audits.filter(a => !a.has_product_schema)

        return {
          success: true,
          data: {
            total_audited: schemaAudit.audits.length,
            missing_schema: productsWithoutSchema.length,
            generated_schemas: productsWithoutSchema.map(a => ({
              product_id: a.product_id,
              url: a.url,
              schema: a.generated_schema
            }))
          },
          deliverable_url: '/dashboard/seo/schema',
          tokens_used: 500
        }
      }

      // ============================================
      // Core Web Vitals (New)
      // ============================================
      case 'check_vitals': {
        if (!urls || urls.length === 0) {
          return { success: false, error: 'No URLs provided for vitals check' }
        }

        const vitalsResult = await auditSiteVitals(urls, limit, productIds)
        await storeVitalsResults(vitalsResult.results)

        return {
          success: true,
          data: vitalsResult,
          deliverable_url: '/dashboard/seo/vitals',
          tokens_used: 50 // PageSpeed API only, no LLM
        }
      }

      case 'check_vitals_single': {
        if (!urls || urls.length === 0) {
          return { success: false, error: 'No URL provided for single vitals check' }
        }

        const singleVitals = await measureCoreWebVitals(urls[0], productIds?.[0])
        await storeVitalsResults([singleVitals])

        return {
          success: true,
          data: singleVitals,
          deliverable_url: '/dashboard/seo/vitals',
          tokens_used: 50
        }
      }

      // ============================================
      // AI Search Optimization - GEO (New)
      // ============================================
      case 'analyze_geo': {
        if (!urls || urls.length === 0) {
          return { success: false, error: 'No URLs provided for GEO analysis' }
        }

        const geoResult = await batchAnalyzeGEO(urls, productIds, limit)
        await storeGEOResults(geoResult.results)

        return {
          success: true,
          data: geoResult,
          deliverable_url: '/dashboard/seo/geo',
          tokens_used: 1200 * geoResult.results.length
        }
      }

      case 'analyze_geo_single': {
        if (!urls || urls.length === 0) {
          return { success: false, error: 'No URL provided for GEO analysis' }
        }

        const singleGeo = await analyzeAISearchReadiness(urls[0], productIds?.[0])
        await storeGEOResults([singleGeo])

        return {
          success: true,
          data: singleGeo,
          deliverable_url: '/dashboard/seo/geo',
          tokens_used: 1200
        }
      }

      case 'optimize_content': {
        const { content, productName, targetKeywords } = metadata

        if (!content || !productName) {
          return { success: false, error: 'Content and productName required for optimization' }
        }

        const optimized = await optimizeContentForAI(
          content,
          productName,
          targetKeywords || []
        )

        return {
          success: true,
          data: optimized,
          tokens_used: 1500
        }
      }

      case 'generate_eeat': {
        const { productName, content, category } = metadata

        if (!productName || !content) {
          return { success: false, error: 'productName and content required for E-E-A-T generation' }
        }

        const enhancements = await generateEEATEnhancements(
          productName,
          content,
          category || 'General'
        )

        return {
          success: true,
          data: enhancements,
          tokens_used: 1000
        }
      }

      // ============================================
      // Full Audit (Combined)
      // ============================================
      case 'full_audit': {
        const baseUrl = process.env.OPENCART_BASE_URL || 'https://audicoonline.co.za'

        // Run all audits in parallel where possible
        const [productsResult, schemaResult] = await Promise.all([
          auditProductsSEO(productIds, limit),
          auditSchemaCompliance(productIds, limit)
        ])

        // Store results
        await Promise.all([
          storeAuditResults(productsResult.audits),
          storeSchemaAuditResults(schemaResult.audits)
        ])

        // Run vitals if URLs provided or generate from products
        let vitalsResult = null
        if (urls && urls.length > 0) {
          vitalsResult = await auditSiteVitals(urls, Math.min(limit, 20))
          await storeVitalsResults(vitalsResult.results)
        } else if (productsResult.audits.length > 0) {
          // Generate URLs from products and check top 10
          const productUrls = productsResult.audits
            .slice(0, 10)
            .map(a => `${baseUrl}/index.php?route=product/product&product_id=${a.product_id}`)
          const productIdsForVitals = productsResult.audits.slice(0, 10).map(a => a.product_id)

          vitalsResult = await auditSiteVitals(productUrls, 10, productIdsForVitals)
          await storeVitalsResults(vitalsResult.results)
        }

        return {
          success: true,
          data: {
            products: productsResult,
            schemas: schemaResult,
            vitals: vitalsResult
          },
          deliverable_url: '/dashboard/seo',
          tokens_used: 2000
        }
      }

      default: {
        // Infer action from task title if metadata.action is missing
        const title = task.title.toLowerCase()
        if (title.includes('full audit') || title.includes('seo audit') || title.includes('critically low')) {
          const baseUrl = process.env.OPENCART_BASE_URL || 'https://audicoonline.co.za'
          const [productsResult, schemaResult] = await Promise.all([
            auditProductsSEO(productIds, limit),
            auditSchemaCompliance(productIds, limit)
          ])
          await Promise.all([
            storeAuditResults(productsResult.audits),
            storeSchemaAuditResults(schemaResult.audits)
          ])
          return {
            success: true,
            data: { products: productsResult, schemas: schemaResult },
            deliverable_url: '/dashboard/seo',
            tokens_used: 2000
          }
        }
        if (title.includes('schema')) {
          const schemaResult = await auditSchemaCompliance(productIds, limit)
          await storeSchemaAuditResults(schemaResult.audits)
          return {
            success: true,
            data: schemaResult,
            deliverable_url: '/dashboard/seo/schema',
            tokens_used: 200
          }
        }
        return { success: false, error: `Unknown SEO action: ${action}. Task title: ${task.title}` }
      }
    }
  } catch (error: any) {
    console.error('[SEO HANDLER] Error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
