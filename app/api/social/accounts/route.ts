import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform')

    let query = supabase
      .from('social_accounts')
      .select('*')
      .order('created_at', { ascending: false })

    if (platform) {
      query = query.eq('platform', platform)
    }

    const { data: accounts, error } = await query

    if (error) {
      console.error('Error fetching social accounts:', error)
      return NextResponse.json(
        { error: 'Failed to fetch social accounts' },
        { status: 500 }
      )
    }

    return NextResponse.json({ accounts: accounts || [] })
  } catch (error) {
    console.error('Social accounts GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch social accounts' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      platform,
      account_id,
      account_name,
      access_token,
      refresh_token,
      token_expires_at,
      metadata,
    } = body

    if (!platform || !account_id || !account_name || !access_token) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const { data: account, error } = await supabase
      .from('social_accounts')
      .insert({
        platform,
        account_id,
        account_name,
        access_token,
        refresh_token,
        token_expires_at,
        metadata: metadata || {},
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating social account:', error)
      return NextResponse.json(
        { error: 'Failed to create social account' },
        { status: 500 }
      )
    }

    return NextResponse.json({ account })
  } catch (error) {
    console.error('Social accounts POST error:', error)
    return NextResponse.json(
      { error: 'Failed to create social account' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('social_accounts')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting social account:', error)
      return NextResponse.json(
        { error: 'Failed to delete social account' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Social accounts DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete social account' },
      { status: 500 }
    )
  }
}
