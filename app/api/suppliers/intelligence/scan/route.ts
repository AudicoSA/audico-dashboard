import { NextRequest, NextResponse } from 'next/server'
import { EmailIntelligenceScanner } from '@/lib/email-intelligence-scanner'

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
    const result = await scanner.scanHistoricalEmails(startDate, endDate)

    return NextResponse.json({
      success: true,
      job_id: result.job_id,
      status: result.status,
      message: 'Historical email scan initiated. Use the job_id to track progress.',
      progress: {
        total_emails: result.total_emails,
        processed_count: result.processed_count,
        suppliers_found: result.suppliers_found,
        products_found: result.products_found,
      },
    })

  } catch (error: any) {
    console.error('Email scan error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate email scan', details: error.message },
      { status: 500 }
    )
  }
}
