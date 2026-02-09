import { NextRequest, NextResponse } from 'next/server'
import { resilienceManager } from '../../../../lib/resilience'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const servicesHealth = resilienceManager.getAllServicesHealth()
    const metrics = resilienceManager.getAllMetrics()

    const healthData = servicesHealth.map(service => {
      const serviceMetrics = metrics.find(m => m.serviceName === service.name)
      return {
        ...service,
        metrics: serviceMetrics || null
      }
    })

    const overallHealth = {
      healthy: servicesHealth.every(s => s.healthy),
      totalServices: servicesHealth.length,
      healthyServices: servicesHealth.filter(s => s.healthy).length,
      degradedServices: servicesHealth.filter(s => s.degradationActive).length,
      unhealthyServices: servicesHealth.filter(s => !s.healthy).length
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      overall: overallHealth,
      services: healthData
    })
  } catch (error) {
    console.error('Error fetching resilience health:', error)
    return NextResponse.json(
      { error: 'Failed to fetch resilience health' },
      { status: 500 }
    )
  }
}
