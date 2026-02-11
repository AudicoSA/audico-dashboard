import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { QuoteRequestDetector } from '../../lib/quote-request-detector'
import { SupplierAgent } from '../agents/supplier-agent'
import { QuoteAgent } from '../agents/quote-agent'
import { SupplierResponseHandler } from '../../lib/supplier-response-handler'
import { gmailService } from '../integrations/gmail-service'

interface WorkflowStep {
  step: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
  started_at?: string
  completed_at?: string
  error?: string
  metadata?: any
}

interface WorkflowExecution {
  workflow_id: string
  email_log_id: string
  quote_request_id?: string
  status: 'initializing' | 'detecting' | 'supplier_contacted' | 'awaiting_responses' | 'generating_quote' | 'pending_approval' | 'quote_sent' | 'failed' | 'completed'
  steps: WorkflowStep[]
  started_at: string
  completed_at?: string
  circuit_breaker_triggered?: boolean
  escalation_reason?: string
}

interface CircuitBreakerState {
  failures: number
  last_failure_time?: Date
  state: 'closed' | 'open' | 'half_open'
}

export class QuoteAutomationWorkflow {
  private supabase: SupabaseClient
  private agentName = 'QuoteAutomationWorkflow'
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map()
  private readonly CIRCUIT_BREAKER_THRESHOLD = 3
  private readonly CIRCUIT_BREAKER_TIMEOUT_MS = 300000 // 5 minutes
  private readonly SUPPLIER_RESPONSE_TIMEOUT_HOURS = 48

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  async automateQuoteRequest(emailLogId: string): Promise<{
    success: boolean
    workflow_id?: string
    quote_request_id?: string
    status?: string
    error?: string
  }> {
    const workflowId = this.generateWorkflowId()
    let execution: WorkflowExecution = {
      workflow_id: workflowId,
      email_log_id: emailLogId,
      status: 'initializing',
      steps: [],
      started_at: new Date().toISOString()
    }

    try {
      await this.logWorkflowStart(workflowId, emailLogId)
      
      const detectionStep = await this.executeStep(
        execution,
        'quote_detection',
        async () => await this.detectQuoteRequest(emailLogId)
      )

      if (!detectionStep.success) {
        return await this.handleWorkflowFailure(
          execution,
          'detection_failed',
          detectionStep.error || 'Quote detection failed'
        )
      }

      const { isQuoteRequest, quoteRequestId, confidenceScore, extractedData } = detectionStep.result

      if (!isQuoteRequest || confidenceScore < 0.5) {
        execution.status = 'completed'
        await this.logWorkflowCompletion(execution, 'not_a_quote_request')
        return {
          success: true,
          workflow_id: workflowId,
          status: 'not_a_quote_request'
        }
      }

      execution.quote_request_id = quoteRequestId
      await this.logAgentActivity(workflowId, 'quote_detected', {
        quote_request_id: quoteRequestId,
        confidence_score: confidenceScore
      })

      if (confidenceScore <= 0.8) {
        execution.status = 'completed'
        await this.logWorkflowCompletion(execution, 'low_confidence_requires_review')
        return {
          success: true,
          workflow_id: workflowId,
          quote_request_id: quoteRequestId,
          status: 'requires_manual_review'
        }
      }

      execution.status = 'supplier_contacted'
      const supplierStep = await this.executeStep(
        execution,
        'contact_suppliers',
        async () => await this.contactSuppliers(quoteRequestId)
      )

      if (!supplierStep.success) {
        return await this.handleWorkflowFailure(
          execution,
          'supplier_contact_failed',
          supplierStep.error || 'Failed to contact suppliers'
        )
      }

      const { suppliersContacted } = supplierStep.result

      if (suppliersContacted === 0) {
        return await this.handleWorkflowFailure(
          execution,
          'no_suppliers_contacted',
          'No suitable suppliers found'
        )
      }

      await this.logAgentActivity(workflowId, 'suppliers_contacted', {
        quote_request_id: quoteRequestId,
        suppliers_count: suppliersContacted
      })

      execution.status = 'awaiting_responses'
      const monitoringStep = await this.executeStep(
        execution,
        'monitor_responses',
        async () => await this.monitorSupplierResponses(quoteRequestId, workflowId)
      )

      if (!monitoringStep.success) {
        return await this.handleWorkflowFailure(
          execution,
          'monitoring_failed',
          monitoringStep.error || 'Response monitoring failed'
        )
      }

      const { responsesReceived, timedOut, reason } = monitoringStep.result

      await this.logAgentActivity(workflowId, 'responses_collected', {
        quote_request_id: quoteRequestId,
        responses_count: responsesReceived,
        collection_reason: reason
      })

      if (responsesReceived === 0) {
        return await this.handleWorkflowFailure(
          execution,
          'no_supplier_responses',
          'No suppliers responded within timeout period'
        )
      }

      execution.status = 'generating_quote'
      const quoteGenerationStep = await this.executeStep(
        execution,
        'generate_quote_pdf',
        async () => await this.generateQuotePDF(quoteRequestId)
      )

      if (!quoteGenerationStep.success) {
        return await this.handleWorkflowFailure(
          execution,
          'quote_generation_failed',
          quoteGenerationStep.error || 'Quote PDF generation failed'
        )
      }

      const { quoteNumber, pdfUrl, taskId } = quoteGenerationStep.result

      await this.logAgentActivity(workflowId, 'quote_pdf_generated', {
        quote_request_id: quoteRequestId,
        quote_number: quoteNumber,
        pdf_url: pdfUrl
      })

      execution.status = 'pending_approval'
      const approvalStep = await this.executeStep(
        execution,
        'create_approval_task',
        async () => await this.createApprovalTaskWithContext(quoteRequestId, workflowId, taskId)
      )

      if (!approvalStep.success) {
        return await this.handleWorkflowFailure(
          execution,
          'approval_task_creation_failed',
          approvalStep.error || 'Failed to create approval task'
        )
      }

      await this.logAgentActivity(workflowId, 'approval_task_created', {
        quote_request_id: quoteRequestId,
        task_id: approvalStep.result.taskId
      })

      execution.status = 'pending_approval'
      execution.completed_at = new Date().toISOString()
      await this.logWorkflowCompletion(execution, 'pending_approval')

      return {
        success: true,
        workflow_id: workflowId,
        quote_request_id: quoteRequestId,
        status: 'pending_approval'
      }

    } catch (error: any) {
      console.error('Workflow execution error:', error)
      return await this.handleWorkflowFailure(
        execution,
        'unexpected_error',
        error.message || 'Unexpected workflow error'
      )
    }
  }

  async handleQuoteApproval(quoteRequestId: string, workflowId: string, approvalStatus: 'approved' | 'rejected' | 'edited'): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      if (approvalStatus === 'rejected') {
        await this.logAgentActivity(workflowId, 'quote_rejected', {
          quote_request_id: quoteRequestId,
          reason: 'Kenny rejected the quote'
        })

        await this.supabase
          .from('quote_requests')
          .update({
            status: 'rejected',
            updated_at: new Date().toISOString()
          })
          .eq('id', quoteRequestId)

        return { success: true }
      }

      const { data: quoteRequest } = await this.supabase
        .from('quote_requests')
        .select('*')
        .eq('id', quoteRequestId)
        .single()

      if (!quoteRequest) {
        throw new Error('Quote request not found')
      }

      await this.logAgentActivity(workflowId, 'quote_approved', {
        quote_request_id: quoteRequestId,
        approval_status: approvalStatus
      })

      const sendStep = await this.sendQuoteToCustomer(quoteRequest)
      
      if (!sendStep.success) {
        await this.escalateToKenny(
          quoteRequestId,
          'email_send_failed',
          sendStep.error || 'Failed to send quote email'
        )
        return { success: false, error: sendStep.error }
      }

      await this.scheduleFollowUp(quoteRequest, workflowId)

      await this.supabase
        .from('quote_requests')
        .update({
          status: 'quote_sent',
          updated_at: new Date().toISOString()
        })
        .eq('id', quoteRequestId)

      await this.logAgentActivity(workflowId, 'quote_sent_to_customer', {
        quote_request_id: quoteRequestId,
        customer_email: quoteRequest.customer_email,
        follow_up_scheduled: true
      })

      return { success: true }

    } catch (error: any) {
      console.error('Error handling quote approval:', error)
      await this.escalateToKenny(
        quoteRequestId,
        'approval_handling_failed',
        error.message
      )
      return { success: false, error: error.message }
    }
  }

  private async detectQuoteRequest(emailLogId: string): Promise<{
    success: boolean
    result?: any
    error?: string
  }> {
    try {
      const circuitBreakerKey = 'quote_detection'
      
      if (!this.checkCircuitBreaker(circuitBreakerKey)) {
        throw new Error('Circuit breaker open: quote detection service unavailable')
      }

      const { data: emailLog } = await this.supabase
        .from('email_logs')
        .select('*')
        .eq('id', emailLogId)
        .single()

      if (!emailLog) {
        throw new Error(`Email log ${emailLogId} not found`)
      }

      const detector = new QuoteRequestDetector()
      const result = await detector.detectQuoteRequest({
        id: emailLog.id,
        gmail_message_id: emailLog.gmail_message_id,
        from_email: emailLog.from_email,
        subject: emailLog.subject,
        body: this.extractEmailBody(emailLog.payload)
      })

      this.recordCircuitBreakerSuccess(circuitBreakerKey)

      return {
        success: true,
        result: {
          isQuoteRequest: result.isQuoteRequest,
          quoteRequestId: result.quoteRequestId,
          confidenceScore: result.confidenceScore,
          extractedData: result.extractedData
        }
      }

    } catch (error: any) {
      this.recordCircuitBreakerFailure('quote_detection')
      return {
        success: false,
        error: error.message
      }
    }
  }

  private async contactSuppliers(quoteRequestId: string): Promise<{
    success: boolean
    result?: any
    error?: string
  }> {
    try {
      const circuitBreakerKey = 'supplier_contact'
      
      if (!this.checkCircuitBreaker(circuitBreakerKey)) {
        throw new Error('Circuit breaker open: supplier contact service unavailable')
      }

      const supplierAgent = new SupplierAgent()
      const result = await supplierAgent.processQuoteRequest(quoteRequestId)

      if (!result.success) {
        throw new Error(result.error || 'Supplier agent failed')
      }

      this.recordCircuitBreakerSuccess(circuitBreakerKey)

      return {
        success: true,
        result: {
          suppliersContacted: result.suppliersContacted
        }
      }

    } catch (error: any) {
      this.recordCircuitBreakerFailure('supplier_contact')
      return {
        success: false,
        error: error.message
      }
    }
  }

  private async monitorSupplierResponses(quoteRequestId: string, workflowId: string): Promise<{
    success: boolean
    result?: any
    error?: string
  }> {
    try {
      const startTime = new Date()
      const timeoutMs = this.SUPPLIER_RESPONSE_TIMEOUT_HOURS * 60 * 60 * 1000
      const pollIntervalMs = 60 * 60 * 1000 // Check every hour

      const { data: quoteRequest } = await this.supabase
        .from('quote_requests')
        .select('*')
        .eq('id', quoteRequestId)
        .single()

      if (!quoteRequest) {
        throw new Error('Quote request not found')
      }

      const { data: contactedSuppliers } = await this.supabase
        .from('email_supplier_interactions')
        .select('supplier_id')
        .eq('quote_request_id', quoteRequestId)
        .eq('interaction_type', 'quote_request')

      const totalContacted = contactedSuppliers?.length || 0

      if (totalContacted === 0) {
        return {
          success: true,
          result: {
            responsesReceived: 0,
            timedOut: true,
            reason: 'no_suppliers_contacted'
          }
        }
      }

      let attempts = 0
      const maxAttempts = Math.ceil(timeoutMs / pollIntervalMs)

      while (attempts < maxAttempts) {
        const { data: responses } = await this.supabase
          .from('email_supplier_interactions')
          .select('supplier_id')
          .eq('quote_request_id', quoteRequestId)
          .eq('interaction_type', 'quote_response')

        const responsesReceived = responses?.length || 0

        if (responsesReceived >= totalContacted) {
          return {
            success: true,
            result: {
              responsesReceived,
              timedOut: false,
              reason: 'all_suppliers_responded'
            }
          }
        }

        if (responsesReceived > 0 && responsesReceived >= Math.ceil(totalContacted * 0.5)) {
          const elapsed = Date.now() - startTime.getTime()
          if (elapsed >= timeoutMs * 0.75) {
            return {
              success: true,
              result: {
                responsesReceived,
                timedOut: true,
                reason: 'timeout_with_partial_responses'
              }
            }
          }
        }

        const elapsed = Date.now() - startTime.getTime()
        if (elapsed >= timeoutMs) {
          return {
            success: true,
            result: {
              responsesReceived,
              timedOut: true,
              reason: 'timeout_reached'
            }
          }
        }

        await this.logAgentActivity(workflowId, 'monitoring_supplier_responses', {
          quote_request_id: quoteRequestId,
          responses_received: responsesReceived,
          total_contacted: totalContacted,
          attempt: attempts + 1,
          elapsed_hours: Math.round(elapsed / (60 * 60 * 1000))
        })

        await this.sleep(pollIntervalMs)
        attempts++
      }

      const { data: finalResponses } = await this.supabase
        .from('email_supplier_interactions')
        .select('supplier_id')
        .eq('quote_request_id', quoteRequestId)
        .eq('interaction_type', 'quote_response')

      return {
        success: true,
        result: {
          responsesReceived: finalResponses?.length || 0,
          timedOut: true,
          reason: 'max_attempts_reached'
        }
      }

    } catch (error: any) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  private async generateQuotePDF(quoteRequestId: string): Promise<{
    success: boolean
    result?: any
    error?: string
  }> {
    try {
      const circuitBreakerKey = 'quote_generation'
      
      if (!this.checkCircuitBreaker(circuitBreakerKey)) {
        throw new Error('Circuit breaker open: quote generation service unavailable')
      }

      const quoteAgent = new QuoteAgent()
      const result = await quoteAgent.generateCustomerQuote(quoteRequestId)

      if (!result.success) {
        throw new Error(result.error || 'Quote generation failed')
      }

      this.recordCircuitBreakerSuccess(circuitBreakerKey)

      return {
        success: true,
        result: {
          quoteNumber: result.quoteNumber,
          pdfUrl: result.pdfUrl,
          taskId: result.taskId
        }
      }

    } catch (error: any) {
      this.recordCircuitBreakerFailure('quote_generation')
      return {
        success: false,
        error: error.message
      }
    }
  }

  private async createApprovalTaskWithContext(quoteRequestId: string, workflowId: string, existingTaskId?: string): Promise<{
    success: boolean
    result?: any
    error?: string
  }> {
    try {
      if (existingTaskId) {
        await this.supabase
          .from('squad_tasks')
          .update({
            metadata: {
              workflow_id: workflowId,
              quote_request_id: quoteRequestId,
              action_required: 'approve_quote'
            }
          })
          .eq('id', existingTaskId)

        return {
          success: true,
          result: { taskId: existingTaskId }
        }
      }

      const { data: quoteRequest } = await this.supabase
        .from('quote_requests')
        .select('*')
        .eq('id', quoteRequestId)
        .single()

      if (!quoteRequest) {
        throw new Error('Quote request not found')
      }

      const { data: workflowLogs } = await this.supabase
        .from('agent_logs')
        .select('*')
        .eq('workflow_id', workflowId)
        .order('timestamp', { ascending: true })

      const timeline = (workflowLogs || []).map((log: any) => ({
        timestamp: log.timestamp,
        event: log.event_type,
        details: log.context
      }))

      const description = `Quote ready for approval - Generated via automated workflow

**Customer:** ${quoteRequest.customer_name || quoteRequest.customer_email}
**Quote Number:** ${quoteRequest.pdf_url ? 'Available' : 'N/A'}
**Workflow ID:** ${workflowId}

**Workflow Timeline:**
${timeline.map(t => `- ${new Date(t.timestamp).toLocaleString()}: ${t.event}`).join('\n')}

**Actions:**
1. Review quote PDF
2. Approve or request changes
3. Quote will be sent to customer automatically upon approval

**Quote Request ID:** ${quoteRequestId}`

      const { data: task } = await this.supabase
        .from('squad_tasks')
        .insert({
          title: `Approve Automated Quote - ${quoteRequest.customer_name || quoteRequest.customer_email}`,
          description,
          status: 'new',
          assigned_agent: 'Kenny',
          priority: 'high',
          mentions_kenny: true,
          deliverable_url: quoteRequest.pdf_url,
          metadata: {
            workflow_id: workflowId,
            quote_request_id: quoteRequestId,
            action_required: 'approve_quote',
            automated_workflow: true,
            timeline
          }
        })
        .select()
        .single()

      await this.supabase
        .from('squad_messages')
        .insert({
          from_agent: this.agentName,
          to_agent: 'Kenny',
          message: `@Kenny - Automated quote workflow complete. Quote for ${quoteRequest.customer_name || quoteRequest.customer_email} ready for your approval.`,
          task_id: task?.id,
          data: {
            workflow_id: workflowId,
            quote_request_id: quoteRequestId,
            action: 'approve_quote'
          }
        })

      return {
        success: true,
        result: { taskId: task?.id }
      }

    } catch (error: any) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  private async sendQuoteToCustomer(quoteRequest: any): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const circuitBreakerKey = 'email_send'
      
      if (!this.checkCircuitBreaker(circuitBreakerKey)) {
        throw new Error('Circuit breaker open: email service unavailable')
      }

      const { data: draftData } = await this.supabase
        .from('email_drafts')
        .select('*')
        .eq('metadata->>quote_request_id', quoteRequest.id)
        .eq('status', 'pending_approval')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!draftData) {
        throw new Error('Email draft not found')
      }

      const result = await gmailService.sendEmail(
        draftData.to_email,
        draftData.subject,
        draftData.body,
        undefined,
        undefined,
        draftData.attachments?.map((url: string) => ({
          filename: `quote-${quoteRequest.id.substring(0, 8)}.pdf`,
          url
        }))
      )

      if (!result.success) {
        throw new Error(result.error || 'Email send failed')
      }

      await this.supabase
        .from('email_drafts')
        .update({ status: 'sent' })
        .eq('id', draftData.id)

      this.recordCircuitBreakerSuccess(circuitBreakerKey)

      return { success: true }

    } catch (error: any) {
      this.recordCircuitBreakerFailure('email_send')
      return {
        success: false,
        error: error.message
      }
    }
  }

  private async scheduleFollowUp(quoteRequest: any, workflowId: string): Promise<void> {
    try {
      const followUpDate = new Date()
      followUpDate.setDate(followUpDate.getDate() + 3)

      await this.supabase
        .from('squad_tasks')
        .insert({
          title: `Follow up: Quote for ${quoteRequest.customer_name || quoteRequest.customer_email}`,
          description: `Follow up on quote sent ${new Date().toLocaleDateString()}.

Customer: ${quoteRequest.customer_name || quoteRequest.customer_email}
Email: ${quoteRequest.customer_email}
Quote Request ID: ${quoteRequest.id}

Check if customer has questions or is ready to proceed with the order.`,
          status: 'new',
          assigned_agent: 'Mpho',
          priority: 'medium',
          mentions_kenny: false,
          deliverable_url: quoteRequest.pdf_url,
          metadata: {
            workflow_id: workflowId,
            quote_request_id: quoteRequest.id,
            task_type: 'follow_up',
            scheduled_for: followUpDate.toISOString()
          }
        })

      await this.logAgentActivity(workflowId, 'follow_up_scheduled', {
        quote_request_id: quoteRequest.id,
        scheduled_for: followUpDate.toISOString()
      })

    } catch (error) {
      console.error('Error scheduling follow-up:', error)
    }
  }

  private async executeStep<T>(
    execution: WorkflowExecution,
    stepName: string,
    stepFunction: () => Promise<T>
  ): Promise<T> {
    const step: WorkflowStep = {
      step: stepName,
      status: 'in_progress',
      started_at: new Date().toISOString()
    }

    execution.steps.push(step)

    try {
      const result = await stepFunction()
      
      step.status = 'completed'
      step.completed_at = new Date().toISOString()
      
      return result

    } catch (error: any) {
      step.status = 'failed'
      step.completed_at = new Date().toISOString()
      step.error = error.message
      
      throw error
    }
  }

  private async handleWorkflowFailure(
    execution: WorkflowExecution,
    reason: string,
    error: string
  ): Promise<{
    success: boolean
    workflow_id: string
    quote_request_id?: string
    error: string
  }> {
    execution.status = 'failed'
    execution.completed_at = new Date().toISOString()
    execution.escalation_reason = reason

    await this.logWorkflowCompletion(execution, 'failed')

    if (execution.quote_request_id) {
      await this.escalateToKenny(execution.quote_request_id, reason, error)
    }

    await this.logAgentActivity(execution.workflow_id, 'workflow_failed', {
      reason,
      error,
      quote_request_id: execution.quote_request_id
    })

    return {
      success: false,
      workflow_id: execution.workflow_id,
      quote_request_id: execution.quote_request_id,
      error
    }
  }

  private async escalateToKenny(
    quoteRequestId: string,
    reason: string,
    error: string
  ): Promise<void> {
    try {
      const { data: quoteRequest } = await this.supabase
        .from('quote_requests')
        .select('*')
        .eq('id', quoteRequestId)
        .single()

      await this.supabase
        .from('squad_tasks')
        .insert({
          title: `[ESCALATION] Quote Workflow Failed - ${quoteRequest?.customer_name || quoteRequest?.customer_email || 'Unknown'}`,
          description: `The automated quote workflow encountered an error and requires manual intervention.

**Reason:** ${reason}
**Error:** ${error}
**Quote Request ID:** ${quoteRequestId}
**Customer:** ${quoteRequest?.customer_name || quoteRequest?.customer_email || 'N/A'}

Please review and handle this quote request manually.`,
          status: 'new',
          assigned_agent: 'Kenny',
          priority: 'urgent',
          mentions_kenny: true,
          deliverable_url: null,
          metadata: {
            quote_request_id: quoteRequestId,
            escalation_reason: reason,
            error_message: error,
            escalated_at: new Date().toISOString()
          }
        })

      await this.supabase
        .from('squad_messages')
        .insert({
          from_agent: this.agentName,
          to_agent: 'Kenny',
          message: `@Kenny - URGENT: Quote workflow failed for ${quoteRequest?.customer_email}. Reason: ${reason}. Manual intervention required.`,
          task_id: null,
          data: {
            quote_request_id: quoteRequestId,
            escalation_reason: reason,
            error,
            action: 'escalation'
          }
        })

    } catch (escalationError) {
      console.error('Failed to escalate to Kenny:', escalationError)
    }
  }

  private checkCircuitBreaker(key: string): boolean {
    const state = this.circuitBreakers.get(key)

    if (!state || state.state === 'closed') {
      return true
    }

    if (state.state === 'open') {
      const timeSinceLastFailure = state.last_failure_time 
        ? Date.now() - state.last_failure_time.getTime()
        : 0

      if (timeSinceLastFailure >= this.CIRCUIT_BREAKER_TIMEOUT_MS) {
        state.state = 'half_open'
        state.failures = 0
        return true
      }

      return false
    }

    if (state.state === 'half_open') {
      return true
    }

    return false
  }

  private recordCircuitBreakerSuccess(key: string): void {
    const state = this.circuitBreakers.get(key)
    
    if (!state) {
      this.circuitBreakers.set(key, {
        failures: 0,
        state: 'closed'
      })
      return
    }

    state.failures = 0
    state.state = 'closed'
    state.last_failure_time = undefined
  }

  private recordCircuitBreakerFailure(key: string): void {
    const state = this.circuitBreakers.get(key) || {
      failures: 0,
      state: 'closed' as const
    }

    state.failures++
    state.last_failure_time = new Date()

    if (state.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      state.state = 'open'
    }

    this.circuitBreakers.set(key, state)
  }

  private async logWorkflowStart(workflowId: string, emailLogId: string): Promise<void> {
    try {
      await this.supabase
        .from('agent_logs')
        .insert({
          workflow_id: workflowId,
          agent_name: this.agentName,
          event_type: 'workflow_started',
          timestamp: new Date().toISOString(),
          context: {
            email_log_id: emailLogId,
            workflow_version: '1.0.0'
          }
        })
    } catch (error) {
      console.error('Error logging workflow start:', error)
    }
  }

  private async logWorkflowCompletion(execution: WorkflowExecution, outcome: string): Promise<void> {
    try {
      const duration = execution.completed_at
        ? new Date(execution.completed_at).getTime() - new Date(execution.started_at).getTime()
        : 0

      await this.supabase
        .from('agent_logs')
        .insert({
          workflow_id: execution.workflow_id,
          agent_name: this.agentName,
          event_type: 'workflow_completed',
          timestamp: new Date().toISOString(),
          context: {
            outcome,
            status: execution.status,
            duration_ms: duration,
            steps: execution.steps,
            quote_request_id: execution.quote_request_id,
            escalation_reason: execution.escalation_reason,
            circuit_breaker_triggered: execution.circuit_breaker_triggered
          }
        })

      await this.supabase
        .from('squad_messages')
        .insert({
          from_agent: this.agentName,
          to_agent: null,
          message: `Workflow ${execution.workflow_id.substring(0, 8)} completed: ${outcome}`,
          task_id: null,
          data: {
            workflow_id: execution.workflow_id,
            outcome,
            duration_seconds: Math.round(duration / 1000),
            quote_request_id: execution.quote_request_id
          }
        })
    } catch (error) {
      console.error('Error logging workflow completion:', error)
    }
  }

  private async logAgentActivity(workflowId: string, eventType: string, context: any): Promise<void> {
    try {
      await this.supabase
        .from('agent_logs')
        .insert({
          workflow_id: workflowId,
          agent_name: this.agentName,
          event_type: eventType,
          timestamp: new Date().toISOString(),
          context
        })
    } catch (error) {
      console.error('Error logging agent activity:', error)
    }
  }

  private generateWorkflowId(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 9)
    return `wf-${timestamp}-${random}`
  }

  private extractEmailBody(payload: any): string {
    if (!payload) return ''
    
    if (payload.body) {
      return typeof payload.body === 'string' ? payload.body : JSON.stringify(payload.body)
    }
    
    if (payload.snippet) {
      return payload.snippet
    }
    
    if (payload.parts) {
      const textParts = payload.parts
        .filter((p: any) => p.mimeType === 'text/plain' || p.mimeType === 'text/html')
        .map((p: any) => p.body?.data || '')
      return textParts.join('\n')
    }
    
    return ''
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export const quoteAutomationWorkflow = new QuoteAutomationWorkflow()

export async function automateQuoteRequest(emailLogId: string): Promise<{
  success: boolean
  workflow_id?: string
  quote_request_id?: string
  status?: string
  error?: string
}> {
  const workflow = new QuoteAutomationWorkflow()
  return await workflow.automateQuoteRequest(emailLogId)
}
