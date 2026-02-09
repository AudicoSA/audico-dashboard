import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const supabase = getServerSupabase()
  
  try {
    const { email, password, full_name, company_name, phone } = await request.json()
    
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      )
    }

    // Try to find existing customer profile
    const { data: existingProfile } = await supabase
      .from('customer_profiles')
      .select('id')
      .eq('primary_email', email)
      .single()

    // Create portal user record
    const { data: portalUser, error: portalError } = await supabase
      .from('portal_users')
      .insert({
        auth_user_id: authData.user.id,
        email,
        full_name,
        company_name,
        phone,
        customer_profile_id: existingProfile?.id || null,
        email_verified: false,
      })
      .select()
      .single()

    if (portalError) {
      console.error('Error creating portal user:', portalError)
      return NextResponse.json(
        { error: 'Failed to create portal user' },
        { status: 500 }
      )
    }

    // Log audit event
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    const userAgent = request.headers.get('user-agent')
    
    await supabase.rpc('log_audit_event', {
      p_portal_user_id: portalUser.id,
      p_action_type: 'register',
      p_ip_address: ip,
      p_user_agent: userAgent,
      p_purpose: 'User registration',
    })

    return NextResponse.json({
      user: authData.user,
      portalUser,
      message: 'Registration successful. Please check your email to verify your account.',
    })
  } catch (error: any) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'An error occurred during registration' },
      { status: 500 }
    )
  }
}
