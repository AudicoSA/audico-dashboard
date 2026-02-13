/**
 * Example: Integrating Quote Workflow Monitor with Quote Automation Workflow
 * 
 * This example shows how to integrate the monitoring system into the existing
 * quote automation workflow to track performance, detect bottlenecks, and
 * enable automated diagnostics and recovery.
 */

import { QuoteAutomationWorkflow } from './quote-automation-workflow'
import { quoteWorkflowMonitor } from './quote-workflow-monitor'

/**
 * Enhanced Quote Automation Workflow with Monitoring
 */
export class MonitoredQuoteAutomationWorkflow extends QuoteAutomationWorkflow {
  
  /**
   * Override the main automation method to add monitoring
   */
  async automateQuoteRequest(emailLogId: string): Promise<{
    success: boolean
    workflow_id?: string
    quote_request_id?: string
    status?: string
    error?: string
  }> {
    const workflowId = this.generateWorkflowId()
    
    // Start workflow tracking
    await quoteWorkflowMonitor.startWorkflowTracking(
      workflowId,
      'quote_automation',
      emailLogId
    )

    try {
      // STEP 1: Quote Detection
      await quoteWorkflowMonitor.updateStepProgress(workflowId, 'quote_detection', 'in_progress')
      
      const detectionResult = await this.detectQuoteRequest(emailLogId)
      
      if (!detectionResult.success) {
        await quoteWorkflowMonitor.updateStepProgress(
          workflowId,
          'quote_detection',
          'failed',
          detectionResult.error
        )
        await quoteWorkflowMonitor.completeWorkflow(workflowId, 'failed')
        return { success: false, workflow_id: workflowId, error: detectionResult.error }
      }

      await quoteWorkflowMonitor.updateStepProgress(
        workflowId,
        'quote_detection',
        'completed',
        undefined,
        {
          confidence: detectionResult.result.confidenceScore,
          is_quote: detectionResult.result.isQuoteRequest
        }
      )

      const { isQuoteRequest, quoteRequestId, confidenceScore } = detectionResult.result

      if (!isQuoteRequest || confidenceScore < 0.5) {
        await quoteWorkflowMonitor.completeWorkflow(workflowId, 'completed', {
          outcome: 'not_a_quote_request',
          confidence: confidenceScore
        })
        return {
          success: true,
          workflow_id: workflowId,
          status: 'not_a_quote_request'
        }
      }

      if (confidenceScore <= 0.8) {
        await quoteWorkflowMonitor.completeWorkflow(workflowId, 'completed', {
          outcome: 'requires_manual_review',
          confidence: confidenceScore
        })
        return {
          success: true,
          workflow_id: workflowId,
          quote_request_id: quoteRequestId,
          status: 'requires_manual_review'
        }
      }

      // STEP 2: Contact Suppliers
      await quoteWorkflowMonitor.updateStepProgress(workflowId, 'contact_suppliers', 'in_progress')
      
      const supplierResult = await this.contactSuppliers(quoteRequestId)
      
      if (!supplierResult.success) {
        await quoteWorkflowMonitor.updateStepProgress(
          workflowId,
          'contact_suppliers',
          'failed',
          supplierResult.error
        )
        await quoteWorkflowMonitor.completeWorkflow(workflowId, 'failed')
        return { success: false, workflow_id: workflowId, error: supplierResult.error }
      }

      const { suppliersContacted } = supplierResult.result

      await quoteWorkflowMonitor.updateStepProgress(
        workflowId,
        'contact_suppliers',
        'completed',
        undefined,
        { suppliers_contacted: suppliersContacted }
      )

      // Update supplier metrics
      await quoteWorkflowMonitor.updateSupplierMetrics(workflowId, suppliersContacted, 0)

      if (suppliersContacted === 0) {
        await quoteWorkflowMonitor.completeWorkflow(workflowId, 'failed', {
          failure_reason: 'no_suppliers_contacted'
        })
        return {
          success: false,
          workflow_id: workflowId,
          error: 'No suitable suppliers found'
        }
      }

      // STEP 3: Monitor Supplier Responses
      await quoteWorkflowMonitor.updateStepProgress(workflowId, 'monitor_responses', 'in_progress')
      
      const monitoringResult = await this.monitorSupplierResponses(quoteRequestId, workflowId)
      
      if (!monitoringResult.success) {
        await quoteWorkflowMonitor.updateStepProgress(
          workflowId,
          'monitor_responses',
          'failed',
          monitoringResult.error
        )
        await quoteWorkflowMonitor.completeWorkflow(workflowId, 'failed')
        return { success: false, workflow_id: workflowId, error: monitoringResult.error }
      }

      const { responsesReceived } = monitoringResult.result

      await quoteWorkflowMonitor.updateStepProgress(
        workflowId,
        'monitor_responses',
        'completed',
        undefined,
        {
          responses_received: responsesReceived,
          suppliers_contacted: suppliersContacted
        }
      )

      // Update supplier response metrics
      await quoteWorkflowMonitor.updateSupplierMetrics(
        workflowId,
        suppliersContacted,
        responsesReceived
      )

      if (responsesReceived === 0) {
        await quoteWorkflowMonitor.completeWorkflow(workflowId, 'failed', {
          failure_reason: 'no_supplier_responses'
        })
        return {
          success: false,
          workflow_id: workflowId,
          error: 'No suppliers responded within timeout period'
        }
      }

      // STEP 4: Generate Quote PDF
      await quoteWorkflowMonitor.updateStepProgress(workflowId, 'generate_quote_pdf', 'in_progress')
      
      const quoteResult = await this.generateQuotePDF(quoteRequestId)
      
      if (!quoteResult.success) {
        await quoteWorkflowMonitor.updateStepProgress(
          workflowId,
          'generate_quote_pdf',
          'failed',
          quoteResult.error
        )
        await quoteWorkflowMonitor.completeWorkflow(workflowId, 'failed')
        return { success: false, workflow_id: workflowId, error: quoteResult.error }
      }

      const { quoteNumber, pdfUrl } = quoteResult.result

      await quoteWorkflowMonitor.updateStepProgress(
        workflowId,
        'generate_quote_pdf',
        'completed',
        undefined,
        { quote_number: quoteNumber, pdf_url: pdfUrl }
      )

      // STEP 5: Create Approval Task
      await quoteWorkflowMonitor.updateStepProgress(workflowId, 'create_approval_task', 'in_progress')
      
      const approvalResult = await this.createApprovalTaskWithContext(
        quoteRequestId,
        workflowId,
        quoteResult.result.taskId
      )
      
      if (!approvalResult.success) {
        await quoteWorkflowMonitor.updateStepProgress(
          workflowId,
          'create_approval_task',
          'failed',
          approvalResult.error
        )
        await quoteWorkflowMonitor.completeWorkflow(workflowId, 'failed')
        return { success: false, workflow_id: workflowId, error: approvalResult.error }
      }

      await quoteWorkflowMonitor.updateStepProgress(
        workflowId,
        'create_approval_task',
        'completed',
        undefined,
        { task_id: approvalResult.result.taskId }
      )

      // Complete workflow tracking
      await quoteWorkflowMonitor.completeWorkflow(workflowId, 'completed', {
        outcome: 'pending_approval',
        quote_request_id: quoteRequestId,
        quote_number: quoteNumber,
        suppliers_contacted: suppliersContacted,
        suppliers_responded: responsesReceived
      })

      return {
        success: true,
        workflow_id: workflowId,
        quote_request_id: quoteRequestId,
        status: 'pending_approval'
      }

    } catch (error: any) {
      console.error('Workflow execution error:', error)
      
      // Let the monitor handle the failure and attempt recovery
      await quoteWorkflowMonitor.completeWorkflow(workflowId, 'failed', {
        unexpected_error: error.message,
        stack: error.stack
      })

      return {
        success: false,
        workflow_id: workflowId,
        error: error.message
      }
    }
  }

  /**
   * Override the approval handler to update monitoring
   */
  async handleQuoteApproval(
    quoteRequestId: string,
    workflowId: string,
    approvalStatus: 'approved' | 'rejected' | 'edited'
  ): Promise<{ success: boolean; error?: string }> {
    
    if (approvalStatus === 'approved') {
      // STEP 6: Send Quote
      await quoteWorkflowMonitor.updateStepProgress(workflowId, 'send_quote', 'in_progress')

      const result = await super.handleQuoteApproval(quoteRequestId, workflowId, approvalStatus)

      if (result.success) {
        await quoteWorkflowMonitor.updateStepProgress(workflowId, 'send_quote', 'completed')
        await quoteWorkflowMonitor.completeWorkflow(workflowId, 'completed', {
          outcome: 'quote_sent',
          approval_status: approvalStatus
        })
      } else {
        await quoteWorkflowMonitor.updateStepProgress(
          workflowId,
          'send_quote',
          'failed',
          result.error
        )
        await quoteWorkflowMonitor.completeWorkflow(workflowId, 'failed')
      }

      return result
    }

    // For rejected/edited, just complete the workflow
    await quoteWorkflowMonitor.completeWorkflow(workflowId, 'completed', {
      outcome: approvalStatus,
      quote_request_id: quoteRequestId
    })

    return await super.handleQuoteApproval(quoteRequestId, workflowId, approvalStatus)
  }

  /**
   * Generate unique workflow ID
   */
  private generateWorkflowId(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 9)
    return `wf-${timestamp}-${random}`
  }

  /**
   * Placeholder methods (these would be implemented in the actual workflow)
   */
  private async detectQuoteRequest(emailLogId: string): Promise<any> {
    // Implementation from QuoteAutomationWorkflow
    return { success: true, result: { isQuoteRequest: true, quoteRequestId: 'qr-123', confidenceScore: 0.95 } }
  }

  private async contactSuppliers(quoteRequestId: string): Promise<any> {
    // Implementation from QuoteAutomationWorkflow
    return { success: true, result: { suppliersContacted: 3 } }
  }

  private async monitorSupplierResponses(quoteRequestId: string, workflowId: string): Promise<any> {
    // Implementation from QuoteAutomationWorkflow
    return { success: true, result: { responsesReceived: 2 } }
  }

  private async generateQuotePDF(quoteRequestId: string): Promise<any> {
    // Implementation from QuoteAutomationWorkflow
    return { success: true, result: { quoteNumber: 'Q-2024-001', pdfUrl: 'https://...', taskId: 'task-123' } }
  }

  private async createApprovalTaskWithContext(
    quoteRequestId: string,
    workflowId: string,
    taskId?: string
  ): Promise<any> {
    // Implementation from QuoteAutomationWorkflow
    return { success: true, result: { taskId: taskId || 'task-123' } }
  }
}

/**
 * Example: Scheduled monitoring checks
 */
export async function runScheduledMonitoring() {
  console.log('Running scheduled workflow monitoring...')
  
  const alerts = await quoteWorkflowMonitor.runMonitoringChecks()
  
  console.log(`Generated ${alerts.length} alerts:`)
  alerts.forEach(alert => {
    console.log(`  [${alert.severity.toUpperCase()}] ${alert.type}: ${alert.message}`)
  })

  // Get health summary
  const summary = await quoteWorkflowMonitor.getHealthSummary()
  
  console.log('\nHealth Summary:')
  console.log(`  Total Metrics: ${summary.metrics.length}`)
  console.log(`  Active Bottlenecks: ${summary.bottlenecks.length}`)
  console.log(`  Recent Failures: ${summary.failures.length}`)
  console.log(`  Unresolved Alerts: ${summary.alerts.filter((a: any) => a.unresolved_count > 0).length}`)

  return { alerts, summary }
}

/**
 * Example: Manual diagnostic check for a specific workflow
 */
export async function diagnoseWorkflow(workflowId: string) {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: execution, error } = await supabase
    .from('quote_workflow_executions')
    .select('*')
    .eq('workflow_id', workflowId)
    .single()

  if (error || !execution) {
    console.error('Workflow not found:', workflowId)
    return null
  }

  console.log(`\nWorkflow Diagnostic: ${workflowId}`)
  console.log(`Status: ${execution.status}`)
  console.log(`Duration: ${execution.total_duration_seconds}s`)
  console.log(`Current Step: ${execution.current_step}`)
  
  if (execution.bottleneck_detected) {
    console.log(`\n⚠️  BOTTLENECK DETECTED: ${execution.bottleneck_step}`)
    console.log(`   Duration: ${execution.bottleneck_duration}s`)
    console.log(`   Threshold exceeded by: ${execution.bottleneck_threshold_exceeded_by}s`)
  }

  if (execution.failure_reason) {
    console.log(`\n❌ FAILURE: ${execution.failure_step}`)
    console.log(`   Reason: ${execution.failure_reason}`)
    console.log(`   Failure Count: ${execution.failure_count}`)
  }

  if (execution.suggested_fixes && execution.suggested_fixes.length > 0) {
    console.log(`\n💡 Suggested Fixes:`)
    execution.suggested_fixes.forEach((fix: string, idx: number) => {
      console.log(`   ${idx + 1}. ${fix}`)
    })
  }

  if (execution.recovery_attempted) {
    console.log(`\n🔧 Recovery Attempted: ${execution.recovery_successful ? 'SUCCESS' : 'FAILED'}`)
    console.log(`   Actions: ${JSON.stringify(execution.recovery_actions, null, 2)}`)
  }

  return execution
}
