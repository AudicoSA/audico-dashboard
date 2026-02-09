import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getServerSupabase()
  
  try {
    const { id: ticketId } = await params

    const { data: messages, error } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .eq('is_internal', false)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching messages:', error)
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      )
    }

    return NextResponse.json({ messages })
  } catch (error: any) {
    console.error('Error in messages GET:', error)
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getServerSupabase()
  
  try {
    const { id: ticketId } = await params
    const body = await request.json()
    const { portal_user_id, message } = body

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Get user details
    const { data: user } = await supabase
      .from('portal_users')
      .select('full_name')
      .eq('id', portal_user_id)
      .single()

    // Create message
    const { data: newMessage, error } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: ticketId,
        sender_type: 'customer',
        sender_id: portal_user_id,
        sender_name: user?.full_name || 'Customer',
        message,
        is_internal: false,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating message:', error)
      return NextResponse.json(
        { error: 'Failed to create message' },
        { status: 500 }
      )
    }

    // Update ticket status if needed
    await supabase
      .from('support_tickets')
      .update({
        status: 'waiting_internal',
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketId)
      .in('status', ['waiting_customer', 'open'])

    return NextResponse.json({ message: newMessage })
  } catch (error: any) {
    console.error('Error in messages POST:', error)
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    )
  }
}
