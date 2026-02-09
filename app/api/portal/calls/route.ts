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

    // Get scheduled calls
    const { data: calls, error } = await supabase
      .from('scheduled_calls')
      .select('*, call_transcripts(*)')
      .eq('portal_user_id', userId)
      .order('scheduled_for', { ascending: false })

    if (error) {
      console.error('Error fetching calls:', error)
      return NextResponse.json(
        { error: 'Failed to fetch calls' },
        { status: 500 }
      )
    }

    return NextResponse.json({ calls })
  } catch (error: any) {
    console.error('Error in calls GET:', error)
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
    const { portal_user_id, scheduled_for, duration_minutes, purpose, phone } = body

    if (!portal_user_id || !scheduled_for || !phone) {
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

    // Create scheduled call
    const { data: call, error } = await supabase
      .from('scheduled_calls')
      .insert({
        portal_user_id,
        customer_name: user?.full_name,
        customer_email: user?.email,
        customer_phone: phone,
        scheduled_for,
        duration_minutes: duration_minutes || 30,
        purpose,
        status: 'scheduled',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating call:', error)
      return NextResponse.json(
        { error: 'Failed to schedule call' },
        { status: 500 }
      )
    }

    // Log audit event
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    await supabase.rpc('log_audit_event', {
      p_portal_user_id: portal_user_id,
      p_action_type: 'schedule_call',
      p_resource_type: 'call',
      p_resource_id: call.id,
      p_ip_address: ip,
      p_purpose: 'Customer scheduling call',
    })

    return NextResponse.json({ call })
  } catch (error: any) {
    console.error('Error in calls POST:', error)
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    )
  }
}
