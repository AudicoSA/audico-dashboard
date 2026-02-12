import { NextRequest, NextResponse } from 'next/server'
import { EmailIntelligenceScanner } from '@/lib/email-intelligence-scanner'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { job_id } = body

    if (!job_id) {
      return NextResponse.json(
        { error: 'job_id is required' },
        { status: 400 }
      )
    }

    const scanner = new EmailIntelligenceScanner()
    const { state, has_more, batch_results } = await scanner.processBatch(job_id)

    return NextResponse.json({
      success: true,
      job_id: state.job_id,
      has_more,
      progress: {
        status: state.status,
        total_messages: state.total_messages,
        processed_count: state.processed_count,
        suppliers_found: state.suppliers_found,
        products_found: state.products_found,
        contacts_found: state.contacts_found,
        interactions_logged: state.interactions_logged,
        errors: state.errors,
        tokens_used: state.tokens_used,
        estimated_cost_usd: Math.round(state.estimated_cost_usd * 100) / 100,
        percentage: state.total_messages > 0
          ? Math.round((state.processed_count / state.total_messages) * 100)
          : 0,
      },
      batch_results,
    })

  } catch (error: any) {
    console.error('Batch processing error:', error)
    return NextResponse.json(
      { error: 'Failed to process batch', details: error.message },
      { status: 500 }
    )
  }
}
