import { NextRequest, NextResponse } from 'next/server'
import { resilienceManager } from '../../../../lib/resilience'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { serviceName } = body

    if (serviceName) {
      resilienceManager.resetService(serviceName)
      return NextResponse.json({
        success: true,
        message: `Service ${serviceName} has been reset`
      })
    }

    resilienceManager.resetAll()
    return NextResponse.json({
      success: true,
      message: 'All services have been reset'
    })
  } catch (error) {
    console.error('Error resetting resilience state:', error)
    return NextResponse.json(
      { error: 'Failed to reset resilience state' },
      { status: 500 }
    )
  }
}
