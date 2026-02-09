import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantSlug = searchParams.get('tenant')

    if (!tenantSlug) {
      return NextResponse.json({ error: 'Tenant parameter required' }, { status: 400 })
    }

    const supabase = getServerSupabase()

    const { data: tenant } = await supabase
      .from('reseller_tenants')
      .select('id')
      .eq('subdomain', tenantSlug)
      .single()

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    const { data: apiKeys, error } = await supabase
      .from('tenant_api_keys')
      .select('id, key_name, key_prefix, is_active, usage_count, last_used_at, created_at')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching API keys:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ apiKeys })
  } catch (error: any) {
    console.error('Error in GET /api/tenant/api-keys:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
