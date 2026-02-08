import { NextRequest, NextResponse } from 'next/server'
import MarketingAgent from '@/services/agents/marketing-agent'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...params } = body

    const agent = new MarketingAgent()

    switch (action) {
      case 'process_reseller_signup':
        if (!params.applicationId) {
          return NextResponse.json(
            { error: 'applicationId is required' },
            { status: 400 }
          )
        }
        await agent.processResellerSignup(params.applicationId)
        return NextResponse.json({ 
          success: true, 
          message: 'Reseller signup processed successfully' 
        })

      case 'calculate_reseller_pricing':
        const pricing = await agent.calculateResellerPricing()
        return NextResponse.json({ 
          success: true, 
          pricing 
        })

      case 'generate_newsletter':
        const newsletter = await agent.generateNewsletterDraft()
        return NextResponse.json({ 
          success: true, 
          newsletter 
        })

      case 'find_influencers':
        const niches = params.niches || ['tech', 'audio', 'smart home']
        await agent.findAndStoreInfluencers(niches)
        return NextResponse.json({ 
          success: true, 
          message: 'Influencer search completed and tasks created' 
        })

      case 'search_influencers':
        const niche = params.niche || 'tech'
        const limit = params.limit || 20
        const influencers = await agent.searchTechInfluencers(niche, limit)
        return NextResponse.json({ 
          success: true, 
          influencers 
        })

      case 'run_workflow':
        await agent.runMarketingWorkflow()
        return NextResponse.json({ 
          success: true, 
          message: 'Marketing workflow completed successfully' 
        })

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Marketing Agent API error:', error)
    return NextResponse.json(
      { 
        error: 'Marketing agent operation failed', 
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const action = searchParams.get('action')

    const agent = new MarketingAgent()

    switch (action) {
      case 'get_trending_products':
        const limit = parseInt(searchParams.get('limit') || '10')
        const trending = await agent.getTrendingProductsFromSEO(limit)
        return NextResponse.json({ 
          success: true, 
          trending 
        })

      case 'calculate_reseller_pricing':
        const pricing = await agent.calculateResellerPricing()
        return NextResponse.json({ 
          success: true, 
          pricing 
        })

      default:
        return NextResponse.json({
          success: true,
          message: 'Marketing Agent API',
          available_actions: {
            POST: [
              'process_reseller_signup',
              'calculate_reseller_pricing',
              'generate_newsletter',
              'find_influencers',
              'search_influencers',
              'run_workflow'
            ],
            GET: [
              'get_trending_products',
              'calculate_reseller_pricing'
            ]
          }
        })
    }
  } catch (error) {
    console.error('Marketing Agent API error:', error)
    return NextResponse.json(
      { 
        error: 'Marketing agent operation failed',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
