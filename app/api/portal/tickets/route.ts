import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const supabase = getServerSupabase()
  
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    const { data: tickets, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('portal_user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching tickets:', error)
      return NextResponse.json(
        { error: 'Failed to fetch tickets' },
        { status: 500 }
      )
    }

    return NextResponse.json({ tickets })
  } catch (error: any) {
    console.error('Error in tickets GET:', error)
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const supabase = getServerSupabase()
  
  try {
    const body = await request.json()
    const { portal_user_id, subject, description, category, priority } = body

    if (!portal_user_id || !subject || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get user details
    const { data: user } = await supabase
      .from('portal_users')
      .select('email, full_name')
      .eq('id', portal_user_id)
      .single()

    // Generate ticket number
    const { data: ticketNumber } = await supabase.rpc('generate_ticket_number')

    // Create ticket
    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .insert({
        ticket_number: ticketNumber,
        portal_user_id,
        customer_email: user?.email,
        customer_name: user?.full_name,
        subject,
        description,
        category: category || 'general',
        priority: priority || 'medium',
        status: 'open',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating ticket:', error)
      return NextResponse.json(
        { error: 'Failed to create ticket' },
        { status: 500 }
      )
    }

    // Log audit event
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    await supabase.rpc('log_audit_event', {
      p_portal_user_id: portal_user_id,
      p_action_type: 'create_ticket',
      p_resource_type: 'ticket',
      p_resource_id: ticket.id,
      p_ip_address: ip,
      p_purpose: 'Customer support request',
    })

    // Generate AI status update (async - don't wait)
    generateAIStatus(ticket.id, description).catch(console.error)

    return NextResponse.json({ ticket })
  } catch (error: any) {
    console.error('Error in tickets POST:', error)
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    )
  }
}

async function generateAIStatus(ticketId: string, description: string) {
  // This would call your AI service to generate a status update
  // For now, just a placeholder
  const supabase = getServerSupabase()
  
  const aiStatus = `We've received your request and our team is reviewing it. Based on your description, this appears to be a ${description.length > 100 ? 'detailed' : 'standard'} inquiry. We'll respond within 24 hours.`
  
  await supabase
    .from('support_tickets')
    .update({
      ai_generated_status: aiStatus,
      ai_generated_at: new Date().toISOString(),
    })
    .eq('id', ticketId)
}
