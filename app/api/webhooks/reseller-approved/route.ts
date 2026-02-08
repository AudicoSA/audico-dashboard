import { NextRequest, NextResponse } from 'next/server'
import { orchestrator } from '@/services/orchestrator'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, record, old_record } = body

    if (type !== 'UPDATE' && type !== 'INSERT') {
      return NextResponse.json({ received: true })
    }

    if (!record) {
      return NextResponse.json(
        { error: 'No record provided' },
        { status: 400 }
      )
    }

    const isNewlyApproved = 
      record.status === 'active' && 
      (!old_record || old_record.status !== 'active')

    if (!isNewlyApproved) {
      return NextResponse.json({ received: true, action: 'none' })
    }

    const hasExistingKit = record.metadata?.reseller_kit?.slide_deck_url

    if (hasExistingKit) {
      return NextResponse.json({ 
        received: true, 
        action: 'skipped',
        reason: 'Kit already exists'
      })
    }

    await orchestrator.triggerResellerKitGeneration(record.id)

    return NextResponse.json({
      success: true,
      message: `Reseller kit generation triggered for ${record.company_name}`,
      resellerId: record.id
    })
  } catch (error) {
    console.error('Error in reseller approval webhook:', error)
    return NextResponse.json(
      { 
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
