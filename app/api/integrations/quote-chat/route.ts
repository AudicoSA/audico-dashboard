import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  getActiveQuoteSessions,
  getQuoteSessionById,
  getQuoteSessionMessages,
  updateQuoteSessionStatus,
  createQuoteSessionMessage,
  searchQuoteSessionsByCustomer,
  getQuoteSessionStats,
  generateQuoteNumber,
  linkEmailToQuoteSession,
  extractQuoteRequestFromEmail,
} from '@/lib/quote-chat'
import { getServerSupabase } from '@/lib/supabase'
import type { QuoteChatSession, QuoteRequest } from '@/lib/supabase'

const dashboardSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function logToSquadMessages(fromAgent: string, message: string, data: any = null) {
  await dashboardSupabase
    .from('squad_messages')
    .insert({
      from_agent: fromAgent,
      to_agent: null,
      message,
      task_id: null,
      data,
    })
}

async function syncCustomerData(session: QuoteChatSession): Promise<void> {
  if (!session.customer_email && !session.customer_phone) {
    return
  }

  const customerId = session.customer_email || session.customer_phone || session.session_id

  const interactionData = {
    customer_id: customerId,
    customer_name: session.customer_name,
    customer_email: session.customer_email,
    customer_phone: session.customer_phone,
    interaction_type: 'chat' as const,
    interaction_source: 'audico-quote-chat',
    interaction_date: session.last_activity_at,
    subject: `Quote Request: ${session.company_name || 'General Inquiry'}`,
    summary: `Quote chat session - Status: ${session.status}`,
    sentiment: null,
    outcome: session.status === 'completed' ? 'resolved' : null,
    priority: session.status === 'pending_quote' ? 'high' : 'medium' as const,
    status: session.status === 'completed' ? 'completed' : 'pending' as const,
    assigned_agent: 'quote_agent',
    reference_id: session.session_id,
    reference_type: 'quote_chat_session',
    details: {
      session_id: session.session_id,
      quote_items: session.quote_items,
      total_amount: session.total_amount,
      currency: session.currency,
      company_name: session.company_name,
      messages_count: session.messages?.length || 0,
      ...session.metadata,
    },
  }

  const { data: existing } = await dashboardSupabase
    .from('customer_interactions')
    .select('id')
    .eq('reference_id', session.session_id)
    .eq('reference_type', 'quote_chat_session')
    .single()

  if (existing) {
    await dashboardSupabase
      .from('customer_interactions')
      .update({
        ...interactionData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
  } else {
    await dashboardSupabase
      .from('customer_interactions')
      .insert(interactionData)
  }

  await logToSquadMessages(
    'quote_chat_integration',
    `Customer data synced for session: ${session.session_id}`,
    {
      action: 'customer_sync',
      session_id: session.session_id,
      customer_id: customerId,
    }
  )
}

async function createQuoteRequestFromSession(
  session: QuoteChatSession,
  emailId?: string
): Promise<QuoteRequest | null> {
  if (!session.customer_email) {
    console.error('Cannot create quote request without customer email')
    return null
  }

  const quoteNumber = generateQuoteNumber()
  const validUntil = new Date()
  validUntil.setDate(validUntil.getDate() + 30)

  const quoteData = {
    session_id: session.session_id,
    email_id: emailId || null,
    customer_name: session.customer_name || 'Customer',
    customer_email: session.customer_email,
    customer_phone: session.customer_phone,
    company_name: session.company_name,
    items: session.quote_items || [],
    notes: session.metadata?.notes || null,
    status: 'pending' as const,
    quote_number: quoteNumber,
    quote_amount: session.total_amount,
    quote_pdf_url: null,
    valid_until: validUntil.toISOString(),
    generated_by: 'quote_agent',
    metadata: {
      session_id: session.session_id,
      created_from_chat: true,
      linked_email: emailId,
      ...session.metadata,
    },
  }

  const { data, error } = await dashboardSupabase
    .from('quote_requests')
    .insert(quoteData)
    .select()
    .single()

  if (error) {
    console.error('Error creating quote request:', error)
    return null
  }

  await logToSquadMessages(
    'quote_chat_integration',
    `Quote request created: ${quoteNumber}`,
    {
      action: 'quote_request_created',
      quote_number: quoteNumber,
      session_id: session.session_id,
      quote_id: data?.id,
    }
  )

  return data
}

async function triggerPdfGeneration(quoteRequest: QuoteRequest): Promise<boolean> {
  try {
    await dashboardSupabase
      .from('squad_messages')
      .insert({
        from_agent: 'quote_chat_integration',
        to_agent: 'quote_agent',
        message: `Generate PDF quote for ${quoteRequest.quote_number}`,
        task_id: quoteRequest.id,
        data: {
          action: 'generate_pdf',
          quote_id: quoteRequest.id,
          quote_number: quoteRequest.quote_number,
          customer_email: quoteRequest.customer_email,
          items: quoteRequest.items,
          total_amount: quoteRequest.quote_amount,
        },
      })

    await dashboardSupabase
      .from('quote_requests')
      .update({
        status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', quoteRequest.id)

    await logToSquadMessages(
      'quote_chat_integration',
      `PDF generation triggered for quote: ${quoteRequest.quote_number}`,
      {
        action: 'pdf_generation_triggered',
        quote_id: quoteRequest.id,
      }
    )

    return true
  } catch (error) {
    console.error('Error triggering PDF generation:', error)
    return false
  }
}

async function linkEmailResponseToQuoteChat(
  emailId: string,
  emailSender: string,
  emailSubject: string,
  emailBody: string
): Promise<{ linked: boolean; session?: QuoteChatSession; quote_request?: QuoteRequest }> {
  const sessions = await searchQuoteSessionsByCustomer(emailSender)
  
  if (sessions.length === 0) {
    return { linked: false }
  }

  const activeSessions = sessions.filter(s => s.status === 'active' || s.status === 'pending_quote')
  const targetSession = activeSessions.length > 0 ? activeSessions[0] : sessions[0]

  const linked = await linkEmailToQuoteSession(emailId, targetSession.session_id, emailSender)
  
  if (!linked) {
    return { linked: false }
  }

  const quoteAnalysis = extractQuoteRequestFromEmail(emailSubject, emailBody, emailSender)
  
  if (quoteAnalysis.isQuoteRequest) {
    await createQuoteSessionMessage(
      targetSession.session_id,
      'system',
      `Email quote request received: ${emailSubject}\n\nItems identified: ${quoteAnalysis.items.length}`,
      'Email Integration',
      [],
      {
        email_id: emailId,
        quote_items: quoteAnalysis.items,
        notes: quoteAnalysis.notes,
      }
    )

    await updateQuoteSessionStatus(targetSession.session_id, 'pending_quote', {
      ...targetSession.metadata,
      pending_email_quote: emailId,
    })

    const quoteRequest = await createQuoteRequestFromSession(targetSession, emailId)
    
    if (quoteRequest) {
      await triggerPdfGeneration(quoteRequest)
      return { linked: true, session: targetSession, quote_request: quoteRequest }
    }
  }

  return { linked: true, session: targetSession }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const sessionId = searchParams.get('session_id')
    const email = searchParams.get('email')
    const phone = searchParams.get('phone')
    const name = searchParams.get('name')
    const limit = parseInt(searchParams.get('limit') || '50')

    await logToSquadMessages(
      'quote_chat_integration',
      `API request: ${action || 'list'}`,
      { action, sessionId, email, phone }
    )

    if (action === 'active') {
      const sessions = await getActiveQuoteSessions(limit)
      return NextResponse.json({
        success: true,
        sessions,
        count: sessions.length,
      })
    }

    if (action === 'session' && sessionId) {
      const session = await getQuoteSessionById(sessionId)
      
      if (!session) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        )
      }

      const messages = await getQuoteSessionMessages(sessionId)
      const stats = await getQuoteSessionStats(sessionId)

      return NextResponse.json({
        success: true,
        session,
        messages,
        stats,
      })
    }

    if (action === 'search') {
      const sessions = await searchQuoteSessionsByCustomer(email || undefined, phone || undefined, name || undefined, limit)
      
      return NextResponse.json({
        success: true,
        sessions,
        count: sessions.length,
      })
    }

    if (action === 'sync') {
      const sessions = await getActiveQuoteSessions(limit)
      let syncedCount = 0

      for (const session of sessions) {
        try {
          await syncCustomerData(session)
          syncedCount++
        } catch (error) {
          console.error(`Failed to sync session ${session.session_id}:`, error)
        }
      }

      return NextResponse.json({
        success: true,
        synced: syncedCount,
        total: sessions.length,
      })
    }

    const sessions = await getActiveQuoteSessions(limit)
    
    return NextResponse.json({
      success: true,
      sessions,
      count: sessions.length,
    })
  } catch (error: any) {
    console.error('Quote chat integration error:', error)
    await logToSquadMessages(
      'quote_chat_integration',
      `Error: ${error.message}`,
      {
        action: 'error',
        error: error.message,
        stack: error.stack,
      }
    )

    return NextResponse.json(
      {
        error: 'Failed to process quote chat request',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, session_id, email_id, email_sender, email_subject, email_body } = body

    await logToSquadMessages(
      'quote_chat_integration',
      `POST request: ${action}`,
      { action, session_id, email_id }
    )

    if (action === 'link_email' && email_id && session_id && email_sender) {
      const linked = await linkEmailToQuoteSession(email_id, session_id, email_sender)
      
      if (!linked) {
        return NextResponse.json(
          { error: 'Failed to link email to session' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        linked: true,
        session_id,
        email_id,
      })
    }

    if (action === 'process_email_quote' && email_id && email_sender && email_subject && email_body) {
      const result = await linkEmailResponseToQuoteChat(
        email_id,
        email_sender,
        email_subject,
        email_body
      )

      return NextResponse.json({
        success: true,
        ...result,
      })
    }

    if (action === 'create_quote' && session_id) {
      const session = await getQuoteSessionById(session_id)
      
      if (!session) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        )
      }

      const quoteRequest = await createQuoteRequestFromSession(session, email_id)
      
      if (!quoteRequest) {
        return NextResponse.json(
          { error: 'Failed to create quote request' },
          { status: 500 }
        )
      }

      const pdfTriggered = await triggerPdfGeneration(quoteRequest)

      return NextResponse.json({
        success: true,
        quote_request: quoteRequest,
        pdf_generation_triggered: pdfTriggered,
      })
    }

    if (action === 'sync_customer' && session_id) {
      const session = await getQuoteSessionById(session_id)
      
      if (!session) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        )
      }

      await syncCustomerData(session)

      return NextResponse.json({
        success: true,
        synced: true,
        session_id,
      })
    }

    if (action === 'update_status' && session_id && body.status) {
      const updated = await updateQuoteSessionStatus(
        session_id,
        body.status,
        body.metadata
      )

      if (!updated) {
        return NextResponse.json(
          { error: 'Failed to update session status' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        session: updated,
      })
    }

    if (action === 'add_message' && session_id && body.message) {
      const message = await createQuoteSessionMessage(
        session_id,
        body.sender_type || 'system',
        body.message,
        body.sender_name,
        body.attachments || [],
        body.metadata || {}
      )

      if (!message) {
        return NextResponse.json(
          { error: 'Failed to create message' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message,
      })
    }

    return NextResponse.json(
      { error: 'Invalid action or missing required parameters' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Quote chat integration POST error:', error)
    await logToSquadMessages(
      'quote_chat_integration',
      `POST Error: ${error.message}`,
      {
        action: 'error',
        error: error.message,
        stack: error.stack,
      }
    )

    return NextResponse.json(
      {
        error: 'Failed to process quote chat request',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
