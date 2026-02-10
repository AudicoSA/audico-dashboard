/**
 * Task Rejection Endpoint
 *
 * Allows Kenny to reject tasks that require manual approval.
 * Rejected tasks will not be executed.
 */

import { NextRequest, NextResponse } from 'next/server'
import { approvalWorkflow } from '@/services/approval-workflow'
import { logToSquadMessages } from '@/lib/logger'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST handler for task rejection
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params
    const body = await request.json()
    const reason = body.reason || 'No reason provided'

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

    // Reject the task
    await approvalWorkflow.rejectTask(taskId, 'Kenny', reason)

    // Log rejection
    await logToSquadMessages(
      'Jarvis',
      `❌ Task rejected by Kenny: "${task.title}" - Reason: ${reason}`,
      {
        task_id: taskId,
        rejected_by: 'Kenny',
        reason,
        agent: task.assigned_agent
      }
    )

    console.log(`[REJECTION] Task ${taskId} rejected by Kenny: ${reason}`)

    return NextResponse.json({
      success: true,
      message: 'Task rejected successfully',
      task_id: taskId,
      reason
    })
  } catch (error: any) {
    console.error('[REJECTION] Error rejecting task:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET handler for rejection status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params

    const { data: task, error } = await supabase
      .from('squad_tasks')
      .select('status, rejected_at, rejected_by, rejection_reason')
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
      rejected: task.status === 'rejected',
      rejected_by: task.rejected_by,
      rejected_at: task.rejected_at,
      rejection_reason: task.rejection_reason
    })
  } catch (error: any) {
    console.error('[REJECTION] Error getting rejection status:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
