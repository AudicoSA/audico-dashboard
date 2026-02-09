import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export interface DecisionLog {
  agentName: string
  decisionType: string
  decisionContext: any
  decisionMade: string
  rationale: string
  confidenceScore?: number
  promptVersion?: string
  promptVariant?: string
  inputData?: any
  outputData?: any
  metadata?: any
}

export interface DecisionOutcome {
  decisionId: string
  outcomeType: string
  outcomeValue?: number
  outcomeData?: any
  feedbackSource: 'automated' | 'human' | 'system'
  notes?: string
  metadata?: any
}

export interface PromptVersion {
  agentName: string
  decisionType: string
  version: string
  variant?: string
  promptTemplate: string
  systemInstructions?: string
  parameters?: any
  status?: 'testing' | 'active' | 'archived' | 'rejected'
  rolloutPercentage?: number
  parentVersionId?: string
  createdBy?: string
  notes?: string
  metadata?: any
}

export interface PromptExperiment {
  name: string
  description?: string
  agentName: string
  decisionType: string
  controlVersionId: string
  testVersionId: string
  trafficSplit?: number
  targetSampleSize?: number
  metadata?: any
}

export interface LearningInsight {
  agentName: string
  analysisPeriodStart: Date
  analysisPeriodEnd: Date
  decisionType?: string
  totalDecisions: number
  avgConfidenceScore?: number
  performanceMetrics: any
  identifiedPatterns: any[]
  optimizationSuggestions: any[]
  generatedVariants: any[]
  analysisSummary: string
  metadata?: any
}

export class IntelligenceEvolutionService {
  /**
   * Log an agent decision with full context and rationale
   */
  async logDecision(decision: DecisionLog): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('agent_decisions')
        .insert({
          agent_name: decision.agentName,
          decision_type: decision.decisionType,
          decision_context: decision.decisionContext,
          decision_made: decision.decisionMade,
          rationale: decision.rationale,
          confidence_score: decision.confidenceScore,
          prompt_version: decision.promptVersion,
          prompt_variant: decision.promptVariant,
          input_data: decision.inputData || {},
          output_data: decision.outputData || {},
          metadata: decision.metadata || {}
        })
        .select()
        .single()

      if (error) throw error

      return data.id
    } catch (error) {
      console.error('Error logging decision:', error)
      throw error
    }
  }

  /**
   * Record outcome of a previous decision
   */
  async recordOutcome(outcome: DecisionOutcome): Promise<void> {
    try {
      const { error } = await supabase
        .from('decision_outcomes')
        .insert({
          decision_id: outcome.decisionId,
          outcome_type: outcome.outcomeType,
          outcome_value: outcome.outcomeValue,
          outcome_data: outcome.outcomeData || {},
          feedback_source: outcome.feedbackSource,
          notes: outcome.notes,
          metadata: outcome.metadata || {}
        })

      if (error) throw error
    } catch (error) {
      console.error('Error recording outcome:', error)
      throw error
    }
  }

  /**
   * Get active prompt version for an agent
   */
  async getActivePromptVersion(
    agentName: string,
    decisionType: string
  ): Promise<any | null> {
    try {
      // Check for active A/B test
      const { data: experiment } = await supabase
        .from('prompt_experiments')
        .select('*, control_version:prompt_versions!control_version_id(*), test_version:prompt_versions!test_version_id(*)')
        .eq('agent_name', agentName)
        .eq('decision_type', decisionType)
        .eq('status', 'running')
        .single()

      if (experiment) {
        // Use traffic split to determine which version to use
        const useTest = Math.random() * 100 < experiment.traffic_split
        return useTest ? experiment.test_version : experiment.control_version
      }

      // No experiment, get active version
      const { data, error } = await supabase
        .from('prompt_versions')
        .select('*')
        .eq('agent_name', agentName)
        .eq('decision_type', decisionType)
        .eq('status', 'active')
        .order('rollout_percentage', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      return data
    } catch (error) {
      console.error('Error getting active prompt version:', error)
      return null
    }
  }

  /**
   * Create new prompt version
   */
  async createPromptVersion(version: PromptVersion): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('prompt_versions')
        .insert({
          agent_name: version.agentName,
          decision_type: version.decisionType,
          version: version.version,
          variant: version.variant || 'default',
          prompt_template: version.promptTemplate,
          system_instructions: version.systemInstructions,
          parameters: version.parameters || {},
          status: version.status || 'testing',
          rollout_percentage: version.rolloutPercentage || 0,
          parent_version_id: version.parentVersionId,
          created_by: version.createdBy || 'system',
          notes: version.notes,
          metadata: version.metadata || {}
        })
        .select()
        .single()

      if (error) throw error

      return data.id
    } catch (error) {
      console.error('Error creating prompt version:', error)
      throw error
    }
  }

  /**
   * Create A/B test experiment
   */
  async createExperiment(experiment: PromptExperiment): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('prompt_experiments')
        .insert({
          name: experiment.name,
          description: experiment.description,
          agent_name: experiment.agentName,
          decision_type: experiment.decisionType,
          control_version_id: experiment.controlVersionId,
          test_version_id: experiment.testVersionId,
          traffic_split: experiment.trafficSplit || 50,
          target_sample_size: experiment.targetSampleSize || 100,
          status: 'running',
          start_date: new Date().toISOString(),
          metadata: experiment.metadata || {}
        })
        .select()
        .single()

      if (error) throw error

      return data.id
    } catch (error) {
      console.error('Error creating experiment:', error)
      throw error
    }
  }

  /**
   * Analyze agent performance using Claude
   */
  async analyzeAgentPerformance(
    agentName: string,
    periodStart: Date,
    periodEnd: Date,
    decisionType?: string
  ): Promise<LearningInsight> {
    try {
      // Fetch decisions and outcomes for the period
      let query = supabase
        .from('agent_decisions')
        .select(`
          *,
          outcomes:decision_outcomes(*)
        `)
        .eq('agent_name', agentName)
        .gte('created_at', periodStart.toISOString())
        .lte('created_at', periodEnd.toISOString())

      if (decisionType) {
        query = query.eq('decision_type', decisionType)
      }

      const { data: decisions, error } = await query

      if (error) throw error

      // Calculate performance metrics
      const totalDecisions = decisions.length
      const avgConfidence = decisions.reduce((sum, d) => sum + (d.confidence_score || 0), 0) / totalDecisions

      const performanceMetrics = this.calculatePerformanceMetrics(decisions)

      // Use Claude to analyze patterns and generate insights
      const analysisPrompt = `You are an AI agent performance analyst. Analyze the following agent decision data and provide actionable insights for continuous improvement.

Agent: ${agentName}
Period: ${periodStart.toISOString()} to ${periodEnd.toISOString()}
Decision Type: ${decisionType || 'All types'}
Total Decisions: ${totalDecisions}
Average Confidence: ${avgConfidence.toFixed(2)}

Performance Metrics:
${JSON.stringify(performanceMetrics, null, 2)}

Sample Decisions (first 20):
${JSON.stringify(decisions.slice(0, 20), null, 2)}

Please analyze and provide:
1. Identified Patterns: What patterns do you see in successful vs unsuccessful decisions?
2. Optimization Suggestions: What specific improvements would increase performance?
3. Prompt Variants: Generate 2-3 prompt template variants that could improve decision quality
4. Summary: Brief executive summary of findings

Format your response as JSON:
{
  "identified_patterns": [
    {
      "pattern": "description",
      "confidence": 0-1,
      "impact": "high|medium|low",
      "examples": []
    }
  ],
  "optimization_suggestions": [
    {
      "suggestion": "description",
      "priority": "high|medium|low",
      "expected_improvement": "percentage or description",
      "implementation": "how to implement"
    }
  ],
  "generated_variants": [
    {
      "variant_name": "name",
      "changes": "what's different",
      "rationale": "why this should work better",
      "prompt_template": "the actual prompt template"
    }
  ],
  "analysis_summary": "executive summary of findings and recommendations"
}`

      const message = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 8000,
        messages: [
          {
            role: 'user',
            content: analysisPrompt
          }
        ]
      })

      const textContent = message.content.find(block => block.type === 'text')
      if (!textContent) throw new Error('No text content in Claude response')

      const analysisText = (textContent as any).text
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('Failed to parse JSON from Claude response')

      const analysis = JSON.parse(jsonMatch[0])

      // Create learning insight record
      const insight: LearningInsight = {
        agentName,
        analysisPeriodStart: periodStart,
        analysisPeriodEnd: periodEnd,
        decisionType,
        totalDecisions,
        avgConfidenceScore: avgConfidence,
        performanceMetrics,
        identifiedPatterns: analysis.identified_patterns || [],
        optimizationSuggestions: analysis.optimization_suggestions || [],
        generatedVariants: analysis.generated_variants || [],
        analysisSummary: analysis.analysis_summary || '',
        metadata: {
          claude_model: 'claude-3-5-sonnet-20241022',
          analysis_timestamp: new Date().toISOString()
        }
      }

      // Store insight
      const { data: insightData, error: insightError } = await supabase
        .from('agent_learning_insights')
        .insert({
          agent_name: insight.agentName,
          analysis_period_start: insight.analysisPeriodStart.toISOString(),
          analysis_period_end: insight.analysisPeriodEnd.toISOString(),
          decision_type: insight.decisionType,
          total_decisions: insight.totalDecisions,
          avg_confidence_score: insight.avgConfidenceScore,
          performance_metrics: insight.performanceMetrics,
          identified_patterns: insight.identifiedPatterns,
          optimization_suggestions: insight.optimizationSuggestions,
          generated_variants: insight.generatedVariants,
          analysis_summary: insight.analysisSummary,
          status: 'completed',
          analyzed_by: 'claude',
          metadata: insight.metadata
        })
        .select()
        .single()

      if (insightError) throw insightError

      // Check if any variants need human approval (especially Kenny-mention changes)
      await this.processGeneratedVariants(insightData.id, insight.generatedVariants, agentName, decisionType || '')

      return insight
    } catch (error) {
      console.error('Error analyzing agent performance:', error)
      throw error
    }
  }

  /**
   * Calculate performance metrics from decisions
   */
  private calculatePerformanceMetrics(decisions: any[]): any {
    const metrics: any = {
      total_decisions: decisions.length,
      decisions_with_outcomes: 0,
      positive_outcomes: 0,
      negative_outcomes: 0,
      by_decision_type: {},
      by_confidence_score: {
        high: 0,
        medium: 0,
        low: 0
      },
      avg_outcome_value: 0
    }

    let totalOutcomeValue = 0
    let outcomeCount = 0

    decisions.forEach(decision => {
      // Count by decision type
      if (!metrics.by_decision_type[decision.decision_type]) {
        metrics.by_decision_type[decision.decision_type] = {
          count: 0,
          positive: 0,
          negative: 0
        }
      }
      metrics.by_decision_type[decision.decision_type].count++

      // Count by confidence
      if (decision.confidence_score >= 0.8) {
        metrics.by_confidence_score.high++
      } else if (decision.confidence_score >= 0.5) {
        metrics.by_confidence_score.medium++
      } else {
        metrics.by_confidence_score.low++
      }

      // Process outcomes
      if (decision.outcomes && decision.outcomes.length > 0) {
        metrics.decisions_with_outcomes++

        decision.outcomes.forEach((outcome: any) => {
          if (outcome.outcome_value !== null) {
            totalOutcomeValue += outcome.outcome_value
            outcomeCount++

            if (outcome.outcome_value >= 70) {
              metrics.positive_outcomes++
              metrics.by_decision_type[decision.decision_type].positive++
            } else {
              metrics.negative_outcomes++
              metrics.by_decision_type[decision.decision_type].negative++
            }
          }
        })
      }
    })

    if (outcomeCount > 0) {
      metrics.avg_outcome_value = totalOutcomeValue / outcomeCount
    }

    metrics.success_rate = metrics.decisions_with_outcomes > 0
      ? (metrics.positive_outcomes / metrics.decisions_with_outcomes) * 100
      : 0

    return metrics
  }

  /**
   * Process generated variants and create approval requests if needed
   */
  private async processGeneratedVariants(
    insightId: string,
    variants: any[],
    agentName: string,
    decisionType: string
  ): Promise<void> {
    try {
      for (const variant of variants) {
        // Create new prompt version
        const versionId = await this.createPromptVersion({
          agentName,
          decisionType,
          version: `${new Date().getTime()}_${variant.variant_name}`,
          variant: variant.variant_name,
          promptTemplate: variant.prompt_template || '',
          systemInstructions: variant.rationale,
          status: 'testing',
          rolloutPercentage: 0,
          createdBy: 'claude_analysis',
          notes: variant.changes,
          metadata: {
            learning_insight_id: insightId,
            expected_improvement: variant.expected_improvement || 'unknown'
          }
        })

        // Check if this affects Kenny-mention decisions - needs approval
        const needsApproval = decisionType === 'kenny_mention_decision' ||
                             variant.prompt_template.toLowerCase().includes('kenny') ||
                             variant.changes.toLowerCase().includes('kenny')

        const priority = needsApproval ? 'high' : 'medium'
        const requestType = needsApproval ? 'kenny_mention_change' : 'new_variant'

        // Create approval request
        await supabase
          .from('prompt_approval_queue')
          .insert({
            prompt_version_id: versionId,
            learning_insight_id: insightId,
            request_type: requestType,
            priority,
            change_summary: variant.changes,
            impact_analysis: {
              expected_improvement: variant.expected_improvement || 'unknown',
              rationale: variant.rationale,
              affects_kenny_mentions: needsApproval
            },
            risk_assessment: needsApproval
              ? 'High: Changes affect Kenny-mention decisions. Requires careful review.'
              : 'Low: Standard optimization variant.',
            requested_by: 'claude_analysis'
          })
      }
    } catch (error) {
      console.error('Error processing generated variants:', error)
    }
  }

  /**
   * Update experiment metrics and check for completion
   */
  async updateExperimentMetrics(experimentId: string): Promise<void> {
    try {
      const { data: experiment, error: expError } = await supabase
        .from('prompt_experiments')
        .select('*, control_version:prompt_versions!control_version_id(*), test_version:prompt_versions!test_version_id(*)')
        .eq('id', experimentId)
        .single()

      if (expError || !experiment) throw new Error('Experiment not found')

      // Fetch decisions using control and test versions
      const { data: controlDecisions } = await supabase
        .from('agent_decisions')
        .select('*, outcomes:decision_outcomes(*)')
        .eq('prompt_version', experiment.control_version.version)
        .gte('created_at', experiment.start_date)

      const { data: testDecisions } = await supabase
        .from('agent_decisions')
        .select('*, outcomes:decision_outcomes(*)')
        .eq('prompt_version', experiment.test_version.version)
        .gte('created_at', experiment.start_date)

      const controlMetrics = this.calculatePerformanceMetrics(controlDecisions || [])
      const testMetrics = this.calculatePerformanceMetrics(testDecisions || [])

      const currentSampleSize = (controlDecisions?.length || 0) + (testDecisions?.length || 0)

      // Calculate statistical significance (simplified z-test)
      let significance = 0
      let winner = 'inconclusive'

      if (currentSampleSize >= experiment.target_sample_size) {
        const controlSuccessRate = controlMetrics.success_rate / 100
        const testSuccessRate = testMetrics.success_rate / 100
        
        const pooledProportion = 
          (controlMetrics.positive_outcomes + testMetrics.positive_outcomes) /
          (controlMetrics.decisions_with_outcomes + testMetrics.decisions_with_outcomes)

        const standardError = Math.sqrt(
          pooledProportion * (1 - pooledProportion) *
          (1 / controlMetrics.decisions_with_outcomes + 1 / testMetrics.decisions_with_outcomes)
        )

        const zScore = Math.abs((testSuccessRate - controlSuccessRate) / standardError)
        significance = 1 - Math.exp(-0.5 * zScore * zScore) // Approximate p-value

        if (significance >= 0.95) {
          winner = testSuccessRate > controlSuccessRate ? 'test' : 'control'
        }
      }

      // Update experiment
      const updateData: any = {
        current_sample_size: currentSampleSize,
        control_metrics: controlMetrics,
        test_metrics: testMetrics,
        statistical_significance: significance
      }

      if (currentSampleSize >= experiment.target_sample_size) {
        updateData.status = 'completed'
        updateData.end_date = new Date().toISOString()
        updateData.winner = winner
        updateData.results_summary = `Experiment completed with ${currentSampleSize} samples. Winner: ${winner}. Statistical significance: ${(significance * 100).toFixed(2)}%.`
      }

      await supabase
        .from('prompt_experiments')
        .update(updateData)
        .eq('id', experimentId)

      // If experiment completed with clear winner, create approval request
      if (winner === 'test' && significance >= 0.95) {
        await supabase
          .from('prompt_approval_queue')
          .insert({
            prompt_version_id: experiment.test_version_id,
            experiment_id: experimentId,
            request_type: 'experiment_approval',
            priority: 'high',
            change_summary: `A/B test "${experiment.name}" completed successfully. Test variant shows ${(testMetrics.success_rate - controlMetrics.success_rate).toFixed(2)}% improvement.`,
            impact_analysis: {
              control_success_rate: controlMetrics.success_rate,
              test_success_rate: testMetrics.success_rate,
              improvement: testMetrics.success_rate - controlMetrics.success_rate,
              statistical_significance: significance,
              sample_size: currentSampleSize
            },
            risk_assessment: 'Low: Variant has been tested and shows statistically significant improvement.',
            requested_by: 'experiment_system'
          })
      }
    } catch (error) {
      console.error('Error updating experiment metrics:', error)
      throw error
    }
  }

  /**
   * Approve prompt change and rollout
   */
  async approvePromptChange(
    approvalId: string,
    reviewedBy: string,
    reviewerNotes: string,
    rolloutPercentage: number = 100
  ): Promise<void> {
    try {
      const { data: approval, error: approvalError } = await supabase
        .from('prompt_approval_queue')
        .select('*')
        .eq('id', approvalId)
        .single()

      if (approvalError || !approval) throw new Error('Approval request not found')

      // Update approval status
      await supabase
        .from('prompt_approval_queue')
        .update({
          status: 'approved',
          reviewed_by: reviewedBy,
          reviewed_at: new Date().toISOString(),
          reviewer_notes: reviewerNotes
        })
        .eq('id', approvalId)

      // Activate the prompt version with gradual rollout
      await supabase
        .from('prompt_versions')
        .update({
          status: 'active',
          rollout_percentage: rolloutPercentage,
          approved_by: reviewedBy,
          approved_at: new Date().toISOString()
        })
        .eq('id', approval.prompt_version_id)

      // If full rollout, archive old versions
      if (rolloutPercentage === 100) {
        const { data: newVersion } = await supabase
          .from('prompt_versions')
          .select('agent_name, decision_type')
          .eq('id', approval.prompt_version_id)
          .single()

        if (newVersion) {
          await supabase
            .from('prompt_versions')
            .update({ status: 'archived' })
            .eq('agent_name', newVersion.agent_name)
            .eq('decision_type', newVersion.decision_type)
            .eq('status', 'active')
            .neq('id', approval.prompt_version_id)
        }
      }
    } catch (error) {
      console.error('Error approving prompt change:', error)
      throw error
    }
  }

  /**
   * Create daily performance snapshot
   */
  async createPerformanceSnapshot(agentName: string, date: Date): Promise<void> {
    try {
      const startOfDay = new Date(date)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(date)
      endOfDay.setHours(23, 59, 59, 999)

      const { data: decisions } = await supabase
        .from('agent_decisions')
        .select('*, outcomes:decision_outcomes(*)')
        .eq('agent_name', agentName)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())

      if (!decisions || decisions.length === 0) return

      const metrics = this.calculatePerformanceMetrics(decisions)

      const { data: activeVersions } = await supabase
        .from('prompt_versions')
        .select('id')
        .eq('agent_name', agentName)
        .eq('status', 'active')

      const { data: runningExperiments } = await supabase
        .from('prompt_experiments')
        .select('id')
        .eq('agent_name', agentName)
        .eq('status', 'running')

      await supabase
        .from('agent_performance_snapshots')
        .upsert({
          agent_name: agentName,
          snapshot_date: date.toISOString().split('T')[0],
          decision_types: metrics.by_decision_type,
          overall_accuracy: metrics.success_rate,
          total_decisions: metrics.total_decisions,
          successful_decisions: metrics.positive_outcomes,
          roi_metrics: {},
          engagement_metrics: {},
          efficiency_metrics: {},
          active_prompt_versions: activeVersions?.length || 0,
          experiments_running: runningExperiments?.length || 0,
          metadata: {
            snapshot_timestamp: new Date().toISOString()
          }
        }, {
          onConflict: 'agent_name,snapshot_date'
        })
    } catch (error) {
      console.error('Error creating performance snapshot:', error)
      throw error
    }
  }
}

export const intelligenceEvolution = new IntelligenceEvolutionService()
