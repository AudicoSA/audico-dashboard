import { NextRequest, NextResponse } from 'next/server'
import {
  getScanJobs,
  getJobProgress,
  getScanStatistics,
  getSuppliersInRange,
  getProductsInRange,
  getInteractionsInRange,
  findDuplicateSuppliers,
} from '@/lib/email-intelligence-utils'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'jobs') {
      const limit = parseInt(searchParams.get('limit') || '10')
      const jobs = await getScanJobs(limit)
      
      return NextResponse.json({
        success: true,
        jobs,
      })
    }

    if (action === 'job_progress') {
      const jobId = searchParams.get('job_id')
      if (!jobId) {
        return NextResponse.json(
          { error: 'job_id parameter is required' },
          { status: 400 }
        )
      }

      const progress = await getJobProgress(jobId)
      
      return NextResponse.json({
        success: true,
        job_id: jobId,
        progress,
      })
    }

    if (action === 'statistics') {
      const stats = await getScanStatistics()
      
      return NextResponse.json({
        success: true,
        statistics: stats,
      })
    }

    if (action === 'suppliers') {
      const daysBack = parseInt(searchParams.get('days_back') || '30')
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - daysBack)

      const suppliers = await getSuppliersInRange(startDate, endDate)
      
      return NextResponse.json({
        success: true,
        date_range: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        count: suppliers.length,
        suppliers,
      })
    }

    if (action === 'products') {
      const daysBack = parseInt(searchParams.get('days_back') || '30')
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - daysBack)

      const products = await getProductsInRange(startDate, endDate)
      
      return NextResponse.json({
        success: true,
        date_range: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        count: products.length,
        products,
      })
    }

    if (action === 'interactions') {
      const daysBack = parseInt(searchParams.get('days_back') || '30')
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - daysBack)

      const interactions = await getInteractionsInRange(startDate, endDate)
      
      return NextResponse.json({
        success: true,
        date_range: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        count: interactions.length,
        interactions,
      })
    }

    if (action === 'duplicates') {
      const duplicates = await findDuplicateSuppliers()
      
      return NextResponse.json({
        success: true,
        email_duplicates_count: duplicates.email_duplicates.length,
        company_duplicates_count: duplicates.company_duplicates.length,
        duplicates,
      })
    }

    return NextResponse.json(
      { 
        error: 'Invalid action',
        valid_actions: [
          'jobs',
          'job_progress',
          'statistics',
          'suppliers',
          'products',
          'interactions',
          'duplicates',
        ],
      },
      { status: 400 }
    )

  } catch (error: any) {
    console.error('Error fetching scan stats:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch scan statistics', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}
