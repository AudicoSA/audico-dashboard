import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Initialize Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'orchestrator-status') {
      try {
        const { orchestrator } = await import('@/services/orchestrator')
        const tokenBudget = orchestrator.getTokenBudget()
        const activeOps = orchestrator.getActiveOperations()
        
        return NextResponse.json({
          tokenBudget,
          activeOperations: activeOps,
          timestamp: new Date().toISOString()
        })
      } catch (error: any) {
        return NextResponse.json(
          { error: 'Orchestrator not initialized', details: error.message },
          { status: 503 }
        )
      }
    }

    // Fetch tasks
    const { data: tasks, error: tasksError } = await supabase
      .from('squad_tasks')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (tasksError) {
      console.error('Error fetching tasks:', tasksError)
      // Return empty array if table doesn't exist yet
      if (tasksError.code === '42P01') {
        return NextResponse.json({ tasks: [], activity: [], message: 'Tables not created yet - run migration' })
      }
    }

    // Fetch recent activity (messages between agents)
    const { data: activity, error: activityError } = await supabase
      .from('squad_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (activityError) {
      console.error('Error fetching activity:', activityError)
    }

    // Fetch agent statuses
    const { data: agents, error: agentsError } = await supabase
      .from('squad_agents')
      .select('*')
      .order('name')

    let orchestratorData = null
    try {
      const { orchestrator } = await import('@/services/orchestrator')
      const tokenBudget = orchestrator.getTokenBudget()
      const activeOps = orchestrator.getActiveOperations()
      orchestratorData = { tokenBudget, activeOperations: activeOps }
    } catch (e) {
    }

    return NextResponse.json({
      tasks: tasks || [],
      activity: activity || [],
      agents: agents || [],
      orchestrator: orchestratorData
    })

  } catch (error) {
    console.error('Squad API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch squad data' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const { action, title, description, status, assigned_agent, priority, mentions_kenny, deliverable_url } = body

    if (action === 'orchestrator-init') {
      try {
        const { orchestrator } = await import('@/services/orchestrator')
        await orchestrator.initialize()
        return NextResponse.json({ success: true, message: 'Orchestrator initialized' })
      } catch (error: any) {
        return NextResponse.json(
          { error: 'Failed to initialize orchestrator', details: error.message },
          { status: 500 }
        )
      }
    }

    if (action === 'orchestrator-shutdown') {
      try {
        const { orchestrator } = await import('@/services/orchestrator')
        await orchestrator.shutdown()
        return NextResponse.json({ success: true, message: 'Orchestrator shutdown' })
      } catch (error: any) {
        return NextResponse.json(
          { error: 'Failed to shutdown orchestrator', details: error.message },
          { status: 500 }
        )
      }
    }

    if (action === 'orchestrator-message') {
      try {
        const { orchestrator } = await import('@/services/orchestrator')
        const { fromAgent, toAgent, message, taskId, data } = body
        
        if (!fromAgent || !message) {
          return NextResponse.json(
            { error: 'fromAgent and message are required' },
            { status: 400 }
          )
        }
        
        await orchestrator.sendMessage(fromAgent, toAgent || null, message, taskId, data)
        return NextResponse.json({ success: true, message: 'Message sent' })
      } catch (error: any) {
        return NextResponse.json(
          { error: 'Failed to send message', details: error.message },
          { status: 500 }
        )
      }
    }

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

    // Insert new task
    const { data: task, error } = await supabase
      .from('squad_tasks')
      .insert({
        title,
        description: description || '',
        status: status || 'new',
        assigned_agent: assigned_agent || 'jarvis',
        priority: priority || 'medium',
        mentions_kenny: mentions_kenny || false,
        deliverable_url: deliverable_url || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating task:', error)
      // Return mock success if table doesn't exist yet
      if (error.code === '42P01') {
        return NextResponse.json({
          task: { id: 'mock-' + Date.now(), ...body },
          message: 'Tables not created yet - task saved in memory only'
        })
      }
      return NextResponse.json(
        { error: 'Failed to create task' },
        { status: 500 }
      )
    }

    // Log the task creation as activity
    await supabase
      .from('squad_messages')
      .insert({
        from_agent: 'jarvis',
        message: `New task created: "${title}" assigned to ${assigned_agent}`,
        task_id: task.id,
      })

    return NextResponse.json({ task })

  } catch (error) {
    console.error('Squad API POST error:', error)
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      )
    }

    // Update task
    const { data: task, error } = await supabase
      .from('squad_tasks')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating task:', error)
      return NextResponse.json(
        { error: 'Failed to update task' },
        { status: 500 }
      )
    }

    return NextResponse.json({ task })

  } catch (error) {
    console.error('Squad API PATCH error:', error)
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    )
  }
}
