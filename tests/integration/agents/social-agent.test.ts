import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SocialMediaAgent } from '@/services/agents/social-agent'
import { mockSupabase } from '../../mocks/supabase'
import { mockAnthropicAPI } from '../../mocks/anthropic'
import { mockNotebookLM } from '../../mocks/notebooklm'
import { testProducts, testSocialPosts } from '../../fixtures/test-data'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase)
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => mockAnthropicAPI.createMockClient())
}))

vi.mock('@/services/integrations/notebooklm-service', () => ({
  default: vi.fn(() => mockNotebookLM)
}))

describe('Social Media Agent Integration Tests', () => {
  let agent: SocialMediaAgent

  beforeEach(() => {
    agent = new SocialMediaAgent()
    mockSupabase._clearMockData()
    mockAnthropicAPI.clearAll()
    mockNotebookLM.clearAll()

    mockSupabase._setMockData('products', testProducts)
    
    mockAnthropicAPI.setDefaultResponse(
      'Check out our amazing smart LED light bulbs! 💡 Transform your home with WiFi-enabled lighting that you can control from anywhere. #SmartHome #HomeAutomation #LED'
    )
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchProductCatalog', () => {
    it('should fetch product catalog from database', async () => {
      const products = await agent.fetchProductCatalog(10)

      expect(products).toBeDefined()
      expect(products.length).toBeGreaterThan(0)
      expect(products[0]).toHaveProperty('name')
      expect(products[0]).toHaveProperty('price')
    })

    it('should respect limit parameter', async () => {
      mockSupabase._setMockData('products', Array(20).fill(testProducts[0]))

      const products = await agent.fetchProductCatalog(5)

      expect(products.length).toBeLessThanOrEqual(5)
    })
  })

  describe('searchProducts', () => {
    it('should search products by query', async () => {
      const products = await agent.searchProducts('LED', 5)

      expect(products).toBeDefined()
      expect(Array.isArray(products)).toBe(true)
    })
  })

  describe('generatePostContent', () => {
    it('should generate post content using Claude API', async () => {
      const content = await agent.generatePostContent(
        'facebook',
        ['smart home', 'LED', 'automation'],
        [testProducts[0]]
      )

      expect(content).toBeDefined()
      expect(typeof content).toBe('string')
      expect(content.length).toBeGreaterThan(0)
    })

    it('should handle different platforms', async () => {
      const platforms = ['facebook', 'instagram', 'twitter', 'linkedin']

      for (const platform of platforms) {
        const content = await agent.generatePostContent(
          platform,
          ['smart home'],
          testProducts
        )

        expect(content).toBeDefined()
        expect(typeof content).toBe('string')
      }
    })
  })

  describe('createPostDraft', () => {
    it('should create a post draft in database', async () => {
      const postId = await agent.createPostDraft(
        'facebook',
        ['smart home', 'automation'],
        new Date(Date.now() + 86400000)
      )

      expect(postId).toBeDefined()
      expect(typeof postId).toBe('string')

      const posts = mockSupabase._getMockData('social_posts')
      expect(posts.length).toBeGreaterThan(0)
      expect(posts[0].platform).toBe('facebook')
      expect(posts[0].status).toBe('draft')
    })

    it('should create post with visual content when requested', async () => {
      const postId = await agent.createPostDraft(
        'instagram',
        ['smart home'],
        undefined,
        undefined,
        true,
        'infographic'
      )

      expect(postId).toBeDefined()

      const messages = mockSupabase._getMockData('squad_messages')
      const visualMessage = messages.find(m => 
        m.data?.action === 'visual_auto_generated'
      )
      
      expect(visualMessage).toBeDefined()
    })
  })

  describe('generateVisualContent', () => {
    it('should generate infographic for social post', async () => {
      mockSupabase._setMockData('social_posts', [testSocialPosts[0]])

      const result = await agent.generateVisualContent(
        'post-1',
        'infographic'
      )

      expect(result.success).toBe(true)
      expect(result.visualUrl).toBeDefined()
      expect(result.artifactId).toBeDefined()
    })

    it('should create notebook and add sources', async () => {
      mockSupabase._setMockData('social_posts', [testSocialPosts[0]])

      await agent.generateVisualContent('post-1', 'infographic')

      const notebooks = mockSupabase._getMockData('notebooklm_notebooks')
      expect(notebooks.length).toBeGreaterThan(0)
    })

    it('should handle different visual types', async () => {
      mockSupabase._setMockData('social_posts', [testSocialPosts[0]])

      const types: Array<'infographic' | 'slide_deck' | 'video_overview'> = [
        'infographic',
        'slide_deck',
        'video_overview'
      ]

      for (const type of types) {
        const result = await agent.generateVisualContent('post-1', type)
        expect(result.success).toBe(true)
      }
    })
  })

  describe('approvePost', () => {
    it('should approve and schedule post', async () => {
      mockSupabase._setMockData('social_posts', [testSocialPosts[0]])

      const scheduledDate = new Date(Date.now() + 86400000)
      await agent.approvePost('post-1', scheduledDate)

      const messages = mockSupabase._getMockData('squad_messages')
      const approvalMessage = messages.find(m => m.data?.action === 'approved')
      
      expect(approvalMessage).toBeDefined()
    })
  })

  describe('publishPost', () => {
    it('should mark post as published', async () => {
      mockSupabase._setMockData('social_posts', [testSocialPosts[0]])

      await agent.publishPost('post-1')

      const messages = mockSupabase._getMockData('squad_messages')
      const publishMessage = messages.find(m => m.data?.action === 'published')
      
      expect(publishMessage).toBeDefined()
    })
  })

  describe('getScheduledPosts', () => {
    it('should retrieve posts scheduled for next hour', async () => {
      const scheduledPost = {
        ...testSocialPosts[1],
        status: 'scheduled',
        scheduled_for: new Date(Date.now() + 1800000).toISOString()
      }

      mockSupabase._setMockData('social_posts', [scheduledPost])

      const posts = await agent.getScheduledPosts()

      expect(Array.isArray(posts)).toBe(true)
    })
  })

  describe('generateBulkPosts', () => {
    it('should generate multiple posts for different platforms', async () => {
      const postIds = await agent.generateBulkPosts(4)

      expect(postIds).toBeDefined()
      expect(Array.isArray(postIds)).toBe(true)
      expect(postIds.length).toBeGreaterThan(0)
    })
  })
})
