import { createClient } from '@supabase/supabase-js'
import NotebookLMService, { NotebookSource } from '../integrations/notebooklm-service'
import { socialAgent } from '../agents/social-agent'
import { MarketingAgent } from '../agents/marketing-agent'
import * as path from 'path'
import * as fs from 'fs'
import { randomUUID } from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const notebookLM = new NotebookLMService()
const marketingAgent = new MarketingAgent()

export async function generateWeeklySocialVisuals(): Promise<{
  success: boolean
  processed: number
  generated: number
  errors: Array<{ postId: string; error: string }>
}> {
  const result = {
    success: true,
    processed: 0,
    generated: 0,
    errors: [] as Array<{ postId: string; error: string }>
  }

  try {
    await logWorkflowActivity(
      'weekly_social_visuals_started',
      'Starting weekly social visual content generation workflow'
    )

    const now = new Date()
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const { data: upcomingPosts, error: fetchError } = await supabase
      .from('social_posts')
      .select('*')
      .in('status', ['draft', 'scheduled'])
      .gte('scheduled_for', now.toISOString())
      .lte('scheduled_for', nextWeek.toISOString())
      .is('visual_content_url', null)
      .order('scheduled_for', { ascending: true })

    if (fetchError) {
      throw new Error(`Failed to fetch upcoming posts: ${fetchError.message}`)
    }

    if (!upcomingPosts || upcomingPosts.length === 0) {
      await logWorkflowActivity(
        'weekly_social_visuals_completed',
        'No posts requiring visuals found for the next 7 days',
        { posts_found: 0 }
      )
      return result
    }

    result.processed = upcomingPosts.length

    for (const post of upcomingPosts) {
      try {
        const visualType = determineVisualType(post.platform)
        
        const visualResult = await socialAgent.generateVisualContent(
          post.id,
          visualType
        )

        if (visualResult.success) {
          result.generated++
          
          await logWorkflowActivity(
            'social_visual_generated',
            `Generated ${visualType} for ${post.platform} post`,
            {
              post_id: post.id,
              platform: post.platform,
              visual_type: visualType,
              visual_url: visualResult.visualUrl,
              artifact_id: visualResult.artifactId
            }
          )
        } else {
          result.errors.push({
            postId: post.id,
            error: visualResult.error || 'Unknown error'
          })
        }

        await new Promise(resolve => setTimeout(resolve, 2000))
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        result.errors.push({
          postId: post.id,
          error: errorMsg
        })
        
        await logWorkflowActivity(
          'social_visual_error',
          `Failed to generate visual for post ${post.id}`,
          { post_id: post.id, error: errorMsg }
        )
      }
    }

    if (result.errors.length > 0) {
      result.success = false
    }

    await supabase
      .from('squad_tasks')
      .insert({
        title: 'Weekly Social Visuals Generated',
        description: `Processed ${result.processed} upcoming social posts. Generated ${result.generated} visuals. ${result.errors.length > 0 ? `${result.errors.length} errors occurred.` : ''}`,
        status: result.success ? 'completed' : 'failed',
        assigned_agent: 'visual_automation',
        priority: 'medium',
        mentions_kenny: result.errors.length > 0
      })

    await logWorkflowActivity(
      'weekly_social_visuals_completed',
      `Completed weekly social visual generation: ${result.generated}/${result.processed} successful`,
      {
        processed: result.processed,
        generated: result.generated,
        errors_count: result.errors.length,
        errors: result.errors
      }
    )

    return result
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown workflow error'
    
    await logWorkflowActivity(
      'weekly_social_visuals_failed',
      `Weekly social visual generation failed: ${errorMsg}`,
      { error: errorMsg }
    )

    result.success = false
    return result
  }
}

export async function generateMonthlyNewsletterAssets(): Promise<{
  success: boolean
  newsletter_id?: string
  slide_deck_url?: string
  infographic_url?: string
  error?: string
}> {
  try {
    await logWorkflowActivity(
      'monthly_newsletter_assets_started',
      'Starting monthly newsletter asset generation workflow'
    )

    const { data: recentNewsletters, error: fetchError } = await supabase
      .from('newsletter_drafts')
      .select('*')
      .in('status', ['draft', 'review', 'scheduled'])
      .order('created_at', { ascending: false })
      .limit(1)

    if (fetchError) {
      throw new Error(`Failed to fetch newsletters: ${fetchError.message}`)
    }

    let newsletter
    if (!recentNewsletters || recentNewsletters.length === 0) {
      await logWorkflowActivity(
        'newsletter_generation_triggered',
        'No recent newsletter draft found, generating new one'
      )

      const newsletterDraft = await marketingAgent.generateNewsletterDraft()
      
      if (!newsletterDraft) {
        throw new Error('Failed to generate newsletter draft')
      }

      const { data: insertedNewsletter, error: insertError } = await supabase
        .from('newsletter_drafts')
        .insert({
          title: newsletterDraft.subject.substring(0, 100),
          subject_line: newsletterDraft.subject,
          content: newsletterDraft.content,
          status: 'draft',
          created_by: 'visual_automation',
          metadata: newsletterDraft.metadata
        })
        .select()
        .single()

      if (insertError || !insertedNewsletter) {
        throw new Error(`Failed to save newsletter draft: ${insertError?.message}`)
      }

      newsletter = insertedNewsletter
    } else {
      newsletter = recentNewsletters[0]
    }

    const hasExistingAssets = newsletter.metadata?.visual_assets && 
                              newsletter.metadata.visual_assets.length > 0

    if (hasExistingAssets) {
      await logWorkflowActivity(
        'monthly_newsletter_assets_skipped',
        `Newsletter ${newsletter.id} already has visual assets`,
        { newsletter_id: newsletter.id }
      )

      return {
        success: true,
        newsletter_id: newsletter.id,
        slide_deck_url: newsletter.metadata.visual_assets.find((a: any) => a.type === 'slide_deck')?.url,
        infographic_url: newsletter.metadata.visual_assets.find((a: any) => a.type === 'infographic')?.url
      }
    }

    await marketingAgent.generateNewsletterVisuals(newsletter.id)

    const { data: updatedNewsletter } = await supabase
      .from('newsletter_drafts')
      .select('*')
      .eq('id', newsletter.id)
      .single()

    const visualAssets = updatedNewsletter?.metadata?.visual_assets || []

    await supabase
      .from('squad_tasks')
      .insert({
        title: 'Monthly Newsletter Assets Generated',
        description: `Created visual assets for newsletter: ${newsletter.title}. Generated ${visualAssets.length} assets (slide deck + infographic).`,
        status: 'completed',
        assigned_agent: 'visual_automation',
        priority: 'medium',
        mentions_kenny: false,
        deliverable_url: visualAssets[0]?.url
      })

    await logWorkflowActivity(
      'monthly_newsletter_assets_completed',
      `Completed newsletter asset generation for: ${newsletter.title}`,
      {
        newsletter_id: newsletter.id,
        assets_count: visualAssets.length,
        assets: visualAssets
      }
    )

    return {
      success: true,
      newsletter_id: newsletter.id,
      slide_deck_url: visualAssets.find((a: any) => a.type === 'slide_deck')?.url,
      infographic_url: visualAssets.find((a: any) => a.type === 'infographic')?.url
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    
    await logWorkflowActivity(
      'monthly_newsletter_assets_failed',
      `Monthly newsletter asset generation failed: ${errorMsg}`,
      { error: errorMsg }
    )

    return {
      success: false,
      error: errorMsg
    }
  }
}

export async function generateResellerOnboardingKit(resellerId: string): Promise<{
  success: boolean
  slide_deck_url?: string
  artifact_id?: string
  error?: string
}> {
  try {
    await logWorkflowActivity(
      'reseller_kit_generation_started',
      `Starting reseller onboarding kit generation for reseller: ${resellerId}`,
      { reseller_id: resellerId }
    )

    const { data: reseller, error: fetchError } = await supabase
      .from('approved_resellers')
      .select('*')
      .eq('id', resellerId)
      .single()

    if (fetchError || !reseller) {
      throw new Error(`Reseller not found: ${fetchError?.message}`)
    }

    const existingKit = reseller.metadata?.reseller_kit
    if (existingKit && existingKit.slide_deck_url) {
      await logWorkflowActivity(
        'reseller_kit_already_exists',
        `Reseller ${reseller.company_name} already has an onboarding kit`,
        { 
          reseller_id: resellerId,
          existing_kit: existingKit 
        }
      )

      return {
        success: true,
        slide_deck_url: existingKit.slide_deck_url,
        artifact_id: existingKit.artifact_id
      }
    }

    await marketingAgent.generateResellerKit(resellerId)

    const { data: updatedReseller } = await supabase
      .from('approved_resellers')
      .select('*')
      .eq('id', resellerId)
      .single()

    const kitInfo = updatedReseller?.metadata?.reseller_kit

    if (!kitInfo) {
      throw new Error('Reseller kit generation completed but kit info not found')
    }

    await logWorkflowActivity(
      'reseller_kit_generation_completed',
      `Completed reseller onboarding kit for ${reseller.company_name}`,
      {
        reseller_id: resellerId,
        company_name: reseller.company_name,
        slide_deck_url: kitInfo.slide_deck_url,
        artifact_id: kitInfo.artifact_id,
        product_count: kitInfo.product_count
      }
    )

    return {
      success: true,
      slide_deck_url: kitInfo.slide_deck_url,
      artifact_id: kitInfo.artifact_id
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    
    await logWorkflowActivity(
      'reseller_kit_generation_failed',
      `Reseller kit generation failed for ${resellerId}: ${errorMsg}`,
      { reseller_id: resellerId, error: errorMsg }
    )

    return {
      success: false,
      error: errorMsg
    }
  }
}

function determineVisualType(platform: string): 'infographic' | 'slide_deck' | 'video_overview' {
  switch (platform) {
    case 'linkedin':
      return 'slide_deck'
    case 'youtube':
    case 'tiktok':
      return 'video_overview'
    case 'instagram':
    case 'facebook':
    case 'twitter':
    default:
      return 'infographic'
  }
}

async function logWorkflowActivity(
  eventType: string,
  message: string,
  context: any = {}
): Promise<void> {
  try {
    await supabase
      .from('squad_messages')
      .insert({
        from_agent: 'visual_automation',
        to_agent: null,
        message: message,
        task_id: null,
        data: {
          event_type: eventType,
          timestamp: new Date().toISOString(),
          workflow: 'visual_content_automation',
          ...context
        }
      })
  } catch (error) {
    console.error('Error logging workflow activity:', error)
  }
}
