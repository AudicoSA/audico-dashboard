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
    const decisionType = searchParams.get('decisionType')
    const status = searchParams.get('status')

    let query = supabase
      .from('prompt_versions')
      .select('*')

    if (agentName) {
      query = query.eq('agent_name', agentName)
    }

    if (decisionType) {
      query = query.eq('decision_type', decisionType)
    }

    if (status) {
      query = query.eq('status', status)
    }

    query = query.order('created_at', { ascending: false })

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      versions: data
    })
  } catch (error: any) {
    console.error('Error fetching versions:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch versions' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const versionId = await intelligenceEvolution.createPromptVersion(body)

    return NextResponse.json({
      success: true,
      versionId
    })
  } catch (error: any) {
    console.error('Error creating version:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create version' },
      { status: 500 }
    )
  }
}
