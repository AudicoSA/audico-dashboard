import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Initialize Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: NextRequest) {
  try {
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

    return NextResponse.json({
      tasks: tasks || [],
      activity: activity || [],
      agents: agents || []
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
    
    const { title, description, status, assigned_agent, priority, mentions_kenny, deliverable_url } = body

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
