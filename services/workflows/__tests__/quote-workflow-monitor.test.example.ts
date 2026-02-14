/**
 * Example test scenarios for Quote Workflow Monitor
 * 
 * These examples demonstrate how to test the monitoring system
 * and validate its functionality.
 */

import { quoteWorkflowMonitor } from '../quote-workflow-monitor'

/**
 * Test Scenario 1: Successful workflow tracking
 */
export async function testSuccessfulWorkflow() {
  console.log('\n=== Test: Successful Workflow ===\n')

  const workflowId = `test-wf-${Date.now()}`
  
  // Start workflow
  await quoteWorkflowMonitor.startWorkflowTracking(
    workflowId,
    'quote_automation',
    'test-email-123',
    'test-quote-456'
  )
  console.log('✓ Started workflow tracking')

  // Simulate detection step
  await quoteWorkflowMonitor.updateStepProgress(workflowId, 'quote_detection', 'in_progress')
  await new Promise(resolve => setTimeout(resolve, 100))
  await quoteWorkflowMonitor.updateStepProgress(
    workflowId,
    'quote_detection',
    'completed',
    undefined,
    { confidence: 0.95 }
  )
  console.log('✓ Completed detection step')

  // Simulate supplier contact
  await quoteWorkflowMonitor.updateStepProgress(workflowId, 'contact_suppliers', 'in_progress')
  await new Promise(resolve => setTimeout(resolve, 100))
  await quoteWorkflowMonitor.updateSupplierMetrics(workflowId, 3, 0)
  await quoteWorkflowMonitor.updateStepProgress(
    workflowId,
    'contact_suppliers',
    'completed',
    undefined,
    { suppliers_contacted: 3 }
  )
  console.log('✓ Completed supplier contact step')

  // Simulate response monitoring
  await quoteWorkflowMonitor.updateStepProgress(workflowId, 'monitor_responses', 'in_progress')
  await new Promise(resolve => setTimeout(resolve, 100))
  await quoteWorkflowMonitor.updateSupplierMetrics(workflowId, 3, 2)
  await quoteWorkflowMonitor.updateStepProgress(
    workflowId,
    'monitor_responses',
    'completed',
    undefined,
    { responses_received: 2 }
  )
  console.log('✓ Completed response monitoring step')

  // Complete workflow
  await quoteWorkflowMonitor.completeWorkflow(workflowId, 'completed', {
    outcome: 'quote_sent'
  })
  console.log('✓ Workflow completed successfully')

  return workflowId
}

/**
 * Test Scenario 2: Workflow with bottleneck detection
 */
export async function testBottleneckDetection() {
  console.log('\n=== Test: Bottleneck Detection ===\n')

  const workflowId = `test-wf-bottleneck-${Date.now()}`
  
  await quoteWorkflowMonitor.startWorkflowTracking(
    workflowId,
    'quote_automation',
    'test-email-789'
  )

  // Simulate a slow step (exceeds threshold)
  await quoteWorkflowMonitor.updateStepProgress(workflowId, 'quote_detection', 'in_progress')
  
  // Wait longer than the threshold (5 minutes = 300 seconds)
  // For testing, we'll simulate by manipulating the step timing
  await new Promise(resolve => setTimeout(resolve, 100))
  
  // Manually set a high duration to trigger bottleneck detection
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: execution } = await supabase
    .from('quote_workflow_executions')
    .select('*')
    .eq('workflow_id', workflowId)
    .single()

  if (execution) {
    // Simulate 6 minutes (360 seconds) for detection step
    await supabase
      .from('quote_workflow_executions')
      .update({
        detection_duration: 360,
        bottleneck_detected: true,
        bottleneck_step: 'quote_detection',
        bottleneck_duration: 360,
        bottleneck_threshold_exceeded_by: 60
      })
      .eq('workflow_id', workflowId)

    console.log('✓ Bottleneck detected in quote_detection step')
    console.log('  Duration: 360s (threshold: 300s)')
    console.log('  Exceeded by: 60s')
  }

  await quoteWorkflowMonitor.completeWorkflow(workflowId, 'completed')
  
  return workflowId
}

/**
 * Test Scenario 3: Workflow failure with diagnostics
 */
export async function testWorkflowFailure() {
  console.log('\n=== Test: Workflow Failure with Diagnostics ===\n')

  const workflowId = `test-wf-failure-${Date.now()}`
  
  await quoteWorkflowMonitor.startWorkflowTracking(
    workflowId,
    'quote_automation',
    'test-email-failure'
  )

  // Complete detection
  await quoteWorkflowMonitor.updateStepProgress(workflowId, 'quote_detection', 'in_progress')
  await new Promise(resolve => setTimeout(resolve, 50))
  await quoteWorkflowMonitor.updateStepProgress(workflowId, 'quote_detection', 'completed')

  // Fail on supplier contact
  await quoteWorkflowMonitor.updateStepProgress(workflowId, 'contact_suppliers', 'in_progress')
  await new Promise(resolve => setTimeout(resolve, 50))
  await quoteWorkflowMonitor.updateStepProgress(
    workflowId,
    'contact_suppliers',
    'failed',
    'No suppliers found for product category'
  )
  console.log('✓ Workflow failed at supplier contact step')
  console.log('  Reason: No suppliers found for product category')

  // The monitor should have automatically run diagnostics
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: execution } = await supabase
    .from('quote_workflow_executions')
    .select('*')
    .eq('workflow_id', workflowId)
    .single()

  if (execution?.suggested_fixes) {
    console.log('\n💡 Suggested Fixes:')
    execution.suggested_fixes.forEach((fix: string, idx: number) => {
      console.log(`  ${idx + 1}. ${fix}`)
    })
  }

  return workflowId
}

/**
 * Test Scenario 4: Recovery attempt
 */
export async function testRecoveryAttempt() {
  console.log('\n=== Test: Automated Recovery ===\n')

  const workflowId = `test-wf-recovery-${Date.now()}`
  
  await quoteWorkflowMonitor.startWorkflowTracking(
    workflowId,
    'quote_automation',
    'test-email-recovery'
  )

  // Simulate a timeout error (which should trigger recovery)
  await quoteWorkflowMonitor.updateStepProgress(workflowId, 'generate_quote_pdf', 'in_progress')
  await new Promise(resolve => setTimeout(resolve, 50))
  await quoteWorkflowMonitor.updateStepProgress(
    workflowId,
    'generate_quote_pdf',
    'failed',
    'Operation timed out'
  )
  console.log('✓ Workflow failed with timeout error')

  // Check if recovery was attempted
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: execution } = await supabase
    .from('quote_workflow_executions')
    .select('*')
    .eq('workflow_id', workflowId)
    .single()

  if (execution?.recovery_attempted) {
    console.log('✓ Recovery was attempted')
    console.log(`  Success: ${execution.recovery_successful}`)
    console.log(`  Actions: ${JSON.stringify(execution.recovery_actions, null, 2)}`)
  }

  return workflowId
}

/**
 * Test Scenario 5: Alert generation for stuck workflow
 */
export async function testStuckWorkflowAlert() {
  console.log('\n=== Test: Stuck Workflow Alert ===\n')

  const workflowId = `test-wf-stuck-${Date.now()}`
  
  // Create a workflow that's been running for >24 hours (simulated)
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const oldTimestamp = new Date()
  oldTimestamp.setHours(oldTimestamp.getHours() - 25) // 25 hours ago

  await supabase
    .from('quote_workflow_executions')
    .insert({
      workflow_id: workflowId,
      workflow_type: 'quote_automation',
      status: 'awaiting_responses',
      started_at: oldTimestamp.toISOString(),
      current_step: 'monitor_responses',
      suppliers_contacted: 3,
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
    })

  console.log('✓ Created stuck workflow (>24 hours)')

  // Run monitoring checks
  const alerts = await quoteWorkflowMonitor.checkStuckWorkflows()
  
  if (alerts.length > 0) {
    console.log('\n🚨 Alerts Generated:')
    alerts.forEach(alert => {
      console.log(`  [${alert.severity.toUpperCase()}] ${alert.message}`)
      console.log(`  Details:`, JSON.stringify(alert.details, null, 2))
    })
  } else {
    console.log('  No alerts generated (workflow may have been marked as stuck already)')
  }

  return workflowId
}

/**
 * Test Scenario 6: Supplier response rate monitoring
 */
export async function testSupplierResponseMonitoring() {
  console.log('\n=== Test: Supplier Response Rate Monitoring ===\n')

  // Create several workflows with low response rates
  const workflows = []
  
  for (let i = 0; i < 3; i++) {
    const workflowId = `test-wf-supplier-${Date.now()}-${i}`
    
    await quoteWorkflowMonitor.startWorkflowTracking(
      workflowId,
      'quote_automation',
      `test-email-${i}`
    )

    // Contact suppliers but get poor response
    await quoteWorkflowMonitor.updateSupplierMetrics(workflowId, 5, i === 0 ? 1 : 0)
    await quoteWorkflowMonitor.completeWorkflow(workflowId, 'failed', {
      failure_reason: 'insufficient_responses'
    })

    workflows.push(workflowId)
  }

  console.log(`✓ Created ${workflows.length} workflows with low supplier response rates`)

  // Check supplier response trends
  const alerts = await quoteWorkflowMonitor.monitorSupplierResponseRates()
  
  if (alerts.length > 0) {
    console.log('\n📊 Response Rate Alerts:')
    alerts.forEach(alert => {
      console.log(`  ${alert.message}`)
    })
  }

  return workflows
}

/**
 * Test Scenario 7: Health summary retrieval
 */
export async function testHealthSummary() {
  console.log('\n=== Test: Health Summary ===\n')

  const summary = await quoteWorkflowMonitor.getHealthSummary()

  console.log('📈 Health Metrics:')
  console.log(`  Total workflow types: ${summary.metrics.length}`)
  if (summary.metrics.length > 0) {
    summary.metrics.slice(0, 3).forEach((metric: any) => {
      console.log(`\n  ${metric.workflow_type} (${metric.status}):`)
      console.log(`    Executions: ${metric.execution_count}`)
      console.log(`    Success Rate: ${metric.success_rate}%`)
      console.log(`    Avg Duration: ${metric.avg_duration_seconds}s`)
      console.log(`    Bottleneck Rate: ${metric.bottleneck_rate}%`)
    })
  }

  console.log(`\n🔥 Top Bottlenecks: ${summary.bottlenecks.length}`)
  if (summary.bottlenecks.length > 0) {
    summary.bottlenecks.slice(0, 3).forEach((bottleneck: any) => {
      console.log(`  - ${bottleneck.bottleneck_step}: ${bottleneck.occurrence_count} occurrences`)
    })
  }

  console.log(`\n❌ Recent Failures: ${summary.failures.length}`)
  if (summary.failures.length > 0) {
    summary.failures.slice(0, 3).forEach((failure: any) => {
      console.log(`  - ${failure.failure_step}: ${failure.failure_count} failures`)
    })
  }

  console.log(`\n🚨 Active Alerts: ${summary.alerts.length}`)
  if (summary.alerts.length > 0) {
    summary.alerts.forEach((alert: any) => {
      console.log(`  - ${alert.alert_type}: ${alert.unresolved_count} unresolved`)
    })
  }

  return summary
}

/**
 * Run all test scenarios
 */
export async function runAllTests() {
  console.log('\n' + '='.repeat(60))
  console.log('  Quote Workflow Monitor - Test Suite')
  console.log('='.repeat(60))

  try {
    await testSuccessfulWorkflow()
    await testBottleneckDetection()
    await testWorkflowFailure()
    await testRecoveryAttempt()
    await testStuckWorkflowAlert()
    await testSupplierResponseMonitoring()
    await testHealthSummary()

    console.log('\n' + '='.repeat(60))
    console.log('  ✅ All tests completed')
    console.log('='.repeat(60) + '\n')

  } catch (error) {
    console.error('\n❌ Test suite failed:', error)
    throw error
  }
}

// Export for use in test scripts
if (require.main === module) {
  runAllTests()
    .then(() => {
      console.log('Tests completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Tests failed:', error)
      process.exit(1)
    })
}
