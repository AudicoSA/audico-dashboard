import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const agentName = searchParams.get('agentName')
    const days = parseInt(searchParams.get('days') || '30')

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get performance snapshots
    let snapshotsQuery = supabase
      .from('agent_performance_snapshots')
      .select('*')
      .gte('snapshot_date', startDate.toISOString().split('T')[0])
      .order('snapshot_date', { ascending: true })

    if (agentName) {
      snapshotsQuery = snapshotsQuery.eq('agent_name', agentName)
    }

    const { data: snapshots, error: snapshotsError } = await snapshotsQuery

    if (snapshotsError) throw snapshotsError

    // Get recent learning insights
    let insightsQuery = supabase
      .from('agent_learning_insights')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(10)

    if (agentName) {
      insightsQuery = insightsQuery.eq('agent_name', agentName)
    }

    const { data: insights, error: insightsError } = await insightsQuery

    if (insightsError) throw insightsError

    // Get running experiments
    let experimentsQuery = supabase
      .from('prompt_experiments')
      .select('*')
      .eq('status', 'running')

    if (agentName) {
      experimentsQuery = experimentsQuery.eq('agent_name', agentName)
    }

    const { data: experiments, error: experimentsError } = await experimentsQuery

    if (experimentsError) throw experimentsError

    // Get pending approvals
    let approvalsQuery = supabase
      .from('prompt_approval_queue')
      .select(`
        *,
        prompt_version:prompt_versions!prompt_version_id(*)
      `)
      .eq('status', 'pending')
      .order('priority', { ascending: false })

    const { data: approvals, error: approvalsError } = await approvalsQuery

    if (approvalsError) throw approvalsError

    // Get active prompt versions
    let versionsQuery = supabase
      .from('prompt_versions')
      .select('*')
      .eq('status', 'active')

    if (agentName) {
      versionsQuery = versionsQuery.eq('agent_name', agentName)
    }

    const { data: activeVersions, error: versionsError } = await versionsQuery

    if (versionsError) throw versionsError

    // Calculate summary statistics
    const totalDecisions = snapshots?.reduce((sum, s) => sum + (s.total_decisions || 0), 0) || 0
    const avgAccuracy = snapshots?.length > 0
      ? snapshots.reduce((sum, s) => sum + (s.overall_accuracy || 0), 0) / snapshots.length
      : 0

    const totalOptimizations = insights?.reduce((sum, i) => 
      sum + (i.optimization_suggestions?.length || 0), 0) || 0

    const totalVariantsGenerated = insights?.reduce((sum, i) => 
      sum + (i.generated_variants?.length || 0), 0) || 0

    // Calculate ROI gains (simplified)
    const roiGains = snapshots?.map(s => ({
      date: s.snapshot_date,
      agent: s.agent_name,
      accuracy: s.overall_accuracy || 0,
      decisions: s.total_decisions || 0
    })) || []

    return NextResponse.json({
      success: true,
      dashboard: {
        summary: {
          total_decisions: totalDecisions,
          avg_accuracy: Math.round(avgAccuracy * 100) / 100,
          total_optimizations: totalOptimizations,
          variants_generated: totalVariantsGenerated,
          experiments_running: experiments?.length || 0,
          pending_approvals: approvals?.length || 0,
          active_versions: activeVersions?.length || 0
        },
        performance_timeline: snapshots || [],
        recent_insights: insights || [],
        running_experiments: experiments || [],
        pending_approvals: approvals || [],
        roi_gains: roiGains
      }
    })
  } catch (error: any) {
    console.error('Error fetching dashboard data:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch dashboard data' },
      { status: 500 }
    )
  }
}
