import { NextRequest, NextResponse } from 'next/server'
import { intelligenceEvolution } from '@/services/agents/intelligence-evolution'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const agentName = searchParams.get('agentName')
    const status = searchParams.get('status')

    let query = supabase
      .from('prompt_experiments')
      .select(`
        *,
        control_version:prompt_versions!control_version_id(*),
        test_version:prompt_versions!test_version_id(*)
      `)

    if (agentName) {
      query = query.eq('agent_name', agentName)
    }

    if (status) {
      query = query.eq('status', status)
    }

    query = query.order('created_at', { ascending: false })

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      experiments: data
    })
  } catch (error: any) {
    console.error('Error fetching experiments:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch experiments' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, agentName, decisionType, controlVersionId, testVersionId, trafficSplit, targetSampleSize } = body

    if (!name || !agentName || !decisionType || !controlVersionId || !testVersionId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    const experimentId = await intelligenceEvolution.createExperiment({
      name,
      description,
      agentName,
      decisionType,
      controlVersionId,
      testVersionId,
      trafficSplit,
      targetSampleSize
    })

    return NextResponse.json({
      success: true,
      experimentId
    })
  } catch (error: any) {
    console.error('Error creating experiment:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create experiment' },
      { status: 500 }
    )
  }
}
