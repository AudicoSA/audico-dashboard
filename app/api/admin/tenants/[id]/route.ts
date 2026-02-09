import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getServerSupabase()
    const { id } = await params

    const { data: tenant, error } = await supabase
      .from('reseller_tenants')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching tenant:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    return NextResponse.json({ tenant })
  } catch (error: any) {
    console.error('Error in GET /api/admin/tenants/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getServerSupabase()
    const { id } = await params
    const body = await request.json()

    const { data: tenant, error } = await supabase
      .from('reseller_tenants')
      .update(body)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating tenant:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tenant })
  } catch (error: any) {
    console.error('Error in PUT /api/admin/tenants/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getServerSupabase()
    const { id } = await params

    const { error } = await supabase
      .from('reseller_tenants')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting tenant:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/tenants/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
