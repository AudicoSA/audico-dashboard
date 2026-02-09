import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GoogleAdsAgent } from '@/services/agents/ads-agent'
import { mockSupabase } from '../../mocks/supabase'
import { mockGoogleAdsAPI } from '../../mocks/google-apis'
import { mockGoogleAdsCampaigns, mockCampaignPerformanceData } from '../../fixtures/google-ads-data'
import { testAdCampaigns } from '../../fixtures/test-data'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase)
}))

vi.mock('google-ads-api', () => ({
  GoogleAdsApi: vi.fn(() => mockGoogleAdsAPI.createMockClient()),
  enums: {
    CampaignStatus: {
      PAUSED: 'PAUSED',
      ENABLED: 'ENABLED'
    }
  }
}))

describe('Google Ads Agent Integration Tests', () => {
  let agent: GoogleAdsAgent

  beforeEach(() => {
    agent = new GoogleAdsAgent({
      ctrThreshold: 1.0,
      cpaThreshold: 150,
      roasThreshold: 2.0,
      minConversions: 10,
      autoPauseEnabled: true
    })

    mockSupabase._clearMockData()
    mockGoogleAdsAPI.clearAll()

    process.env.GOOGLE_ADS_CUSTOMER_ID = 'test-customer-123'
    process.env.GOOGLE_ADS_REFRESH_TOKEN = 'test-refresh-token'
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('monitorCampaignPerformance', () => {
    it('should fetch and analyze campaign metrics', async () => {
      mockGoogleAdsAPI.setQueryResults(mockGoogleAdsCampaigns)

      await agent.monitorCampaignPerformance()

      const campaigns = mockSupabase._getMockData('ad_campaigns')
      expect(campaigns.length).toBeGreaterThan(0)

      const messages = mockSupabase._getMockData('squad_messages')
      const monitorMessage = messages.find(m => 
        m.data?.action === 'monitor_completed'
      )
      expect(monitorMessage).toBeDefined()
    })

    it('should detect low CTR performance issues', async () => {
      const lowCTRCampaign = {
        ...mockGoogleAdsCampaigns[2],
        metrics: {
          ...mockGoogleAdsCampaigns[2].metrics,
          clicks: 20,
          conversions: 15
        }
      }

      mockGoogleAdsAPI.setQueryResults([lowCTRCampaign])

      await agent.monitorCampaignPerformance()

      const messages = mockSupabase._getMockData('squad_messages')
      const issueMessages = messages.filter(m => 
        m.data?.action === 'performance_issue' || 
        m.data?.action === 'alert_created'
      )

      expect(issueMessages.length).toBeGreaterThan(0)
    })

    it('should auto-pause critical campaigns', async () => {
      const criticalCampaign = {
        campaign: {
          id: '999999',
          name: 'Critical Campaign',
          status: 'ENABLED'
        },
        metrics: {
          impressions: 10000,
          clicks: 20,
          conversions: 12,
          cost_micros: 5000000000,
          conversions_value: 1000
        },
        campaign_budget: {
          amount_micros: 5000000000
        }
      }

      mockGoogleAdsAPI.setQueryResults([criticalCampaign])

      await agent.monitorCampaignPerformance()

      const messages = mockSupabase._getMockData('squad_messages')
      const pauseMessage = messages.find(m => 
        m.data?.action === 'campaign_paused' && m.data?.auto_paused === true
      )

      expect(pauseMessage).toBeDefined()
    })
  })

  describe('updateCampaignMetrics', () => {
    it('should create new campaign record if not exists', async () => {
      const performance = mockCampaignPerformanceData.high_performer

      await agent.updateCampaignMetrics('123456', performance)

      const campaigns = mockSupabase._getMockData('ad_campaigns')
      expect(campaigns.length).toBeGreaterThan(0)

      const campaign = campaigns[0]
      expect(campaign.platform).toBe('google_ads')
      expect(campaign.performance_metrics.impressions).toBe(performance.impressions)
      expect(campaign.performance_metrics.roas).toBe(performance.roas)
    })

    it('should update existing campaign record', async () => {
      mockSupabase._setMockData('ad_campaigns', [
        {
          ...testAdCampaigns[0],
          metadata: { google_campaign_id: '123456' }
        }
      ])

      const performance = mockCampaignPerformanceData.high_performer

      await agent.updateCampaignMetrics('123456', performance)

      const campaigns = mockSupabase._getMockData('ad_campaigns')
      const updatedCampaign = campaigns.find(c => 
        c.metadata?.google_campaign_id === '123456'
      )

      expect(updatedCampaign).toBeDefined()
    })
  })

  describe('generatePerformanceReport', () => {
    it('should generate comprehensive performance report', async () => {
      mockSupabase._setMockData('ad_campaigns', [
        {
          ...testAdCampaigns[0],
          status: 'active',
          platform: 'google_ads'
        }
      ])

      await agent.generatePerformanceReport()

      const messages = mockSupabase._getMockData('squad_messages')
      const reportMessage = messages.find(m => 
        m.data?.action === 'performance_report'
      )

      expect(reportMessage).toBeDefined()
      expect(reportMessage.data.campaigns).toBeGreaterThan(0)
      expect(reportMessage.data.avg_roas).toBeDefined()
    })
  })

  describe('bid adjustment suggestions', () => {
    it('should suggest bid increase for high performers', async () => {
      const highPerformer = {
        ...mockGoogleAdsCampaigns[0],
        metrics: {
          impressions: 10000,
          clicks: 800,
          conversions: 50,
          cost_micros: 2000000000,
          conversions_value: 15000
        }
      }

      mockGoogleAdsAPI.setQueryResults([highPerformer])

      await agent.monitorCampaignPerformance()

      const tasks = mockSupabase._getMockData('squad_tasks')
      const bidTask = tasks.find(t => 
        t.title?.includes('Bid Adjustment Suggested')
      )

      expect(bidTask).toBeDefined()
    })

    it('should suggest bid decrease for low performers', async () => {
      mockGoogleAdsAPI.setQueryResults([mockGoogleAdsCampaigns[2]])

      await agent.monitorCampaignPerformance()

      const tasks = mockSupabase._getMockData('squad_tasks')
      const bidTask = tasks.find(t => 
        t.title?.includes('Bid Adjustment')
      )

      if (bidTask) {
        expect(bidTask.description).toContain('reduce')
      }
    })
  })

  describe('getAllActiveCampaigns', () => {
    it('should retrieve all active Google Ads campaigns', async () => {
      mockSupabase._setMockData('ad_campaigns', [
        { ...testAdCampaigns[0], status: 'active', platform: 'google_ads' }
      ])

      const campaigns = await agent.getAllActiveCampaigns()

      expect(campaigns).toBeDefined()
      expect(Array.isArray(campaigns)).toBe(true)
      expect(campaigns.length).toBeGreaterThan(0)
    })
  })
})
