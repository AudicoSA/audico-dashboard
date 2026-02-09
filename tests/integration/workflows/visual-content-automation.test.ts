import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  generateWeeklySocialVisuals,
  generateMonthlyNewsletterAssets,
  generateResellerOnboardingKit
} from '@/services/workflows/visual-content-automation'
import { mockSupabase } from '../../mocks/supabase'
import { mockNotebookLM } from '../../mocks/notebooklm'
import { testSocialPosts, testApprovedResellers } from '../../fixtures/test-data'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase)
}))

vi.mock('@/services/integrations/notebooklm-service', () => ({
  default: vi.fn(() => mockNotebookLM)
}))

describe('Visual Content Automation Workflow Tests', () => {
  beforeEach(() => {
    mockSupabase._clearMockData()
    mockNotebookLM.clearAll()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('generateWeeklySocialVisuals', () => {
    it('should identify posts needing visuals', async () => {
      const upcomingPosts = [
        {
          ...testSocialPosts[0],
          status: 'scheduled',
          scheduled_for: new Date(Date.now() + 86400000 * 2).toISOString(),
          visual_content_url: null
        },
        {
          ...testSocialPosts[1],
          status: 'scheduled',
          scheduled_for: new Date(Date.now() + 86400000 * 3).toISOString(),
          visual_content_url: null
        }
      ]

      mockSupabase._setMockData('social_posts', upcomingPosts)

      const result = await generateWeeklySocialVisuals()

      expect(result).toBeDefined()
      expect(result.posts_processed).toBeGreaterThan(0)
      expect(result.visuals_generated).toBeGreaterThan(0)
    })

    it('should skip posts that already have visuals', async () => {
      const postsWithVisuals = [
        {
          ...testSocialPosts[0],
          status: 'scheduled',
          scheduled_for: new Date(Date.now() + 86400000).toISOString(),
          visual_content_url: 'https://example.com/visual.png'
        }
      ]

      mockSupabase._setMockData('social_posts', postsWithVisuals)

      const result = await generateWeeklySocialVisuals()

      expect(result.posts_processed).toBe(0)
    })

    it('should generate platform-optimized visuals', async () => {
      const posts = [
        {
          id: 'post-fb',
          platform: 'facebook',
          status: 'scheduled',
          scheduled_for: new Date(Date.now() + 86400000).toISOString(),
          content: 'Test post',
          metadata: { target_keywords: ['smart home'] },
          visual_content_url: null
        },
        {
          id: 'post-ig',
          platform: 'instagram',
          status: 'scheduled',
          scheduled_for: new Date(Date.now() + 86400000 * 2).toISOString(),
          content: 'Test post',
          metadata: { target_keywords: ['tech'] },
          visual_content_url: null
        }
      ]

      mockSupabase._setMockData('social_posts', posts)

      const result = await generateWeeklySocialVisuals()

      expect(result.visuals_generated).toBe(2)
    })
  })

  describe('generateMonthlyNewsletterAssets', () => {
    it('should generate assets for newsletter campaigns', async () => {
      mockSupabase._setMockData('newsletter_drafts', [
        {
          id: 'newsletter-1',
          title: 'Monthly Newsletter',
          subject_line: 'Tech Updates',
          status: 'draft',
          metadata: {}
        }
      ])

      mockSupabase._setMockData('seo_audits', [
        {
          status: 'completed',
          metrics: {
            keywords: ['smart home', 'automation']
          }
        }
      ])

      mockSupabase._setMockData('products', [
        {
          id: 'prod-1',
          name: 'Test Product',
          price: 99.99,
          cost: 50.00
        }
      ])

      const result = await generateMonthlyNewsletterAssets()

      expect(result).toBeDefined()
      expect(result.newsletter_assets_generated).toBeGreaterThan(0)
    })

    it('should create slide deck and infographic', async () => {
      mockSupabase._setMockData('newsletter_drafts', [
        {
          id: 'newsletter-2',
          title: 'Newsletter',
          subject_line: 'Updates',
          status: 'draft',
          metadata: {}
        }
      ])

      await generateMonthlyNewsletterAssets()

      const artifacts = mockSupabase._getMockData('notebooklm_artifacts')
      
      const slideArtifact = artifacts.find(a => a.artifact_type === 'slide_deck')
      const infographicArtifact = artifacts.find(a => a.artifact_type === 'infographic')

      expect(slideArtifact).toBeDefined()
      expect(infographicArtifact).toBeDefined()
    })
  })

  describe('generateResellerOnboardingKit', () => {
    it('should generate onboarding kit for reseller', async () => {
      mockSupabase._setMockData('approved_resellers', [
        testApprovedResellers[0]
      ])

      mockSupabase._setMockData('products', [
        {
          id: 'prod-1',
          name: 'Product 1',
          price: 100,
          cost: 60,
          category: 'Electronics'
        }
      ])

      const result = await generateResellerOnboardingKit('reseller-1')

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(result.reseller_id).toBe('reseller-1')
    })

    it('should create personalized slide deck', async () => {
      mockSupabase._setMockData('approved_resellers', [
        {
          ...testApprovedResellers[0],
          discount_tier: 'premium',
          commission_rate: 12
        }
      ])

      mockSupabase._setMockData('products', [])

      await generateResellerOnboardingKit('reseller-1')

      const notebooks = mockSupabase._getMockData('notebooklm_notebooks')
      expect(notebooks.length).toBeGreaterThan(0)

      const notebook = notebooks[0]
      expect(notebook.name).toContain(testApprovedResellers[0].company_name)
    })

    it('should include order history in kit', async () => {
      mockSupabase._setMockData('approved_resellers', [
        testApprovedResellers[0]
      ])

      mockSupabase._setMockData('reseller_orders', [
        {
          id: 'order-1',
          reseller_id: 'reseller-1',
          status: 'completed',
          items: [{ product_id: 'prod-1', quantity: 10 }],
          order_date: new Date().toISOString()
        }
      ])

      mockSupabase._setMockData('products', [
        {
          id: 'prod-1',
          name: 'Product 1',
          price: 100,
          cost: 60
        }
      ])

      const result = await generateResellerOnboardingKit('reseller-1')

      expect(result.success).toBe(true)
    })

    it('should handle reseller not found', async () => {
      mockSupabase._setMockData('approved_resellers', [])

      await expect(
        generateResellerOnboardingKit('nonexistent-reseller')
      ).rejects.toThrow('Approved reseller not found')
    })
  })

  describe('workflow error handling', () => {
    it('should handle NotebookLM failures gracefully', async () => {
      mockSupabase._setMockData('social_posts', [
        {
          id: 'post-error',
          platform: 'facebook',
          status: 'scheduled',
          scheduled_for: new Date(Date.now() + 86400000).toISOString(),
          content: 'Test',
          metadata: {},
          visual_content_url: null
        }
      ])

      vi.spyOn(mockNotebookLM, 'createNotebook').mockRejectedValueOnce(
        new Error('NotebookLM API error')
      )

      const result = await generateWeeklySocialVisuals()

      expect(result.posts_processed).toBeGreaterThan(0)
      expect(result.errors).toBeDefined()
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })
})
