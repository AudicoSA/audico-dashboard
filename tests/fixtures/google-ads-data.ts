export const mockGoogleAdsCampaigns = [
  {
    campaign: {
      id: '123456',
      name: 'Smart Home Summer Sale',
      status: 'ENABLED'
    },
    metrics: {
      impressions: 10000,
      clicks: 500,
      conversions: 25,
      cost_micros: 2500000000,
      conversions_value: 7500
    },
    campaign_budget: {
      amount_micros: 5000000000
    }
  },
  {
    campaign: {
      id: '789012',
      name: 'Security Products Campaign',
      status: 'ENABLED'
    },
    metrics: {
      impressions: 5000,
      clicks: 150,
      conversions: 8,
      cost_micros: 1200000000,
      conversions_value: 3200
    },
    campaign_budget: {
      amount_micros: 3000000000
    }
  },
  {
    campaign: {
      id: '345678',
      name: 'Low Performing Test Campaign',
      status: 'ENABLED'
    },
    metrics: {
      impressions: 8000,
      clicks: 40,
      conversions: 2,
      cost_micros: 2000000000,
      conversions_value: 400
    },
    campaign_budget: {
      amount_micros: 2500000000
    }
  }
]

export const mockCampaignPerformanceData = {
  high_performer: {
    campaignId: '123456',
    campaignName: 'Smart Home Summer Sale',
    impressions: 10000,
    clicks: 500,
    conversions: 25,
    cost: 2500,
    revenue: 7500,
    ctr: 5.0,
    cpc: 5.0,
    cpa: 100,
    roas: 3.0
  },
  low_performer: {
    campaignId: '345678',
    campaignName: 'Low Performing Test Campaign',
    impressions: 8000,
    clicks: 40,
    conversions: 2,
    cost: 2000,
    revenue: 400,
    ctr: 0.5,
    cpc: 50,
    cpa: 1000,
    roas: 0.2
  }
}
