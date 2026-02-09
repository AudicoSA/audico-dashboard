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

    const { data: tenant, error } = await supabase
      .from('reseller_tenants')
      .select('*')
      .eq('subdomain', tenantSlug)
      .in('status', ['active', 'pending_setup'])
      .single()

    if (error || !tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    return NextResponse.json({ tenant })
  } catch (error: any) {
    console.error('Error in GET /api/tenant/context:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
