import { NextRequest, NextResponse } from 'next/server'
import { intelligenceEvolution } from '@/services/agents/intelligence-evolution'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { data, error } = await supabase
      .from('prompt_experiments')
      .select(`
        *,
        control_version:prompt_versions!control_version_id(*),
        test_version:prompt_versions!test_version_id(*)
      `)
      .eq('id', id)
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      experiment: data
    })
  } catch (error: any) {
    console.error('Error fetching experiment:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch experiment' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { action } = body

    if (action === 'update_metrics') {
      await intelligenceEvolution.updateExperimentMetrics(id)

      return NextResponse.json({
        success: true,
        message: 'Experiment metrics updated'
      })
    } else if (action === 'pause') {
      const { error } = await supabase
        .from('prompt_experiments')
        .update({ status: 'paused' })
        .eq('id', id)

      if (error) throw error

      return NextResponse.json({
        success: true,
        message: 'Experiment paused'
      })
    } else if (action === 'resume') {
      const { error } = await supabase
        .from('prompt_experiments')
        .update({ status: 'running' })
        .eq('id', id)

      if (error) throw error

      return NextResponse.json({
        success: true,
        message: 'Experiment resumed'
      })
    } else if (action === 'cancel') {
      const { error } = await supabase
        .from('prompt_experiments')
        .update({ status: 'cancelled', end_date: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error

      return NextResponse.json({
        success: true,
        message: 'Experiment cancelled'
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Error updating experiment:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update experiment' },
      { status: 500 }
    )
  }
}
