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
      .from('prompt_approval_queue')
      .select(`
        *,
        prompt_version:prompt_versions!prompt_version_id(*),
        experiment:prompt_experiments(*),
        learning_insight:agent_learning_insights(*)
      `)
      .eq('id', id)
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      approval: data
    })
  } catch (error: any) {
    console.error('Error fetching approval:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch approval' },
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
    const { action, reviewedBy, reviewerNotes, rolloutPercentage } = body

    if (!reviewedBy) {
      return NextResponse.json(
        { error: 'reviewedBy is required' },
        { status: 400 }
      )
    }

    if (action === 'approve') {
      await intelligenceEvolution.approvePromptChange(
        id,
        reviewedBy,
        reviewerNotes || '',
        rolloutPercentage || 100
      )

      return NextResponse.json({
        success: true,
        message: 'Prompt change approved and activated'
      })
    } else if (action === 'reject') {
      const { error } = await supabase
        .from('prompt_approval_queue')
        .update({
          status: 'rejected',
          reviewed_by: reviewedBy,
          reviewed_at: new Date().toISOString(),
          reviewer_notes: reviewerNotes
        })
        .eq('id', id)

      if (error) throw error

      return NextResponse.json({
        success: true,
        message: 'Prompt change rejected'
      })
    } else if (action === 'needs_revision') {
      const { error } = await supabase
        .from('prompt_approval_queue')
        .update({
          status: 'needs_revision',
          reviewed_by: reviewedBy,
          reviewed_at: new Date().toISOString(),
          reviewer_notes: reviewerNotes
        })
        .eq('id', id)

      if (error) throw error

      return NextResponse.json({
        success: true,
        message: 'Prompt change requires revision'
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Error processing approval:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process approval' },
      { status: 500 }
    )
  }
}
