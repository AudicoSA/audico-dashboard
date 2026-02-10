/**
 * Task Approval Endpoint
 *
 * Allows Kenny to approve tasks that require manual approval.
 * Once approved, the task becomes eligible for execution.
 */

import { NextRequest, NextResponse } from 'next/server'
import { approvalWorkflow } from '@/services/approval-workflow'
import { logToSquadMessages } from '@/lib/logger'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST handler for task approval
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params

    // Get task details
    const { data: task, error } = await supabase
      .from('squad_tasks')
      .select('*')
      .eq('id', taskId)
      .single()

    if (error || !task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    // Approve the task
    await approvalWorkflow.approveTask(taskId, 'Kenny')

    // Log approval
    await logToSquadMessages(
      'Jarvis',
      `✅ Task approved by Kenny: "${task.title}"`,
      {
        task_id: taskId,
        approved_by: 'Kenny',
        agent: task.assigned_agent
      }
    )

    console.log(`[APPROVAL] Task ${taskId} approved by Kenny`)

    return NextResponse.json({
      success: true,
      message: 'Task approved successfully',
      task_id: taskId
    })
  } catch (error: any) {
    console.error('[APPROVAL] Error approving task:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET handler for approval status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params

    const { data: task, error } = await supabase
      .from('squad_tasks')
      .select('requires_approval, approved_at, approved_by')
      .eq('id', taskId)
      .single()

    if (error || !task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      task_id: taskId,
      requires_approval: task.requires_approval,
      approved: !!task.approved_at,
      approved_by: task.approved_by,
      approved_at: task.approved_at
    })
  } catch (error: any) {
    console.error('[APPROVAL] Error getting approval status:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
