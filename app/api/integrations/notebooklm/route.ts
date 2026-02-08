import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'
import NotebookLMService, { 
  NotebookSource,
  InfographicOptions,
  SlidesOptions,
  VideoOptions
} from '@/services/integrations/notebooklm-service'

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

function validateServiceRoleAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!serviceRoleKey) {
    return false
  }
  
  return authHeader === `Bearer ${serviceRoleKey}`
}

export async function POST(request: NextRequest) {
  if (!validateServiceRoleAuth(request)) {
    await logToAgentLogs(
      'notebooklm_integration',
      'Unauthorized access attempt',
      { path: request.nextUrl.pathname },
      'warning'
    )
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { action, ...params } = body

    const notebookLMService = new NotebookLMService()

    switch (action) {
      case 'notebooks/create':
        return await handleCreateNotebook(notebookLMService, params)
      
      case 'notebooks/add-sources':
        return await handleAddSources(notebookLMService, params)
      
      case 'generate/infographic':
        return await handleGenerateInfographic(notebookLMService, params)
      
      case 'generate/slides':
        return await handleGenerateSlides(notebookLMService, params)
      
      case 'generate/video':
        return await handleGenerateVideo(notebookLMService, params)
      
      case 'artifacts/download':
        return await handleDownloadArtifact(notebookLMService, params)
      
      default:
        await logToAgentLogs(
          'notebooklm_integration',
          'Invalid action requested',
          { action },
          'warning'
        )
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error('NotebookLM API error:', error)
    await logToAgentLogs(
      'notebooklm_integration',
      'API error occurred',
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
  if (!validateServiceRoleAuth(request)) {
    await logToAgentLogs(
      'notebooklm_integration',
      'Unauthorized GET request',
      { path: request.nextUrl.pathname },
      'warning'
    )
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'notebooks/list':
        return await handleListNotebooks(searchParams)
      
      case 'artifacts/list':
        return await handleListArtifacts(searchParams)
      
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use action=notebooks/list or action=artifacts/list' },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error('NotebookLM GET error:', error)
    await logToAgentLogs(
      'notebooklm_integration',
      'GET request error',
      { error: error.message },
      'error'
    )
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

async function handleCreateNotebook(
  service: NotebookLMService,
  params: any
): Promise<NextResponse> {
  const { title, purpose } = params

  if (!title || !purpose) {
    return NextResponse.json(
      { error: 'title and purpose are required' },
      { status: 400 }
    )
  }

  await logToAgentLogs(
    'notebooklm_integration',
    'Creating notebook',
    { title, purpose },
    'info'
  )

  const result = await service.createNotebook(title, purpose)

  await supabase.from('notebooklm_notebooks').insert({
    name: title,
    notebook_id: result.notebookId,
    purpose,
    status: 'active',
    metadata: {
      created_via: 'api',
      created_at_timestamp: result.createdAt
    }
  })

  await logToAgentLogs(
    'notebooklm_integration',
    'Notebook created successfully',
    { notebookId: result.notebookId, title },
    'info'
  )

  return NextResponse.json({
    success: true,
    notebook: result
  })
}

async function handleAddSources(
  service: NotebookLMService,
  params: any
): Promise<NextResponse> {
  const { notebookId, sources } = params

  if (!notebookId || !sources || !Array.isArray(sources)) {
    return NextResponse.json(
      { error: 'notebookId and sources array are required' },
      { status: 400 }
    )
  }

  await logToAgentLogs(
    'notebooklm_integration',
    'Adding sources to notebook',
    { notebookId, sourceCount: sources.length },
    'info'
  )

  const success = await service.addSources(notebookId, sources as NotebookSource[])

  if (success) {
    await supabase
      .from('notebooklm_notebooks')
      .update({ 
        sources_count: sources.length,
        updated_at: new Date().toISOString()
      })
      .eq('notebook_id', notebookId)

    await logToAgentLogs(
      'notebooklm_integration',
      'Sources added successfully',
      { notebookId, sourceCount: sources.length },
      'info'
    )
  } else {
    await logToAgentLogs(
      'notebooklm_integration',
      'Failed to add sources',
      { notebookId },
      'error'
    )
  }

  return NextResponse.json({
    success,
    notebookId,
    sourcesAdded: sources.length
  })
}

async function handleGenerateInfographic(
  service: NotebookLMService,
  params: any
): Promise<NextResponse> {
  const { notebookId, prompt, orientation = 'landscape', colorScheme, format = 'png' } = params

  if (!notebookId || !prompt) {
    return NextResponse.json(
      { error: 'notebookId and prompt are required' },
      { status: 400 }
    )
  }

  await logToAgentLogs(
    'notebooklm_integration',
    'Generating infographic',
    { notebookId, prompt, orientation },
    'info'
  )

  const artifactId = await service.generateInfographic(notebookId, prompt, orientation)

  const { data: notebook } = await supabase
    .from('notebooklm_notebooks')
    .select('id')
    .eq('notebook_id', notebookId)
    .single()

  if (notebook) {
    await supabase.from('notebooklm_artifacts').insert({
      notebook_id: notebook.id,
      artifact_type: 'infographic',
      generation_prompt: prompt,
      status: 'generating',
      metadata: {
        orientation,
        colorScheme,
        format,
        artifactId
      }
    })
  }

  await logToAgentLogs(
    'notebooklm_integration',
    'Infographic generation initiated',
    { notebookId, artifactId },
    'info'
  )

  return NextResponse.json({
    success: true,
    artifactId,
    status: 'generating'
  })
}

async function handleGenerateSlides(
  service: NotebookLMService,
  params: any
): Promise<NextResponse> {
  const { notebookId, prompt, audience = 'general', slideCount, theme } = params

  if (!notebookId || !prompt) {
    return NextResponse.json(
      { error: 'notebookId and prompt are required' },
      { status: 400 }
    )
  }

  await logToAgentLogs(
    'notebooklm_integration',
    'Generating slides',
    { notebookId, prompt, audience },
    'info'
  )

  const artifactId = await service.generateSlides(notebookId, prompt, audience)

  const { data: notebook } = await supabase
    .from('notebooklm_notebooks')
    .select('id')
    .eq('notebook_id', notebookId)
    .single()

  if (notebook) {
    await supabase.from('notebooklm_artifacts').insert({
      notebook_id: notebook.id,
      artifact_type: 'slide_deck',
      generation_prompt: prompt,
      status: 'generating',
      metadata: {
        audience,
        slideCount,
        theme,
        artifactId
      }
    })
  }

  await logToAgentLogs(
    'notebooklm_integration',
    'Slides generation initiated',
    { notebookId, artifactId },
    'info'
  )

  return NextResponse.json({
    success: true,
    artifactId,
    status: 'generating'
  })
}

async function handleGenerateVideo(
  service: NotebookLMService,
  params: any
): Promise<NextResponse> {
  const { notebookId, format = 'mp4', visualStyle = 'professional', duration } = params

  if (!notebookId) {
    return NextResponse.json(
      { error: 'notebookId is required' },
      { status: 400 }
    )
  }

  await logToAgentLogs(
    'notebooklm_integration',
    'Generating video overview',
    { notebookId, format, visualStyle },
    'info'
  )

  const artifactId = await service.generateVideoOverview(notebookId, format, visualStyle)

  const { data: notebook } = await supabase
    .from('notebooklm_notebooks')
    .select('id')
    .eq('notebook_id', notebookId)
    .single()

  if (notebook) {
    await supabase.from('notebooklm_artifacts').insert({
      notebook_id: notebook.id,
      artifact_type: 'video_overview',
      generation_prompt: 'Generate comprehensive video overview',
      status: 'generating',
      metadata: {
        format,
        visualStyle,
        duration,
        artifactId
      }
    })
  }

  await logToAgentLogs(
    'notebooklm_integration',
    'Video generation initiated',
    { notebookId, artifactId },
    'info'
  )

  return NextResponse.json({
    success: true,
    artifactId,
    status: 'generating'
  })
}

async function handleDownloadArtifact(
  service: NotebookLMService,
  params: any
): Promise<NextResponse> {
  const { artifactId, outputPath } = params

  if (!artifactId || !outputPath) {
    return NextResponse.json(
      { error: 'artifactId and outputPath are required' },
      { status: 400 }
    )
  }

  await logToAgentLogs(
    'notebooklm_integration',
    'Downloading artifact',
    { artifactId, outputPath },
    'info'
  )

  const result = await service.downloadArtifact(artifactId, outputPath)

  if (result.success) {
    await supabase
      .from('notebooklm_artifacts')
      .update({
        status: 'completed',
        storage_path: result.outputPath,
        updated_at: new Date().toISOString()
      })
      .eq('metadata->>artifactId', artifactId)

    await logToAgentLogs(
      'notebooklm_integration',
      'Artifact downloaded successfully',
      { artifactId, outputPath: result.outputPath, size: result.size },
      'info'
    )
  } else {
    await logToAgentLogs(
      'notebooklm_integration',
      'Artifact download failed',
      { artifactId },
      'error'
    )
  }

  return NextResponse.json({
    success: result.success,
    artifactId,
    outputPath: result.outputPath,
    size: result.size
  })
}

async function handleListNotebooks(searchParams: URLSearchParams): Promise<NextResponse> {
  const status = searchParams.get('status')
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')

  await logToAgentLogs(
    'notebooklm_integration',
    'Listing notebooks',
    { status, limit, offset },
    'info'
  )

  let query = supabase
    .from('notebooklm_notebooks')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    await logToAgentLogs(
      'notebooklm_integration',
      'Failed to list notebooks',
      { error: error.message },
      'error'
    )
    return NextResponse.json(
      { error: 'Failed to retrieve notebooks' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    notebooks: data,
    count: data.length
  })
}

async function handleListArtifacts(searchParams: URLSearchParams): Promise<NextResponse> {
  const notebookId = searchParams.get('notebookId')
  const artifactType = searchParams.get('artifactType')
  const status = searchParams.get('status')
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')

  await logToAgentLogs(
    'notebooklm_integration',
    'Listing artifacts',
    { notebookId, artifactType, status, limit, offset },
    'info'
  )

  let query = supabase
    .from('notebooklm_artifacts')
    .select(`
      *,
      notebooklm_notebooks (
        id,
        name,
        notebook_id
      )
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (notebookId) {
    const { data: notebook } = await supabase
      .from('notebooklm_notebooks')
      .select('id')
      .eq('notebook_id', notebookId)
      .single()
    
    if (notebook) {
      query = query.eq('notebook_id', notebook.id)
    }
  }

  if (artifactType) {
    query = query.eq('artifact_type', artifactType)
  }

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    await logToAgentLogs(
      'notebooklm_integration',
      'Failed to list artifacts',
      { error: error.message },
      'error'
    )
    return NextResponse.json(
      { error: 'Failed to retrieve artifacts' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    artifacts: data,
    count: data.length
  })
}
