import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { GoogleAdsApi, Customer, enums } from 'google-ads-api'

export interface AdCampaign {
  id: string
  name: string
  platform: string
  status: string
  budget_total: number
  budget_spent: number
  currency: string
  start_date: string | null
  end_date: string | null
  performance_metrics: {
    impressions: number
    clicks: number
    conversions: number
    ctr: number
    cpc: number
    cpa: number
    roas: number
    spend: number
    revenue: number
  }
  managed_by: string | null
  metadata: any
  created_at: string
  updated_at: string
}

export interface CampaignPerformance {
  campaignId: string
  campaignName: string
  impressions: number
  clicks: number
  conversions: number
  cost: number
  revenue: number
  ctr: number
  cpc: number
  cpa: number
  roas: number
}

export interface BidAdjustmentSuggestion {
  campaignId: string
  currentBid: number
  suggestedBid: number
  reason: string
  expectedImpact: string
}

export interface AdsAgentConfig {
  ctrThreshold: number
  cpaThreshold: number
  roasThreshold: number
  minConversions: number
  autoPauseEnabled: boolean
}

const DEFAULT_CONFIG: AdsAgentConfig = {
  ctrThreshold: 1.0,
  cpaThreshold: 150,
  roasThreshold: 2.0,
  minConversions: 10,
  autoPauseEnabled: true
}

export class GoogleAdsAgent {
  private supabase: SupabaseClient | null = null
  private googleAdsClient: GoogleAdsApi | null = null
  private config: AdsAgentConfig

  constructor(config: Partial<AdsAgentConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  private getSupabase(): SupabaseClient {
    if (!this.supabase) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      this.supabase = createClient(supabaseUrl, supabaseKey)
    }
    return this.supabase
  }

  private getGoogleAdsClient(): GoogleAdsApi {
    if (!this.googleAdsClient) {
      this.googleAdsClient = new GoogleAdsApi({
        client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
        client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
        developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!
      })
    }
    return this.googleAdsClient
  }

  private getCustomer(customerId: string, refreshToken: string): Customer {
    const client = this.getGoogleAdsClient()
    return client.Customer({
      customer_id: customerId,
      refresh_token: refreshToken
    })
  }

  async monitorCampaignPerformance(): Promise<void> {
    const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID
    const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN

    if (!customerId || !refreshToken) {
      console.error('Google Ads credentials not configured')
      return
    }

    try {
      const customer = this.getCustomer(customerId, refreshToken)
      
      const campaigns = await customer.query(`
        SELECT 
          campaign.id,
          campaign.name,
          campaign.status,
          metrics.impressions,
          metrics.clicks,
          metrics.conversions,
          metrics.cost_micros,
          metrics.conversions_value,
          campaign_budget.amount_micros
        FROM campaign
        WHERE campaign.status IN ('ENABLED', 'PAUSED')
          AND segments.date DURING LAST_30_DAYS
      `)

      for (const campaign of campaigns) {
        if (!campaign.campaign?.id) continue
        
        const performance = this.calculatePerformanceMetrics(campaign)
        await this.updateCampaignMetrics(String(campaign.campaign.id), performance)
        
        const issues = this.analyzePerformance(performance)
        if (issues.length > 0) {
          await this.handlePerformanceIssues(campaign, performance, issues)
        }

        const bidSuggestion = this.generateBidAdjustmentSuggestion(performance)
        if (bidSuggestion) {
          await this.createBidAdjustmentTask(campaign, bidSuggestion)
        }
      }

      await this.logActivity('monitor_completed', null, {
        campaigns_checked: campaigns.length,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('Error monitoring campaign performance:', error)
      await this.logActivity('monitor_failed', null, {
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  private calculatePerformanceMetrics(campaign: any): CampaignPerformance {
    const impressions = campaign.metrics.impressions || 0
    const clicks = campaign.metrics.clicks || 0
    const conversions = campaign.metrics.conversions || 0
    const costMicros = campaign.metrics.cost_micros || 0
    const conversionValue = campaign.metrics.conversions_value || 0
    
    const cost = costMicros / 1_000_000
    const revenue = conversionValue
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0
    const cpc = clicks > 0 ? cost / clicks : 0
    const cpa = conversions > 0 ? cost / conversions : 0
    const roas = cost > 0 ? revenue / cost : 0

    return {
      campaignId: campaign.campaign.id,
      campaignName: campaign.campaign.name,
      impressions,
      clicks,
      conversions,
      cost,
      revenue,
      ctr,
      cpc,
      cpa,
      roas
    }
  }

  private analyzePerformance(performance: CampaignPerformance): string[] {
    const issues: string[] = []

    if (performance.conversions >= this.config.minConversions) {
      if (performance.ctr < this.config.ctrThreshold) {
        issues.push(`low_ctr`)
      }

      if (performance.cpa > this.config.cpaThreshold) {
        issues.push(`high_cpa`)
      }

      if (performance.roas < this.config.roasThreshold) {
        issues.push(`low_roas`)
      }
    }

    return issues
  }

  async updateCampaignMetrics(campaignId: string, performance: CampaignPerformance): Promise<void> {
    const { data: existingCampaign } = await this.getSupabase()
      .from('ad_campaigns')
      .select('*')
      .eq('metadata->>google_campaign_id', campaignId)
      .single()

    const metricsData = {
      impressions: performance.impressions,
      clicks: performance.clicks,
      conversions: performance.conversions,
      ctr: performance.ctr,
      cpc: performance.cpc,
      cpa: performance.cpa,
      roas: performance.roas,
      spend: performance.cost,
      revenue: performance.revenue
    }

    if (existingCampaign) {
      await this.getSupabase()
        .from('ad_campaigns')
        .update({
          performance_metrics: metricsData,
          budget_spent: performance.cost,
          metadata: {
            ...existingCampaign.metadata,
            last_sync: new Date().toISOString()
          }
        })
        .eq('id', existingCampaign.id)
    } else {
      await this.getSupabase()
        .from('ad_campaigns')
        .insert({
          name: performance.campaignName,
          platform: 'google_ads',
          status: 'active',
          budget_spent: performance.cost,
          performance_metrics: metricsData,
          managed_by: 'Marcus',
          metadata: {
            google_campaign_id: campaignId,
            last_sync: new Date().toISOString()
          }
        })
    }
  }

  async handlePerformanceIssues(
    campaign: any,
    performance: CampaignPerformance,
    issues: string[]
  ): Promise<void> {
    const severityLevel = this.calculateSeverity(issues, performance)

    if (severityLevel === 'critical' && this.config.autoPauseEnabled) {
      await this.pauseCampaign(campaign.campaign.id, issues)
      await this.createAlertTask(campaign, performance, issues, 'critical')
    } else if (severityLevel === 'high') {
      await this.createAlertTask(campaign, performance, issues, 'high')
    } else {
      await this.logActivity('performance_issue', campaign.campaign.id, {
        campaign_name: campaign.campaign.name,
        issues,
        severity: severityLevel,
        metrics: performance
      })
    }
  }

  private calculateSeverity(issues: string[], performance: CampaignPerformance): 'low' | 'medium' | 'high' | 'critical' {
    let score = 0

    if (issues.includes('low_ctr') && performance.ctr < this.config.ctrThreshold / 2) {
      score += 3
    } else if (issues.includes('low_ctr')) {
      score += 1
    }

    if (issues.includes('high_cpa') && performance.cpa > this.config.cpaThreshold * 1.5) {
      score += 3
    } else if (issues.includes('high_cpa')) {
      score += 2
    }

    if (issues.includes('low_roas') && performance.roas < this.config.roasThreshold / 2) {
      score += 3
    } else if (issues.includes('low_roas')) {
      score += 2
    }

    if (score >= 6) return 'critical'
    if (score >= 4) return 'high'
    if (score >= 2) return 'medium'
    return 'low'
  }

  async pauseCampaign(campaignId: string, reasons: string[]): Promise<void> {
    const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID
    const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN

    if (!customerId || !refreshToken) {
      console.error('Cannot pause campaign: Google Ads credentials not configured')
      return
    }

    try {
      const customer = this.getCustomer(customerId, refreshToken)
      
      await customer.campaigns.update([{
        resource_name: `customers/${customerId}/campaigns/${campaignId}`,
        status: enums.CampaignStatus.PAUSED
      }])

      const { data: campaign } = await this.getSupabase()
        .from('ad_campaigns')
        .select('*')
        .eq('metadata->>google_campaign_id', campaignId)
        .single()

      if (campaign) {
        await this.getSupabase()
          .from('ad_campaigns')
          .update({
            status: 'paused',
            metadata: {
              ...campaign.metadata,
              paused_at: new Date().toISOString(),
              pause_reasons: reasons,
              auto_paused: true
            }
          })
          .eq('id', campaign.id)
      }

      await this.logActivity('campaign_paused', campaignId, {
        reasons,
        auto_paused: true,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('Error pausing campaign:', error)
      await this.logActivity('pause_failed', campaignId, {
        error: error instanceof Error ? error.message : String(error),
        reasons
      })
    }
  }

  private generateBidAdjustmentSuggestion(performance: CampaignPerformance): BidAdjustmentSuggestion | null {
    if (performance.conversions < this.config.minConversions) {
      return null
    }

    const currentCpc = performance.cpc
    let suggestedCpc = currentCpc
    let reason = ''
    let expectedImpact = ''

    if (performance.roas > this.config.roasThreshold * 1.5 && performance.cpa < this.config.cpaThreshold * 0.7) {
      suggestedCpc = currentCpc * 1.15
      reason = 'High ROAS and low CPA indicate room for increased bids to capture more volume'
      expectedImpact = 'Increased impressions and conversions while maintaining profitability'
    } else if (performance.roas < this.config.roasThreshold && performance.cpa > this.config.cpaThreshold) {
      suggestedCpc = currentCpc * 0.85
      reason = 'Low ROAS and high CPA require bid reduction to improve efficiency'
      expectedImpact = 'Reduced spend with focus on higher quality traffic'
    } else if (performance.ctr > this.config.ctrThreshold * 2 && performance.roas > this.config.roasThreshold) {
      suggestedCpc = currentCpc * 1.10
      reason = 'High CTR and ROAS suggest strong ad relevance; increase bids to scale'
      expectedImpact = 'Capture more high-intent traffic'
    } else if (performance.ctr < this.config.ctrThreshold && performance.clicks > 100) {
      suggestedCpc = currentCpc * 0.90
      reason = 'Low CTR indicates poor ad relevance; reduce bids and review ad copy'
      expectedImpact = 'Better ad positioning for more relevant searches'
    }

    if (suggestedCpc === currentCpc) {
      return null
    }

    const changePercent = ((suggestedCpc - currentCpc) / currentCpc * 100).toFixed(1)
    const changePercentNum = parseFloat(changePercent)
    reason = `${reason} (${changePercentNum > 0 ? '+' : ''}${changePercent}% adjustment)`

    return {
      campaignId: performance.campaignId,
      currentBid: currentCpc,
      suggestedBid: suggestedCpc,
      reason,
      expectedImpact
    }
  }

  async createBidAdjustmentTask(campaign: any, suggestion: BidAdjustmentSuggestion): Promise<void> {
    const { data: task, error } = await this.getSupabase()
      .from('squad_tasks')
      .insert({
        title: `Bid Adjustment Suggested: ${campaign.campaign.name}`,
        description: `Campaign: ${campaign.campaign.name}\n\nCurrent CPC: R${suggestion.currentBid.toFixed(2)}\nSuggested CPC: R${suggestion.suggestedBid.toFixed(2)}\n\nReason: ${suggestion.reason}\n\nExpected Impact: ${suggestion.expectedImpact}`,
        status: 'new',
        assigned_agent: 'Marcus',
        priority: 'medium',
        mentions_kenny: false,
        deliverable_url: `/campaigns/${suggestion.campaignId}`
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating bid adjustment task:', error)
      return
    }

    await this.getSupabase()
      .from('squad_messages')
      .insert({
        from_agent: 'Marcus',
        to_agent: 'Jarvis',
        message: `Bid adjustment suggested for ${campaign.campaign.name}: ${suggestion.reason}`,
        task_id: task.id,
        data: {
          campaign_id: suggestion.campaignId,
          action: 'bid_adjustment_suggested',
          suggestion
        }
      })

    await this.logActivity('bid_suggestion_created', suggestion.campaignId, {
      task_id: task.id,
      suggestion
    })
  }

  async createAlertTask(
    campaign: any,
    performance: CampaignPerformance,
    issues: string[],
    priority: 'high' | 'critical'
  ): Promise<void> {
    const issueDescriptions = {
      low_ctr: `CTR is ${performance.ctr.toFixed(2)}% (threshold: ${this.config.ctrThreshold}%)`,
      high_cpa: `CPA is R${performance.cpa.toFixed(2)} (threshold: R${this.config.cpaThreshold})`,
      low_roas: `ROAS is ${performance.roas.toFixed(2)}x (threshold: ${this.config.roasThreshold}x)`
    }

    const issueDetails = issues.map(issue => `- ${issueDescriptions[issue as keyof typeof issueDescriptions]}`).join('\n')
    const actionTaken = priority === 'critical' ? '\n\n⚠️ CAMPAIGN HAS BEEN AUTO-PAUSED' : ''

    const { data: task, error } = await this.getSupabase()
      .from('squad_tasks')
      .insert({
        title: `${priority === 'critical' ? '🚨 CRITICAL' : '⚠️'} Ad Performance Alert: ${campaign.campaign.name}`,
        description: `Campaign: ${campaign.campaign.name}\n\nPerformance Issues:\n${issueDetails}\n\nCurrent Metrics:\n- Impressions: ${performance.impressions.toLocaleString()}\n- Clicks: ${performance.clicks.toLocaleString()}\n- Conversions: ${performance.conversions}\n- Spend: R${performance.cost.toFixed(2)}\n- Revenue: R${performance.revenue.toFixed(2)}${actionTaken}\n\nImmediate review and action required.`,
        status: 'new',
        assigned_agent: 'Marcus',
        priority: priority === 'critical' ? 'urgent' : 'high',
        mentions_kenny: priority === 'critical',
        deliverable_url: `/campaigns/${performance.campaignId}`
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating alert task:', error)
      return
    }

    await this.getSupabase()
      .from('squad_messages')
      .insert({
        from_agent: 'Marcus',
        to_agent: priority === 'critical' ? 'Kenny' : 'Jarvis',
        message: `${priority === 'critical' ? '🚨 CRITICAL ALERT' : '⚠️ Alert'}: ${campaign.campaign.name} requires immediate attention. ${issues.join(', ')}`,
        task_id: task.id,
        data: {
          campaign_id: performance.campaignId,
          action: 'performance_alert',
          issues,
          priority,
          metrics: performance,
          auto_paused: priority === 'critical' && this.config.autoPauseEnabled
        }
      })

    await this.logActivity('alert_created', performance.campaignId, {
      task_id: task.id,
      priority,
      issues,
      auto_paused: priority === 'critical' && this.config.autoPauseEnabled
    })
  }

  async getCampaignMetrics(campaignId: string): Promise<AdCampaign | null> {
    const { data, error } = await this.getSupabase()
      .from('ad_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (error) {
      console.error('Error fetching campaign metrics:', error)
      return null
    }

    return data
  }

  async getAllActiveCampaigns(): Promise<AdCampaign[]> {
    const { data, error } = await this.getSupabase()
      .from('ad_campaigns')
      .select('*')
      .eq('status', 'active')
      .eq('platform', 'google_ads')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching active campaigns:', error)
      return []
    }

    return data || []
  }

  async generatePerformanceReport(): Promise<void> {
    const campaigns = await this.getAllActiveCampaigns()
    
    if (campaigns.length === 0) {
      return
    }

    const totalSpend = campaigns.reduce((sum, c) => sum + (c.budget_spent || 0), 0)
    const totalRevenue = campaigns.reduce((sum, c) => sum + (c.performance_metrics?.revenue || 0), 0)
    const totalConversions = campaigns.reduce((sum, c) => sum + (c.performance_metrics?.conversions || 0), 0)
    const avgRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0

    const topPerformers = campaigns
      .filter(c => c.performance_metrics?.roas > this.config.roasThreshold)
      .sort((a, b) => (b.performance_metrics?.roas || 0) - (a.performance_metrics?.roas || 0))
      .slice(0, 3)

    const underperformers = campaigns
      .filter(c => c.performance_metrics?.roas < this.config.roasThreshold)
      .sort((a, b) => (a.performance_metrics?.roas || 0) - (b.performance_metrics?.roas || 0))
      .slice(0, 3)

    const reportSummary = `Google Ads Performance Report - ${new Date().toLocaleDateString()}\n\n` +
      `Overview:\n` +
      `- Active Campaigns: ${campaigns.length}\n` +
      `- Total Spend: R${totalSpend.toFixed(2)}\n` +
      `- Total Revenue: R${totalRevenue.toFixed(2)}\n` +
      `- Total Conversions: ${totalConversions}\n` +
      `- Average ROAS: ${avgRoas.toFixed(2)}x\n\n` +
      `Top Performers (${topPerformers.length}):\n${topPerformers.map(c => 
        `- ${c.name}: ${c.performance_metrics?.roas?.toFixed(2)}x ROAS`
      ).join('\n')}\n\n` +
      `Underperformers (${underperformers.length}):\n${underperformers.map(c => 
        `- ${c.name}: ${c.performance_metrics?.roas?.toFixed(2)}x ROAS`
      ).join('\n')}`

    await this.getSupabase()
      .from('squad_messages')
      .insert({
        from_agent: 'Marcus',
        to_agent: null,
        message: reportSummary,
        data: {
          action: 'performance_report',
          campaigns: campaigns.length,
          total_spend: totalSpend,
          total_revenue: totalRevenue,
          avg_roas: avgRoas
        }
      })
  }

  private async logActivity(action: string, campaignId: string | null, metadata: any = {}): Promise<void> {
    try {
      await this.getSupabase()
        .from('squad_messages')
        .insert({
          from_agent: 'Marcus',
          message: `Ads Agent ${action}${campaignId ? `: ${campaignId}` : ''}`,
          data: {
            action,
            campaign_id: campaignId,
            ...metadata
          }
        })
    } catch (error) {
      console.error('Failed to log activity:', error)
    }
  }
}

export const adsAgent = new GoogleAdsAgent()
