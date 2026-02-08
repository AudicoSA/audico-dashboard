import { NextRequest, NextResponse } from 'next/server'
import { socialAgent } from '@/services/agents/social-agent'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const scheduledPosts = await socialAgent.getScheduledPosts()

    const results = {
      processed: 0,
      published: 0,
      failed: 0,
      errors: [] as any[]
    }

    for (const post of scheduledPosts) {
      results.processed++
      try {
        await socialAgent.publishPost(post.id)
        results.published++
      } catch (error: any) {
        results.failed++
        results.errors.push({
          postId: post.id,
          error: error.message
        })
        await socialAgent.markPostFailed(post.id, error.message)
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('Scheduled posting error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
