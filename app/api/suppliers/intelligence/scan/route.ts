import { NextRequest, NextResponse } from 'next/server'
import { EmailIntelligenceScanner } from '@/lib/email-intelligence-scanner'

export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { start_date, end_date } = body

    if (!start_date || !end_date) {
      return NextResponse.json(
        { error: 'start_date and end_date are required in ISO 8601 format' },
        { status: 400 }
      )
    }

    const startDate = new Date(start_date)
    const endDate = new Date(end_date)

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use ISO 8601 format (e.g., "2024-01-01T00:00:00Z")' },
        { status: 400 }
      )
    }

    if (startDate > endDate) {
      return NextResponse.json(
        { error: 'start_date must be before end_date' },
        { status: 400 }
      )
    }

    const scanner = new EmailIntelligenceScanner()
    const state = await scanner.startScan(startDate, endDate)

    return NextResponse.json({
      success: true,
      job_id: state.job_id,
      status: state.status,
      total_messages: state.total_messages,
      message: `Found ${state.total_messages} emails in Gmail. Ready to process in batches.`,
    })

  } catch (error: any) {
    console.error('Email scan error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate email scan', details: error.message },
      { status: 500 }
    )
  }
}
