import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { auditProductsSEO, generateAndApplySEOFixes, storeAuditResults } from '@/services/agents/seo-agent'
import { mockSupabase } from '../../mocks/supabase'
import { mockMySQL, createMockMySQLConnection } from '../../mocks/mysql'
import { mockAnthropicAPI } from '../../mocks/anthropic'
import {
  mockOpenCartProducts,
  mockOpenCartProductDescriptions,
  mockOpenCartProductImages,
  mockSEOAuditResults
} from '../../fixtures/opencart-data'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase)
}))

vi.mock('mysql2/promise', () => ({
  createConnection: mockMySQL.createConnection
}))

describe('SEO Agent Integration Tests', () => {
  let mockConnection: ReturnType<typeof createMockMySQLConnection>

  beforeEach(() => {
    mockSupabase._clearMockData()
    mockAnthropicAPI.clearAll()

    mockConnection = createMockMySQLConnection()
    mockConnection.setTableData('oc_product', mockOpenCartProducts)
    mockConnection.setTableData('oc_product_description', mockOpenCartProductDescriptions)
    mockConnection.setTableData('oc_product_image', mockOpenCartProductImages)

    mockMySQL.createConnection.mockResolvedValue(mockConnection)

    mockAnthropicAPI.setDefaultResponse(JSON.stringify({
      content: 'This is a comprehensive SEO-optimized product description for the Smart LED Light Bulb. ' +
        'With WiFi connectivity and advanced features, this bulb transforms your home into a smart living space. ' +
        'Control lighting from anywhere, set schedules, and enjoy energy-efficient illumination.',
      meta_title: 'Smart LED Light Bulb - WiFi Enabled Home Automation',
      meta_description: 'Transform your home with our smart LED bulb featuring WiFi control, scheduling, and energy efficiency. Easy setup and compatible with all smart home systems.',
      meta_keywords: ['smart led bulb', 'wifi light bulb', 'home automation', 'smart lighting', 'energy efficient']
    }))

    process.env.OPENCART_BASE_URL = 'https://test.example.com'
    process.env.ANTHROPIC_API_KEY = 'test-key'
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('auditProductsSEO', () => {
    it('should audit multiple products and return results', async () => {
      const result = await auditProductsSEO(undefined, 10)

      expect(result).toBeDefined()
      expect(result.audits).toBeDefined()
      expect(Array.isArray(result.audits)).toBe(true)
      expect(result.summary).toBeDefined()
      expect(result.summary.total_audited).toBeGreaterThan(0)
    })

    it('should identify missing meta titles', async () => {
      const result = await auditProductsSEO([1], 1)

      expect(result.audits.length).toBe(1)
      const audit = result.audits[0]
      
      const metaTitleIssue = audit.issues.find(i => 
        i.type === 'missing_meta_title'
      )

      expect(metaTitleIssue).toBeDefined()
      expect(metaTitleIssue?.severity).toBe('high')
    })

    it('should identify short descriptions', async () => {
      const result = await auditProductsSEO([1], 1)

      const audit = result.audits[0]
      const descriptionIssue = audit.issues.find(i => 
        i.type === 'short_description'
      )

      expect(descriptionIssue).toBeDefined()
    })

    it('should identify missing images', async () => {
      const result = await auditProductsSEO([3], 1)

      const audit = result.audits[0]
      const imageIssue = audit.issues.find(i => 
        i.type === 'missing_main_image'
      )

      expect(imageIssue).toBeDefined()
      expect(imageIssue?.severity).toBe('critical')
    })

    it('should calculate audit scores correctly', async () => {
      const result = await auditProductsSEO([1, 2, 3], 3)

      expect(result.summary.average_score).toBeDefined()
      expect(result.summary.average_score).toBeGreaterThanOrEqual(0)
      expect(result.summary.average_score).toBeLessThanOrEqual(100)
    })

    it('should categorize issues by severity', async () => {
      const result = await auditProductsSEO(undefined, 10)

      expect(result.summary.critical_issues).toBeGreaterThanOrEqual(0)
      expect(result.summary.high_issues).toBeGreaterThanOrEqual(0)
      expect(result.summary.medium_issues).toBeGreaterThanOrEqual(0)
      expect(result.summary.low_issues).toBeGreaterThanOrEqual(0)
    })
  })

  describe('generateAndApplySEOFixes', () => {
    it('should generate SEO content using Claude', async () => {
      const result = await generateAndApplySEOFixes(1, false)

      expect(result).toBeDefined()
      expect(result.product_id).toBe(1)
      expect(result.generated_content).toBeDefined()
      expect(result.generated_content.content).toBeDefined()
      expect(result.generated_content.meta_title).toBeDefined()
      expect(result.generated_content.meta_description).toBeDefined()
      expect(result.generated_content.meta_keywords).toBeDefined()
      expect(Array.isArray(result.generated_content.meta_keywords)).toBe(true)
    })

    it('should apply fixes when requested', async () => {
      const result = await generateAndApplySEOFixes(1, true)

      expect(result.applied).toBe(true)

      const queryHistory = mockConnection.getQueryHistory()
      const updateQuery = queryHistory.find(q => 
        q.query.toLowerCase().includes('update') &&
        q.query.toLowerCase().includes('oc_product_description')
      )

      expect(updateQuery).toBeDefined()
    })

    it('should not apply fixes when not requested', async () => {
      const result = await generateAndApplySEOFixes(1, false)

      expect(result.applied).toBe(false)
    })

    it('should include audit result after generation', async () => {
      const result = await generateAndApplySEOFixes(1, false)

      expect(result.audit_result).toBeDefined()
      expect(result.audit_result?.product_id).toBe(1)
      expect(result.audit_result?.score).toBeGreaterThanOrEqual(0)
    })
  })

  describe('storeAuditResults', () => {
    it('should store audit results in database', async () => {
      const auditIds = await storeAuditResults(
        mockSEOAuditResults,
        'content'
      )

      expect(auditIds).toBeDefined()
      expect(Array.isArray(auditIds)).toBe(true)
      expect(auditIds.length).toBe(mockSEOAuditResults.length)

      const audits = mockSupabase._getMockData('seo_audits')
      expect(audits.length).toBeGreaterThan(0)
    })

    it('should store correct audit metadata', async () => {
      await storeAuditResults(mockSEOAuditResults, 'content')

      const audits = mockSupabase._getMockData('seo_audits')
      const audit = audits[0]

      expect(audit.audit_type).toBe('content')
      expect(audit.status).toBe('completed')
      expect(audit.performed_by).toBe('seo_agent')
      expect(audit.metrics).toBeDefined()
      expect(audit.metrics.product_id).toBeDefined()
    })

    it('should log activity for stored audits', async () => {
      await storeAuditResults(mockSEOAuditResults, 'content')

      const messages = mockSupabase._getMockData('squad_messages')
      const storeMessage = messages.find(m => 
        m.data?.action === 'store_audits_complete'
      )

      expect(storeMessage).toBeDefined()
    })
  })

  describe('end-to-end SEO workflow', () => {
    it('should complete full audit and fix workflow', async () => {
      const auditResult = await auditProductsSEO([1], 1)
      expect(auditResult.audits.length).toBe(1)

      const auditIds = await storeAuditResults(
        auditResult.audits,
        'content'
      )
      expect(auditIds.length).toBe(1)

      const fixResult = await generateAndApplySEOFixes(1, true)
      expect(fixResult.applied).toBe(true)

      const finalAudit = await auditProductsSEO([1], 1)
      expect(finalAudit.audits[0].score).toBeGreaterThanOrEqual(
        auditResult.audits[0].score
      )
    })
  })
})
