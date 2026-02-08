import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'

const supabase = getServerSupabase()

async function logToAgentLogs(
  eventType: string,
  message: string,
  context: Record<string, any> = {},
  logLevel: 'info' | 'warning' | 'error' | 'critical' = 'info'
) {
  try {
    await supabase.from('agent_logs').insert({
      agent_name: 'notebooklm_integration',
      log_level: logLevel,
      event_type: eventType,
      message,
      context,
      error_details: logLevel === 'error' || logLevel === 'critical' ? context : null
    })
  } catch (error) {
    console.error('Failed to log to agent_logs:', error)
  }
}

function validateWebhookAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const webhookSecret = process.env.NOTEBOOKLM_WEBHOOK_SECRET
  
  if (!serviceRoleKey && !webhookSecret) {
    return false
  }
  
  if (webhookSecret && authHeader === `Bearer ${webhookSecret}`) {
    return true
  }
  
  if (serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`) {
    return true
  }
  
  return false
}

export async function POST(request: NextRequest) {
  if (!validateWebhookAuth(request)) {
    await logToAgentLogs(
      'notebooklm_integration',
      'Unauthorized webhook callback attempt',
      { 
        path: request.nextUrl.pathname,
        headers: Object.fromEntries(request.headers.entries())
      },
      'warning'
    )
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { 
      artifactId, 
      status, 
      storagePath, 
      thumbnailUrl, 
      errorMessage,
      metadata 
    } = body

    if (!artifactId) {
      await logToAgentLogs(
        'notebooklm_integration',
        'Invalid webhook payload: missing artifactId',
        { body },
        'warning'
      )
      return NextResponse.json(
        { error: 'artifactId is required' },
        { status: 400 }
      )
    }

    await logToAgentLogs(
      'notebooklm_integration',
      'Processing webhook callback',
      { artifactId, status, storagePath },
      'info'
    )

    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (status) {
      updateData.status = status
    }

    if (storagePath) {
      updateData.storage_path = storagePath
    }

    if (thumbnailUrl) {
      updateData.thumbnail_url = thumbnailUrl
    }

    if (metadata) {
      const { data: artifact } = await supabase
        .from('notebooklm_artifacts')
        .select('metadata')
        .eq('metadata->>artifactId', artifactId)
        .single()

      if (artifact) {
        updateData.metadata = {
          ...artifact.metadata,
          ...metadata,
          callback_received_at: new Date().toISOString()
        }
      }
    }

    const { data, error } = await supabase
      .from('notebooklm_artifacts')
      .update(updateData)
      .eq('metadata->>artifactId', artifactId)
      .select()

    if (error) {
      await logToAgentLogs(
        'notebooklm_integration',
        'Failed to update artifact from webhook',
        { artifactId, error: error.message },
        'error'
      )
      return NextResponse.json(
        { error: 'Failed to update artifact' },
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      await logToAgentLogs(
        'notebooklm_integration',
        'Artifact not found for webhook callback',
        { artifactId },
        'warning'
      )
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      )
    }

    const artifact = data[0]

    if (status === 'completed') {
      await logToAgentLogs(
        'notebooklm_integration',
        'Artifact generation completed',
        { 
          artifactId, 
          artifactType: artifact.artifact_type,
          storagePath 
        },
        'info'
      )

      if (artifact.linked_social_post_id) {
        await supabase
          .from('social_posts')
          .update({
            visual_content_url: storagePath || thumbnailUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', artifact.linked_social_post_id)
      }

      if (artifact.linked_newsletter_id) {
        await supabase
          .from('newsletter_drafts')
          .update({
            visual_content_url: storagePath || thumbnailUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', artifact.linked_newsletter_id)
      }
    } else if (status === 'failed') {
      await logToAgentLogs(
        'notebooklm_integration',
        'Artifact generation failed',
        { 
          artifactId, 
          errorMessage,
          artifactType: artifact.artifact_type 
        },
        'error'
      )
    }

    return NextResponse.json({
      success: true,
      artifactId,
      status: artifact.status,
      message: 'Webhook processed successfully'
    })

  } catch (error: any) {
    console.error('Webhook callback error:', error)
    await logToAgentLogs(
      'notebooklm_integration',
      'Webhook callback processing error',
      { error: error.message, stack: error.stack },
      'error'
    )
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    service: 'NotebookLM Webhook Callback',
    status: 'active',
    endpoint: '/api/integrations/notebooklm/callback',
    methods: ['POST']
  })
}
