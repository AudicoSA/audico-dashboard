export async function logClientError(params: {
  agentName: string
  logLevel: 'info' | 'warning' | 'error' | 'critical'
  eventType: string
  message: string
  errorDetails?: any
  context?: any
}) {
  try {
    await fetch('/api/logs/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    })
  } catch (error) {
    console.error('Failed to log client error:', error)
  }
}
