import { NextRequest, NextResponse } from 'next/server'
import { supplierScoringService } from '@/lib/supplier-scoring'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('Starting supplier scoring update cron job')

    const result = await supplierScoringService.updateSupplierScores()

    if (!result.success) {
      return NextResponse.json(
        { 
          success: false,
          error: result.error,
          details: 'Supplier scoring update failed'
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Supplier scoring update completed',
      suppliers_updated: result.suppliers_updated,
      alerts_created: result.alerts_created,
      opportunities_found: result.opportunities_found,
    })

  } catch (error: any) {
    console.error('Cron supplier scoring error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Supplier scoring update failed', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}
