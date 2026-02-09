import { NextRequest, NextResponse } from 'next/server'
import { resilienceMonitoring } from '../../../../lib/resilience/monitoring'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const summary = resilienceMonitoring.getHealthSummary()
    
    await resilienceMonitoring.logToSupabase(supabase)

    const unhealthyServices = summary.services.filter(s => s.status === 'Unhealthy')
    
    if (unhealthyServices.length > 0) {
      await supabase
        .from('squad_messages')
        .insert({
          from_agent: 'System',
          to_agent: 'Jarvis',
          message: `⚠️ Resilience Alert: ${unhealthyServices.length} service(s) unhealthy`,
          data: {
            action: 'resilience_alert',
            summary,
            timestamp: new Date().toISOString()
          }
        })
    }

    return NextResponse.json({
      success: true,
      summary,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Health check failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
