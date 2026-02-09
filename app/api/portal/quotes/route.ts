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

    // Get user email
    const { data: user } = await supabase
      .from('portal_users')
      .select('email')
      .eq('id', userId)
      .single()

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get quote requests
    const { data: quotes, error } = await supabase
      .from('quote_requests')
      .select('*')
      .eq('customer_email', user.email)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching quotes:', error)
      return NextResponse.json(
        { error: 'Failed to fetch quotes' },
        { status: 500 }
      )
    }

    // Log audit event
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    await supabase.rpc('log_audit_event', {
      p_portal_user_id: userId,
      p_action_type: 'view_quotes',
      p_resource_type: 'quote',
      p_ip_address: ip,
      p_data_accessed: ['quote_requests', 'quote_amounts', 'quote_status'],
      p_purpose: 'Customer viewing quote history',
    })

    return NextResponse.json({ quotes })
  } catch (error: any) {
    console.error('Error in quotes GET:', error)
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    )
  }
}
