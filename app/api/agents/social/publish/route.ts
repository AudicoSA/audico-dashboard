import { NextRequest, NextResponse } from 'next/server'
import { publishToTwitter, publishToFacebook, publishToInstagram } from '@/services/integrations/social-publisher'
import { getServerSupabase } from '@/lib/supabase'
import { logToSquadMessages } from '@/lib/logger'

/**
 * Social Media Publishing Endpoint
 *
 * Handles publishing social media posts via platform APIs.
 * Can be called manually or by the task executor.
 */

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { post_id, platform } = await request.json()

    if (!post_id || !platform) {
      return NextResponse.json(
        { error: 'Missing post_id or platform' },
        { status: 400 }
      )
    }

    const supabase = getServerSupabase()

    // Get post details
    const { data: post, error } = await supabase
      .from('social_posts')
      .select('*')
      .eq('id', post_id)
      .single()

    if (error || !post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      )
    }

    console.log(`[SOCIAL PUBLISH] Publishing to ${platform}:`, post_id)

    let result

    // Publish to appropriate platform
    switch (platform.toLowerCase()) {
      case 'twitter':
      case 'x':
        result = await publishToTwitter(post_id)
        break

      case 'facebook':
        result = await publishToFacebook(post_id)
        break

      case 'instagram':
        result = await publishToInstagram(post_id)
        break

      default:
        return NextResponse.json(
          { error: `Unsupported platform: ${platform}` },
          { status: 400 }
        )
    }

    // Mark related task as completed
    const { data: task } = await supabase
      .from('squad_tasks')
      .select('id')
      .eq('metadata->>post_id', post_id)
      .single()

    if (task) {
      await supabase.from('squad_tasks').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        deliverable_url: result.platform_url || `/social-posts/${post_id}`
      }).eq('id', task.id)
    }

    await logToSquadMessages(
      'social_agent',
      `✅ Post published to ${platform}`,
      {
        post_id,
        platform,
        platform_post_id: result.platform_post_id,
        platform_url: result.platform_url
      }
    )

    return NextResponse.json({
      success: true,
      platform_post_id: result.platform_post_id,
      platform_url: result.platform_url,
      post_id
    })
  } catch (error: any) {
    console.error('[SOCIAL PUBLISH] Error:', error)

    await logToSquadMessages(
      'social_agent',
      `❌ Failed to publish post: ${error.message}`,
      { error: error.message }
    )

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'operational',
    endpoint: '/api/agents/social/publish',
    method: 'POST',
    required_fields: ['post_id', 'platform'],
    supported_platforms: ['twitter', 'facebook', 'instagram']
  })
}
