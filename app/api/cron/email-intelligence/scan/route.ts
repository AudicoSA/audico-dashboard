import { NextRequest, NextResponse } from 'next/server'
import { scanHistoricalEmails } from '@/lib/email-intelligence-scanner'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const daysBack = parseInt(searchParams.get('days_back') || '30')
    const resumeJobId = searchParams.get('resume_job_id') || undefined

    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysBack)

    console.log(`Starting email intelligence scan from ${startDate.toISOString()} to ${endDate.toISOString()}`)

    const result = await scanHistoricalEmails(startDate, endDate, resumeJobId)

    return NextResponse.json({
      success: true,
      message: `Email intelligence scan ${result.status}`,
      result,
    })

  } catch (error: any) {
    console.error('Cron email intelligence scan error:', error)
    
    return NextResponse.json(
      { 
        error: 'Email intelligence scan failed', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}
