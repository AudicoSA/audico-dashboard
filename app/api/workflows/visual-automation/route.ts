import { NextRequest, NextResponse } from 'next/server'
import { 
  generateWeeklySocialVisuals, 
  generateMonthlyNewsletterAssets,
  generateResellerOnboardingKit 
} from '@/services/workflows/visual-content-automation'
import { orchestrator } from '@/services/orchestrator'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, resellerId } = body

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      )
    }

    let result

    switch (action) {
      case 'generate_social_visuals':
        result = await generateWeeklySocialVisuals()
        return NextResponse.json({
          success: true,
          message: 'Social visuals workflow completed',
          result
        })

      case 'generate_newsletter_assets':
        result = await generateMonthlyNewsletterAssets()
        return NextResponse.json({
          success: true,
          message: 'Newsletter assets workflow completed',
          result
        })

      case 'generate_reseller_kit':
        if (!resellerId) {
          return NextResponse.json(
            { error: 'resellerId is required for this action' },
            { status: 400 }
          )
        }
        
        await orchestrator.triggerResellerKitGeneration(resellerId)
        return NextResponse.json({
          success: true,
          message: `Reseller kit generation triggered for ${resellerId}`
        })

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error in visual automation workflow:', error)
    return NextResponse.json(
      { 
        error: 'Failed to execute workflow',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    workflows: [
      {
        name: 'generate_social_visuals',
        description: 'Generate visuals for upcoming social posts in the next 7 days',
        schedule: 'Daily at 9:00 AM',
        method: 'POST',
        body: { action: 'generate_social_visuals' }
      },
      {
        name: 'generate_newsletter_assets',
        description: 'Generate slide deck and infographic for newsletter campaigns',
        schedule: 'Weekly on Mondays at 10:00 AM',
        method: 'POST',
        body: { action: 'generate_newsletter_assets' }
      },
      {
        name: 'generate_reseller_kit',
        description: 'Generate personalized onboarding kit for a reseller',
        schedule: 'Triggered on reseller approval',
        method: 'POST',
        body: { action: 'generate_reseller_kit', resellerId: 'reseller-id-here' }
      }
    ]
  })
}
