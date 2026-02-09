import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getServerSupabase()
    const { id } = await params

    const { data: usage, error } = await supabase
      .from('tenant_usage_metrics')
      .select('*')
      .eq('tenant_id', id)
      .order('metric_date', { ascending: false })
      .limit(30)

    if (error) {
      console.error('Error fetching usage metrics:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ usage })
  } catch (error: any) {
    console.error('Error in GET /api/admin/tenants/[id]/usage:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
