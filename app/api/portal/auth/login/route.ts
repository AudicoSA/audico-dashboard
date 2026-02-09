import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const supabase = getServerSupabase()
  
  try {
    const { email, password } = await request.json()
    
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 401 }
      )
    }

    // Update last login time
    const { error: updateError } = await supabase
      .from('portal_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('auth_user_id', authData.user.id)

    if (updateError) {
      console.error('Error updating last login:', updateError)
    }

    // Log audit event
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    const userAgent = request.headers.get('user-agent')
    
    const { data: portalUser } = await supabase
      .from('portal_users')
      .select('id')
      .eq('auth_user_id', authData.user.id)
      .single()

    if (portalUser) {
      await supabase.rpc('log_audit_event', {
        p_portal_user_id: portalUser.id,
        p_action_type: 'login',
        p_ip_address: ip,
        p_user_agent: userAgent,
        p_purpose: 'User authentication',
      })
    }

    return NextResponse.json({
      user: authData.user,
      session: authData.session,
    })
  } catch (error: any) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    )
  }
}
