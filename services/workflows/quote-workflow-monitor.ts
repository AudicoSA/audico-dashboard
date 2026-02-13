import { createClient, SupabaseClient } from '@supabase/supabase-js'

interface WorkflowStep {
  step: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
  started_at: string
  completed_at?: string
  duration_seconds?: number
  error?: string
  metadata?: any
}

interface WorkflowExecution {
  workflow_id: string
  email_log_id?: string
  quote_request_id?: string
  workflow_type: 'quote_automation' | 'manual_quote' | 'approval' | 'follow_up'
  status: string
  steps: WorkflowStep[]
  current_step?: string
  started_at: string
  completed_at?: string
  
  // Step durations
  detection_duration?: number
  supplier_contact_duration?: number
  response_wait_duration?: number
  quote_generation_duration?: number
  approval_duration?: number
  send_duration?: number
  
  // Metrics
  suppliers_contacted: number
  suppliers_responded: number
  
  // Failure tracking
  failure_reason?: string
  failure_step?: string
  failure_count: number
  last_error?: string
  error_stack: string[]
  
  // Bottleneck detection
  bottleneck_detected: boolean
  bottleneck_step?: string
  bottleneck_duration?: number
  bottleneck_threshold_exceeded_by?: number
  
  // Recovery
  recovery_attempted: boolean
  recovery_actions: any[]
  recovery_successful?: boolean
  
  // Diagnostics
  diagnostic_results: any
  suggested_fixes: string[]
  
  // Alerting
  alert_triggered: boolean
  alert_type?: string
  alert_sent_at?: string
  alert_resolved_at?: string
  
  // Circuit breaker
  circuit_breaker_triggered: boolean
  circuit_breaker_service?: string
  
  metadata: any
}

interface DiagnosticResult {
  issue: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  suggested_fixes: string[]
  automated_fix_available: boolean
}

interface Alert {
  type: 'workflow_stuck' | 'supplier_non_response' | 'declining_acceptance_rate' | 'high_failure_rate' | 'bottleneck_detected'
  severity: 'warning' | 'error' | 'critical'
  workflow_id?: string
  message: string
  details: any
  timestamp: string
}

export class QuoteWorkflowMonitor {
  private supabase: SupabaseClient
  private readonly STUCK_THRESHOLD_HOURS = 24
  private readonly RESPONSE_RATE_WARNING_THRESHOLD = 0.5
  private readonly ACCEPTANCE_RATE_WARNING_THRESHOLD = 0.3
  private readonly FAILURE_RATE_WARNING_THRESHOLD = 0.25
  
  // Bottleneck thresholds (in seconds)
  private readonly BOTTLENECK_THRESHOLDS = {
    detection: 300, // 5 minutes
    supplier_contact: 600, // 10 minutes
    response_wait: 172800, // 48 hours
    quote_generation: 1800, // 30 minutes
    approval: 14400, // 4 hours
    send: 300 // 5 minutes
  }

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  /**
   * Start tracking a new workflow execution
   */
  async startWorkflowTracking(
    workflowId: string,
    workflowType: 'quote_automation' | 'manual_quote' | 'approval' | 'follow_up',
    emailLogId?: string,
    quoteRequestId?: string
  ): Promise<void> {
    try {
      const execution: Partial<WorkflowExecution> = {
        workflow_id: workflowId,
        email_log_id: emailLogId,
        quote_request_id: quoteRequestId,
        workflow_type: workflowType,
        status: 'initializing',
        steps: [],
        started_at: new Date().toISOString(),
        suppliers_contacted: 0,
        suppliers_responded: 0,
        failure_count: 0,
        error_stack: [],
        bottleneck_detected: false,
        recovery_attempted: false,
        recovery_actions: [],
        diagnostic_results: {},
        suggested_fixes: [],
        alert_triggered: false,
        circuit_breaker_triggered: false,
        metadata: {}
      }

      await this.supabase
        .from('quote_workflow_executions')
        .insert(execution)

    } catch (error) {
      console.error('Error starting workflow tracking:', error)
    }
  }

  /**
   * Update workflow step progress
   */
  async updateStepProgress(
    workflowId: string,
    stepName: string,
    status: 'in_progress' | 'completed' | 'failed',
    error?: string,
    metadata?: any
  ): Promise<void> {
    try {
      const { data: execution } = await this.supabase
        .from('quote_workflow_executions')
        .select('*')
        .eq('workflow_id', workflowId)
        .single()

      if (!execution) return

      const steps = execution.steps || []
      let step = steps.find((s: WorkflowStep) => s.step === stepName)

      if (!step) {
        step = {
          step: stepName,
          status: 'in_progress',
          started_at: new Date().toISOString()
        }
        steps.push(step)
      }

      step.status = status
      if (error) step.error = error
      if (metadata) step.metadata = metadata

      if (status === 'completed' || status === 'failed') {
        step.completed_at = new Date().toISOString()
        const duration = (new Date(step.completed_at).getTime() - new Date(step.started_at).getTime()) / 1000
        step.duration_seconds = Math.round(duration)

        // Update specific duration fields and check for bottlenecks
        await this.updateStepDuration(workflowId, stepName, step.duration_seconds)
        await this.checkForBottleneck(workflowId, stepName, step.duration_seconds)
      }

      await this.supabase
        .from('quote_workflow_executions')
        .update({ 
          steps,
          current_step: stepName,
          updated_at: new Date().toISOString()
        })
        .eq('workflow_id', workflowId)

      if (status === 'failed') {
        await this.handleStepFailure(workflowId, stepName, error || 'Unknown error')
      }

    } catch (error) {
      console.error('Error updating step progress:', error)
    }
  }

  /**
   * Update specific step duration fields
   */
  private async updateStepDuration(workflowId: string, stepName: string, duration: number): Promise<void> {
    const durationMap: Record<string, string> = {
      'quote_detection': 'detection_duration',
      'contact_suppliers': 'supplier_contact_duration',
      'monitor_responses': 'response_wait_duration',
      'generate_quote_pdf': 'quote_generation_duration',
      'create_approval_task': 'approval_duration',
      'send_quote': 'send_duration'
    }

    const durationField = durationMap[stepName]
    if (durationField) {
      await this.supabase
        .from('quote_workflow_executions')
        .update({ [durationField]: duration })
        .eq('workflow_id', workflowId)
    }
  }

  /**
   * Check for bottlenecks in workflow steps
   */
  private async checkForBottleneck(workflowId: string, stepName: string, duration: number): Promise<void> {
    const thresholdMap: Record<string, number> = {
      'quote_detection': this.BOTTLENECK_THRESHOLDS.detection,
      'contact_suppliers': this.BOTTLENECK_THRESHOLDS.supplier_contact,
      'monitor_responses': this.BOTTLENECK_THRESHOLDS.response_wait,
      'generate_quote_pdf': this.BOTTLENECK_THRESHOLDS.quote_generation,
      'create_approval_task': this.BOTTLENECK_THRESHOLDS.approval,
      'send_quote': this.BOTTLENECK_THRESHOLDS.send
    }

    const threshold = thresholdMap[stepName]
    if (threshold && duration > threshold) {
      const exceededBy = duration - threshold

      await this.supabase
        .from('quote_workflow_executions')
        .update({
          bottleneck_detected: true,
          bottleneck_step: stepName,
          bottleneck_duration: duration,
          bottleneck_threshold_exceeded_by: exceededBy
        })
        .eq('workflow_id', workflowId)

      await this.triggerAlert(workflowId, {
        type: 'bottleneck_detected',
        severity: exceededBy > threshold * 2 ? 'critical' : 'warning',
        workflow_id: workflowId,
        message: `Bottleneck detected in ${stepName}: ${this.formatDuration(duration)} (threshold: ${this.formatDuration(threshold)})`,
        details: { stepName, duration, threshold, exceededBy },
        timestamp: new Date().toISOString()
      })
    }
  }

  /**
   * Update supplier metrics
   */
  async updateSupplierMetrics(
    workflowId: string,
    suppliersContacted: number,
    suppliersResponded: number
  ): Promise<void> {
    try {
      await this.supabase
        .from('quote_workflow_executions')
        .update({
          suppliers_contacted: suppliersContacted,
          suppliers_responded: suppliersResponded
        })
        .eq('workflow_id', workflowId)

      // Check for supplier non-response pattern
      if (suppliersContacted > 0 && suppliersResponded === 0) {
        const { data: execution } = await this.supabase
          .from('quote_workflow_executions')
          .select('started_at, response_wait_duration')
          .eq('workflow_id', workflowId)
          .single()

        if (execution?.response_wait_duration && execution.response_wait_duration > 86400) { // 24 hours
          await this.triggerAlert(workflowId, {
            type: 'supplier_non_response',
            severity: 'warning',
            workflow_id: workflowId,
            message: `No supplier responses after ${suppliersContacted} contacts for over 24 hours`,
            details: { suppliersContacted, suppliersResponded, waitDuration: execution.response_wait_duration },
            timestamp: new Date().toISOString()
          })
        }
      }

    } catch (error) {
      console.error('Error updating supplier metrics:', error)
    }
  }

  /**
   * Handle workflow step failure
   */
  private async handleStepFailure(workflowId: string, stepName: string, error: string): Promise<void> {
    try {
      const { data: execution } = await this.supabase
        .from('quote_workflow_executions')
        .select('*')
        .eq('workflow_id', workflowId)
        .single()

      if (!execution) return

      const errorStack = [...(execution.error_stack || []), {
        step: stepName,
        error,
        timestamp: new Date().toISOString()
      }]

      const failureCount = execution.failure_count + 1

      // Run diagnostics
      const diagnostics = await this.runDiagnostics(workflowId, stepName, error, execution)

      await this.supabase
        .from('quote_workflow_executions')
        .update({
          status: 'failed',
          failure_step: stepName,
          failure_reason: error,
          failure_count: failureCount,
          last_error: error,
          error_stack: errorStack,
          diagnostic_results: diagnostics.results,
          suggested_fixes: diagnostics.suggestions,
          completed_at: new Date().toISOString()
        })
        .eq('workflow_id', workflowId)

      // Attempt automated recovery
      if (diagnostics.canAutoRecover) {
        await this.attemptRecovery(workflowId, stepName, diagnostics.recoveryActions)
      }

    } catch (error) {
      console.error('Error handling step failure:', error)
    }
  }

  /**
   * Run automated diagnostics on failed workflows
   */
  private async runDiagnostics(
    workflowId: string,
    failedStep: string,
    error: string,
    execution: any
  ): Promise<{
    results: any
    suggestions: string[]
    canAutoRecover: boolean
    recoveryActions: any[]
  }> {
    const diagnostics: DiagnosticResult[] = []
    const suggestions: string[] = []
    const recoveryActions: any[] = []
    let canAutoRecover = false

    // Diagnose common failure patterns
    if (error.includes('Circuit breaker open')) {
      diagnostics.push({
        issue: 'circuit_breaker_triggered',
        severity: 'high',
        description: 'Circuit breaker is open, indicating repeated failures in a service',
        suggested_fixes: [
          'Wait for circuit breaker timeout (5 minutes)',
          'Check service health and logs',
          'Verify external service availability'
        ],
        automated_fix_available: true
      })
      suggestions.push('Wait for circuit breaker to reset and retry')
      canAutoRecover = true
      recoveryActions.push({
        action: 'wait_for_circuit_breaker_reset',
        delay_seconds: 300
      })
    }

    if (error.includes('No suppliers found') || error.includes('No suitable suppliers')) {
      diagnostics.push({
        issue: 'no_suppliers_available',
        severity: 'critical',
        description: 'No suppliers found for the requested products',
        suggested_fixes: [
          'Add suppliers to the database',
          'Review product categories and supplier specialties',
          'Check supplier_products table for coverage'
        ],
        automated_fix_available: false
      })
      suggestions.push('Add relevant suppliers to database or expand supplier network')
    }

    if (error.includes('timeout') || error.includes('timed out')) {
      diagnostics.push({
        issue: 'timeout_exceeded',
        severity: 'medium',
        description: 'Operation exceeded timeout threshold',
        suggested_fixes: [
          'Increase timeout configuration',
          'Optimize the slow operation',
          'Check network connectivity'
        ],
        automated_fix_available: true
      })
      suggestions.push('Retry with extended timeout')
      canAutoRecover = true
      recoveryActions.push({
        action: 'retry_with_extended_timeout',
        timeout_multiplier: 2
      })
    }

    if (error.includes('Email send failed') || error.includes('Gmail')) {
      diagnostics.push({
        issue: 'email_service_failure',
        severity: 'high',
        description: 'Email service encountered an error',
        suggested_fixes: [
          'Verify Gmail API credentials',
          'Check email service rate limits',
          'Verify recipient email address format'
        ],
        automated_fix_available: true
      })
      suggestions.push('Retry email send with exponential backoff')
      canAutoRecover = true
      recoveryActions.push({
        action: 'retry_email_send',
        backoff_seconds: 60
      })
    }

    if (error.includes('Quote generation failed') || error.includes('PDF')) {
      diagnostics.push({
        issue: 'pdf_generation_failure',
        severity: 'high',
        description: 'Quote PDF generation failed',
        suggested_fixes: [
          'Check quote template configuration',
          'Verify all required data is present',
          'Check PDF generation service status'
        ],
        automated_fix_available: false
      })
      suggestions.push('Review quote data completeness and template configuration')
    }

    if (failedStep === 'monitor_responses' && execution.suppliers_contacted > 0 && execution.suppliers_responded === 0) {
      diagnostics.push({
        issue: 'no_supplier_responses',
        severity: 'high',
        description: 'No suppliers responded within timeout period',
        suggested_fixes: [
          'Send follow-up emails to suppliers',
          'Call suppliers directly',
          'Use alternative suppliers',
          'Extend response timeout for this request'
        ],
        automated_fix_available: true
      })
      suggestions.push('Send automated follow-up to non-responding suppliers')
      canAutoRecover = true
      recoveryActions.push({
        action: 'send_supplier_follow_ups',
        quote_request_id: execution.quote_request_id
      })
    }

    return {
      results: {
        diagnostics,
        execution_context: {
          workflow_id: workflowId,
          failed_step: failedStep,
          error_message: error,
          total_failures: execution.failure_count + 1,
          execution_duration: execution.total_duration_seconds
        },
        timestamp: new Date().toISOString()
      },
      suggestions,
      canAutoRecover,
      recoveryActions
    }
  }

  /**
   * Attempt automated recovery
   */
  private async attemptRecovery(workflowId: string, failedStep: string, recoveryActions: any[]): Promise<void> {
    try {
      await this.supabase
        .from('quote_workflow_executions')
        .update({
          status: 'recovering',
          recovery_attempted: true,
          recovery_actions: recoveryActions
        })
        .eq('workflow_id', workflowId)

      for (const action of recoveryActions) {
        try {
          await this.executeRecoveryAction(workflowId, action)
        } catch (error) {
          console.error(`Recovery action failed: ${action.action}`, error)
        }
      }

      // Mark recovery as successful if we get here
      await this.supabase
        .from('quote_workflow_executions')
        .update({
          recovery_successful: true,
          status: 'initializing' // Ready to retry
        })
        .eq('workflow_id', workflowId)

    } catch (error) {
      console.error('Error during recovery attempt:', error)
      await this.supabase
        .from('quote_workflow_executions')
        .update({
          recovery_successful: false,
          status: 'failed'
        })
        .eq('workflow_id', workflowId)
    }
  }

  /**
   * Execute a specific recovery action
   */
  private async executeRecoveryAction(workflowId: string, action: any): Promise<void> {
    switch (action.action) {
      case 'wait_for_circuit_breaker_reset':
        await new Promise(resolve => setTimeout(resolve, action.delay_seconds * 1000))
        break

      case 'send_supplier_follow_ups':
        // Log the need for follow-up (actual implementation would integrate with email service)
        await this.supabase
          .from('agent_logs')
          .insert({
            workflow_id: workflowId,
            agent_name: 'QuoteWorkflowMonitor',
            event_type: 'recovery_action_supplier_follow_up',
            timestamp: new Date().toISOString(),
            context: {
              quote_request_id: action.quote_request_id,
              action: 'send_follow_up_emails'
            }
          })
        break

      case 'retry_email_send':
        await new Promise(resolve => setTimeout(resolve, action.backoff_seconds * 1000))
        break

      default:
        console.log(`Unknown recovery action: ${action.action}`)
    }
  }

  /**
   * Complete workflow tracking
   */
  async completeWorkflow(
    workflowId: string,
    status: 'completed' | 'failed',
    finalMetadata?: any
  ): Promise<void> {
    try {
      await this.supabase
        .from('quote_workflow_executions')
        .update({
          status,
          completed_at: new Date().toISOString(),
          metadata: finalMetadata || {}
        })
        .eq('workflow_id', workflowId)

    } catch (error) {
      console.error('Error completing workflow:', error)
    }
  }

  /**
   * Check for stuck workflows and trigger alerts
   */
  async checkStuckWorkflows(): Promise<Alert[]> {
    try {
      const stuckThreshold = new Date()
      stuckThreshold.setHours(stuckThreshold.getHours() - this.STUCK_THRESHOLD_HOURS)

      const { data: stuckWorkflows } = await this.supabase
        .from('quote_workflow_executions')
        .select('*')
        .in('status', ['initializing', 'detecting', 'supplier_contacted', 'awaiting_responses', 'generating_quote'])
        .lt('started_at', stuckThreshold.toISOString())
        .is('alert_triggered', false)

      const alerts: Alert[] = []

      for (const workflow of stuckWorkflows || []) {
        const alert: Alert = {
          type: 'workflow_stuck',
          severity: 'critical',
          workflow_id: workflow.workflow_id,
          message: `Workflow stuck in ${workflow.status} for over ${this.STUCK_THRESHOLD_HOURS} hours`,
          details: {
            workflow_id: workflow.workflow_id,
            quote_request_id: workflow.quote_request_id,
            current_step: workflow.current_step,
            started_at: workflow.started_at,
            hours_stuck: Math.round((Date.now() - new Date(workflow.started_at).getTime()) / (1000 * 60 * 60))
          },
          timestamp: new Date().toISOString()
        }

        alerts.push(alert)
        await this.triggerAlert(workflow.workflow_id, alert)

        // Mark as stuck
        await this.supabase
          .from('quote_workflow_executions')
          .update({ status: 'stuck' })
          .eq('workflow_id', workflow.workflow_id)
      }

      return alerts

    } catch (error) {
      console.error('Error checking stuck workflows:', error)
      return []
    }
  }

  /**
   * Monitor supplier response rate trends
   */
  async monitorSupplierResponseRates(): Promise<Alert[]> {
    try {
      const { data: trends } = await this.supabase
        .from('quote_workflow_supplier_trends')
        .select('*')
        .order('date', { ascending: false })
        .limit(7)

      if (!trends || trends.length === 0) return []

      const recentAvg = trends.slice(0, 3).reduce((sum, t) => sum + (t.avg_response_rate || 0), 0) / 3
      const alerts: Alert[] = []

      if (recentAvg < this.RESPONSE_RATE_WARNING_THRESHOLD * 100) {
        alerts.push({
          type: 'supplier_non_response',
          severity: 'warning',
          message: `Supplier response rate declining: ${recentAvg.toFixed(1)}% (last 3 days)`,
          details: {
            recent_avg_response_rate: recentAvg,
            threshold: this.RESPONSE_RATE_WARNING_THRESHOLD * 100,
            trend_data: trends.slice(0, 7)
          },
          timestamp: new Date().toISOString()
        })
      }

      return alerts

    } catch (error) {
      console.error('Error monitoring supplier response rates:', error)
      return []
    }
  }

  /**
   * Monitor customer acceptance rate trends
   */
  async monitorCustomerAcceptanceRates(): Promise<Alert[]> {
    try {
      const { data: trends } = await this.supabase
        .from('quote_workflow_customer_acceptance_patterns')
        .select('*')
        .order('week', { ascending: false })
        .limit(4)

      if (!trends || trends.length === 0) return []

      const recentWeeks = trends.slice(0, 2)
      const avgAcceptanceRate = recentWeeks.reduce((sum, t) => sum + (t.acceptance_rate || 0), 0) / recentWeeks.length
      const alerts: Alert[] = []

      if (avgAcceptanceRate < this.ACCEPTANCE_RATE_WARNING_THRESHOLD * 100) {
        alerts.push({
          type: 'declining_acceptance_rate',
          severity: 'error',
          message: `Customer acceptance rate declining: ${avgAcceptanceRate.toFixed(1)}% (last 2 weeks)`,
          details: {
            recent_acceptance_rate: avgAcceptanceRate,
            threshold: this.ACCEPTANCE_RATE_WARNING_THRESHOLD * 100,
            trend_data: trends
          },
          timestamp: new Date().toISOString()
        })
      }

      return alerts

    } catch (error) {
      console.error('Error monitoring acceptance rates:', error)
      return []
    }
  }

  /**
   * Monitor overall workflow failure rates
   */
  async monitorFailureRates(): Promise<Alert[]> {
    try {
      const { data: metrics } = await this.supabase
        .from('quote_workflow_health_metrics')
        .select('*')
        .eq('workflow_type', 'quote_automation')

      if (!metrics || metrics.length === 0) return []

      const totalExecutions = metrics.reduce((sum, m) => sum + (m.execution_count || 0), 0)
      const failedExecutions = metrics
        .filter(m => m.status === 'failed')
        .reduce((sum, m) => sum + (m.execution_count || 0), 0)

      const failureRate = totalExecutions > 0 ? failedExecutions / totalExecutions : 0
      const alerts: Alert[] = []

      if (failureRate > this.FAILURE_RATE_WARNING_THRESHOLD) {
        alerts.push({
          type: 'high_failure_rate',
          severity: 'critical',
          message: `High workflow failure rate: ${(failureRate * 100).toFixed(1)}%`,
          details: {
            failure_rate: failureRate * 100,
            threshold: this.FAILURE_RATE_WARNING_THRESHOLD * 100,
            total_executions: totalExecutions,
            failed_executions: failedExecutions,
            metrics
          },
          timestamp: new Date().toISOString()
        })
      }

      return alerts

    } catch (error) {
      console.error('Error monitoring failure rates:', error)
      return []
    }
  }

  /**
   * Trigger an alert
   */
  private async triggerAlert(workflowId: string, alert: Alert): Promise<void> {
    try {
      await this.supabase
        .from('quote_workflow_executions')
        .update({
          alert_triggered: true,
          alert_type: alert.type,
          alert_sent_at: alert.timestamp
        })
        .eq('workflow_id', workflowId)

      // Create squad message for Kenny
      await this.supabase
        .from('squad_messages')
        .insert({
          from_agent: 'QuoteWorkflowMonitor',
          to_agent: 'Kenny',
          message: `@Kenny - ALERT: ${alert.message}`,
          task_id: null,
          data: {
            alert_type: alert.type,
            severity: alert.severity,
            workflow_id: workflowId,
            details: alert.details
          }
        })

      // Log the alert
      await this.supabase
        .from('agent_logs')
        .insert({
          workflow_id: workflowId,
          agent_name: 'QuoteWorkflowMonitor',
          event_type: `alert_${alert.type}`,
          timestamp: alert.timestamp,
          context: {
            severity: alert.severity,
            message: alert.message,
            details: alert.details
          }
        })

    } catch (error) {
      console.error('Error triggering alert:', error)
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(workflowId: string): Promise<void> {
    try {
      await this.supabase
        .from('quote_workflow_executions')
        .update({
          alert_resolved_at: new Date().toISOString()
        })
        .eq('workflow_id', workflowId)

    } catch (error) {
      console.error('Error resolving alert:', error)
    }
  }

  /**
   * Get workflow health summary
   */
  async getHealthSummary(): Promise<any> {
    try {
      const [metricsRes, bottlenecksRes, failuresRes, alertsRes] = await Promise.all([
        this.supabase.from('quote_workflow_health_metrics').select('*'),
        this.supabase.from('quote_workflow_bottlenecks').select('*').limit(10),
        this.supabase.from('quote_workflow_failure_analysis').select('*').limit(10),
        this.supabase.from('quote_workflow_alert_summary').select('*')
      ])

      return {
        metrics: metricsRes.data || [],
        bottlenecks: bottlenecksRes.data || [],
        failures: failuresRes.data || [],
        alerts: alertsRes.data || [],
        timestamp: new Date().toISOString()
      }

    } catch (error) {
      console.error('Error getting health summary:', error)
      return null
    }
  }

  /**
   * Run all monitoring checks
   */
  async runMonitoringChecks(): Promise<Alert[]> {
    const allAlerts: Alert[] = []

    try {
      const [stuckAlerts, supplierAlerts, acceptanceAlerts, failureAlerts] = await Promise.all([
        this.checkStuckWorkflows(),
        this.monitorSupplierResponseRates(),
        this.monitorCustomerAcceptanceRates(),
        this.monitorFailureRates()
      ])

      allAlerts.push(...stuckAlerts, ...supplierAlerts, ...acceptanceAlerts, ...failureAlerts)

      return allAlerts

    } catch (error) {
      console.error('Error running monitoring checks:', error)
      return allAlerts
    }
  }

  /**
   * Format duration for display
   */
  private formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`
    if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`
    return `${(seconds / 86400).toFixed(1)}d`
  }
}

export const quoteWorkflowMonitor = new QuoteWorkflowMonitor()
