import { NextRequest, NextResponse } from 'next/server'
import { resilienceManager } from '../../../../lib/resilience'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const serviceName = searchParams.get('service')

    if (serviceName) {
      const metrics = resilienceManager.getServiceMetrics(serviceName)
      const health = resilienceManager.getServiceHealth(serviceName)

      if (!metrics || !health) {
        return NextResponse.json(
          { error: `Service ${serviceName} not found` },
          { status: 404 }
        )
      }

      return NextResponse.json({
        service: serviceName,
        metrics,
        health
      })
    }

    const allMetrics = resilienceManager.getAllMetrics()
    const allHealth = resilienceManager.getAllServicesHealth()

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      metrics: allMetrics,
      health: allHealth
    })
  } catch (error) {
    console.error('Error fetching resilience metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch resilience metrics' },
      { status: 500 }
    )
  }
}
