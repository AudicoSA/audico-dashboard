/**
 * Example Integration: How to add Intelligence Evolution to existing agents
 * 
 * This file demonstrates how to integrate decision logging and outcome tracking
 * into your existing agent code.
 */

import { DecisionLogger } from './decision-logger'
import { intelligenceEvolution } from './intelligence-evolution'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

/**
 * EXAMPLE 1: Email Classification Agent with Decision Logging
 */
export class EmailClassificationAgentWithLearning {
  private logger = new DecisionLogger('email_classifier')

  async classifyEmail(email: any): Promise<any> {
    // Get active prompt version (A/B testing support)
    const promptVersion = await intelligenceEvolution.getActivePromptVersion(
      'email_classifier',
      'email_classification'
    )

    // Use prompt version if available, otherwise use default
    const systemPrompt = promptVersion?.prompt_template || `You are an email classification expert...`

    // Make decision using Claude
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Classify this email:\nFrom: ${email.sender}\nSubject: ${email.subject}\nBody: ${email.body}`
        }
      ]
    })

    const response = JSON.parse((message.content[0] as any).text)

    // Log the decision
    const decisionId = await this.logger.logEmailClassification({
      emailId: email.id,
      classification: response.classification,
      priority: response.priority,
      assignedAgent: response.assigned_agent,
      rationale: response.rationale,
      confidenceScore: response.confidence,
      emailContent: {
        sender: email.sender,
        subject: email.subject,
        body: email.body
      }
    })

    // Store decision ID for later outcome tracking
    await supabase
      .from('email_classifications')
      .update({ 
        metadata: { 
          ...email.metadata, 
          decision_id: decisionId,
          prompt_version: promptVersion?.version 
        } 
      })
      .eq('id', email.id)

    return {
      classification: response.classification,
      priority: response.priority,
      assignedAgent: response.assigned_agent,
      decisionId
    }
  }

  // Human verifies the classification later
  async verifyClassification(emailId: string, wasCorrect: boolean, feedback?: string): Promise<void> {
    // Get the decision ID
    const { data: email } = await supabase
      .from('email_classifications')
      .select('metadata')
      .eq('id', emailId)
      .single()

    if (email?.metadata?.decision_id) {
      // Record the outcome
      await this.logger.recordEmailAccuracy({
        decisionId: email.metadata.decision_id,
        wasCorrect,
        humanFeedback: feedback
      })
    }
  }
}

/**
 * EXAMPLE 2: Social Media Agent with Engagement Tracking
 */
export class SocialMediaAgentWithLearning {
  private logger = new DecisionLogger('Lerato')

  async generatePost(platform: string, keywords: string[], products: any[]): Promise<any> {
    // Get active prompt version
    const promptVersion = await intelligenceEvolution.getActivePromptVersion(
      'Lerato',
      'social_post_generation'
    )

    const systemPrompt = promptVersion?.system_instructions || 'You are a social media expert...'
    const userPrompt = promptVersion?.prompt_template?.replace('{platform}', platform)
      .replace('{keywords}', keywords.join(', '))
      .replace('{products}', JSON.stringify(products)) || 
      `Create a ${platform} post about ${keywords.join(', ')}`

    // Generate content
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })

    const content = (message.content[0] as any).text

    // Create post
    const { data: post } = await supabase
      .from('social_posts')
      .insert({
        platform,
        content,
        status: 'draft',
        created_by: 'Lerato',
        metadata: {
          target_keywords: keywords,
          products_referenced: products.map(p => ({ id: p.id, name: p.name }))
        }
      })
      .select()
      .single()

    // Log the decision
    const decisionId = await this.logger.logSocialPostGeneration({
      postId: post.id,
      platform,
      content,
      targetKeywords: keywords,
      rationale: `Generated ${platform} post targeting ${keywords.join(', ')} with ${products.length} products`,
      confidenceScore: 0.85,
      productContext: { products }
    })

    // Store decision ID
    await supabase
      .from('social_posts')
      .update({ 
        metadata: { 
          ...post.metadata, 
          decision_id: decisionId,
          prompt_version: promptVersion?.version 
        } 
      })
      .eq('id', post.id)

    return post
  }

  // Track engagement after post is published
  async updateEngagement(postId: string): Promise<void> {
    const { data: post } = await supabase
      .from('social_posts')
      .select('*')
      .eq('id', postId)
      .single()

    if (post?.metadata?.decision_id && post.engagement) {
      await this.logger.recordSocialEngagement({
        decisionId: post.metadata.decision_id,
        likes: post.engagement.likes || 0,
        comments: post.engagement.comments || 0,
        shares: post.engagement.shares || 0,
        platform: post.platform
      })
    }
  }
}

/**
 * EXAMPLE 3: Kenny-Mention Decision with Approval Workflow
 */
export class TaskAgentWithKennyMentions {
  private logger = new DecisionLogger('task_agent')

  async createTask(taskData: any): Promise<any> {
    // Get active prompt version for Kenny-mention decisions
    const promptVersion = await intelligenceEvolution.getActivePromptVersion(
      'task_agent',
      'kenny_mention_decision'
    )

    // Determine if Kenny should be mentioned
    const shouldMentionKenny = await this.shouldMentionKenny(taskData, promptVersion)

    // Log the Kenny-mention decision
    const decisionId = await this.logger.logKennyMentionDecision({
      entityType: 'task',
      entityId: taskData.id,
      shouldMentionKenny: shouldMentionKenny.decision,
      rationale: shouldMentionKenny.rationale,
      confidenceScore: shouldMentionKenny.confidence,
      context: {
        task_type: taskData.type,
        priority: taskData.priority,
        business_impact: shouldMentionKenny.businessImpact
      }
    })

    // Create the task
    const { data: task } = await supabase
      .from('squad_tasks')
      .insert({
        ...taskData,
        mentions_kenny: shouldMentionKenny.decision,
        metadata: {
          ...taskData.metadata,
          decision_id: decisionId,
          kenny_mention_rationale: shouldMentionKenny.rationale
        }
      })
      .select()
      .single()

    return task
  }

  private async shouldMentionKenny(
    taskData: any, 
    promptVersion: any
  ): Promise<{ decision: boolean; rationale: string; confidence: number; businessImpact: string }> {
    const systemPrompt = promptVersion?.system_instructions || 
      'You are an expert at determining when executive input is needed...'

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 512,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Should Kenny (the CEO) be mentioned in this task?\n\n${JSON.stringify(taskData, null, 2)}\n\nRespond with JSON: {"decision": boolean, "rationale": "...", "confidence": 0-1, "business_impact": "low|medium|high"}`
      }]
    })

    const response = JSON.parse((message.content[0] as any).text)
    return response
  }

  // Human approves or rejects the Kenny-mention decision
  async reviewKennyMention(taskId: string, approved: boolean, reviewedBy: string, feedback?: string): Promise<void> {
    const { data: task } = await supabase
      .from('squad_tasks')
      .select('metadata')
      .eq('id', taskId)
      .single()

    if (task?.metadata?.decision_id) {
      await this.logger.recordHumanFeedback({
        decisionId: task.metadata.decision_id,
        approved,
        feedback,
        reviewedBy
      })
    }
  }
}

/**
 * EXAMPLE 4: Ad Campaign Optimization with ROI Tracking
 */
export class AdCampaignAgentWithLearning {
  private logger = new DecisionLogger('ads_agent')

  async optimizeCampaign(campaignId: string): Promise<any> {
    // Get campaign data
    const { data: campaign } = await supabase
      .from('ad_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    // Get active prompt version
    const promptVersion = await intelligenceEvolution.getActivePromptVersion(
      'ads_agent',
      'ad_campaign_optimization'
    )

    // Analyze and optimize
    const optimization = await this.analyzeAndOptimize(campaign, promptVersion)

    // Log the decision
    const decisionId = await this.logger.logAdCampaignOptimization({
      campaignId,
      optimizationType: optimization.type,
      changes: optimization.changes,
      rationale: optimization.rationale,
      confidenceScore: optimization.confidence,
      currentMetrics: campaign.performance_metrics
    })

    // Apply changes
    await supabase
      .from('ad_campaigns')
      .update({
        ...optimization.changes,
        metadata: {
          ...campaign.metadata,
          decision_id: decisionId,
          optimization_history: [...(campaign.metadata?.optimization_history || []), {
            timestamp: new Date().toISOString(),
            type: optimization.type,
            changes: optimization.changes
          }]
        }
      })
      .eq('id', campaignId)

    return optimization
  }

  // Track ROI after optimization
  async updateCampaignROI(campaignId: string): Promise<void> {
    const { data: campaign } = await supabase
      .from('ad_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaign?.metadata?.decision_id && campaign.performance_metrics) {
      const metrics = campaign.performance_metrics
      const spent = campaign.budget_spent || 0
      const revenue = metrics.conversions * (metrics.avg_order_value || 0)

      await this.logger.recordAdROI({
        decisionId: campaign.metadata.decision_id,
        spent,
        revenue,
        conversions: metrics.conversions
      })
    }
  }

  private async analyzeAndOptimize(campaign: any, promptVersion: any): Promise<any> {
    // Implementation details...
    return {
      type: 'budget_adjustment',
      changes: { budget_total: campaign.budget_total * 1.2 },
      rationale: 'Campaign performing well, increasing budget',
      confidence: 0.88
    }
  }
}

/**
 * EXAMPLE 5: Batch Processing with Decision Logging
 */
export async function batchProcessWithLearning() {
  const logger = new DecisionLogger('batch_processor')

  // Process multiple items
  const items = await fetchItemsToProcess()

  for (const item of items) {
    // Get active prompt for this decision type
    const promptVersion = await intelligenceEvolution.getActivePromptVersion(
      'batch_processor',
      item.type
    )

    // Process item
    const result = await processItem(item, promptVersion)

    // Log decision
    const decisionId = await logger.log({
      decisionType: item.type,
      decisionMade: result.action,
      rationale: result.rationale,
      confidenceScore: result.confidence,
      context: { item_id: item.id, item_type: item.type },
      inputData: item,
      outputData: result
    })

    // Store decision ID for outcome tracking
    await storeDecisionId(item.id, decisionId)
  }
}

// Helper functions
async function fetchItemsToProcess(): Promise<any[]> {
  // Implementation
  return []
}

async function processItem(item: any, promptVersion: any): Promise<any> {
  // Implementation
  return { action: 'processed', rationale: 'Item processed successfully', confidence: 0.9 }
}

async function storeDecisionId(itemId: string, decisionId: string): Promise<void> {
  // Implementation
}

/**
 * EXAMPLE 6: Manual Analysis Trigger
 */
export async function runManualAnalysis(agentName: string): Promise<any> {
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const insight = await intelligenceEvolution.analyzeAgentPerformance(
    agentName,
    weekAgo,
    now
  )

  console.log('Analysis complete:', {
    total_decisions: insight.totalDecisions,
    avg_confidence: insight.avgConfidenceScore,
    patterns_found: insight.identifiedPatterns.length,
    suggestions: insight.optimizationSuggestions.length,
    variants: insight.generatedVariants.length
  })

  return insight
}

/**
 * EXAMPLE 7: Create and Run A/B Test
 */
export async function setupABTest(
  agentName: string,
  decisionType: string,
  controlVersionId: string,
  testVersionId: string
): Promise<string> {
  const experimentId = await intelligenceEvolution.createExperiment({
    name: `${agentName} ${decisionType} optimization test`,
    description: 'Testing new prompt variant for improved performance',
    agentName,
    decisionType,
    controlVersionId,
    testVersionId,
    trafficSplit: 50, // 50% to each version
    targetSampleSize: 100 // Run until 100 total decisions
  })

  console.log('A/B test created:', experimentId)
  return experimentId
}

/**
 * EXAMPLE 8: Approve Prompt Change with Gradual Rollout
 */
export async function approveWithRollout(
  approvalId: string,
  reviewedBy: string
): Promise<void> {
  // Start with 10% traffic
  await intelligenceEvolution.approvePromptChange(
    approvalId,
    reviewedBy,
    'Approved for gradual rollout',
    10
  )

  console.log('Prompt approved with 10% rollout')

  // Monitor for 24 hours, then increase to 50%
  // (In production, this would be automated based on metrics)
  setTimeout(async () => {
    // Check metrics are good, then increase
    // Update rollout percentage directly in database
    console.log('Increasing rollout to 50%')
  }, 24 * 60 * 60 * 1000)
}
