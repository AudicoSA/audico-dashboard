import { createClient, SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { ProductCatalogItem } from './types'
import { HOME_AUTOMATION_KEYWORDS, getPlatformGuideline, getRandomKeywords, Platform } from './utils'

export class SocialMediaAgent {
  private supabase: SupabaseClient | null = null
  private anthropic: Anthropic | null = null

  private getSupabase(): SupabaseClient {
    if (!this.supabase) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      this.supabase = createClient(supabaseUrl, supabaseKey)
    }
    return this.supabase
  }

  private getAnthropic(): Anthropic {
    if (!this.anthropic) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY!,
      })
    }
    return this.anthropic
  }

  async fetchProductCatalog(limit: number = 20): Promise<ProductCatalogItem[]> {
    try {
      const { data, error } = await this.getSupabase()
        .from('products')
        .select('*')
        .limit(limit)

      if (error) {
        console.error('Error fetching product catalog:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Exception fetching product catalog:', error)
      return []
    }
  }

  async searchProducts(query: string, limit: number = 10): Promise<ProductCatalogItem[]> {
    try {
      const { data, error } = await this.getSupabase()
        .from('products')
        .select('*')
        .or(`name.ilike.%${query}%,description.ilike.%${query}%,category.ilike.%${query}%,brand.ilike.%${query}%`)
        .limit(limit)

      if (error) {
        console.error('Error searching products:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Exception searching products:', error)
      return []
    }
  }

  async generatePostContent(
    platform: string,
    targetKeywords: string[],
    products: ProductCatalogItem[]
  ): Promise<string> {
    const productContext = products.length > 0
      ? products.map(p => `- ${p.name}: ${p.description || 'No description'} (${p.brand || 'Unknown brand'})`).join('\n')
      : 'No specific products available'

    const guideline = getPlatformGuideline(platform as Platform)

    const prompt = `You are a social media content creator for a home automation and smart home technology retailer.

Target Keywords: ${targetKeywords.join(', ')}
Platform: ${guideline.name}
Platform Guidelines: ${guideline.tone}
Max Length: ${guideline.maxLength} characters (recommended: ${guideline.recommended})

Available Products Context:
${productContext}

Create an engaging social media post that:
1. Naturally incorporates the target keywords
2. Highlights the benefits of home automation/smart home technology
3. References relevant products from the catalog if applicable
4. Includes a clear call-to-action
5. Follows the platform-specific guidelines
6. Is engaging and encourages user interaction

Generate ONLY the post content, without any meta-commentary or explanations.`

    try {
      const message = await this.getAnthropic().messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })

      const textContent = message.content.find(block => block.type === 'text')
      return textContent ? textContent.text : ''
    } catch (error) {
      console.error('Error generating post content with Claude:', error)
      throw new Error('Failed to generate post content')
    }
  }

  async createPostDraft(
    platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'tiktok' | 'youtube',
    targetKeywords: string[],
    scheduledFor?: Date,
    productQuery?: string
  ): Promise<string> {
    const products = productQuery
      ? await this.searchProducts(productQuery)
      : await this.fetchProductCatalog(10)

    const content = await this.generatePostContent(platform, targetKeywords, products)

    const { data, error } = await this.getSupabase()
      .from('social_posts')
      .insert({
        platform,
        content,
        status: 'draft',
        scheduled_for: scheduledFor?.toISOString() || null,
        created_by: 'Lerato',
        metadata: {
          target_keywords: targetKeywords,
          products_referenced: products.map(p => ({ id: p.id, name: p.name })),
          generated_at: new Date().toISOString(),
          generation_method: 'claude_rag'
        }
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating post draft:', error)
      throw new Error('Failed to save post draft')
    }

    await this.logActivity('created_draft', data.id, {
      platform,
      keywords: targetKeywords,
      scheduled: !!scheduledFor
    })

    return data.id
  }

  async createApprovalTask(postId: string): Promise<string> {
    const { data: post, error: fetchError } = await this.getSupabase()
      .from('social_posts')
      .select('*')
      .eq('id', postId)
      .single()

    if (fetchError || !post) {
      throw new Error('Post not found')
    }

    const { data: task, error: taskError } = await this.getSupabase()
      .from('squad_tasks')
      .insert({
        title: `Review Social Media Post - ${post.platform}`,
        description: `Please review and approve the ${post.platform} post draft.\n\nContent Preview:\n${post.content.substring(0, 200)}${post.content.length > 200 ? '...' : ''}`,
        status: 'new',
        assigned_agent: 'Jarvis',
        priority: 'medium',
        mentions_kenny: true,
        deliverable_url: `/social-posts/${postId}`
      })
      .select()
      .single()

    if (taskError) {
      console.error('Error creating approval task:', taskError)
      throw new Error('Failed to create approval task')
    }

    await this.getSupabase()
      .from('social_posts')
      .update({
        metadata: {
          ...post.metadata,
          approval_task_id: task.id
        }
      })
      .eq('id', postId)

    await this.getSupabase()
      .from('squad_messages')
      .insert({
        from_agent: 'Lerato',
        to_agent: 'Jarvis',
        message: `New ${post.platform} post ready for review: "${post.content.substring(0, 100)}..."`,
        task_id: task.id,
        data: {
          post_id: postId,
          platform: post.platform,
          action: 'approval_requested'
        }
      })

    return task.id
  }

  async approvePost(postId: string, scheduledFor?: Date): Promise<void> {
    const updateData: any = {
      status: scheduledFor ? 'scheduled' : 'draft',
      scheduled_for: scheduledFor?.toISOString() || null
    }

    const { error } = await this.getSupabase()
      .from('social_posts')
      .update(updateData)
      .eq('id', postId)

    if (error) {
      throw new Error('Failed to approve post')
    }

    await this.logActivity('approved', postId, {
      scheduled: !!scheduledFor,
      scheduled_for: scheduledFor?.toISOString()
    })

    const { data: post } = await this.getSupabase()
      .from('social_posts')
      .select('metadata')
      .eq('id', postId)
      .single()

    if (post?.metadata?.approval_task_id) {
      await this.getSupabase()
        .from('squad_tasks')
        .update({ status: 'completed' })
        .eq('id', post.metadata.approval_task_id)
    }
  }

  async rejectPost(postId: string, reason: string): Promise<void> {
    const { data: post, error: fetchError } = await this.getSupabase()
      .from('social_posts')
      .select('metadata')
      .eq('id', postId)
      .single()

    if (fetchError) {
      throw new Error('Post not found')
    }

    const { error } = await this.getSupabase()
      .from('social_posts')
      .update({
        metadata: {
          ...post.metadata,
          rejection_reason: reason,
          rejected_at: new Date().toISOString()
        }
      })
      .eq('id', postId)

    if (error) {
      throw new Error('Failed to reject post')
    }

    await this.logActivity('rejected', postId, { reason })

    if (post?.metadata?.approval_task_id) {
      await this.getSupabase()
        .from('squad_tasks')
        .update({
          status: 'completed',
          description: `Post rejected: ${reason}`
        })
        .eq('id', post.metadata.approval_task_id)
    }
  }

  async getScheduledPosts(): Promise<any[]> {
    const now = new Date()
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)

    const { data, error } = await this.getSupabase()
      .from('social_posts')
      .select('*')
      .eq('status', 'scheduled')
      .gte('scheduled_for', now.toISOString())
      .lte('scheduled_for', oneHourFromNow.toISOString())
      .order('scheduled_for', { ascending: true })

    if (error) {
      console.error('Error fetching scheduled posts:', error)
      return []
    }

    return data || []
  }

  async publishPost(postId: string): Promise<void> {
    const { error } = await this.getSupabase()
      .from('social_posts')
      .update({
        status: 'published',
        published_at: new Date().toISOString()
      })
      .eq('id', postId)

    if (error) {
      throw new Error('Failed to mark post as published')
    }

    await this.logActivity('published', postId, {
      published_at: new Date().toISOString()
    })
  }

  async markPostFailed(postId: string, error: string): Promise<void> {
    const { data: post } = await this.getSupabase()
      .from('social_posts')
      .select('metadata')
      .eq('id', postId)
      .single()

    await this.getSupabase()
      .from('social_posts')
      .update({
        status: 'failed',
        metadata: {
          ...post?.metadata,
          error,
          failed_at: new Date().toISOString()
        }
      })
      .eq('id', postId)

    await this.logActivity('failed', postId, { error })
  }

  async generateBulkPosts(count: number = 7): Promise<string[]> {
    const postIds: string[] = []
    const platforms: Array<'facebook' | 'instagram' | 'twitter' | 'linkedin'> = ['facebook', 'instagram', 'twitter', 'linkedin']
    
    for (let i = 0; i < count; i++) {
      const platform = platforms[i % platforms.length]
      const keywordSample = getRandomKeywords(3)

      try {
        const postId = await this.createPostDraft(
          platform,
          keywordSample,
          new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000)
        )
        postIds.push(postId)

        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error) {
        console.error(`Failed to generate post ${i + 1}:`, error)
      }
    }

    return postIds
  }

  async scheduleWeeklyPosts(): Promise<void> {
    const postIds = await this.generateBulkPosts(7)

    await this.getSupabase()
      .from('squad_tasks')
      .insert({
        title: 'Weekly Social Media Posts Generated',
        description: `Generated ${postIds.length} social media posts for the upcoming week. Posts require approval before publishing.`,
        status: 'completed',
        assigned_agent: 'Lerato',
        priority: 'low',
        mentions_kenny: false
      })

    await this.getSupabase()
      .from('squad_messages')
      .insert({
        from_agent: 'Lerato',
        to_agent: null,
        message: `Weekly batch of ${postIds.length} social media posts generated and scheduled for review.`,
        data: {
          post_ids: postIds,
          action: 'bulk_generation'
        }
      })
  }

  private async logActivity(action: string, postId: string, metadata: any = {}): Promise<void> {
    try {
      await this.getSupabase()
        .from('squad_messages')
        .insert({
          from_agent: 'Lerato',
          message: `Social post ${action}: ${postId}`,
          data: {
            action,
            post_id: postId,
            ...metadata
          }
        })
    } catch (error) {
      console.error('Failed to log activity:', error)
    }
  }
}

export const socialAgent = new SocialMediaAgent()
