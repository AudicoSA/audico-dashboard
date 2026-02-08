/**
 * Quote Chat Integration - Usage Examples
 * 
 * This file contains example code snippets for using the Quote Chat Integration API.
 * These examples can be used in various parts of the application.
 */

// Example 1: Fetch active quote sessions
export async function fetchActiveQuoteSessions() {
  const response = await fetch('/api/integrations/quote-chat?action=active&limit=20')
  const data = await response.json()
  
  if (data.success) {
    console.log(`Found ${data.count} active sessions`)
    data.sessions.forEach((session: any) => {
      console.log(`Session ${session.session_id}: ${session.customer_email} - ${session.status}`)
    })
  }
  
  return data.sessions
}

// Example 2: Get specific session with messages
export async function getQuoteSessionDetails(sessionId: string) {
  const response = await fetch(
    `/api/integrations/quote-chat?action=session&session_id=${sessionId}`
  )
  const data = await response.json()
  
  if (data.success) {
    console.log('Session:', data.session)
    console.log('Messages:', data.messages.length)
    console.log('Stats:', data.stats)
  }
  
  return data
}

// Example 3: Search for customer's quote sessions
export async function findCustomerQuoteSessions(email: string) {
  const response = await fetch(
    `/api/integrations/quote-chat?action=search&email=${encodeURIComponent(email)}`
  )
  const data = await response.json()
  
  if (data.success) {
    console.log(`Customer ${email} has ${data.count} quote sessions`)
  }
  
  return data.sessions
}

// Example 4: Link an email to a quote session
export async function linkEmailToSession(
  emailId: string,
  sessionId: string,
  senderEmail: string
) {
  const response = await fetch('/api/integrations/quote-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'link_email',
      email_id: emailId,
      session_id: sessionId,
      email_sender: senderEmail,
    }),
  })
  
  const data = await response.json()
  
  if (data.success) {
    console.log(`Email ${emailId} linked to session ${sessionId}`)
  }
  
  return data
}

// Example 5: Process an email for quote request detection
export async function processEmailForQuote(
  emailId: string,
  sender: string,
  subject: string,
  body: string
) {
  const response = await fetch('/api/integrations/quote-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'process_email_quote',
      email_id: emailId,
      email_sender: sender,
      email_subject: subject,
      email_body: body,
    }),
  })
  
  const data = await response.json()
  
  if (data.success) {
    if (data.quote_request) {
      console.log(`Quote request created: ${data.quote_request.quote_number}`)
    } else if (data.linked) {
      console.log('Email linked to existing session')
    } else {
      console.log('No quote session found for customer')
    }
  }
  
  return data
}

// Example 6: Create a quote request from a session
export async function createQuoteFromSession(sessionId: string, emailId?: string) {
  const response = await fetch('/api/integrations/quote-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'create_quote',
      session_id: sessionId,
      email_id: emailId,
    }),
  })
  
  const data = await response.json()
  
  if (data.success) {
    console.log(`Quote ${data.quote_request.quote_number} created`)
    console.log(`PDF generation: ${data.pdf_generation_triggered ? 'triggered' : 'failed'}`)
  }
  
  return data
}

// Example 7: Sync customer data for a session
export async function syncCustomerData(sessionId: string) {
  const response = await fetch('/api/integrations/quote-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'sync_customer',
      session_id: sessionId,
    }),
  })
  
  const data = await response.json()
  
  if (data.success) {
    console.log(`Customer data synced for session ${sessionId}`)
  }
  
  return data
}

// Example 8: Update session status
export async function updateSessionStatus(
  sessionId: string,
  status: 'active' | 'pending_quote' | 'quote_sent' | 'completed' | 'abandoned',
  metadata?: Record<string, any>
) {
  const response = await fetch('/api/integrations/quote-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'update_status',
      session_id: sessionId,
      status,
      metadata,
    }),
  })
  
  const data = await response.json()
  
  if (data.success) {
    console.log(`Session ${sessionId} status updated to ${status}`)
  }
  
  return data
}

// Example 9: Add a message to a session
export async function addMessageToSession(
  sessionId: string,
  message: string,
  senderType: 'customer' | 'agent' | 'system' = 'system',
  senderName?: string,
  attachments?: string[]
) {
  const response = await fetch('/api/integrations/quote-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'add_message',
      session_id: sessionId,
      sender_type: senderType,
      sender_name: senderName,
      message,
      attachments: attachments || [],
      metadata: {},
    }),
  })
  
  const data = await response.json()
  
  if (data.success) {
    console.log(`Message added to session ${sessionId}`)
  }
  
  return data
}

// Example 10: Sync all active sessions
export async function syncAllActiveSessions() {
  const response = await fetch('/api/integrations/quote-chat?action=sync')
  const data = await response.json()
  
  if (data.success) {
    console.log(`Synced ${data.synced} of ${data.total} sessions`)
  }
  
  return data
}

// Example 11: Integration with Email Agent
export async function handleIncomingEmail(emailLog: any) {
  // Check if email is from a customer with active quote sessions
  const sessions = await findCustomerQuoteSessions(emailLog.from_email)
  
  if (sessions.length > 0) {
    console.log(`Customer has ${sessions.length} existing quote sessions`)
    
    // Process email for quote request
    const result = await processEmailForQuote(
      emailLog.id,
      emailLog.from_email,
      emailLog.subject,
      emailLog.payload?.body || ''
    )
    
    if (result.quote_request) {
      // Quote was automatically created
      return {
        action: 'quote_created',
        quote_number: result.quote_request.quote_number,
      }
    } else if (result.linked) {
      // Email was linked to existing session
      return {
        action: 'email_linked',
        session_id: result.session?.session_id,
      }
    }
  }
  
  return { action: 'no_quote_session' }
}

// Example 12: Dashboard widget - Active quote sessions
export async function getActiveQuotesForDashboard() {
  const sessions = await fetchActiveQuoteSessions()
  
  const summary = {
    total: sessions.length,
    pending_quote: sessions.filter((s: any) => s.status === 'pending_quote').length,
    active: sessions.filter((s: any) => s.status === 'active').length,
    quote_sent: sessions.filter((s: any) => s.status === 'quote_sent').length,
    by_customer: sessions.reduce((acc: any, s: any) => {
      const email = s.customer_email || 'unknown'
      acc[email] = (acc[email] || 0) + 1
      return acc
    }, {}),
  }
  
  return {
    sessions,
    summary,
  }
}

// Example 13: Automated follow-up
export async function checkStaleQuoteSessions() {
  const sessions = await fetchActiveQuoteSessions()
  const now = new Date()
  const staleThresholdHours = 48
  
  const staleSessions = sessions.filter((session: any) => {
    const lastActivity = new Date(session.last_activity_at)
    const hoursSinceActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60)
    return hoursSinceActivity > staleThresholdHours
  })
  
  console.log(`Found ${staleSessions.length} stale sessions`)
  
  for (const session of staleSessions) {
    await addMessageToSession(
      session.session_id,
      'This quote session has been inactive for 48 hours. Following up with customer.',
      'system',
      'Auto Follow-up'
    )
  }
  
  return staleSessions
}

// Example 14: Quote analytics
export async function getQuoteAnalytics() {
  const sessions = await fetchActiveQuoteSessions()
  
  const analytics = {
    total_sessions: sessions.length,
    total_value: sessions.reduce((sum: number, s: any) => sum + (s.total_amount || 0), 0),
    avg_value: 0,
    by_status: {} as Record<string, number>,
    by_currency: {} as Record<string, number>,
  }
  
  analytics.avg_value = analytics.total_sessions > 0 
    ? analytics.total_value / analytics.total_sessions 
    : 0
  
  sessions.forEach((session: any) => {
    analytics.by_status[session.status] = (analytics.by_status[session.status] || 0) + 1
    analytics.by_currency[session.currency] = (analytics.by_currency[session.currency] || 0) + 1
  })
  
  return analytics
}

// Example 15: Error handling pattern
export async function safeQuoteOperation<T>(
  operation: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    console.error('Quote operation failed:', error)
    // Log to agent_logs
    await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent: 'quote_chat_integration',
        level: 'error',
        event_type: 'operation_failed',
        context: { error: (error as Error).message },
      }),
    })
    return fallback
  }
}
