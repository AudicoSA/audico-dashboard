/**
 * Social Media Content Generation Cron
 *
 * Runs daily at 9 AM SAST (0 7 * * * UTC).
 * Checks if social media content is needed, generates AI-powered posts
 * using the existing SocialMediaAgent, and creates approval tasks.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth'
import { checkRateLimit, logAgentExecution } from '@/lib/rate-limiter'
import { logAgentActivity, logToSquadMessages } from '@/lib/logger'
import { socialAgent } from '@/services/agents/social-agent'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
    return NextResponse.json({
        status: 'social-generate-active',
        message: 'Social media content generation cron ready',
        timestamp: new Date().toISOString(),
    })
}

export async function POST(request: NextRequest) {
    if (!verifyCronRequest(request)) {
        return unauthorizedResponse()
    }

    try {
        const rateLimit = await checkRateLimit({
            agentName: 'social_generate',
            maxExecutions: 2,
            windowSeconds: 86400,
        })

        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: 'Rate limit exceeded', remaining: rateLimit.remaining },
                { status: 429 }
            )
        }

        await logAgentActivity({
            agentName: 'social-agent',
            logLevel: 'info',
            eventType: 'content_generation_start',
            message: 'Social media content generation cycle started',
            context: { action: 'generate_start' },
        })

        await logToSquadMessages(
            'Social Media Agent',
            '🎨 Starting daily content generation cycle'
        )

        // Check days since last post
        const { data: recentPosts } = await supabase
            .from('social_posts')
            .select('id, platform, status, published_at, created_at')
            .order('created_at', { ascending: false })
            .limit(10)

        const lastPublished = recentPosts
            ?.filter((p: any) => p.status === 'published' && p.published_at)
            ?.sort((a: any, b: any) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())?.[0]

        const daysSinceLastPost = lastPublished
            ? Math.floor((Date.now() - new Date(lastPublished.published_at).getTime()) / (1000 * 60 * 60 * 24))
            : 999

        // Check for existing drafts/scheduled posts that haven't been published yet
        const pendingDrafts = recentPosts?.filter(
            (p: any) => p.status === 'draft' || p.status === 'scheduled'
        ) || []

        // If there are already pending drafts, skip generation
        if (pendingDrafts.length >= 3) {
            await logToSquadMessages(
                'Social Media Agent',
                `⏸️ Skipping content generation — ${pendingDrafts.length} pending drafts already waiting for approval`
            )

            await logAgentExecution('social_generate', {
                status: 'skipped',
                reason: 'pending_drafts_exist',
                pending_count: pendingDrafts.length,
            })

            return NextResponse.json({
                success: true,
                action: 'skipped',
                reason: `${pendingDrafts.length} pending drafts already exist`,
                daysSinceLastPost,
            })
        }

        // Generate posts for platforms — rotate through them
        const platforms = ['twitter', 'facebook', 'instagram'] as const
        const targetPlatform = platforms[new Date().getDay() % platforms.length]

        const postIds: string[] = []
        const errors: string[] = []

        try {
            // Use the existing SocialMediaAgent to generate content
            const postId = await socialAgent.createPostDraft(
                targetPlatform,
                ['audio', 'smart home', 'technology', 'South Africa'],
                undefined, // scheduledFor — let Kenny approve first
                undefined, // productQuery — let the agent pick trending products
                false,     // generateVisual — keep it simple for now
            )

            postIds.push(postId)

            // Create approval task
            await socialAgent.createApprovalTask(postId)

            await logToSquadMessages(
                'Social Media Agent',
                `✅ Generated ${targetPlatform} post draft (ID: ${postId}) — awaiting Kenny's approval`,
                { post_id: postId, platform: targetPlatform }
            )
        } catch (genError: any) {
            errors.push(`${targetPlatform}: ${genError.message}`)
            await logToSquadMessages(
                'Social Media Agent',
                `❌ Failed to generate ${targetPlatform} post: ${genError.message}`,
                { platform: targetPlatform, error: genError.message }
            )
        }

        // If it's been 5+ days, generate an extra post for urgency
        if (daysSinceLastPost >= 5 && postIds.length > 0) {
            const extraPlatform = platforms[(new Date().getDay() + 1) % platforms.length]
            try {
                const extraPostId = await socialAgent.createPostDraft(
                    extraPlatform,
                    ['deals', 'audio equipment', 'home automation'],
                )

                postIds.push(extraPostId)
                await socialAgent.createApprovalTask(extraPostId)

                await logToSquadMessages(
                    'Social Media Agent',
                    `🚨 Social media silent for ${daysSinceLastPost} days — generated bonus ${extraPlatform} post (ID: ${extraPostId})`,
                    { post_id: extraPostId, platform: extraPlatform, urgency: 'high' }
                )
            } catch (extraError: any) {
                errors.push(`${extraPlatform} (bonus): ${extraError.message}`)
            }
        }

        await logAgentExecution('social_generate', {
            status: 'completed',
            posts_generated: postIds.length,
            days_since_last_post: daysSinceLastPost,
            errors: errors.length > 0 ? errors : undefined,
        })

        // Update agent status
        await supabase.from('squad_agents').update({
            status: 'active',
            last_active: new Date().toISOString(),
        }).eq('name', 'Social Media Agent')

        return NextResponse.json({
            success: true,
            postsGenerated: postIds.length,
            postIds,
            daysSinceLastPost,
            errors: errors.length > 0 ? errors : undefined,
            remaining: rateLimit.remaining,
        })
    } catch (error: any) {
        console.error('Social generate cron error:', error)

        await logAgentActivity({
            agentName: 'social-agent',
            logLevel: 'error',
            eventType: 'content_generation_error',
            message: `Social content generation failed: ${error.message}`,
            errorDetails: { error: error.message, stack: error.stack },
            context: { action: 'generate_error' },
        })

        await logToSquadMessages(
            'Social Media Agent',
            `❌ Content generation cycle failed: ${error.message}`,
            { error: error.message }
        )

        return NextResponse.json(
            { error: 'Social content generation failed', details: error.message },
            { status: 500 }
        )
    }
}
