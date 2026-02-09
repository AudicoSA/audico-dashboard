import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'
import { generateApiKey } from '@/lib/tenant'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getServerSupabase()
    const { id } = await params

    const { data: apiKeys, error } = await supabase
      .from('tenant_api_keys')
      .select('id, key_name, key_prefix, is_active, usage_count, last_used_at, created_at')
      .eq('tenant_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching API keys:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ apiKeys })
  } catch (error: any) {
    console.error('Error in GET /api/admin/tenants/[id]/api-keys:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getServerSupabase()
    const { id } = await params
    const body = await request.json()

    const { key, prefix, hash } = generateApiKey()

    const { data: apiKey, error } = await supabase
      .from('tenant_api_keys')
      .insert({
        tenant_id: id,
        key_name: body.key_name,
        key_prefix: prefix,
        key_hash: hash,
        permissions: body.permissions || {
          read_products: true,
          write_products: false,
          read_customers: true,
          write_customers: false,
          read_orders: true,
          write_orders: false,
          manage_agents: false,
        },
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating API key:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ apiKey, key }, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/admin/tenants/[id]/api-keys:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
