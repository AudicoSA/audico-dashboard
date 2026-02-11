import { createClient } from '@supabase/supabase-js'
import { createConnection, Connection, RowDataPacket } from 'mysql2/promise'
import type {
  ProductSchemaLD,
  BreadcrumbListLD,
  DetectedSchema,
  SchemaAuditResult
} from './seo-types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface OpenCartProduct extends RowDataPacket {
  product_id: number
  model: string
  sku: string
  upc: string
  ean: string
  jan: string
  isbn: string
  mpn: string
  location: string
  quantity: number
  stock_status_id: number
  image: string
  manufacturer_id: number
  shipping: number
  price: number
  points: number
  tax_class_id: number
  date_available: Date
  weight: number
  weight_class_id: number
  length: number
  width: number
  height: number
  length_class_id: number
  subtract: number
  minimum: number
  sort_order: number
  status: number
  viewed: number
  date_added: Date
  date_modified: Date
}

interface OpenCartProductDescription extends RowDataPacket {
  product_id: number
  language_id: number
  name: string
  description: string
  tag: string
  meta_title: string
  meta_description: string
  meta_keyword: string
}

interface OpenCartProductImage extends RowDataPacket {
  product_image_id: number
  product_id: number
  image: string
  sort_order: number
}

interface AuditIssue {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  field: string
  message: string
  current_value?: string | null
}

interface AuditRecommendation {
  type: string
  priority: 'low' | 'medium' | 'high'
  action: string
  details: string
  suggested_content?: string
}

interface ProductAuditResult {
  product_id: number
  product_name: string
  sku: string
  issues: AuditIssue[]
  recommendations: AuditRecommendation[]
  score: number
  image_analysis?: ImageAnalysisResult
}

interface ImageAnalysisResult {
  url: string
  quality_score: number
  width?: number
  height?: number
  format?: string
  size_kb?: number
  issues: string[]
  recommendations: string[]
}

interface ClaudeResponse {
  content: string
  meta_title: string
  meta_description: string
  meta_keywords: string[]
}

async function connectToOpenCart(): Promise<Connection> {
  const connection = await createConnection({
    host: process.env.OPENCART_DB_HOST || 'localhost',
    port: parseInt(process.env.OPENCART_DB_PORT || '3306'),
    user: process.env.OPENCART_DB_USER,
    password: process.env.OPENCART_DB_PASSWORD,
    database: process.env.OPENCART_DB_NAME,
  })
  
  return connection
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

async function analyzeImageQuality(imageUrl: string): Promise<ImageAnalysisResult> {
  const issues: string[] = []
  const recommendations: string[] = []
  let quality_score = 100

  try {
    const apiUrl = process.env.IMAGE_ANALYSIS_API_URL
    const apiKey = process.env.IMAGE_ANALYSIS_API_KEY

    if (!apiUrl) {
      return {
        url: imageUrl,
        quality_score: 0,
        issues: ['Image analysis API not configured'],
        recommendations: ['Configure IMAGE_ANALYSIS_API_URL environment variable'],
      }
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { 'Authorization': `Bearer ${apiKey}` }),
      },
      body: JSON.stringify({ image_url: imageUrl }),
    })

    if (!response.ok) {
      throw new Error(`Image analysis API returned ${response.status}`)
    }

    const data = await response.json()

    const width = data.width || 0
    const height = data.height || 0
    const size_kb = data.size_kb || 0

    if (width < 800 || height < 800) {
      issues.push('Image resolution too low for e-commerce')
      recommendations.push('Use images at least 800x800px for better display')
      quality_score -= 30
    }

    if (size_kb > 500) {
      issues.push('Image file size too large')
      recommendations.push('Optimize image to reduce file size below 500KB')
      quality_score -= 20
    }

    if (data.format && !['jpg', 'jpeg', 'png', 'webp'].includes(data.format.toLowerCase())) {
      issues.push('Suboptimal image format')
      recommendations.push('Use JPG, PNG, or WebP format for better compatibility')
      quality_score -= 15
    }

    if (data.sharpness && data.sharpness < 0.5) {
      issues.push('Image appears blurry or low quality')
      recommendations.push('Use higher quality, sharper images')
      quality_score -= 25
    }

    return {
      url: imageUrl,
      quality_score: Math.max(0, quality_score),
      width,
      height,
      format: data.format,
      size_kb,
      issues,
      recommendations,
    }
  } catch (error: any) {
    return {
      url: imageUrl,
      quality_score: 50,
      issues: [`Failed to analyze image: ${error.message}`],
      recommendations: ['Manually verify image quality and format'],
    }
  }
}

async function generateSEOContent(
  productName: string,
  currentDescription: string,
  category: string,
  context: any
): Promise<ClaudeResponse> {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured')
    }

    const prompt = `You are an expert SEO copywriter for e-commerce products. Generate optimized content for the following product:

Product Name: ${productName}
Category: ${category}
Current Description: ${currentDescription || 'None'}
Additional Context: ${JSON.stringify(context)}

Please provide:
1. A compelling, SEO-optimized product description (200-300 words) that includes relevant keywords naturally
2. An engaging meta title (50-60 characters)
3. A compelling meta description (150-160 characters)
4. 5-8 relevant meta keywords

Format your response as JSON with the following structure:
{
  "content": "The full product description here",
  "meta_title": "The meta title here",
  "meta_description": "The meta description here",
  "meta_keywords": ["keyword1", "keyword2", ...]
}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    })

    if (!response.ok) {
      throw new Error(`Claude API returned ${response.status}: ${await response.text()}`)
    }

    const data = await response.json()
    const contentText = data.content[0].text

    const jsonMatch = contentText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Failed to parse JSON from Claude response')
    }

    const parsedContent = JSON.parse(jsonMatch[0])

    return {
      content: parsedContent.content,
      meta_title: parsedContent.meta_title,
      meta_description: parsedContent.meta_description,
      meta_keywords: parsedContent.meta_keywords,
    }
  } catch (error: any) {
    await logToSquadMessages(
      'seo_agent',
      `Failed to generate SEO content: ${error.message}`,
      { action: 'generate_seo_content_error', product: productName, error: error.message }
    )

    return {
      content: currentDescription || `High-quality ${productName} available now. Contact us for more details.`,
      meta_title: productName.substring(0, 60),
      meta_description: `Shop ${productName} at competitive prices. Quality products with fast delivery.`,
      meta_keywords: [productName.toLowerCase(), 'buy online', 'quality product'],
    }
  }
}

async function auditProduct(
  connection: Connection,
  product: OpenCartProduct,
  description: OpenCartProductDescription | null,
  images: OpenCartProductImage[]
): Promise<ProductAuditResult> {
  const issues: AuditIssue[] = []
  const recommendations: AuditRecommendation[] = []
  let score = 100

  if (!description) {
    issues.push({
      type: 'missing_description',
      severity: 'critical',
      field: 'product_description',
      message: 'Product has no description in any language',
    })
    recommendations.push({
      type: 'content',
      priority: 'high',
      action: 'Add product description',
      details: 'Create a comprehensive product description with SEO keywords',
    })
    score -= 40
  } else {
    if (!description.description || description.description.length < 100) {
      issues.push({
        type: 'short_description',
        severity: 'high',
        field: 'description',
        message: 'Product description is too short or missing',
        current_value: description.description,
      })
      recommendations.push({
        type: 'content',
        priority: 'high',
        action: 'Expand product description',
        details: 'Write a detailed description of at least 200 words with relevant keywords',
      })
      score -= 30
    }

    if (!description.meta_title || description.meta_title.length === 0) {
      issues.push({
        type: 'missing_meta_title',
        severity: 'high',
        field: 'meta_title',
        message: 'Meta title is missing',
      })
      recommendations.push({
        type: 'seo',
        priority: 'high',
        action: 'Add meta title',
        details: 'Create an engaging meta title (50-60 characters) with primary keywords',
      })
      score -= 15
    } else if (description.meta_title.length < 30 || description.meta_title.length > 60) {
      issues.push({
        type: 'suboptimal_meta_title',
        severity: 'medium',
        field: 'meta_title',
        message: 'Meta title length is not optimal (should be 50-60 characters)',
        current_value: description.meta_title,
      })
      recommendations.push({
        type: 'seo',
        priority: 'medium',
        action: 'Optimize meta title length',
        details: 'Adjust meta title to be between 50-60 characters for best SEO results',
      })
      score -= 10
    }

    if (!description.meta_description || description.meta_description.length === 0) {
      issues.push({
        type: 'missing_meta_description',
        severity: 'high',
        field: 'meta_description',
        message: 'Meta description is missing',
      })
      recommendations.push({
        type: 'seo',
        priority: 'high',
        action: 'Add meta description',
        details: 'Create a compelling meta description (150-160 characters) with call-to-action',
      })
      score -= 15
    } else if (description.meta_description.length < 120 || description.meta_description.length > 160) {
      issues.push({
        type: 'suboptimal_meta_description',
        severity: 'medium',
        field: 'meta_description',
        message: 'Meta description length is not optimal (should be 150-160 characters)',
        current_value: description.meta_description,
      })
      recommendations.push({
        type: 'seo',
        priority: 'medium',
        action: 'Optimize meta description length',
        details: 'Adjust meta description to be between 150-160 characters',
      })
      score -= 10
    }

    if (!description.meta_keyword || description.meta_keyword.length === 0) {
      issues.push({
        type: 'missing_meta_keywords',
        severity: 'medium',
        field: 'meta_keyword',
        message: 'Meta keywords are missing',
      })
      recommendations.push({
        type: 'seo',
        priority: 'medium',
        action: 'Add meta keywords',
        details: 'Add 5-8 relevant keywords for better categorization',
      })
      score -= 10
    }
  }

  if (!product.image || product.image.length === 0) {
    issues.push({
      type: 'missing_main_image',
      severity: 'critical',
      field: 'image',
      message: 'Product has no main image',
    })
    recommendations.push({
      type: 'media',
      priority: 'high',
      action: 'Add main product image',
      details: 'Upload a high-quality main product image (at least 800x800px)',
    })
    score -= 30
  }

  if (images.length === 0) {
    issues.push({
      type: 'no_additional_images',
      severity: 'medium',
      field: 'product_images',
      message: 'Product has no additional images',
    })
    recommendations.push({
      type: 'media',
      priority: 'medium',
      action: 'Add multiple product images',
      details: 'Add 3-5 additional images showing different angles and details',
    })
    score -= 15
  } else if (images.length < 3) {
    issues.push({
      type: 'few_images',
      severity: 'low',
      field: 'product_images',
      message: 'Product has fewer than 3 additional images',
      current_value: images.length.toString(),
    })
    recommendations.push({
      type: 'media',
      priority: 'low',
      action: 'Add more product images',
      details: 'Consider adding more images for better product presentation',
    })
    score -= 5
  }

  let imageAnalysis: ImageAnalysisResult | undefined

  if (product.image && product.image.length > 0) {
    const baseUrl = process.env.OPENCART_BASE_URL || ''
    const imageUrl = baseUrl + '/' + product.image
    imageAnalysis = await analyzeImageQuality(imageUrl)

    if (imageAnalysis.quality_score < 70) {
      issues.push({
        type: 'poor_image_quality',
        severity: imageAnalysis.quality_score < 40 ? 'high' : 'medium',
        field: 'image',
        message: `Main image quality score is low: ${imageAnalysis.quality_score}/100`,
      })
      recommendations.push({
        type: 'media',
        priority: imageAnalysis.quality_score < 40 ? 'high' : 'medium',
        action: 'Improve main image quality',
        details: imageAnalysis.recommendations.join('; '),
      })
      score -= Math.floor((100 - imageAnalysis.quality_score) / 5)
    }
  }

  return {
    product_id: product.product_id,
    product_name: description?.name || `Product ${product.product_id}`,
    sku: product.sku,
    issues,
    recommendations,
    score: Math.max(0, score),
    image_analysis: imageAnalysis,
  }
}

export async function auditProductsSEO(
  productIds?: number[],
  limit: number = 100
): Promise<{
  audits: ProductAuditResult[]
  summary: {
    total_audited: number
    average_score: number
    critical_issues: number
    high_issues: number
    medium_issues: number
    low_issues: number
  }
}> {
  let connection: Connection | null = null

  try {
    await logToSquadMessages(
      'seo_agent',
      'Starting SEO audit for OpenCart products',
      { action: 'audit_start', product_ids: productIds, limit }
    )

    connection = await connectToOpenCart()

    let productsQuery = 'SELECT * FROM oc_product WHERE status = 1'
    const queryParams: any[] = []

    if (productIds && productIds.length > 0) {
      productsQuery += ` AND product_id IN (${productIds.map(() => '?').join(',')})`
      queryParams.push(...productIds)
    }

    productsQuery += ' LIMIT ?'
    queryParams.push(limit)

    const [products] = await connection.execute<OpenCartProduct[]>(productsQuery, queryParams)

    const audits: ProductAuditResult[] = []

    for (const product of products) {
      const [descriptions] = await connection.execute<OpenCartProductDescription[]>(
        'SELECT * FROM oc_product_description WHERE product_id = ? AND language_id = 1',
        [product.product_id]
      )

      const [images] = await connection.execute<OpenCartProductImage[]>(
        'SELECT * FROM oc_product_image WHERE product_id = ? ORDER BY sort_order',
        [product.product_id]
      )

      const auditResult = await auditProduct(
        connection,
        product,
        descriptions[0] || null,
        images
      )

      audits.push(auditResult)
    }

    const summary = {
      total_audited: audits.length,
      average_score: audits.length > 0 
        ? Math.round(audits.reduce((sum, a) => sum + a.score, 0) / audits.length) 
        : 0,
      critical_issues: audits.reduce((sum, a) => sum + a.issues.filter(i => i.severity === 'critical').length, 0),
      high_issues: audits.reduce((sum, a) => sum + a.issues.filter(i => i.severity === 'high').length, 0),
      medium_issues: audits.reduce((sum, a) => sum + a.issues.filter(i => i.severity === 'medium').length, 0),
      low_issues: audits.reduce((sum, a) => sum + a.issues.filter(i => i.severity === 'low').length, 0),
    }

    await logToSquadMessages(
      'seo_agent',
      `SEO audit completed: ${audits.length} products audited`,
      { action: 'audit_complete', summary }
    )

    return { audits, summary }
  } catch (error: any) {
    await logToSquadMessages(
      'seo_agent',
      `SEO audit failed: ${error.message}`,
      { action: 'audit_error', error: error.message }
    )
    throw error
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}

export async function storeAuditResults(
  auditResults: ProductAuditResult[],
  auditType: 'full_site' | 'page' | 'technical' | 'content' = 'content'
): Promise<string[]> {
  const auditIds: string[] = []

  try {
    for (const result of auditResults) {
      const baseUrl = process.env.OPENCART_BASE_URL || ''
      const productUrl = `${baseUrl}/index.php?route=product/product&product_id=${result.product_id}`

      const { data, error } = await supabase
        .from('seo_audits')
        .insert({
          url: productUrl,
          audit_type: auditType,
          status: 'completed',
          score: result.score,
          issues_found: result.issues,
          recommendations: result.recommendations,
          metrics: {
            product_id: result.product_id,
            product_name: result.product_name,
            sku: result.sku,
            image_analysis: result.image_analysis,
            issues_by_severity: {
              critical: result.issues.filter(i => i.severity === 'critical').length,
              high: result.issues.filter(i => i.severity === 'high').length,
              medium: result.issues.filter(i => i.severity === 'medium').length,
              low: result.issues.filter(i => i.severity === 'low').length,
            },
          },
          performed_by: 'seo_agent',
          completed_at: new Date().toISOString(),
          metadata: {
            audit_timestamp: new Date().toISOString(),
          },
        })
        .select()
        .single()

      if (error) {
        await logToSquadMessages(
          'seo_agent',
          `Failed to store audit result for product ${result.product_id}: ${error.message}`,
          { action: 'store_audit_error', product_id: result.product_id, error: error.message }
        )
      } else if (data) {
        auditIds.push(data.id)
      }
    }

    await logToSquadMessages(
      'seo_agent',
      `Stored ${auditIds.length} audit results in database`,
      { action: 'store_audits_complete', audit_ids: auditIds }
    )

    return auditIds
  } catch (error: any) {
    await logToSquadMessages(
      'seo_agent',
      `Failed to store audit results: ${error.message}`,
      { action: 'store_audits_error', error: error.message }
    )
    throw error
  }
}

export async function generateAndApplySEOFixes(
  productId: number,
  applyFixes: boolean = false
): Promise<{
  product_id: number
  generated_content: ClaudeResponse
  applied: boolean
  audit_result?: ProductAuditResult
}> {
  let connection: Connection | null = null

  try {
    await logToSquadMessages(
      'seo_agent',
      `Generating SEO fixes for product ${productId}`,
      { action: 'generate_fixes_start', product_id: productId, apply_fixes: applyFixes }
    )

    connection = await connectToOpenCart()

    const [products] = await connection.execute<OpenCartProduct[]>(
      'SELECT * FROM oc_product WHERE product_id = ?',
      [productId]
    )

    if (products.length === 0) {
      throw new Error(`Product ${productId} not found`)
    }

    const product = products[0]

    const [descriptions] = await connection.execute<OpenCartProductDescription[]>(
      'SELECT * FROM oc_product_description WHERE product_id = ? AND language_id = 1',
      [productId]
    )

    const description = descriptions[0] || null

    const [categoryResult] = await connection.execute<RowDataPacket[]>(
      `SELECT c.name 
       FROM oc_category_description c
       INNER JOIN oc_product_to_category pc ON c.category_id = pc.category_id
       WHERE pc.product_id = ? AND c.language_id = 1
       LIMIT 1`,
      [productId]
    )

    const category = categoryResult.length > 0 ? categoryResult[0].name : 'General'

    const context = {
      sku: product.sku,
      price: product.price,
      category,
      current_meta_title: description?.meta_title,
      current_meta_description: description?.meta_description,
    }

    const generatedContent = await generateSEOContent(
      description?.name || `Product ${productId}`,
      description?.description || '',
      category,
      context
    )

    let applied = false

    if (applyFixes && description) {
      await connection.execute(
        `UPDATE oc_product_description 
         SET description = ?,
             meta_title = ?,
             meta_description = ?,
             meta_keyword = ?
         WHERE product_id = ? AND language_id = 1`,
        [
          generatedContent.content,
          generatedContent.meta_title,
          generatedContent.meta_description,
          generatedContent.meta_keywords.join(', '),
          productId,
        ]
      )

      applied = true

      await logToSquadMessages(
        'seo_agent',
        `Applied SEO fixes to product ${productId}`,
        { action: 'apply_fixes_complete', product_id: productId }
      )
    }

    const [images] = await connection.execute<OpenCartProductImage[]>(
      'SELECT * FROM oc_product_image WHERE product_id = ?',
      [productId]
    )

    const [updatedDescriptions] = await connection.execute<OpenCartProductDescription[]>(
      'SELECT * FROM oc_product_description WHERE product_id = ? AND language_id = 1',
      [productId]
    )

    const auditResult = await auditProduct(
      connection,
      product,
      updatedDescriptions[0] || null,
      images
    )

    return {
      product_id: productId,
      generated_content: generatedContent,
      applied,
      audit_result: auditResult,
    }
  } catch (error: any) {
    await logToSquadMessages(
      'seo_agent',
      `Failed to generate SEO fixes: ${error.message}`,
      { action: 'generate_fixes_error', product_id: productId, error: error.message }
    )
    throw error
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}

export async function runFullSEOAudit(
  productIds?: number[],
  limit: number = 100,
  storeResults: boolean = true
): Promise<{
  audits: ProductAuditResult[]
  summary: any
  stored_audit_ids?: string[]
}> {
  const { audits, summary } = await auditProductsSEO(productIds, limit)

  let stored_audit_ids: string[] | undefined

  if (storeResults) {
    stored_audit_ids = await storeAuditResults(audits)
  }

  return {
    audits,
    summary,
    stored_audit_ids,
  }
}

// ============================================
// Schema.org Markup Functions
// ============================================

/**
 * Get manufacturer name from OpenCart by ID
 */
async function getManufacturerName(manufacturerId: number): Promise<string | undefined> {
  let connection: Connection | null = null
  try {
    connection = await connectToOpenCart()
    const [rows] = await connection.execute<RowDataPacket[]>(
      'SELECT name FROM oc_manufacturer WHERE manufacturer_id = ?',
      [manufacturerId]
    )
    return rows.length > 0 ? rows[0].name : undefined
  } catch {
    return undefined
  } finally {
    if (connection) await connection.end()
  }
}

/**
 * Get product reviews summary from OpenCart
 */
async function getProductReviews(productId: number): Promise<{ rating: number; count: number } | undefined> {
  let connection: Connection | null = null
  try {
    connection = await connectToOpenCart()
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT AVG(rating) as avg_rating, COUNT(*) as count
       FROM oc_review
       WHERE product_id = ? AND status = 1`,
      [productId]
    )
    if (rows.length > 0 && rows[0].count > 0) {
      return {
        rating: Math.round(rows[0].avg_rating * 10) / 10,
        count: rows[0].count
      }
    }
    return undefined
  } catch {
    return undefined
  } finally {
    if (connection) await connection.end()
  }
}

/**
 * Get category path for a product (for breadcrumbs)
 */
async function getCategoryPath(productId: number): Promise<Array<{ name: string; url: string }>> {
  let connection: Connection | null = null
  const baseUrl = process.env.OPENCART_BASE_URL || 'https://audicoonline.co.za'

  try {
    connection = await connectToOpenCart()
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT cd.name, c.category_id, cp.path_id
       FROM oc_product_to_category ptc
       JOIN oc_category_path cp ON ptc.category_id = cp.category_id
       JOIN oc_category c ON cp.path_id = c.category_id
       JOIN oc_category_description cd ON c.category_id = cd.category_id AND cd.language_id = 1
       WHERE ptc.product_id = ?
       ORDER BY cp.level ASC`,
      [productId]
    )

    return rows.map(row => ({
      name: row.name,
      url: `${baseUrl}/index.php?route=product/category&path=${row.category_id}`
    }))
  } catch {
    return []
  } finally {
    if (connection) await connection.end()
  }
}

/**
 * Detect existing Schema.org markup on a page
 */
export async function detectSchemaMarkup(url: string): Promise<DetectedSchema[]> {
  const detectedSchemas: DetectedSchema[] = []

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Audico SEO Agent/1.0'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const html = await response.text()

    // 1. Detect JSON-LD schemas
    const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    let match

    while ((match = jsonLdRegex.exec(html)) !== null) {
      try {
        const schemaData = JSON.parse(match[1].trim())
        const schemas = Array.isArray(schemaData) ? schemaData : [schemaData]

        for (const schema of schemas) {
          const type = schema['@type'] || 'Unknown'
          const errors = validateSchema(schema)

          detectedSchemas.push({
            type,
            format: 'JSON-LD',
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
            data: schema
          })
        }
      } catch (parseError) {
        detectedSchemas.push({
          type: 'Invalid',
          format: 'JSON-LD',
          valid: false,
          errors: ['Failed to parse JSON-LD: ' + (parseError as Error).message]
        })
      }
    }

    // 2. Detect Microdata
    const hasProductMicrodata = html.includes('itemtype="https://schema.org/Product"') ||
                                html.includes('itemtype="http://schema.org/Product"')
    const hasBreadcrumbMicrodata = html.includes('itemtype="https://schema.org/BreadcrumbList"') ||
                                   html.includes('itemtype="http://schema.org/BreadcrumbList"')

    if (hasProductMicrodata) {
      detectedSchemas.push({
        type: 'Product',
        format: 'Microdata',
        valid: true,
        errors: undefined
      })
    }

    if (hasBreadcrumbMicrodata) {
      detectedSchemas.push({
        type: 'BreadcrumbList',
        format: 'Microdata',
        valid: true,
        errors: undefined
      })
    }

    return detectedSchemas
  } catch (error: any) {
    await logToSquadMessages(
      'seo_agent',
      `Failed to detect schema markup for ${url}: ${error.message}`,
      { action: 'detect_schema_error', url, error: error.message }
    )
    return []
  }
}

/**
 * Validate a schema object for required fields
 */
function validateSchema(schema: Record<string, any>): string[] {
  const errors: string[] = []
  const type = schema['@type']

  if (!type) {
    errors.push('Missing @type property')
    return errors
  }

  if (type === 'Product') {
    if (!schema.name) errors.push('Product: missing name')
    if (!schema.description) errors.push('Product: missing description')
    if (!schema.offers) errors.push('Product: missing offers')
    if (schema.offers && !schema.offers.price) errors.push('Product: offers missing price')
    if (schema.offers && !schema.offers.availability) errors.push('Product: offers missing availability')
  }

  if (type === 'BreadcrumbList') {
    if (!schema.itemListElement || schema.itemListElement.length === 0) {
      errors.push('BreadcrumbList: missing itemListElement')
    }
  }

  return errors
}

/**
 * Generate Product JSON-LD schema from OpenCart data
 */
export async function generateProductSchema(
  product: OpenCartProduct,
  description: OpenCartProductDescription,
  images: OpenCartProductImage[],
  reviews?: { rating: number; count: number }
): Promise<ProductSchemaLD> {
  const baseUrl = process.env.OPENCART_BASE_URL || 'https://audicoonline.co.za'

  let brandName: string | undefined
  if (product.manufacturer_id) {
    brandName = await getManufacturerName(product.manufacturer_id)
  }

  // Clean description HTML
  const cleanDescription = description.description
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 500)

  // Build image URLs
  const imageUrls: string[] = []
  if (product.image) {
    imageUrls.push(`${baseUrl}/image/${product.image}`)
  }
  for (const img of images.slice(0, 5)) {
    imageUrls.push(`${baseUrl}/image/${img.image}`)
  }

  const schema: ProductSchemaLD = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: description.name,
    description: cleanDescription || `High-quality ${description.name} available at Audico Online`,
    image: imageUrls,
    sku: product.sku || product.model,
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "ZAR",
      availability: product.quantity > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: `${baseUrl}/index.php?route=product/product&product_id=${product.product_id}`
    }
  }

  // Add optional fields
  if (product.mpn) {
    schema.mpn = product.mpn
  }

  if (brandName) {
    schema.brand = {
      "@type": "Brand",
      name: brandName
    }
  }

  if (reviews && reviews.count > 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: reviews.rating,
      reviewCount: reviews.count
    }
  }

  return schema
}

/**
 * Generate Breadcrumb JSON-LD schema from category path
 */
export function generateBreadcrumbSchema(
  categoryPath: Array<{ name: string; url: string }>
): BreadcrumbListLD {
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

/**
 * Audit schema compliance for products
 */
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
  let connection: Connection | null = null
  const audits: SchemaAuditResult[] = []
  const baseUrl = process.env.OPENCART_BASE_URL || 'https://audicoonline.co.za'

  try {
    await logToSquadMessages(
      'seo_agent',
      'Starting schema compliance audit',
      { action: 'schema_audit_start', product_ids: productIds, limit }
    )

    connection = await connectToOpenCart()

    // Get products to audit
    let productsQuery = 'SELECT * FROM oc_product WHERE status = 1'
    const queryParams: any[] = []

    if (productIds && productIds.length > 0) {
      productsQuery += ` AND product_id IN (${productIds.map(() => '?').join(',')})`
      queryParams.push(...productIds)
    }

    productsQuery += ' LIMIT ?'
    queryParams.push(limit)

    const [products] = await connection.execute<OpenCartProduct[]>(productsQuery, queryParams)

    for (const product of products) {
      const productUrl = `${baseUrl}/index.php?route=product/product&product_id=${product.product_id}`

      // Get product description and images
      const [descriptions] = await connection.execute<OpenCartProductDescription[]>(
        'SELECT * FROM oc_product_description WHERE product_id = ? AND language_id = 1',
        [product.product_id]
      )

      const [images] = await connection.execute<OpenCartProductImage[]>(
        'SELECT * FROM oc_product_image WHERE product_id = ? ORDER BY sort_order LIMIT 5',
        [product.product_id]
      )

      const description = descriptions[0] || null

      // Detect existing schemas on the page
      const detectedSchemas = await detectSchemaMarkup(productUrl)

      const hasProductSchema = detectedSchemas.some(s => s.type === 'Product')
      const hasBreadcrumbSchema = detectedSchemas.some(s => s.type === 'BreadcrumbList')
      const hasOrganizationSchema = detectedSchemas.some(s => s.type === 'Organization')
      const hasReviewSchema = detectedSchemas.some(s => s.type === 'AggregateRating' || s.type === 'Review')

      const missingFields: string[] = []
      const validationErrors: string[] = []
      const recommendations: string[] = []

      // Collect validation errors
      for (const schema of detectedSchemas) {
        if (schema.errors) {
          validationErrors.push(...schema.errors)
        }
      }

      // Generate recommendations
      if (!hasProductSchema) {
        recommendations.push('Add Product JSON-LD schema for rich snippets in Google search results')
        missingFields.push('Product schema')
      }

      if (!hasBreadcrumbSchema) {
        recommendations.push('Add BreadcrumbList schema for improved navigation in search results')
        missingFields.push('Breadcrumb schema')
      }

      // Generate schema if missing
      let generatedSchema: ProductSchemaLD | undefined
      if (!hasProductSchema && description) {
        const reviews = await getProductReviews(product.product_id)
        generatedSchema = await generateProductSchema(product, description, images, reviews)
      }

      audits.push({
        product_id: product.product_id,
        url: productUrl,
        has_product_schema: hasProductSchema,
        has_breadcrumb_schema: hasBreadcrumbSchema,
        has_organization_schema: hasOrganizationSchema,
        has_review_schema: hasReviewSchema,
        detected_schemas: detectedSchemas,
        missing_required_fields: missingFields,
        validation_errors: validationErrors,
        generated_schema: generatedSchema,
        recommendations,
        audited_at: new Date()
      })
    }

    const summary = {
      total: audits.length,
      with_schema: audits.filter(a => a.has_product_schema).length,
      without_schema: audits.filter(a => !a.has_product_schema).length,
      with_errors: audits.filter(a => a.validation_errors.length > 0).length
    }

    await logToSquadMessages(
      'seo_agent',
      `Schema compliance audit completed: ${summary.total} products audited`,
      { action: 'schema_audit_complete', summary }
    )

    return { audits, summary }
  } catch (error: any) {
    await logToSquadMessages(
      'seo_agent',
      `Schema compliance audit failed: ${error.message}`,
      { action: 'schema_audit_error', error: error.message }
    )
    throw error
  } finally {
    if (connection) await connection.end()
  }
}

/**
 * Store schema audit results to Supabase
 */
export async function storeSchemaAuditResults(audits: SchemaAuditResult[]): Promise<string[]> {
  const auditIds: string[] = []

  try {
    for (const audit of audits) {
      const { data, error } = await supabase
        .from('seo_schema_audits')
        .insert({
          url: audit.url,
          product_id: audit.product_id,
          has_product_schema: audit.has_product_schema,
          has_breadcrumb_schema: audit.has_breadcrumb_schema,
          has_organization_schema: audit.has_organization_schema,
          has_review_schema: audit.has_review_schema,
          detected_schemas: audit.detected_schemas,
          missing_required_fields: audit.missing_required_fields,
          validation_errors: audit.validation_errors,
          generated_schema: audit.generated_schema
        })
        .select('id')
        .single()

      if (error) {
        console.error(`Failed to store schema audit for product ${audit.product_id}:`, error.message)
      } else if (data) {
        auditIds.push(data.id)
      }
    }

    await logToSquadMessages(
      'seo_agent',
      `Stored ${auditIds.length} schema audit results`,
      { action: 'store_schema_audits_complete', audit_ids: auditIds }
    )

    return auditIds
  } catch (error: any) {
    await logToSquadMessages(
      'seo_agent',
      `Failed to store schema audit results: ${error.message}`,
      { action: 'store_schema_audits_error', error: error.message }
    )
    throw error
  }
}
