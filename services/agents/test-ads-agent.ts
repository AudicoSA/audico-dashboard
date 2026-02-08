/**
 * Test script for Google Ads Agent
 * 
 * Usage:
 * 1. Ensure .env.local is configured with Google Ads credentials
 * 2. Run: npx tsx services/agents/test-ads-agent.ts
 * 
 * Note: Install tsx if needed: npm install -D tsx
 */

import { adsAgent, GoogleAdsAgent } from './ads-agent'

async function testAdsAgent() {
  console.log('🚀 Testing Google Ads Agent...\n')

  try {
    // Test 1: Check configuration
    console.log('✓ Test 1: Configuration Check')
    const hasClientId = !!process.env.GOOGLE_ADS_CLIENT_ID
    const hasClientSecret = !!process.env.GOOGLE_ADS_CLIENT_SECRET
    const hasDeveloperToken = !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN
    const hasCustomerId = !!process.env.GOOGLE_ADS_CUSTOMER_ID
    const hasRefreshToken = !!process.env.GOOGLE_ADS_REFRESH_TOKEN
    
    console.log(`  Client ID: ${hasClientId ? '✓' : '✗'}`)
    console.log(`  Client Secret: ${hasClientSecret ? '✓' : '✗'}`)
    console.log(`  Developer Token: ${hasDeveloperToken ? '✓' : '✗'}`)
    console.log(`  Customer ID: ${hasCustomerId ? '✓' : '✗'}`)
    console.log(`  Refresh Token: ${hasRefreshToken ? '✓' : '✗'}`)
    
    if (!hasClientId || !hasClientSecret || !hasDeveloperToken || !hasCustomerId || !hasRefreshToken) {
      console.log('\n⚠️  Warning: Not all Google Ads credentials are configured')
      console.log('   Configure them in .env.local to test with real data\n')
    }

    // Test 2: Get active campaigns from database
    console.log('\n✓ Test 2: Database Integration')
    const campaigns = await adsAgent.getAllActiveCampaigns()
    console.log(`  Found ${campaigns.length} active campaigns in database`)
    
    if (campaigns.length > 0) {
      const campaign = campaigns[0]
      console.log(`  Sample campaign: ${campaign.name}`)
      console.log(`  Status: ${campaign.status}`)
      console.log(`  Spend: R${campaign.budget_spent || 0}`)
      if (campaign.performance_metrics) {
        console.log(`  CTR: ${campaign.performance_metrics.ctr?.toFixed(2)}%`)
        console.log(`  CPA: R${campaign.performance_metrics.cpa?.toFixed(2)}`)
        console.log(`  ROAS: ${campaign.performance_metrics.roas?.toFixed(2)}x`)
      }
    } else {
      console.log('  No campaigns found. Will be created on first monitoring run.')
    }

    // Test 3: Custom configuration
    console.log('\n✓ Test 3: Custom Configuration')
    const customAgent = new GoogleAdsAgent({
      ctrThreshold: 1.5,
      cpaThreshold: 100,
      roasThreshold: 3.0,
      minConversions: 20,
      autoPauseEnabled: false
    })
    console.log('  Custom thresholds configured:')
    console.log('    CTR: 1.5%, CPA: R100, ROAS: 3.0x, Min Conversions: 20')
    console.log('    Auto-pause: disabled')

    // Test 4: Performance report generation
    console.log('\n✓ Test 4: Performance Report Generation')
    await adsAgent.generatePerformanceReport()
    console.log('  Performance report generated and logged to squad_messages')

    // Test 5: Monitor performance (only if credentials configured)
    if (hasClientId && hasClientSecret && hasDeveloperToken && hasCustomerId && hasRefreshToken) {
      console.log('\n✓ Test 5: Campaign Monitoring')
      console.log('  Attempting to fetch campaigns from Google Ads API...')
      try {
        await adsAgent.monitorCampaignPerformance()
        console.log('  ✓ Campaign monitoring completed successfully')
      } catch (error) {
        console.log('  ✗ Campaign monitoring failed:', error instanceof Error ? error.message : String(error))
      }
    } else {
      console.log('\n⊘ Test 5: Campaign Monitoring (Skipped)')
      console.log('  Configure Google Ads credentials to enable this test')
    }

    console.log('\n✅ All tests completed!\n')
    
    // Summary
    console.log('📋 Next Steps:')
    if (!hasClientId || !hasClientSecret || !hasDeveloperToken || !hasCustomerId || !hasRefreshToken) {
      console.log('  1. Configure Google Ads API credentials in .env.local')
      console.log('  2. Run this test again to verify API connectivity')
      console.log('  3. Add monitoring schedule to orchestrator')
    } else {
      console.log('  1. ✓ Credentials configured')
      console.log('  2. Add monitoring schedule to orchestrator')
      console.log('  3. Monitor squad_tasks for alerts')
      console.log('  4. Adjust thresholds as needed for your business')
    }
    console.log('\n📖 Documentation:')
    console.log('  - services/agents/ADS_AGENT.md (full documentation)')
    console.log('  - services/agents/QUICKSTART_ADS.md (quick start guide)')
    console.log('  - GOOGLE_ADS_AGENT_IMPLEMENTATION.md (implementation summary)\n')

  } catch (error) {
    console.error('\n❌ Test failed:', error)
    if (error instanceof Error) {
      console.error('Error details:', error.message)
      console.error('Stack trace:', error.stack)
    }
    process.exit(1)
  }
}

// Run tests
testAdsAgent()
  .then(() => {
    console.log('🎉 Test suite completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Test suite failed:', error)
    process.exit(1)
  })
