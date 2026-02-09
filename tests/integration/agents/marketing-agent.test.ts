import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MarketingAgent } from '@/services/agents/marketing-agent'
import { mockSupabase } from '../../mocks/supabase'
import { mockAnthropicAPI } from '../../mocks/anthropic'
import { mockGooglePlacesAPI, mockYouTubeAPI } from '../../mocks/google-apis'
import { mockNotebookLM } from '../../mocks/notebooklm'
import { testProducts, testResellerApplications, testApprovedResellers } from '../../fixtures/test-data'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase)
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => mockAnthropicAPI.createMockClient())
}))

vi.mock('@/services/integrations/notebooklm-service', () => ({
  default: vi.fn(() => mockNotebookLM)
}))

global.fetch = vi.fn()

describe('Marketing Agent Integration Tests', () => {
  let agent: MarketingAgent

  beforeEach(() => {
    agent = new MarketingAgent()
    mockSupabase._clearMockData()
    mockAnthropicAPI.clearAll()
    mockGooglePlacesAPI.clearAll()
    mockYouTubeAPI.clearAll()
    mockNotebookLM.clearAll()

    mockSupabase._setMockData('products', testProducts)

    process.env.GOOGLE_PLACES_API_KEY = 'test-places-key'
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key'
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('verifyBusinessViaGooglePlaces', () => {
    it('should verify business using Google Places API', async () => {
      mockGooglePlacesAPI.setPlaces([
        {
          place_id: 'place-123',
          name: 'Tech Retailers Inc',
          formatted_address: '123 Business St, City',
          business_status: 'OPERATIONAL',
          types: ['store'],
          rating: 4.5,
          user_ratings_total: 100,
          website: 'https://techretailers.com',
          formatted_phone_number: '+1234567890'
        }
      ])

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockGooglePlacesAPI.findPlace('Tech Retailers Inc')
      }).mockResolvedValueOnce({
        ok: true,
        json: async () => mockGooglePlacesAPI.getPlaceDetails('place-123')
      })

      const result = await agent.verifyBusinessViaGooglePlaces(
        'Tech Retailers Inc',
        '123 Business St'
      )

      expect(result).toBeDefined()
      expect(result?.verified).toBe(true)
      expect(result?.place_id).toBe('place-123')
      expect(result?.rating).toBe(4.5)
    })

    it('should return null for non-existent business', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ candidates: [] })
      })

      const result = await agent.verifyBusinessViaGooglePlaces(
        'Non-Existent Business'
      )

      expect(result).toBeNull()
    })
  })

  describe('processResellerSignup', () => {
    it('should process reseller application and verify business', async () => {
      mockSupabase._setMockData('reseller_applications', [
        testResellerApplications[0]
      ])

      mockGooglePlacesAPI.setPlaces([
        {
          place_id: 'place-456',
          name: 'Tech Retailers Inc',
          formatted_address: '123 Business St, City',
          business_status: 'OPERATIONAL',
          types: ['store'],
          user_ratings_total: 50
        }
      ])

      ;(global.fetch as any).mockImplementation(async (url: string) => ({
        ok: true,
        json: async () => {
          if (url.includes('findplacefromtext')) {
            return mockGooglePlacesAPI.findPlace('Tech Retailers Inc')
          } else {
            return mockGooglePlacesAPI.getPlaceDetails('place-456')
          }
        }
      }))

      await agent.processResellerSignup('app-1')

      const messages = mockSupabase._getMockData('squad_messages')
      const processMessage = messages.find(m => 
        m.data?.event_type === 'reseller_signup_processed'
      )

      expect(processMessage).toBeDefined()
    })

    it('should approve verified businesses automatically', async () => {
      mockSupabase._setMockData('reseller_applications', [
        { ...testResellerApplications[0], status: 'under_review' }
      ])

      mockGooglePlacesAPI.setPlaces([
        {
          place_id: 'place-789',
          name: 'Tech Retailers Inc',
          formatted_address: '123 Business St',
          business_status: 'OPERATIONAL',
          types: ['store'],
          user_ratings_total: 100
        }
      ])

      ;(global.fetch as any).mockImplementation(async () => ({
        ok: true,
        json: async () => mockGooglePlacesAPI.getPlaceDetails('place-789')
      }))

      await agent.processResellerSignup('app-1')

      const messages = mockSupabase._getMockData('squad_messages')
      const approvalMessage = messages.find(m => 
        m.data?.new_status === 'approved'
      )

      expect(approvalMessage).toBeDefined()
    })
  })

  describe('calculateResellerPricing', () => {
    it('should calculate reseller pricing for all products', async () => {
      const pricing = await agent.calculateResellerPricing()

      expect(pricing).toBeDefined()
      expect(Array.isArray(pricing)).toBe(true)
      expect(pricing.length).toBeGreaterThan(0)

      const product = pricing[0]
      expect(product.reseller_price).toBeDefined()
      expect(product.margin).toBeDefined()
      expect(product.reseller_price).toBeLessThan(product.price)
    })

    it('should apply correct margin calculation', async () => {
      const pricing = await agent.calculateResellerPricing()

      pricing.forEach(product => {
        const cost = product.cost || product.price * 0.6
        const expectedResellerPrice = cost * 1.10
        
        expect(product.reseller_price).toBeCloseTo(expectedResellerPrice, 2)
      })
    })
  })

  describe('getTrendingProductsFromSEO', () => {
    it('should identify trending products from SEO data', async () => {
      mockSupabase._setMockData('seo_audits', [
        {
          status: 'completed',
          metrics: {
            keywords: [
              { term: 'smart lighting', volume: 1000 },
              { term: 'led bulbs', volume: 500 }
            ],
            top_pages: []
          },
          completed_at: new Date().toISOString()
        }
      ])

      const trending = await agent.getTrendingProductsFromSEO(10)

      expect(trending).toBeDefined()
      expect(Array.isArray(trending)).toBe(true)
    })
  })

  describe('generateNewsletterDraft', () => {
    it('should generate newsletter with AI assistance', async () => {
      mockSupabase._setMockData('seo_audits', [
        {
          status: 'completed',
          metrics: {
            keywords: ['smart home', 'automation'],
            top_pages: []
          },
          completed_at: new Date().toISOString()
        }
      ])

      mockAnthropicAPI.setDefaultResponse(JSON.stringify({
        subject: 'Transform Your Home with Smart Technology',
        html_content: '<html><body><h1>Newsletter</h1></body></html>',
        text_preview: 'Check out our latest smart home products'
      }))

      const draft = await agent.generateNewsletterDraft()

      expect(draft).toBeDefined()
      expect(draft?.subject).toBeDefined()
      expect(draft?.content).toBeDefined()
      expect(draft?.products).toBeDefined()
      expect(draft?.metadata).toBeDefined()
    })
  })

  describe('searchTechInfluencers', () => {
    it('should search for influencers across platforms', async () => {
      mockYouTubeAPI.setChannels([
        {
          id: 'channel-1',
          snippet: {
            title: 'Tech Reviews Channel',
            description: 'Tech product reviews',
            customUrl: '@techreviews'
          },
          statistics: {
            subscriberCount: '100000',
            videoCount: '500',
            viewCount: '10000000'
          }
        }
      ])

      ;(global.fetch as any).mockImplementation(async (url: string) => {
        if (url.includes('youtube')) {
          if (url.includes('search')) {
            return {
              ok: true,
              json: async () => mockYouTubeAPI.searchChannels('tech', 5)
            }
          } else {
            return {
              ok: true,
              json: async () => mockYouTubeAPI.getChannelDetails('channel-1')
            }
          }
        }
        return { ok: false }
      })

      const influencers = await agent.searchTechInfluencers('tech', 10)

      expect(influencers).toBeDefined()
      expect(Array.isArray(influencers)).toBe(true)
    })
  })

  describe('generateResellerKit', () => {
    it('should generate comprehensive reseller kit', async () => {
      mockSupabase._setMockData('approved_resellers', [
        testApprovedResellers[0]
      ])

      await agent.generateResellerKit('reseller-1')

      const messages = mockSupabase._getMockData('squad_messages')
      const kitMessage = messages.find(m => 
        m.data?.event_type === 'reseller_kit_generated'
      )

      expect(kitMessage).toBeDefined()
      expect(kitMessage.data.reseller_id).toBe('reseller-1')
    })

    it('should create NotebookLM notebook for reseller kit', async () => {
      mockSupabase._setMockData('approved_resellers', [
        testApprovedResellers[0]
      ])

      await agent.generateResellerKit('reseller-1')

      const notebooks = mockSupabase._getMockData('notebooklm_notebooks')
      expect(notebooks.length).toBeGreaterThan(0)

      const notebook = notebooks[0]
      expect(notebook.metadata.reseller_id).toBe('reseller-1')
      expect(notebook.metadata.type).toBe('reseller_kit')
    })
  })

  describe('storeInfluencerOpportunities', () => {
    it('should create tasks for influencer outreach', async () => {
      const influencers = [
        {
          platform: 'youtube' as const,
          handle: '@techreviewer',
          name: 'Tech Reviewer',
          followers: 50000,
          engagement_rate: 5.5,
          niche: 'tech',
          metadata: {
            channel_url: 'https://youtube.com/channel/123'
          }
        }
      ]

      await agent.storeInfluencerOpportunities(influencers)

      const tasks = mockSupabase._getMockData('squad_tasks')
      expect(tasks.length).toBeGreaterThan(0)

      const task = tasks[0]
      expect(task.title).toContain('Tech Reviewer')
      expect(task.assigned_agent).toBe('marketing')
    })
  })
})
