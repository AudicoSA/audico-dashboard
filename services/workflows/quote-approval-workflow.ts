import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { gmailService } from '../integrations/gmail-service'

export class QuoteApprovalWorkflow {
  private supabase: SupabaseClient

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  async getApprovalStats() {
    const { data: feedbackData } = await this.supabase
      .from('quote_approval_feedback')
      .select('action, approval_time_seconds, patterns, created_at')
      .order('created_at', { ascending: false })
      .limit(100)

    if (!feedbackData) {
      return {
        total: 0,
        approved: 0,
        rejected: 0,
        edited: 0,
        avgApprovalTime: 0,
        recentPatterns: []
      }
    }

    const approved = feedbackData.filter(f => f.action === 'approved')
    const rejected = feedbackData.filter(f => f.action === 'rejected')
    const edited = feedbackData.filter(f => f.action === 'edited')

    const approvalTimes = feedbackData
      .filter(f => f.approval_time_seconds)
      .map(f => f.approval_time_seconds)

    const avgApprovalTime = approvalTimes.length > 0
      ? approvalTimes.reduce((sum, time) => sum + time, 0) / approvalTimes.length
      : 0

    const recentPatterns = edited
      .slice(0, 10)
      .map(f => ({
        quote_number: f.patterns?.quote_number,
        edit_types: f.patterns?.edit_types || [],
        price_direction: f.patterns?.price_direction,
        total_change_percentage: f.patterns?.total_change_percentage
      }))

    return {
      total: feedbackData.length,
      approved: approved.length,
      rejected: rejected.length,
      edited: edited.length,
      approvalRate: feedbackData.length > 0 
        ? (approved.length / feedbackData.length) * 100 
        : 0,
      avgApprovalTime: Math.round(avgApprovalTime),
      recentPatterns
    }
  }

  async getEditPatterns() {
    const { data: editsData } = await this.supabase
      .from('quote_edits')
      .select('edit_type, item_name, old_value, new_value, reason')
      .order('created_at', { ascending: false })
      .limit(50)

    if (!editsData) {
      return {
        mostCommonEditType: null,
        mostEditedItems: [],
        avgPriceChange: 0
      }
    }

    const editTypeCounts: Record<string, number> = {}
    const itemEditCounts: Record<string, number> = {}
    const priceChanges: number[] = []

    for (const edit of editsData) {
      editTypeCounts[edit.edit_type] = (editTypeCounts[edit.edit_type] || 0) + 1

      if (edit.item_name) {
        itemEditCounts[edit.item_name] = (itemEditCounts[edit.item_name] || 0) + 1
      }

      if (edit.edit_type === 'price_adjustment' && edit.old_value?.unit_price && edit.new_value?.unit_price) {
        const oldPrice = edit.old_value.unit_price
        const newPrice = edit.new_value.unit_price
        const changePercent = ((newPrice - oldPrice) / oldPrice) * 100
        priceChanges.push(changePercent)
      }
    }

    const mostCommonEditType = Object.entries(editTypeCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || null

    const mostEditedItems = Object.entries(itemEditCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([item, count]) => ({ item, count }))

    const avgPriceChange = priceChanges.length > 0
      ? priceChanges.reduce((sum, change) => sum + change, 0) / priceChanges.length
      : 0

    return {
      mostCommonEditType,
      mostEditedItems,
      avgPriceChange: Math.round(avgPriceChange * 100) / 100,
      totalEdits: editsData.length,
      editTypeBreakdown: editTypeCounts
    }
  }

  async getPendingApprovals() {
    const { data: tasks } = await this.supabase
      .from('squad_tasks')
      .select('*')
      .eq('status', 'new')
      .eq('metadata->>action_required', 'approve_quote')
      .order('created_at', { ascending: false })

    return tasks || []
  }

  async getQuoteHistory(quoteRequestId: string) {
    const [feedbackResult, editsResult] = await Promise.all([
      this.supabase
        .from('quote_approval_feedback')
        .select('*')
        .eq('quote_request_id', quoteRequestId)
        .order('created_at', { ascending: true }),
      this.supabase
        .from('quote_edits')
        .select('*')
        .eq('quote_request_id', quoteRequestId)
        .order('created_at', { ascending: true })
    ])

    return {
      feedback: feedbackResult.data || [],
      edits: editsResult.data || []
    }
  }

  async getLearningInsights() {
    const stats = await this.getApprovalStats()
    const patterns = await this.getEditPatterns()

    const insights = []

    if (stats.approvalRate < 60) {
      insights.push({
        type: 'warning',
        message: `Approval rate is low (${Math.round(stats.approvalRate)}%). Consider reviewing quote generation logic.`,
        metric: 'approval_rate',
        value: stats.approvalRate
      })
    }

    if (stats.edited > stats.approved) {
      insights.push({
        type: 'info',
        message: 'More quotes are being edited than approved directly. This suggests pricing needs refinement.',
        metric: 'edit_rate',
        value: (stats.edited / stats.total) * 100
      })
    }

    if (patterns.avgPriceChange < -5) {
      insights.push({
        type: 'warning',
        message: `Prices are consistently being reduced by ${Math.abs(patterns.avgPriceChange).toFixed(1)}%. Consider lowering initial markups.`,
        metric: 'price_adjustment',
        value: patterns.avgPriceChange
      })
    } else if (patterns.avgPriceChange > 5) {
      insights.push({
        type: 'info',
        message: `Prices are being increased by ${patterns.avgPriceChange.toFixed(1)}% on average. Consider higher initial markups.`,
        metric: 'price_adjustment',
        value: patterns.avgPriceChange
      })
    }

    if (patterns.mostEditedItems.length > 0) {
      const topItem = patterns.mostEditedItems[0]
      insights.push({
        type: 'info',
        message: `"${topItem.item}" is frequently edited (${topItem.count} times). Review pricing or sourcing for this item.`,
        metric: 'frequently_edited_item',
        value: topItem
      })
    }

    if (stats.avgApprovalTime > 300) {
      insights.push({
        type: 'info',
        message: `Average approval time is ${Math.round(stats.avgApprovalTime / 60)} minutes. Consider providing more context in approval tasks.`,
        metric: 'approval_time',
        value: stats.avgApprovalTime
      })
    }

    return {
      insights,
      stats,
      patterns,
      generatedAt: new Date().toISOString()
    }
  }
}

export const quoteApprovalWorkflow = new QuoteApprovalWorkflow()
