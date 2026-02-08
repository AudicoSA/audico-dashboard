import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface AgentStatistics {
  agentName: string
  role: string
  status: 'active' | 'idle' | 'offline'
  last_active: string
  pendingTasks: number
  inProgressTasks: number
  completedTasks: number
  totalTasks: number
  successRate: number
  recentErrors: Array<{
    message: string
    timestamp: string
    task_id?: string
  }>
  tokenUsage: number
}

interface OrchestratorHealth {
  isRunning: boolean
  uptime: string
  tokenBudget: {
    total: number
    used: number
    remaining: number
    usagePercent: number
  }
  lastExecutionTimes: {
    email_poll?: string
    email_classify?: string
    email_respond?: string
    status_update?: string
    conflict_check?: string
    token_monitor?: string
  }
  activeOperationsCount: number
  scheduledJobsCount: number
}

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

    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const agentType = searchParams.get('agentType')
    const agentName = searchParams.get('agentName')

    let tasksQuery = supabase
      .from('squad_tasks')
      .select('*')
      .order('created_at', { ascending: false })

    if (dateFrom) {
      tasksQuery = tasksQuery.gte('created_at', dateFrom)
    }
    if (dateTo) {
      tasksQuery = tasksQuery.lte('created_at', dateTo)
    }
    if (agentName) {
      tasksQuery = tasksQuery.eq('assigned_agent', agentName)
    }

    tasksQuery = tasksQuery.limit(100)

    const { data: tasks, error: tasksError } = await tasksQuery

    if (tasksError) {
      console.error('Error fetching tasks:', tasksError)
      if (tasksError.code === '42P01') {
        return NextResponse.json({ 
          tasks: [], 
          activity: [], 
          agents: [],
          agentStatistics: [],
          orchestratorHealth: null,
          message: 'Tables not created yet - run migration' 
        })
      }
    }

    let messagesQuery = supabase
      .from('squad_messages')
      .select('*')
      .order('created_at', { ascending: false })

    if (dateFrom) {
      messagesQuery = messagesQuery.gte('created_at', dateFrom)
    }
    if (dateTo) {
      messagesQuery = messagesQuery.lte('created_at', dateTo)
    }

    messagesQuery = messagesQuery.limit(50)

    const { data: activity, error: activityError } = await messagesQuery

    if (activityError) {
      console.error('Error fetching activity:', activityError)
    }

    let agentsQuery = supabase
      .from('squad_agents')
      .select('*')
      .order('name')

    if (agentType) {
      agentsQuery = agentsQuery.eq('role', agentType)
    }

    const { data: agents, error: agentsError } = await agentsQuery

    const agentStatistics: AgentStatistics[] = []
    
    if (agents && agents.length > 0) {
      for (const agent of agents) {
        const agentTasks = (tasks || []).filter(t => t.assigned_agent === agent.name)
        
        const pendingTasks = agentTasks.filter(t => t.status === 'new').length
        const inProgressTasks = agentTasks.filter(t => t.status === 'in_progress').length
        const completedTasks = agentTasks.filter(t => t.status === 'completed').length
        const totalTasks = agentTasks.length
        
        const successRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

        const agentMessages = (activity || []).filter(
          m => m.from_agent === agent.name && m.message.toLowerCase().includes('error')
        ).slice(0, 5)
        
        const recentErrors = agentMessages.map(m => ({
          message: m.message,
          timestamp: m.created_at,
          task_id: m.task_id
        }))

        let tokenUsage = 0
        try {
          const { orchestrator } = await import('@/services/orchestrator')
          const tokenBudget = orchestrator.getTokenBudget()
          tokenUsage = tokenBudget.agentUsage[agent.name] || 0
        } catch (e) {
        }

        agentStatistics.push({
          agentName: agent.name,
          role: agent.role,
          status: agent.status,
          last_active: agent.last_active,
          pendingTasks,
          inProgressTasks,
          completedTasks,
          totalTasks,
          successRate: Math.round(successRate * 100) / 100,
          recentErrors,
          tokenUsage
        })
      }
    }

    let orchestratorHealth: OrchestratorHealth | null = null
    try {
      const { orchestrator } = await import('@/services/orchestrator')
      const tokenBudget = orchestrator.getTokenBudget()
      const activeOps = orchestrator.getActiveOperations()

      const lastExecutionTimes: OrchestratorHealth['lastExecutionTimes'] = {}
      
      const scheduleMessages = (activity || []).filter(
        m => m.from_agent === 'orchestrator' || m.from_agent === 'email_agent'
      )

      const scheduleTypes = ['email_poll', 'email_classify', 'email_respond', 'status_update', 'conflict_check', 'token_monitor']
      for (const scheduleType of scheduleTypes) {
        const lastExecution = scheduleMessages.find(m => 
          m.message.toLowerCase().includes(scheduleType.replace('_', ' '))
        )
        if (lastExecution) {
          lastExecutionTimes[scheduleType as keyof typeof lastExecutionTimes] = lastExecution.created_at
        }
      }

      const startupMessage = (activity || []).find(
        m => m.from_agent === 'orchestrator' && m.message.includes('starting up')
      )
      const uptime = startupMessage 
        ? `Since ${new Date(startupMessage.created_at).toLocaleString()}`
        : 'Unknown'

      orchestratorHealth = {
        isRunning: true,
        uptime,
        tokenBudget: {
          total: tokenBudget.total,
          used: tokenBudget.used,
          remaining: tokenBudget.remaining,
          usagePercent: Math.round((tokenBudget.used / tokenBudget.total) * 100 * 100) / 100
        },
        lastExecutionTimes,
        activeOperationsCount: activeOps.length,
        scheduledJobsCount: 6
      }
    } catch (e) {
      orchestratorHealth = {
        isRunning: false,
        uptime: 'Not running',
        tokenBudget: {
          total: 0,
          used: 0,
          remaining: 0,
          usagePercent: 0
        },
        lastExecutionTimes: {},
        activeOperationsCount: 0,
        scheduledJobsCount: 0
      }
    }

    return NextResponse.json({
      tasks: tasks || [],
      activity: activity || [],
      agents: agents || [],
      agentStatistics,
      orchestratorHealth,
      filters: {
        dateFrom,
        dateTo,
        agentType,
        agentName
      }
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
