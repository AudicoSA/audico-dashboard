import { intelligenceEvolution } from '../agents/intelligence-evolution'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * Weekly agent learning workflow
 * Analyzes all agents' performance and generates optimization suggestions
 */
export async function runWeeklyAgentLearningAnalysis(): Promise<{
  success: boolean
  insights: any[]
  errors: any[]
}> {
  const insights: any[] = []
  const errors: any[] = []

  try {
    await logWorkflowMessage('Weekly agent learning analysis started')

    const agents = [
      { name: 'Lerato', decisionTypes: ['social_post_generation'] },
      { name: 'marketing', decisionTypes: ['reseller_approval', 'influencer_identification', 'newsletter_generation'] },
      { name: 'seo_agent', decisionTypes: ['seo_recommendation'] },
      { name: 'ads_agent', decisionTypes: ['ad_campaign_optimization'] }
    ]

    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    for (const agent of agents) {
      for (const decisionType of agent.decisionTypes) {
        try {
          await logWorkflowMessage(`Analyzing ${agent.name} - ${decisionType}`)

          const insight = await intelligenceEvolution.analyzeAgentPerformance(
            agent.name,
            weekAgo,
            now,
            decisionType
          )

          insights.push({
            agent: agent.name,
            decision_type: decisionType,
            insight
          })

          await logWorkflowMessage(
            `Completed analysis for ${agent.name} - ${decisionType}`,
            {
              total_decisions: insight.totalDecisions,
              avg_confidence: insight.avgConfidenceScore,
              suggestions_count: insight.optimizationSuggestions.length,
              variants_generated: insight.generatedVariants.length
            }
          )
        } catch (error: any) {
          console.error(`Error analyzing ${agent.name} - ${decisionType}:`, error)
          errors.push({
            agent: agent.name,
            decision_type: decisionType,
            error: error.message
          })

          await logWorkflowMessage(
            `Failed to analyze ${agent.name} - ${decisionType}: ${error.message}`,
            { error: error.message }
          )
        }
      }

      // Create daily performance snapshot
      try {
        await intelligenceEvolution.createPerformanceSnapshot(agent.name, new Date())
      } catch (error: any) {
        console.error(`Error creating snapshot for ${agent.name}:`, error)
      }
    }

    await logWorkflowMessage(
      `Weekly agent learning analysis completed`,
      {
        insights_count: insights.length,
        errors_count: errors.length
      }
    )

    return {
      success: errors.length === 0,
      insights,
      errors
    }
  } catch (error: any) {
    console.error('Error in weekly agent learning analysis:', error)
    await logWorkflowMessage(`Weekly analysis failed: ${error.message}`, { error: error.message })

    return {
      success: false,
      insights,
      errors: [...errors, { error: error.message }]
    }
  }
}

/**
 * Update all running experiments
 */
export async function updateRunningExperiments(): Promise<{
  success: boolean
  updated: number
  completed: number
}> {
  try {
    await logWorkflowMessage('Updating running experiments')

    const { data: experiments, error } = await supabase
      .from('prompt_experiments')
      .select('id')
      .eq('status', 'running')

    if (error) throw error

    let completed = 0

    for (const experiment of experiments || []) {
      try {
        await intelligenceEvolution.updateExperimentMetrics(experiment.id)

        // Check if experiment is now completed
        const { data: updated } = await supabase
          .from('prompt_experiments')
          .select('status')
          .eq('id', experiment.id)
          .single()

        if (updated?.status === 'completed') {
          completed++
        }
      } catch (error: any) {
        console.error(`Error updating experiment ${experiment.id}:`, error)
      }
    }

    await logWorkflowMessage(
      `Updated ${experiments?.length || 0} experiments, ${completed} completed`
    )

    return {
      success: true,
      updated: experiments?.length || 0,
      completed
    }
  } catch (error: any) {
    console.error('Error updating experiments:', error)
    await logWorkflowMessage(`Failed to update experiments: ${error.message}`)

    return {
      success: false,
      updated: 0,
      completed: 0
    }
  }
}

/**
 * Process pending approval requests (notify humans)
 */
export async function processPendingApprovals(): Promise<{
  success: boolean
  pending: number
  notified: number
}> {
  try {
    const { data: approvals, error } = await supabase
      .from('prompt_approval_queue')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })

    if (error) throw error

    let notified = 0

    for (const approval of approvals || []) {
      try {
        // Create task for human review
        await supabase
          .from('squad_tasks')
          .insert({
            title: `Agent Learning: ${approval.request_type.replace(/_/g, ' ')} - ${approval.priority.toUpperCase()}`,
            description: `${approval.change_summary}\n\nRisk: ${approval.risk_assessment || 'Unknown'}\n\nReview the prompt change and approve/reject in the Agent Intelligence Dashboard.`,
            status: 'new',
            assigned_agent: 'Jarvis',
            priority: approval.priority,
            mentions_kenny: approval.request_type === 'kenny_mention_change',
            deliverable_url: `/agent-intelligence/approvals/${approval.id}`
          })

        notified++
      } catch (error: any) {
        console.error(`Error notifying approval ${approval.id}:`, error)
      }
    }

    await logWorkflowMessage(
      `Processed ${approvals?.length || 0} pending approvals, created ${notified} tasks`
    )

    return {
      success: true,
      pending: approvals?.length || 0,
      notified
    }
  } catch (error: any) {
    console.error('Error processing pending approvals:', error)
    await logWorkflowMessage(`Failed to process approvals: ${error.message}`)

    return {
      success: false,
      pending: 0,
      notified: 0
    }
  }
}

/**
 * Complete agent learning workflow - runs all sub-workflows
 */
export async function runCompleteAgentLearningWorkflow(): Promise<any> {
  const results = {
    timestamp: new Date().toISOString(),
    analysis: null as any,
    experiments: null as any,
    approvals: null as any
  }

  // Run weekly analysis
  results.analysis = await runWeeklyAgentLearningAnalysis()

  // Update experiments
  results.experiments = await updateRunningExperiments()

  // Process approvals
  results.approvals = await processPendingApprovals()

  return results
}

async function logWorkflowMessage(message: string, data: any = {}): Promise<void> {
  try {
    await supabase
      .from('squad_messages')
      .insert({
        from_agent: 'intelligence_evolution',
        to_agent: null,
        message,
        task_id: null,
        data: {
          event_type: 'agent_learning_workflow',
          timestamp: new Date().toISOString(),
          ...data
        }
      })
  } catch (error) {
    console.error('Error logging workflow message:', error)
  }
}
