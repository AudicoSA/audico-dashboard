import { NextRequest, NextResponse } from 'next/server'
import { EmailIntelligenceScanner } from '@/lib/email-intelligence-scanner'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { action, start_date, end_date, resume_job_id } = body

    if (action === 'start') {
      if (!start_date || !end_date) {
        return NextResponse.json(
          { error: 'start_date and end_date are required' },
          { status: 400 }
        )
      }

      const scanner = new EmailIntelligenceScanner()
      
      const startDate = new Date(start_date)
      const endDate = new Date(end_date)

      const result = await scanner.scanHistoricalEmails(startDate, endDate)

      return NextResponse.json({
        success: true,
        job_id: result.job_id,
        state: result,
      })
    }

    if (action === 'resume') {
      if (!resume_job_id) {
        return NextResponse.json(
          { error: 'resume_job_id is required' },
          { status: 400 }
        )
      }

      const scanner = new EmailIntelligenceScanner()
      const result = await scanner.scanHistoricalEmails(
        new Date(),
        new Date(),
        resume_job_id
      )

      return NextResponse.json({
        success: true,
        job_id: result.job_id,
        state: result,
      })
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "start" or "resume"' },
      { status: 400 }
    )

  } catch (error: any) {
    console.error('Email intelligence scan error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to scan emails', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('job_id')

    if (!jobId) {
      return NextResponse.json(
        { error: 'job_id parameter is required' },
        { status: 400 }
      )
    }

    const scanner = new EmailIntelligenceScanner()
    
    const state = scanner.getState()

    if (!state || state.job_id !== jobId) {
      return NextResponse.json(
        { error: 'Job not found or not active in this instance' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      state,
    })

  } catch (error: any) {
    console.error('Error fetching scan status:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch scan status', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}
