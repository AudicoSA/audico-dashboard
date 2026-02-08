import { getServerSupabase } from './supabase'

export async function logAgentActivity(params: {
  agentName: string
  logLevel: 'info' | 'warning' | 'error' | 'critical'
  eventType: string
  message: string
  errorDetails?: any
  context?: any
}) {
  const supabase = getServerSupabase()
  
  const { error } = await supabase.from('agent_logs').insert({
    agent_name: params.agentName,
    log_level: params.logLevel,
    event_type: params.eventType,
    message: params.message,
    error_details: params.errorDetails || null,
    context: params.context || {}
  })

  if (error) {
    console.error('Failed to log agent activity:', error)
  }

  if (params.logLevel === 'critical' || params.logLevel === 'error') {
    await triggerAlert(params)
  }
}

async function triggerAlert(params: {
  agentName: string
  logLevel: string
  eventType: string
  message: string
  errorDetails?: any
}) {
  try {
    const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    await fetch(`${url}/api/alerts/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    })
  } catch (error) {
    console.error('Failed to trigger alert:', error)
  }
}
