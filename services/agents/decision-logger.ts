import { intelligenceEvolution, DecisionLog, DecisionOutcome } from './intelligence-evolution'

/**
 * Decision Logger - Helper class for agents to easily log decisions and outcomes
 */
export class DecisionLogger {
  private agentName: string
  private currentPromptVersion?: string

  constructor(agentName: string) {
    this.agentName = agentName
  }

  setPromptVersion(version: string) {
    this.currentPromptVersion = version
  }

  /**
   * Log a decision with full context
   */
  async log(params: {
    decisionType: string
    decisionMade: string
    rationale: string
    context?: any
    confidenceScore?: number
    inputData?: any
    outputData?: any
    promptVariant?: string
    metadata?: any
  }): Promise<string> {
    const decision: DecisionLog = {
      agentName: this.agentName,
      decisionType: params.decisionType,
      decisionContext: params.context || {},
      decisionMade: params.decisionMade,
      rationale: params.rationale,
      confidenceScore: params.confidenceScore,
      promptVersion: this.currentPromptVersion,
      promptVariant: params.promptVariant,
      inputData: params.inputData,
      outputData: params.outputData,
      metadata: params.metadata
    }

    return await intelligenceEvolution.logDecision(decision)
  }

  /**
   * Log email classification decision
   */
  async logEmailClassification(params: {
    emailId: string
    classification: string
    priority: string
    assignedAgent?: string
    rationale: string
    confidenceScore: number
    emailContent: { sender: string; subject: string; body?: string }
  }): Promise<string> {
    return await this.log({
      decisionType: 'email_classification',
      decisionMade: `Classification: ${params.classification}, Priority: ${params.priority}${params.assignedAgent ? `, Assigned: ${params.assignedAgent}` : ''}`,
      rationale: params.rationale,
      confidenceScore: params.confidenceScore,
      context: {
        email_id: params.emailId,
        classification: params.classification,
        priority: params.priority,
        assigned_agent: params.assignedAgent
      },
      inputData: {
        sender: params.emailContent.sender,
        subject: params.emailContent.subject,
        body_preview: params.emailContent.body?.substring(0, 500)
      },
      outputData: {
        classification: params.classification,
        priority: params.priority,
        assigned_agent: params.assignedAgent
      }
    })
  }

  /**
   * Log social post generation decision
   */
  async logSocialPostGeneration(params: {
    postId: string
    platform: string
    content: string
    targetKeywords: string[]
    rationale: string
    confidenceScore: number
    productContext?: any
  }): Promise<string> {
    return await this.log({
      decisionType: 'social_post_generation',
      decisionMade: `Generated ${params.platform} post with ${params.targetKeywords.length} keywords`,
      rationale: params.rationale,
      confidenceScore: params.confidenceScore,
      context: {
        post_id: params.postId,
        platform: params.platform,
        target_keywords: params.targetKeywords
      },
      inputData: {
        platform: params.platform,
        target_keywords: params.targetKeywords,
        product_context: params.productContext
      },
      outputData: {
        content_preview: params.content.substring(0, 500),
        content_length: params.content.length
      }
    })
  }

  /**
   * Log ad campaign optimization decision
   */
  async logAdCampaignOptimization(params: {
    campaignId: string
    optimizationType: string
    changes: any
    rationale: string
    confidenceScore: number
    currentMetrics: any
  }): Promise<string> {
    return await this.log({
      decisionType: 'ad_campaign_optimization',
      decisionMade: `${params.optimizationType}: ${JSON.stringify(params.changes)}`,
      rationale: params.rationale,
      confidenceScore: params.confidenceScore,
      context: {
        campaign_id: params.campaignId,
        optimization_type: params.optimizationType
      },
      inputData: {
        current_metrics: params.currentMetrics,
        changes_applied: params.changes
      },
      outputData: {
        optimization_type: params.optimizationType,
        changes: params.changes
      }
    })
  }

  /**
   * Log SEO recommendation decision
   */
  async logSEORecommendation(params: {
    url: string
    recommendationType: string
    recommendations: any[]
    rationale: string
    confidenceScore: number
    auditScore: number
  }): Promise<string> {
    return await this.log({
      decisionType: 'seo_recommendation',
      decisionMade: `${params.recommendationType}: ${params.recommendations.length} recommendations`,
      rationale: params.rationale,
      confidenceScore: params.confidenceScore,
      context: {
        url: params.url,
        recommendation_type: params.recommendationType,
        audit_score: params.auditScore
      },
      inputData: {
        url: params.url,
        audit_score: params.auditScore
      },
      outputData: {
        recommendations: params.recommendations,
        recommendation_count: params.recommendations.length
      }
    })
  }

  /**
   * Log Kenny-mention decision (requires special approval)
   */
  async logKennyMentionDecision(params: {
    entityType: string
    entityId: string
    shouldMentionKenny: boolean
    rationale: string
    confidenceScore: number
    context: any
  }): Promise<string> {
    return await this.log({
      decisionType: 'kenny_mention_decision',
      decisionMade: params.shouldMentionKenny ? 'Mention Kenny' : 'Do not mention Kenny',
      rationale: params.rationale,
      confidenceScore: params.confidenceScore,
      context: {
        entity_type: params.entityType,
        entity_id: params.entityId,
        should_mention_kenny: params.shouldMentionKenny,
        ...params.context
      },
      metadata: {
        requires_human_review: true
      }
    })
  }

  /**
   * Record outcome of a decision
   */
  async recordOutcome(params: {
    decisionId: string
    outcomeType: string
    outcomeValue?: number
    outcomeData?: any
    feedbackSource: 'automated' | 'human' | 'system'
    notes?: string
  }): Promise<void> {
    const outcome: DecisionOutcome = {
      decisionId: params.decisionId,
      outcomeType: params.outcomeType,
      outcomeValue: params.outcomeValue,
      outcomeData: params.outcomeData,
      feedbackSource: params.feedbackSource,
      notes: params.notes
    }

    await intelligenceEvolution.recordOutcome(outcome)
  }

  /**
   * Record email classification accuracy
   */
  async recordEmailAccuracy(params: {
    decisionId: string
    wasCorrect: boolean
    humanFeedback?: string
  }): Promise<void> {
    await this.recordOutcome({
      decisionId: params.decisionId,
      outcomeType: 'email_accuracy',
      outcomeValue: params.wasCorrect ? 100 : 0,
      feedbackSource: 'human',
      notes: params.humanFeedback,
      outcomeData: {
        correct: params.wasCorrect
      }
    })
  }

  /**
   * Record social post engagement
   */
  async recordSocialEngagement(params: {
    decisionId: string
    likes: number
    comments: number
    shares: number
    platform: string
  }): Promise<void> {
    const totalEngagement = params.likes + params.comments * 2 + params.shares * 3
    const engagementScore = Math.min(100, totalEngagement / 10)

    await this.recordOutcome({
      decisionId: params.decisionId,
      outcomeType: 'social_engagement',
      outcomeValue: engagementScore,
      feedbackSource: 'automated',
      outcomeData: {
        likes: params.likes,
        comments: params.comments,
        shares: params.shares,
        platform: params.platform,
        total_engagement: totalEngagement
      }
    })
  }

  /**
   * Record ad campaign ROI
   */
  async recordAdROI(params: {
    decisionId: string
    spent: number
    revenue: number
    conversions: number
  }): Promise<void> {
    const roi = params.spent > 0 ? ((params.revenue - params.spent) / params.spent) * 100 : 0
    const roiScore = Math.min(100, Math.max(0, (roi + 100) / 2))

    await this.recordOutcome({
      decisionId: params.decisionId,
      outcomeType: 'ad_roi',
      outcomeValue: roiScore,
      feedbackSource: 'automated',
      outcomeData: {
        spent: params.spent,
        revenue: params.revenue,
        conversions: params.conversions,
        roi: roi
      }
    })
  }

  /**
   * Record SEO improvement
   */
  async recordSEOImprovement(params: {
    decisionId: string
    beforeScore: number
    afterScore: number
    timeframe: string
  }): Promise<void> {
    const improvement = params.afterScore - params.beforeScore
    const improvementScore = Math.min(100, Math.max(0, params.beforeScore + improvement))

    await this.recordOutcome({
      decisionId: params.decisionId,
      outcomeType: 'seo_improvement',
      outcomeValue: improvementScore,
      feedbackSource: 'automated',
      outcomeData: {
        before_score: params.beforeScore,
        after_score: params.afterScore,
        improvement: improvement,
        timeframe: params.timeframe
      }
    })
  }

  /**
   * Record human approval/rejection
   */
  async recordHumanFeedback(params: {
    decisionId: string
    approved: boolean
    feedback?: string
    reviewedBy: string
  }): Promise<void> {
    await this.recordOutcome({
      decisionId: params.decisionId,
      outcomeType: params.approved ? 'human_approval' : 'human_rejection',
      outcomeValue: params.approved ? 100 : 0,
      feedbackSource: 'human',
      notes: `Reviewed by ${params.reviewedBy}. ${params.feedback || ''}`,
      outcomeData: {
        approved: params.approved,
        reviewed_by: params.reviewedBy
      }
    })
  }
}

// Export singleton instances for each agent
export const leratoDecisionLogger = new DecisionLogger('Lerato') // Social media
export const marketingDecisionLogger = new DecisionLogger('marketing') // Marketing
export const seoDecisionLogger = new DecisionLogger('seo_agent') // SEO
export const adsDecisionLogger = new DecisionLogger('ads_agent') // Ads
