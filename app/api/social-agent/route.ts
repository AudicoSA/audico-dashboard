import { NextRequest, NextResponse } from 'next/server'
import { socialAgent } from '@/services/agents/social-agent'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...params } = body

    switch (action) {
      case 'generate_post':
        const { platform, keywords, scheduledFor, productQuery } = params
        if (!platform || !keywords) {
          return NextResponse.json(
            { error: 'platform and keywords are required' },
            { status: 400 }
          )
        }
        const postId = await socialAgent.createPostDraft(
          platform,
          keywords,
          scheduledFor ? new Date(scheduledFor) : undefined,
          productQuery
        )
        const taskId = await socialAgent.createApprovalTask(postId)
        return NextResponse.json({ postId, taskId })

      case 'approve_post':
        const { postId: approvePostId, scheduledFor: approveScheduledFor } = params
        if (!approvePostId) {
          return NextResponse.json(
            { error: 'postId is required' },
            { status: 400 }
          )
        }
        await socialAgent.approvePost(
          approvePostId,
          approveScheduledFor ? new Date(approveScheduledFor) : undefined
        )
        return NextResponse.json({ success: true })

      case 'reject_post':
        const { postId: rejectPostId, reason } = params
        if (!rejectPostId || !reason) {
          return NextResponse.json(
            { error: 'postId and reason are required' },
            { status: 400 }
          )
        }
        await socialAgent.rejectPost(rejectPostId, reason)
        return NextResponse.json({ success: true })

      case 'publish_post':
        const { postId: publishPostId } = params
        if (!publishPostId) {
          return NextResponse.json(
            { error: 'postId is required' },
            { status: 400 }
          )
        }
        await socialAgent.publishPost(publishPostId)
        return NextResponse.json({ success: true })

      case 'generate_bulk':
        const { count = 7 } = params
        const postIds = await socialAgent.generateBulkPosts(count)
        return NextResponse.json({ postIds, count: postIds.length })

      case 'schedule_weekly':
        await socialAgent.scheduleWeeklyPosts()
        return NextResponse.json({ success: true })

      case 'get_scheduled':
        const scheduledPosts = await socialAgent.getScheduledPosts()
        return NextResponse.json({ posts: scheduledPosts })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error('Social agent API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const scheduledPosts = await socialAgent.getScheduledPosts()
    return NextResponse.json({ posts: scheduledPosts })
  } catch (error: any) {
    console.error('Social agent GET error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
