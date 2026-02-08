import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  createConnector,
  PostResult,
} from '@/lib/social-connectors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { post_id, platforms } = body

    if (!post_id) {
      return NextResponse.json(
        { error: 'post_id is required' },
        { status: 400 }
      )
    }

    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json(
        { error: 'platforms array is required' },
        { status: 400 }
      )
    }

    const { data: post, error: postError } = await supabase
      .from('social_posts')
      .select('*')
      .eq('id', post_id)
      .single()

    if (postError || !post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      )
    }

    if (post.status !== 'draft' && post.status !== 'scheduled') {
      return NextResponse.json(
        { error: `Cannot publish post with status: ${post.status}` },
        { status: 400 }
      )
    }

    const { data: accounts, error: accountsError } = await supabase
      .from('social_accounts')
      .select('*')
      .in('platform', platforms)

    if (accountsError) {
      return NextResponse.json(
        { error: 'Failed to fetch social accounts' },
        { status: 500 }
      )
    }

    if (!accounts || accounts.length === 0) {
      return NextResponse.json(
        { error: 'No connected social accounts found for the specified platforms' },
        { status: 404 }
      )
    }

    const results: PostResult[] = []
    let publishedCount = 0
    let failedCount = 0

    for (const account of accounts) {
      if (!platforms.includes(account.platform)) {
        continue
      }

      const connector = await createConnector(account)

      if (!connector) {
        results.push({
          success: false,
          error: 'Unsupported platform',
          platform: account.platform,
        })
        failedCount++
        continue
      }

      const result = await connector.post(post.content, post.media_urls || [])
      results.push(result)

      if (result.success) {
        publishedCount++

        await supabase
          .from('social_posts')
          .update({
            status: 'published',
            published_at: new Date().toISOString(),
            post_url: result.post_url || null,
            metadata: {
              ...post.metadata,
              [account.platform]: {
                post_id: result.post_id,
                post_url: result.post_url,
                account_id: account.account_id,
                published_at: new Date().toISOString(),
              },
            },
          })
          .eq('id', post_id)
      } else {
        failedCount++
      }
    }

    if (failedCount > 0 && publishedCount === 0) {
      await supabase
        .from('social_posts')
        .update({
          status: 'failed',
          metadata: {
            ...post.metadata,
            errors: results
              .filter((r) => !r.success)
              .map((r) => ({ platform: r.platform, error: r.error })),
          },
        })
        .eq('id', post_id)
    }

    await supabase.from('squad_messages').insert({
      from_agent: 'social-agent',
      message: `Published post to ${publishedCount} platform(s). ${failedCount} failed.`,
      data: {
        post_id,
        results,
      },
    })

    return NextResponse.json({
      success: publishedCount > 0,
      published: publishedCount,
      failed: failedCount,
      results,
    })
  } catch (error) {
    console.error('Social post API error:', error)
    return NextResponse.json(
      { error: 'Failed to publish post', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const platform = searchParams.get('platform')

    let query = supabase
      .from('social_posts')
      .select('*')
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    if (platform) {
      query = query.eq('platform', platform)
    }

    const { data: posts, error } = await query.limit(100)

    if (error) {
      console.error('Error fetching posts:', error)
      return NextResponse.json(
        { error: 'Failed to fetch posts' },
        { status: 500 }
      )
    }

    return NextResponse.json({ posts: posts || [] })
  } catch (error) {
    console.error('Social posts GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    )
  }
}
