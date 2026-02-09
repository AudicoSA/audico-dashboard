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

    // Get orders from cache
    const { data: orders, error } = await supabase
      .from('opencart_orders_cache')
      .select('*')
      .eq('customer_email', user.email)
      .order('order_date', { ascending: false })

    if (error) {
      console.error('Error fetching orders:', error)
      return NextResponse.json(
        { error: 'Failed to fetch orders' },
        { status: 500 }
      )
    }

    // Log audit event
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    await supabase.rpc('log_audit_event', {
      p_portal_user_id: userId,
      p_action_type: 'view_orders',
      p_resource_type: 'order',
      p_ip_address: ip,
      p_data_accessed: ['order_history', 'order_total', 'order_status'],
      p_purpose: 'Customer viewing order history',
    })

    return NextResponse.json({ orders })
  } catch (error: any) {
    console.error('Error in orders GET:', error)
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    )
  }
}
