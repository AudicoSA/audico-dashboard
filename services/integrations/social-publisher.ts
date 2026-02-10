import { getServerSupabase } from '@/lib/supabase'

/**
 * Social Media Publisher Service
 *
 * Handles publishing posts to social platforms:
 * - Twitter/X (OAuth 2.0)
 * - Facebook Pages
 * - Instagram Business
 */

interface PublishResult {
  platform_post_id: string
  platform_url?: string
  published_at: string
}

/**
 * Get social account credentials from database
 */
async function getSocialAccountToken(platform: string) {
  const supabase = getServerSupabase()

  const { data, error } = await supabase
    .from('social_accounts')
    .select('access_token, refresh_token, metadata')
    .eq('platform', platform)
    .eq('is_active', true)
    .single()

  if (error || !data) {
    throw new Error(`No active ${platform} account configured`)
  }

  return data
}

/**
 * Fetch post from database
 */
async function fetchPostFromDB(postId: string) {
  const supabase = getServerSupabase()

  const { data, error } = await supabase
    .from('social_posts')
    .select('*')
    .eq('id', postId)
    .single()

  if (error || !data) {
    throw new Error(`Post not found: ${postId}`)
  }

  return data
}

/**
 * Publish post to Twitter/X
 * Uses OAuth 2.0 (already configured)
 */
export async function publishToTwitter(postId: string): Promise<PublishResult> {
  console.log('[SOCIAL PUBLISHER] Publishing to Twitter:', postId)

  try {
    const post = await fetchPostFromDB(postId)
    const account = await getSocialAccountToken('twitter')

    // Twitter API v2 endpoint
    const response = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${account.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: post.content
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Twitter API error: ${JSON.stringify(error)}`)
    }

    const data = await response.json()

    // Update social_posts status
    const supabase = getServerSupabase()
    await supabase.from('social_posts').update({
      status: 'published',
      published_at: new Date().toISOString(),
      post_url: `https://twitter.com/user/status/${data.data.id}`,
      metadata: {
        ...post.metadata,
        platform_post_id: data.data.id
      }
    }).eq('id', postId)

    console.log('[SOCIAL PUBLISHER] Twitter post published:', data.data.id)

    return {
      platform_post_id: data.data.id,
      platform_url: `https://twitter.com/user/status/${data.data.id}`,
      published_at: new Date().toISOString()
    }
  } catch (error: any) {
    console.error('[SOCIAL PUBLISHER] Twitter error:', error)
    throw new Error(`Failed to publish to Twitter: ${error.message}`)
  }
}

/**
 * Publish post to Facebook Page
 * Requires Page Access Token
 */
export async function publishToFacebook(postId: string): Promise<PublishResult> {
  console.log('[SOCIAL PUBLISHER] Publishing to Facebook:', postId)

  try {
    const post = await fetchPostFromDB(postId)
    const account = await getSocialAccountToken('facebook')
    const pageId = account.metadata.page_id

    if (!pageId) {
      throw new Error('Facebook Page ID not configured')
    }

    // Facebook Graph API
    const response = await fetch(`https://graph.facebook.com/v18.0/${pageId}/feed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: post.content,
        access_token: account.access_token
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Facebook API error: ${JSON.stringify(error)}`)
    }

    const data = await response.json()

    // Update social_posts status
    const supabase = getServerSupabase()
    await supabase.from('social_posts').update({
      status: 'published',
      published_at: new Date().toISOString(),
      post_url: `https://facebook.com/${data.id}`,
      metadata: {
        ...post.metadata,
        platform_post_id: data.id
      }
    }).eq('id', postId)

    console.log('[SOCIAL PUBLISHER] Facebook post published:', data.id)

    return {
      platform_post_id: data.id,
      platform_url: `https://facebook.com/${data.id}`,
      published_at: new Date().toISOString()
    }
  } catch (error: any) {
    console.error('[SOCIAL PUBLISHER] Facebook error:', error)
    throw new Error(`Failed to publish to Facebook: ${error.message}`)
  }
}

/**
 * Publish post to Instagram Business Account
 * Requires Instagram Business Account linked to Facebook Page
 * Instagram API requires 2-step: create container, then publish
 */
export async function publishToInstagram(postId: string): Promise<PublishResult> {
  console.log('[SOCIAL PUBLISHER] Publishing to Instagram:', postId)

  try {
    const post = await fetchPostFromDB(postId)
    const account = await getSocialAccountToken('instagram')
    const instagramAccountId = account.metadata.instagram_account_id

    if (!instagramAccountId) {
      throw new Error('Instagram Business Account ID not configured')
    }

    // Check if post has image URL
    if (!post.media_urls || post.media_urls.length === 0) {
      throw new Error('Instagram posts require at least one image URL')
    }

    const imageUrl = post.media_urls[0]

    // Step 1: Create container
    const containerResponse = await fetch(
      `https://graph.facebook.com/v18.0/${instagramAccountId}/media`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image_url: imageUrl,
          caption: post.content,
          access_token: account.access_token
        })
      }
    )

    if (!containerResponse.ok) {
      const error = await containerResponse.json()
      throw new Error(`Instagram container error: ${JSON.stringify(error)}`)
    }

    const containerData = await containerResponse.json()

    // Step 2: Publish container
    const publishResponse = await fetch(
      `https://graph.facebook.com/v18.0/${instagramAccountId}/media_publish`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          creation_id: containerData.id,
          access_token: account.access_token
        })
      }
    )

    if (!publishResponse.ok) {
      const error = await publishResponse.json()
      throw new Error(`Instagram publish error: ${JSON.stringify(error)}`)
    }

    const data = await publishResponse.json()

    // Update social_posts status
    const supabase = getServerSupabase()
    await supabase.from('social_posts').update({
      status: 'published',
      published_at: new Date().toISOString(),
      post_url: `https://instagram.com/p/${data.id}`,
      metadata: {
        ...post.metadata,
        platform_post_id: data.id,
        container_id: containerData.id
      }
    }).eq('id', postId)

    console.log('[SOCIAL PUBLISHER] Instagram post published:', data.id)

    return {
      platform_post_id: data.id,
      platform_url: `https://instagram.com/p/${data.id}`,
      published_at: new Date().toISOString()
    }
  } catch (error: any) {
    console.error('[SOCIAL PUBLISHER] Instagram error:', error)
    throw new Error(`Failed to publish to Instagram: ${error.message}`)
  }
}

/**
 * Get post details (for preview/debugging)
 */
export async function getPostDetails(postId: string) {
  console.log('[SOCIAL PUBLISHER] Fetching post:', postId)
  return await fetchPostFromDB(postId)
}
