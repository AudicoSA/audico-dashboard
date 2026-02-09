import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getServerSupabase()
    const { id } = await params

    const { data: customers, error } = await supabase
      .from('tenant_customers')
      .select('*')
      .eq('tenant_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching tenant customers:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ customers })
  } catch (error: any) {
    console.error('Error in GET /api/admin/tenants/[id]/customers:', error)
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

    const { data: customer, error } = await supabase
      .from('tenant_customers')
      .insert({
        tenant_id: id,
        ...body,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating customer:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ customer }, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/admin/tenants/[id]/customers:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
