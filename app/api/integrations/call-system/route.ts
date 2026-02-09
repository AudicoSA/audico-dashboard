import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface CallTranscriptWebhookPayload {
  call_id: string
  customer_phone: string
  customer_name?: string
  customer_email?: string
  call_duration?: number
  call_start_time: string
  call_end_time?: string
  transcript: string
  summary?: string
  sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed'
  call_outcome?: 'resolved' | 'follow_up_needed' | 'escalation' | 'inquiry' | 'order' | 'complaint' | 'other'
  customer_intent?: string
  key_topics?: string[]
  metadata?: Record<string, any>
}

async function logToSquadMessages(fromAgent: string, message: string, data: any = null) {
  await supabase
    .from('squad_messages')
    .insert({
      from_agent: fromAgent,
      to_agent: null,
      message,
      task_id: null,
      data,
    })
}

async function syncCallToTimeline(callData: CallTranscriptWebhookPayload, transcriptId: string) {
  const customerId = callData.customer_email || callData.customer_phone

  const { error } = await supabase.from('customer_interactions').insert({
    customer_id: customerId,
    customer_name: callData.customer_name || null,
    customer_email: callData.customer_email || null,
    customer_phone: callData.customer_phone,
    interaction_type: 'call',
    interaction_source: 'audico-call-system',
    interaction_date: callData.call_start_time,
    subject: callData.customer_intent || 'Phone Call',
    summary: callData.summary || null,
    sentiment: callData.sentiment || null,
    outcome: callData.call_outcome || null,
    priority: callData.call_outcome === 'escalation' ? 'urgent' : 'medium',
    status:
      callData.call_outcome === 'resolved'
        ? 'completed'
        : callData.call_outcome === 'follow_up_needed'
        ? 'follow_up_required'
        : 'pending',
    reference_id: transcriptId,
    reference_type: 'call_transcript',
    details: {
      call_id: callData.call_id,
      call_duration: callData.call_duration,
      key_topics: callData.key_topics || [],
      ...callData.metadata,
    },
  })

  if (error) {
    console.error('Error syncing call to timeline:', error)
  }

  if (callData.customer_email) {
    await supabase.rpc('update_customer_profile_stats', {
      p_customer_id: callData.customer_email,
    })
  }
}

async function generateFollowUpTasks(callData: CallTranscriptWebhookPayload, transcriptId: string) {
  const tasks: Array<{
    title: string
    description: string
    assigned_agent: string
    priority: string
    status: string
  }> = []

  const { call_outcome, customer_intent, sentiment, customer_name, customer_phone, summary, key_topics } = callData

  if (call_outcome === 'follow_up_needed' || call_outcome === 'escalation') {
    const taskPriority = call_outcome === 'escalation' ? 'urgent' : 'high'
    const customerIdentifier = customer_name || customer_phone

    tasks.push({
      title: `Follow-up required: Call with ${customerIdentifier}`,
      description: `Customer interaction requires follow-up action.\n\nSummary: ${summary || 'No summary available'}\n\nKey Topics: ${key_topics?.join(', ') || 'None'}\n\nSentiment: ${sentiment || 'Unknown'}\n\nCall ID: ${callData.call_id}`,
      assigned_agent: 'Sizwe',
      priority: taskPriority,
      status: 'new',
    })
  }

  if (call_outcome === 'order' || customer_intent?.toLowerCase().includes('order') || customer_intent?.toLowerCase().includes('purchase')) {
    tasks.push({
      title: `Process order inquiry from call: ${customer_name || customer_phone}`,
      description: `Customer expressed interest in placing an order during call.\n\nSummary: ${summary || 'No summary available'}\n\nCustomer Intent: ${customer_intent || 'Order/Purchase'}\n\nCall ID: ${callData.call_id}`,
      assigned_agent: 'Mpho',
      priority: 'high',
      status: 'new',
    })
  }

  if (call_outcome === 'complaint' || sentiment === 'negative') {
    tasks.push({
      title: `Address customer complaint: ${customer_name || customer_phone}`,
      description: `Customer complaint received during call requires attention.\n\nSummary: ${summary || 'No summary available'}\n\nSentiment: ${sentiment}\n\nKey Topics: ${key_topics?.join(', ') || 'None'}\n\nCall ID: ${callData.call_id}`,
      assigned_agent: 'Sizwe',
      priority: 'urgent',
      status: 'new',
    })
  }

  if (call_outcome === 'inquiry' || customer_intent?.toLowerCase().includes('information') || customer_intent?.toLowerCase().includes('inquiry')) {
    const needsEmailFollowUp = callData.customer_email && summary

    if (needsEmailFollowUp) {
      tasks.push({
        title: `Send follow-up email: ${customer_name || customer_phone}`,
        description: `Send detailed information email based on call inquiry.\n\nCustomer Email: ${callData.customer_email}\n\nSummary: ${summary}\n\nKey Topics: ${key_topics?.join(', ') || 'None'}\n\nCall ID: ${callData.call_id}`,
        assigned_agent: 'Naledi',
        priority: 'medium',
        status: 'new',
      })
    }
  }

  const shouldCreateMarketingTask = sentiment === 'positive' && callData.customer_email && (
    call_outcome === 'resolved' || call_outcome === 'inquiry' || call_outcome === 'order'
  )

  if (shouldCreateMarketingTask) {
    tasks.push({
      title: `Add to marketing campaign: ${customer_name || customer_phone}`,
      description: `Positive customer interaction - consider for targeted marketing.\n\nCustomer Email: ${callData.customer_email}\n\nSentiment: ${sentiment}\n\nOutcome: ${call_outcome}\n\nKey Topics: ${key_topics?.join(', ') || 'None'}\n\nCall ID: ${callData.call_id}`,
      assigned_agent: 'Naledi',
      priority: 'low',
      status: 'new',
    })
  }

  for (const task of tasks) {
    try {
      const { data: createdTask, error } = await supabase
        .from('squad_tasks')
        .insert(task)
        .select()
        .single()

      if (error) {
        console.error('Error creating task:', error)
      } else {
        await logToSquadMessages(
          'call_system',
          `Created task: ${task.title}`,
          {
            action: 'task_created',
            task_id: createdTask?.id,
            call_id: callData.call_id,
            transcript_id: transcriptId,
          }
        )
      }
    } catch (err) {
      console.error('Failed to create task:', err)
    }
  }

  return tasks
}

async function syncToCustomerTimeline(callData: CallTranscriptWebhookPayload, transcriptId: string) {
  const customerId = callData.customer_email || callData.customer_phone

  const interactionData = {
    customer_id: customerId,
    customer_name: callData.customer_name || null,
    customer_email: callData.customer_email || null,
    customer_phone: callData.customer_phone,
    interaction_type: 'call' as const,
    interaction_source: 'audico-call-system',
    interaction_date: callData.call_start_time,
    subject: `Phone call - ${callData.call_outcome || 'general'}`,
    summary: callData.summary || null,
    sentiment: callData.sentiment || null,
    outcome: callData.call_outcome || null,
    priority: determinePriority(callData),
    status: determineStatus(callData),
    assigned_agent: determineAssignedAgent(callData),
    reference_id: transcriptId,
    reference_type: 'call_transcript',
    details: {
      call_id: callData.call_id,
      call_duration: callData.call_duration,
      call_start_time: callData.call_start_time,
      call_end_time: callData.call_end_time,
      customer_intent: callData.customer_intent,
      key_topics: callData.key_topics || [],
      transcript_excerpt: callData.transcript.substring(0, 500),
      ...callData.metadata,
    },
  }

  const { data, error } = await supabase
    .from('customer_interactions')
    .insert(interactionData)
    .select()
    .single()

  if (error) {
    console.error('Error syncing to customer timeline:', error)
    throw error
  }

  await logToSquadMessages(
    'call_system',
    `Synced call to customer timeline: ${callData.customer_name || callData.customer_phone}`,
    {
      action: 'timeline_sync',
      interaction_id: data?.id,
      call_id: callData.call_id,
      customer_id: customerId,
    }
  )

  return data
}

function determinePriority(callData: CallTranscriptWebhookPayload): 'low' | 'medium' | 'high' | 'urgent' {
  if (callData.call_outcome === 'escalation') return 'urgent'
  if (callData.call_outcome === 'complaint' || callData.sentiment === 'negative') return 'urgent'
  if (callData.call_outcome === 'follow_up_needed') return 'high'
  if (callData.call_outcome === 'order') return 'high'
  if (callData.call_outcome === 'inquiry') return 'medium'
  return 'medium'
}

function determineStatus(callData: CallTranscriptWebhookPayload): 'pending' | 'in_progress' | 'completed' | 'follow_up_required' {
  if (callData.call_outcome === 'resolved') return 'completed'
  if (callData.call_outcome === 'follow_up_needed' || callData.call_outcome === 'escalation') return 'follow_up_required'
  if (callData.call_outcome === 'order' || callData.call_outcome === 'inquiry') return 'pending'
  return 'completed'
}

function determineAssignedAgent(callData: CallTranscriptWebhookPayload): string | null {
  if (callData.call_outcome === 'order') return 'Mpho'
  if (callData.call_outcome === 'complaint' || callData.call_outcome === 'escalation') return 'Sizwe'
  if (callData.call_outcome === 'follow_up_needed') return 'Sizwe'
  if (callData.call_outcome === 'inquiry') return 'Naledi'
  return null
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const webhookSecret = process.env.CALL_SYSTEM_WEBHOOK_SECRET

    if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const payload: CallTranscriptWebhookPayload = await request.json()

    const {
      call_id,
      customer_phone,
      customer_name,
      customer_email,
      call_duration,
      call_start_time,
      call_end_time,
      transcript,
      summary,
      sentiment,
      call_outcome,
      customer_intent,
      key_topics,
      metadata,
    } = payload

    if (!call_id || !customer_phone || !call_start_time || !transcript) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          required: ['call_id', 'customer_phone', 'call_start_time', 'transcript'],
        },
        { status: 400 }
      )
    }

    await logToSquadMessages(
      'call_system',
      `Received call transcript from ${customer_name || customer_phone}`,
      {
        action: 'webhook_received',
        call_id,
        customer_phone,
        call_outcome,
      }
    )

    const { data: transcript_record, error: transcriptError } = await supabase
      .from('call_transcripts')
      .insert({
        call_id,
        customer_phone,
        customer_name: customer_name || null,
        customer_email: customer_email || null,
        call_duration: call_duration || null,
        call_start_time,
        call_end_time: call_end_time || null,
        transcript,
        summary: summary || null,
        sentiment: sentiment || null,
        call_outcome: call_outcome || null,
        customer_intent: customer_intent || null,
        key_topics: key_topics || [],
        metadata: metadata || {},
      })
      .select()
      .single()

    if (transcriptError) {
      console.error('Error storing call transcript:', transcriptError)

      if (transcriptError.code === '23505') {
        return NextResponse.json(
          { error: 'Call transcript already exists', call_id },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to store call transcript', details: transcriptError.message },
        { status: 500 }
      )
    }

    const transcriptId = transcript_record.id

    const [tasks, timeline] = await Promise.all([
      generateFollowUpTasks(payload, transcriptId),
      syncToCustomerTimeline(payload, transcriptId),
    ])

    await logToSquadMessages(
      'call_system',
      `Call processing complete for ${customer_name || customer_phone}: ${tasks.length} task(s) generated`,
      {
        action: 'processing_complete',
        call_id,
        transcript_id: transcriptId,
        tasks_created: tasks.length,
        timeline_entry_id: timeline?.id,
      }
    )

    return NextResponse.json({
      success: true,
      transcript: {
        id: transcriptId,
        call_id,
      },
      tasks_generated: tasks.length,
      timeline_synced: true,
      timeline_entry_id: timeline?.id,
    })
  } catch (error: any) {
    console.error('Call system webhook error:', error)
    await logToSquadMessages(
      'call_system',
      `Webhook processing failed: ${error.message}`,
      {
        action: 'webhook_error',
        error: error.message,
        stack: error.stack,
      }
    )

    return NextResponse.json(
      { error: 'Failed to process call transcript', details: error.message },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const customer_id = searchParams.get('customer_id')
    const customer_email = searchParams.get('customer_email')
    const customer_phone = searchParams.get('customer_phone')
    const call_id = searchParams.get('call_id')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (call_id) {
      const { data, error } = await supabase
        .from('call_transcripts')
        .select('*')
        .eq('call_id', call_id)
        .single()

      if (error) {
        return NextResponse.json({ error: 'Call transcript not found' }, { status: 404 })
      }

      return NextResponse.json({ transcript: data })
    }

    let query = supabase.from('call_transcripts').select('*')

    if (customer_phone) {
      query = query.eq('customer_phone', customer_phone)
    } else if (customer_email) {
      query = query.eq('customer_email', customer_email)
    }

    query = query.order('call_start_time', { ascending: false }).limit(limit)

    const { data: transcripts, error: transcriptsError } = await query

    if (transcriptsError) {
      console.error('Error fetching call transcripts:', transcriptsError)
      return NextResponse.json(
        { error: 'Failed to fetch call transcripts' },
        { status: 500 }
      )
    }

    let timeline_data = null
    if (customer_id || customer_email || customer_phone) {
      let timelineQuery = supabase.from('customer_interactions').select('*')

      if (customer_id) {
        timelineQuery = timelineQuery.eq('customer_id', customer_id)
      } else if (customer_email) {
        timelineQuery = timelineQuery.eq('customer_email', customer_email)
      } else if (customer_phone) {
        timelineQuery = timelineQuery.eq('customer_phone', customer_phone)
      }

      timelineQuery = timelineQuery.order('interaction_date', { ascending: false }).limit(limit)

      const { data, error } = await timelineQuery

      if (!error) {
        timeline_data = data
      }
    }

    return NextResponse.json({
      transcripts: transcripts || [],
      timeline: timeline_data || [],
      count: transcripts?.length || 0,
    })
  } catch (error: any) {
    console.error('Call system GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch data', details: error.message },
      { status: 500 }
    )
  }
}
