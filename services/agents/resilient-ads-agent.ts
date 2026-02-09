import { GoogleAdsAgent, AdsAgentConfig } from './ads-agent'
import { withResilience } from '../../lib/resilience'

export class ResilientGoogleAdsAgent extends GoogleAdsAgent {
  constructor(config: Partial<AdsAgentConfig> = {}) {
    super(config)
  }

  async monitorCampaignPerformance(): Promise<void> {
    return withResilience(
      'google-ads-api',
      () => super.monitorCampaignPerformance(),
      { fallbackValue: undefined }
    )
  }

  async generatePerformanceReport(): Promise<void> {
    return withResilience(
      'google-ads-api',
      () => super.generatePerformanceReport(),
      { fallbackValue: undefined }
    )
  }
}

export const resilientAdsAgent = new ResilientGoogleAdsAgent()
