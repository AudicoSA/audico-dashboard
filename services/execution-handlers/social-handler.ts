/**
 * Social Media Agent Execution Handler
 *
 * Handles social media tasks:
 * - generate_content: Creates draft posts via AI for approval
 * - publish: Publishes approved posts to platforms
 */

import type { Task } from '@/types/squad'
import { publishToTwitter, publishToFacebook, publishToInstagram } from '@/services/integrations/social-publisher'
import { socialAgent } from '@/services/agents/social-agent'
import { getServerSupabase } from '@/lib/supabase'
import { logToSquadMessages } from '@/lib/logger'

const DRY_RUN = process.env.AGENT_DRY_RUN === 'true'

interface ExecutionResult {
  success: boolean
  deliverable_url?: string
  error?: string
}

/**
 * Execute social media task based on action type
 */
export async function socialPublishHandler(task: Task): Promise<ExecutionResult> {
  console.log('[SOCIAL HANDLER] Executing task:', task.title)

  const action = task.metadata?.action || 'publish'

  try {
    switch (action) {
      case 'generate_content':
        return await handleGenerateContent(task)

      case 'publish':
        return await handlePublish(task)

      default:
        // Default: try to infer intent from task title
        const title = task.title.toLowerCase()
        if (title.includes('generate') || title.includes('create') || title.includes('content') || title.includes('silent')) {
          return await handleGenerateContent(task)
        }
        if (title.includes('publish') || title.includes('post')) {
          return await handlePublish(task)
        }
        return await handleGenerateContent(task)
    }
  } catch (error: any) {
    console.error('[SOCIAL HANDLER] Error:', error)

    await logToSquadMessages(
      'Social Media Agent',
      `❌ Failed: ${error.message}`,
      { task_id: task.id, error: error.message }
    )

    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Generate social media content drafts for approval
 * Creates the post text via Claude, attaches product images, and
 * optionally generates a visual (infographic/slide) via NotebookLM.
 */
async function handleGenerateContent(task: Task): Promise<ExecutionResult> {
  console.log('[SOCIAL HANDLER] Generating content for approval')

  const platforms: Array<'facebook' | 'instagram' | 'twitter'> = ['facebook', 'instagram', 'twitter']
  const keywords = task.metadata?.keywords || ['audio', 'smart home', 'technology', 'South Africa']
  const targetPlatform = task.metadata?.platform || platforms[new Date().getDay() % platforms.length]
  const generateVisual = task.metadata?.generate_visual === true

  // Generate post draft (text content + product references)
  const postId = await socialAgent.createPostDraft(
    targetPlatform as any,
    keywords,
    undefined, // scheduledFor — let user approve first
    undefined, // productQuery — let agent pick from catalog
    generateVisual,
    generateVisual ? 'infographic' : undefined,
  )

  // Attach product images to media_urls so the post has visuals
  const supabase = getServerSupabase()
  const { data: post } = await supabase
    .from('social_posts')
    .select('metadata')
    .eq('id', postId)
    .single()

  if (post?.metadata?.products_referenced?.length > 0) {
    const productIds = post.metadata.products_referenced.map((p: any) => p.id)
    const { data: products } = await supabase
      .from('products')
      .select('image_url')
      .in('id', productIds)
      .not('image_url', 'is', null)

    const imageUrls = products?.map((p: any) => p.image_url).filter(Boolean) || []

    if (imageUrls.length > 0) {
      await supabase
        .from('social_posts')
        .update({ media_urls: imageUrls })
        .eq('id', postId)
    }
  }

  await logToSquadMessages(
    'Social Media Agent',
    `✅ Generated ${targetPlatform} post draft with product images — awaiting approval in Social Media panel`,
    { post_id: postId, platform: targetPlatform }
  )

  return {
    success: true,
    deliverable_url: `/squad?tab=social-media-agent`
  }
}

/**
 * Publish an approved post to its platform
 */
async function handlePublish(task: Task): Promise<ExecutionResult> {
  const postId = task.metadata?.post_id
  const platform = task.metadata?.platform

  if (!postId || !platform) {
    throw new Error('Missing post_id or platform in task metadata — cannot publish without both')
  }

  console.log(`[SOCIAL HANDLER] Publishing to ${platform}:`, postId)

  let result

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
}
