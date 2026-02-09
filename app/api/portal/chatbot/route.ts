import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'
import { generateChatbotResponse, detectCustomerIntent, shouldEscalateToTicket } from '@/lib/portal-chatbot'

export async function POST(request: NextRequest) {
  const supabase = getServerSupabase()
  
  try {
    const body = await request.json()
    const { session_id, portal_user_id, message } = body

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    let sessionId = session_id
    let session: any

    // Get or create session
    if (sessionId) {
      const { data } = await supabase
        .from('chatbot_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single()
      session = data
    }

    if (!session) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const { data: newSession, error: sessionError } = await supabase
        .from('chatbot_sessions')
        .insert({
          session_id: sessionId,
          portal_user_id,
          status: 'active',
          context: { messages: [] },
        })
        .select()
        .single()

      if (sessionError) {
        console.error('Error creating session:', sessionError)
        return NextResponse.json(
          { error: 'Failed to create session' },
          { status: 500 }
        )
      }
      session = newSession
    }

    // Detect customer intent
    const intent = detectCustomerIntent(message)

    // Save customer message
    await supabase
      .from('chatbot_messages')
      .insert({
        session_id: session.id,
        sender_type: 'customer',
        message,
        intent,
      })

    // Get relevant knowledge base articles
    const { data: kbArticles } = await supabase
      .from('knowledge_base')
      .select('title, content, category')
      .eq('status', 'active')
      .limit(3)

    // Get user's past interactions for context
    let contextData: any = {}
    if (portal_user_id) {
      const { data: user } = await supabase
        .from('portal_users')
        .select('email, full_name, company_name')
        .eq('id', portal_user_id)
        .single()

      if (user) {
        contextData.customerName = user.full_name
        contextData.customerEmail = user.email
        contextData.companyName = user.company_name

        const { data: recentOrders } = await supabase
          .from('opencart_orders_cache')
          .select('order_id, order_status, order_total')
          .eq('customer_email', user.email)
          .order('order_date', { ascending: false })
          .limit(3)

        const { data: recentTickets } = await supabase
          .from('support_tickets')
          .select('ticket_number, subject, status')
          .eq('portal_user_id', portal_user_id)
          .order('created_at', { ascending: false })
          .limit(3)

        contextData.recentOrders = recentOrders || []
        contextData.recentTickets = recentTickets || []
      }
    }

    contextData.knowledgeBase = kbArticles || []

    // Get conversation history
    const { data: previousMessages } = await supabase
      .from('chatbot_messages')
      .select('sender_type, message')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true })
      .limit(10)

    const conversationHistory = previousMessages?.slice(-5).map(m => ({
      role: m.sender_type === 'customer' ? 'user' as const : 'assistant' as const,
      content: m.message,
    })) || []

    // Generate AI response
    const { message: botMessage, sources } = await generateChatbotResponse(
      message,
      conversationHistory,
      contextData
    )

    // Check if we should escalate to ticket
    const shouldEscalate = shouldEscalateToTicket(message, intent)

    // Save bot response
    const { data: savedBotMessage } = await supabase
      .from('chatbot_messages')
      .insert({
        session_id: session.id,
        sender_type: 'bot',
        message: botMessage,
        intent,
        sources: sources || [],
        metadata: {
          should_escalate: shouldEscalate,
        },
      })
      .select()
      .single()

    // Update session activity
    await supabase
      .from('chatbot_sessions')
      .update({
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', session.id)

    return NextResponse.json({
      session_id: sessionId,
      message: savedBotMessage,
      sources: sources || [],
      should_escalate: shouldEscalate,
    })
  } catch (error: any) {
    console.error('Error in chatbot:', error)
    return NextResponse.json(
      { error: 'An error occurred processing your message' },
      { status: 500 }
    )
  }
}
