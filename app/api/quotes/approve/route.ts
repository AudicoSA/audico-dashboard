import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { gmailService } from '../../../../services/integrations/gmail-service'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface ApprovalRequest {
  quoteRequestId: string
  action: 'approve' | 'reject' | 'edit'
  reason?: string
  edits?: {
    items?: Array<{
      id: string
      product_name?: string
      quantity?: number
      unit_price?: number
      description?: string
    }>
    addedItems?: Array<{
      product_name: string
      quantity: number
      unit_price: number
      description?: string
    }>
    removedItemIds?: string[]
    notes?: string
    terms?: string
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body: ApprovalRequest = await request.json()
    const { quoteRequestId, action, reason, edits } = body

    if (!quoteRequestId || !action) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: quoteRequestId and action' },
        { status: 400 }
      )
    }

    const { data: quoteRequest, error: quoteError } = await supabase
      .from('quote_requests')
      .select('*, pdf_url')
      .eq('id', quoteRequestId)
      .single()

    if (quoteError || !quoteRequest) {
      return NextResponse.json(
        { success: false, error: 'Quote request not found' },
        { status: 404 }
      )
    }

    const { data: task, error: taskError } = await supabase
      .from('squad_tasks')
      .select('*')
      .eq('metadata->>quote_request_id', quoteRequestId)
      .eq('metadata->>action_required', 'approve_quote')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (action === 'approve') {
      return await handleApproval(quoteRequest, task, startTime)
    } else if (action === 'reject') {
      return await handleRejection(quoteRequest, task, reason, startTime)
    } else if (action === 'edit') {
      return await handleEdit(quoteRequest, task, edits, reason, startTime)
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    )

  } catch (error: any) {
    console.error('Error processing quote approval:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process approval' },
      { status: 500 }
    )
  }
}

async function handleApproval(
  quoteRequest: any,
  task: any,
  startTime: number
) {
  const approvalTimeSeconds = Math.floor((Date.now() - startTime) / 1000)
  const draftId = task?.metadata?.draft_id
  const pdfUrl = quoteRequest.pdf_url
  const quoteNumber = task?.metadata?.quote_number || 'N/A'

  if (!draftId) {
    return NextResponse.json(
      { success: false, error: 'Email draft not found' },
      { status: 404 }
    )
  }

  const { data: emailDraft } = await supabase
    .from('email_drafts')
    .select('*')
    .eq('id', draftId)
    .single()

  if (!emailDraft) {
    return NextResponse.json(
      { success: false, error: 'Email draft not found in database' },
      { status: 404 }
    )
  }

  const emailResult = await gmailService.sendEmail(
    emailDraft.to_email,
    emailDraft.subject,
    emailDraft.body,
    undefined,
    undefined,
    pdfUrl ? [{ filename: `${quoteNumber}.pdf`, url: pdfUrl }] : undefined
  )

  if (!emailResult.success) {
    return NextResponse.json(
      { success: false, error: `Failed to send email: ${emailResult.error}` },
      { status: 500 }
    )
  }

  await supabase
    .from('quote_requests')
    .update({
      status: 'sent_to_customer',
      updated_at: new Date().toISOString()
    })
    .eq('id', quoteRequest.id)

  await supabase
    .from('email_drafts')
    .update({
      status: 'sent',
      updated_at: new Date().toISOString()
    })
    .eq('id', draftId)

  await logCustomerInteraction(quoteRequest, quoteNumber, emailResult.messageId)

  await createFollowUpTask(quoteRequest, quoteNumber)

  await logApprovalFeedback(
    quoteRequest.id,
    quoteNumber,
    'approved',
    null,
    task?.metadata?.total_amount,
    null,
    approvalTimeSeconds
  )

  if (task) {
    await supabase
      .from('squad_tasks')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', task.id)
  }

  await supabase
    .from('squad_messages')
    .insert({
      from_agent: 'QuoteApprovalSystem',
      to_agent: 'QuoteAgent',
      message: `Quote ${quoteNumber} approved and sent to ${quoteRequest.customer_email}. Follow-up task created for 48h.`,
      task_id: task?.id,
      data: {
        quote_request_id: quoteRequest.id,
        quote_number: quoteNumber,
        action: 'approved',
        sent_to: quoteRequest.customer_email,
        gmail_message_id: emailResult.messageId,
        timestamp: new Date().toISOString()
      }
    })

  return NextResponse.json({
    success: true,
    message: 'Quote approved and sent to customer',
    quoteNumber,
    emailSent: true,
    followUpTaskCreated: true
  })
}

async function handleRejection(
  quoteRequest: any,
  task: any,
  reason: string | undefined,
  startTime: number
) {
  const approvalTimeSeconds = Math.floor((Date.now() - startTime) / 1000)
  const quoteNumber = task?.metadata?.quote_number || 'N/A'

  if (!reason) {
    return NextResponse.json(
      { success: false, error: 'Rejection reason is required' },
      { status: 400 }
    )
  }

  await supabase
    .from('quote_requests')
    .update({
      status: 'rejected',
      updated_at: new Date().toISOString()
    })
    .eq('id', quoteRequest.id)

  await logApprovalFeedback(
    quoteRequest.id,
    quoteNumber,
    'rejected',
    reason ?? null,
    task?.metadata?.total_amount,
    null,
    approvalTimeSeconds
  )

  if (task) {
    await supabase
      .from('squad_tasks')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString(),
        description: `${task.description}\n\n**REJECTED**\nReason: ${reason}`
      })
      .eq('id', task.id)
  }

  await supabase
    .from('squad_messages')
    .insert({
      from_agent: 'QuoteApprovalSystem',
      to_agent: 'QuoteAgent',
      message: `Quote ${quoteNumber} rejected by Kenny. Reason: ${reason}. Learning from this feedback for future improvements.`,
      task_id: task?.id,
      data: {
        quote_request_id: quoteRequest.id,
        quote_number: quoteNumber,
        action: 'rejected',
        reason: reason,
        for_learning: true,
        timestamp: new Date().toISOString()
      }
    })

  return NextResponse.json({
    success: true,
    message: 'Quote rejected and feedback logged for learning',
    quoteNumber,
    feedbackLogged: true
  })
}

async function handleEdit(
  quoteRequest: any,
  task: any,
  edits: any,
  reason: string | undefined,
  startTime: number
) {
  const quoteNumber = task?.metadata?.quote_number || 'N/A'

  if (!edits) {
    return NextResponse.json(
      { success: false, error: 'Edit details are required' },
      { status: 400 }
    )
  }

  const editLogs: any[] = []
  const originalTotal = task?.metadata?.total_amount || 0

  if (edits.items) {
    for (const item of edits.items) {
      const editLog = {
        quote_request_id: quoteRequest.id,
        quote_number: quoteNumber,
        edit_type: 'price_adjustment',
        item_name: item.product_name,
        old_value: { unit_price: item.original_unit_price },
        new_value: { 
          unit_price: item.unit_price,
          quantity: item.quantity 
        },
        reason: reason
      }
      editLogs.push(editLog)
    }
  }

  if (edits.addedItems && edits.addedItems.length > 0) {
    for (const item of edits.addedItems) {
      const editLog = {
        quote_request_id: quoteRequest.id,
        quote_number: quoteNumber,
        edit_type: 'product_added',
        item_name: item.product_name,
        old_value: null,
        new_value: {
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          description: item.description
        },
        reason: reason
      }
      editLogs.push(editLog)
    }
  }

  if (edits.removedItemIds && edits.removedItemIds.length > 0) {
    for (const itemId of edits.removedItemIds) {
      const editLog = {
        quote_request_id: quoteRequest.id,
        quote_number: quoteNumber,
        edit_type: 'product_removed',
        item_name: `Item ${itemId}`,
        old_value: { item_id: itemId },
        new_value: null,
        reason: reason
      }
      editLogs.push(editLog)
    }
  }

  if (editLogs.length > 0) {
    await supabase
      .from('quote_edits')
      .insert(editLogs)
  }

  const editedQuoteData = {
    ...quoteRequest,
    items: edits.items || [],
    notes: edits.notes || quoteRequest.notes,
    terms: edits.terms || quoteRequest.terms
  }

  const newTotal = calculateTotal(editedQuoteData)

  const pdfResponse = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/quote/generate-pdf`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteId: quoteRequest.id,
        quoteNumber,
        customerName: quoteRequest.customer_name,
        customerEmail: quoteRequest.customer_email,
        companyName: quoteRequest.metadata?.company_name,
        items: edits.items || [],
        subtotal: newTotal.subtotal,
        tax: newTotal.tax,
        shipping: 0,
        total: newTotal.total,
        currency: 'ZAR',
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        notes: edits.notes,
        terms: edits.terms
      })
    }
  )

  if (!pdfResponse.ok) {
    return NextResponse.json(
      { success: false, error: 'Failed to regenerate PDF' },
      { status: 500 }
    )
  }

  const pdfResult = await pdfResponse.json()
  const newPdfUrl = pdfResult.pdfUrl

  await supabase
    .from('quote_requests')
    .update({
      pdf_url: newPdfUrl,
      status: 'pdf_generated',
      updated_at: new Date().toISOString()
    })
    .eq('id', quoteRequest.id)

  await logApprovalFeedback(
    quoteRequest.id,
    quoteNumber,
    'edited',
    reason ?? null,
    originalTotal,
    newTotal.total,
    Math.floor((Date.now() - startTime) / 1000),
    editLogs
  )

  const newTaskId = await createNewApprovalTask(
    quoteRequest,
    quoteNumber,
    newPdfUrl,
    newTotal,
    edits
  )

  await supabase
    .from('squad_messages')
    .insert({
      from_agent: 'QuoteApprovalSystem',
      to_agent: 'QuoteAgent',
      message: `Quote ${quoteNumber} edited by Kenny. ${editLogs.length} changes made. New PDF generated and returned to approval queue.`,
      task_id: newTaskId,
      data: {
        quote_request_id: quoteRequest.id,
        quote_number: quoteNumber,
        action: 'edited',
        edit_count: editLogs.length,
        original_total: originalTotal,
        new_total: newTotal.total,
        for_learning: true,
        timestamp: new Date().toISOString()
      }
    })

  if (task) {
    await supabase
      .from('squad_tasks')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString(),
        description: `${task.description}\n\n**EDITED**\nChanges: ${editLogs.length} edits made. Regenerated and returned to approval queue.`
      })
      .eq('id', task.id)
  }

  return NextResponse.json({
    success: true,
    message: 'Quote edited, PDF regenerated, and returned to approval queue',
    quoteNumber,
    newPdfUrl,
    editCount: editLogs.length,
    newTaskId,
    newTotal: newTotal.total
  })
}

async function logCustomerInteraction(
  quoteRequest: any,
  quoteNumber: string,
  gmailMessageId?: string
) {
  await supabase
    .from('customer_interactions')
    .insert({
      customer_id: quoteRequest.customer_email,
      customer_name: quoteRequest.customer_name,
      customer_email: quoteRequest.customer_email,
      interaction_type: 'email',
      interaction_source: 'quote_system',
      interaction_date: new Date().toISOString(),
      subject: `Quote Sent: ${quoteNumber}`,
      summary: `Quote ${quoteNumber} sent to customer via email`,
      sentiment: 'neutral',
      outcome: 'quote_sent',
      priority: 'medium',
      status: 'completed',
      assigned_agent: 'QuoteAgent',
      reference_id: quoteRequest.id,
      reference_type: 'quote_request',
      details: {
        quote_number: quoteNumber,
        gmail_message_id: gmailMessageId,
        sent_at: new Date().toISOString()
      }
    })
}

async function createFollowUpTask(quoteRequest: any, quoteNumber: string) {
  const followUpDate = new Date()
  followUpDate.setHours(followUpDate.getHours() + 48)

  await supabase
    .from('squad_tasks')
    .insert({
      title: `Follow up on Quote ${quoteNumber} - ${quoteRequest.customer_name}`,
      description: `Check if customer ${quoteRequest.customer_name} (${quoteRequest.customer_email}) has responded to quote ${quoteNumber}.

**Actions:**
1. Check email for customer response
2. If no response, send friendly follow-up
3. Update quote status based on customer feedback

**Quote Details:**
- Sent: ${new Date().toISOString()}
- Expected Follow-up: ${followUpDate.toISOString()}`,
      status: 'new',
      assigned_agent: 'QuoteAgent',
      priority: 'medium',
      mentions_kenny: false,
      metadata: {
        quote_request_id: quoteRequest.id,
        quote_number: quoteNumber,
        customer_email: quoteRequest.customer_email,
        action_required: 'follow_up_quote',
        scheduled_for: followUpDate.toISOString()
      }
    })
}

async function logApprovalFeedback(
  quoteRequestId: string,
  quoteNumber: string,
  action: string,
  reason: string | null,
  originalTotal: number | null,
  editedTotal: number | null,
  approvalTimeSeconds: number,
  edits: any[] = []
) {
  const patterns = analyzePatterns(action, reason, edits, originalTotal, editedTotal)

  await supabase
    .from('quote_approval_feedback')
    .insert({
      quote_request_id: quoteRequestId,
      quote_number: quoteNumber,
      action,
      reason,
      original_total: originalTotal,
      edited_total: editedTotal,
      edits,
      approval_time_seconds: approvalTimeSeconds,
      patterns,
      metadata: {
        timestamp: new Date().toISOString(),
        edit_count: edits.length
      }
    })
}

function analyzePatterns(
  action: string,
  reason: string | null,
  edits: any[],
  originalTotal: number | null,
  editedTotal: number | null
): any {
  const patterns: any = {
    action,
    has_reason: !!reason
  }

  if (edits.length > 0) {
    const editTypes = edits.map(e => e.edit_type)
    patterns.edit_types = Array.from(new Set(editTypes))
    patterns.edit_count = edits.length

    const priceAdjustments = edits.filter(e => e.edit_type === 'price_adjustment')
    if (priceAdjustments.length > 0) {
      patterns.price_changes = priceAdjustments.length
    }

    const additions = edits.filter(e => e.edit_type === 'product_added')
    if (additions.length > 0) {
      patterns.products_added = additions.length
    }

    const removals = edits.filter(e => e.edit_type === 'product_removed')
    if (removals.length > 0) {
      patterns.products_removed = removals.length
    }
  }

  if (originalTotal && editedTotal) {
    patterns.total_change_percentage = ((editedTotal - originalTotal) / originalTotal) * 100
    patterns.price_direction = editedTotal > originalTotal ? 'increased' : 'decreased'
  }

  return patterns
}

function calculateTotal(quoteData: any) {
  const items = quoteData.items || []
  const subtotal = items.reduce((sum: number, item: any) => {
    const itemTotal = (item.unit_price || 0) * (item.quantity || 0)
    return sum + itemTotal
  }, 0)

  const tax = subtotal * 0.15
  const total = subtotal + tax

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    total: Math.round(total * 100) / 100
  }
}

async function createNewApprovalTask(
  quoteRequest: any,
  quoteNumber: string,
  pdfUrl: string,
  newTotal: any,
  edits: any
) {
  const { data } = await supabase
    .from('squad_tasks')
    .insert({
      title: `Re-approve Edited Quote ${quoteNumber} for ${quoteRequest.customer_name}`,
      description: `Quote has been edited by Kenny and requires re-approval before sending.

**Quote Details:**
- Quote Number: ${quoteNumber}
- Customer: ${quoteRequest.customer_name} (${quoteRequest.customer_email})
- New Total: ZAR ${newTotal.total.toFixed(2)}

**Changes Made:**
- ${edits.items?.length || 0} items modified
- ${edits.addedItems?.length || 0} items added
- ${edits.removedItemIds?.length || 0} items removed

**Actions Required:**
1. Review the updated PDF: [View PDF](${pdfUrl})
2. Approve and send to customer`,
      status: 'new',
      assigned_agent: 'QuoteAgent',
      priority: 'high',
      mentions_kenny: true,
      deliverable_url: pdfUrl,
      metadata: {
        quote_request_id: quoteRequest.id,
        quote_number: quoteNumber,
        pdf_url: pdfUrl,
        customer_email: quoteRequest.customer_email,
        customer_name: quoteRequest.customer_name,
        total_amount: newTotal.total,
        currency: 'ZAR',
        action_required: 'approve_quote',
        edited: true,
        original_task_completed: true
      }
    })
    .select()
    .single()

  return data?.id
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'stats') {
      const { data: approvalStats } = await supabase
        .from('quote_approval_feedback')
        .select('action, approval_time_seconds, patterns')

      const stats = {
        total: approvalStats?.length || 0,
        approved: approvalStats?.filter(s => s.action === 'approved').length || 0,
        rejected: approvalStats?.filter(s => s.action === 'rejected').length || 0,
        edited: approvalStats?.filter(s => s.action === 'edited').length || 0,
        avgApprovalTime: approvalStats?.length 
          ? approvalStats.reduce((sum, s) => sum + (s.approval_time_seconds || 0), 0) / approvalStats.length 
          : 0
      }

      return NextResponse.json({
        success: true,
        stats
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Quote Approval API',
      endpoints: {
        POST: {
          description: 'Approve, reject, or edit a quote',
          actions: {
            approve: 'Send quote to customer and create follow-up task',
            reject: 'Reject quote and log feedback for learning',
            edit: 'Edit quote items, regenerate PDF, return to approval queue'
          }
        },
        GET: {
          stats: 'Get approval statistics'
        }
      }
    })

  } catch (error: any) {
    console.error('Quote Approval API GET error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
