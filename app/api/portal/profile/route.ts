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

    const { data: user, error } = await supabase
      .from('portal_users')
      .select('*, customer_profiles(*)')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error fetching profile:', error)
      return NextResponse.json(
        { error: 'Failed to fetch profile' },
        { status: 500 }
      )
    }

    // Get reseller status if applicable
    let resellerStatus = null
    if (user.email) {
      const { data: resellerApp } = await supabase
        .from('reseller_applications')
        .select('*')
        .eq('contact_email', user.email)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      resellerStatus = resellerApp
    }

    // Log audit event
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    await supabase.rpc('log_audit_event', {
      p_portal_user_id: userId,
      p_action_type: 'view_profile',
      p_resource_type: 'profile',
      p_resource_id: userId,
      p_ip_address: ip,
      p_data_accessed: ['email', 'full_name', 'company_name', 'phone'],
      p_purpose: 'Customer viewing own profile',
    })

    return NextResponse.json({
      user,
      resellerStatus,
    })
  } catch (error: any) {
    console.error('Error in profile GET:', error)
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  const supabase = getServerSupabase()
  
  try {
    const body = await request.json()
    const { user_id, full_name, company_name, phone, preferences } = body

    if (!user_id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    const updateData: any = {}
    if (full_name !== undefined) updateData.full_name = full_name
    if (company_name !== undefined) updateData.company_name = company_name
    if (phone !== undefined) updateData.phone = phone
    if (preferences !== undefined) updateData.preferences = preferences

    const { data: user, error } = await supabase
      .from('portal_users')
      .update(updateData)
      .eq('id', user_id)
      .select()
      .single()

    if (error) {
      console.error('Error updating profile:', error)
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      )
    }

    // Log audit event
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    await supabase.rpc('log_audit_event', {
      p_portal_user_id: user_id,
      p_action_type: 'update_profile',
      p_resource_type: 'profile',
      p_resource_id: user_id,
      p_ip_address: ip,
      p_action_details: updateData,
      p_purpose: 'Customer updating profile information',
    })

    return NextResponse.json({ user })
  } catch (error: any) {
    console.error('Error in profile PUT:', error)
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    )
  }
}
