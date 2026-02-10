/**
 * Social Media Agent Execution Handler
 *
 * Handles social media publishing tasks for the Social Media Agent.
 * Phase 3: Full implementation with multi-platform support.
 */

import type { Task } from '@/types/squad'
import { publishToTwitter, publishToFacebook, publishToInstagram } from '@/services/integrations/social-publisher'
import { getServerSupabase } from '@/lib/supabase'
import { logToSquadMessages } from '@/lib/logger'

const DRY_RUN = process.env.AGENT_DRY_RUN === 'true'

interface ExecutionResult {
  success: boolean
  deliverable_url?: string
  error?: string
}

/**
 * Execute social media publishing task
 */
export async function socialPublishHandler(task: Task): Promise<ExecutionResult> {
  console.log('[SOCIAL HANDLER] Executing task:', task.title)

  if (DRY_RUN) {
    console.log('[DRY RUN] Would publish social post:', task.metadata)
    await logToSquadMessages(
      'Social Media Agent',
      `[DRY RUN] Would publish post: ${task.title}`,
      task.metadata
    )
    return {
      success: true,
      deliverable_url: '/social-posts/dry-run-preview',
    }
  }

  try {
    const supabase = getServerSupabase()

    // Get post metadata
    const postId = task.metadata?.post_id
    const platform = task.metadata?.platform

    if (!postId || !platform) {
      throw new Error('Missing post_id or platform in task metadata')
    }

    console.log(`[SOCIAL HANDLER] Publishing to ${platform}:`, postId)

    let result

    // Publish to appropriate platform
    switch (platform.toLowerCase()) {
      case 'twitter':
      case 'x':
        result = await publishToTwitter(postId)
        break

      case 'facebook':
        result = await publishToFacebook(postId)
        break

      case 'instagram':
        result = await publishToInstagram(postId)
        break

      default:
        throw new Error(`Unsupported platform: ${platform}`)
    }

    // Log success
    await logToSquadMessages(
      'Social Media Agent',
      `✅ Post published to ${platform}: ${result.platform_url}`,
      {
        post_id: postId,
        platform,
        platform_post_id: result.platform_post_id,
        platform_url: result.platform_url
      }
    )

    return {
      success: true,
      deliverable_url: result.platform_url || `/social-posts/${postId}`
    }
  } catch (error: any) {
    console.error('[SOCIAL HANDLER] Error:', error)

    // Log error to squad messages
    await logToSquadMessages(
      'Social Media Agent',
      `❌ Failed to publish post: ${error.message}`,
      { task_id: task.id, error: error.message }
    )

    return {
      success: false,
      error: error.message
    }
  }
}
