/**
 * Marketing Check Cron Route
 *
 * Runs daily at 10 AM SAST (0 8 * * * UTC).
 * Checks for pending reseller applications, overdue newsletters,
 * and un-contacted influencers, then creates tasks as needed.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth'
import { checkRateLimit, logAgentExecution } from '@/lib/rate-limiter'
import { logAgentActivity, logToSquadMessages } from '@/lib/logger'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
    return NextResponse.json({
        status: 'marketing-check-active',
        message: 'Marketing check cron ready',
        timestamp: new Date().toISOString(),
    })
}

export async function POST(request: NextRequest) {
    if (!verifyCronRequest(request)) {
        return unauthorizedResponse()
    }

    try {
        const rateLimit = await checkRateLimit({
            agentName: 'marketing_check',
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
            agentName: 'marketing-agent',
            logLevel: 'info',
            eventType: 'daily_check_start',
            message: 'Daily marketing check started',
            context: { action: 'check_start' },
        })

        await logToSquadMessages(
            'Marketing Agent',
            '📊 Starting daily marketing pipeline check'
        )

        const tasksCreated: any[] = []
        const errors: string[] = []

        // Get existing active tasks to avoid duplicates
        const { data: activeTasks } = await supabase
            .from('squad_tasks')
            .select('title, assigned_agent, status')
            .eq('assigned_agent', 'Marketing Agent')
            .in('status', ['new', 'in_progress'])

        const activeTaskTitles = activeTasks?.map((t: any) => t.title.toLowerCase()) || []

        // ================================================================
        // 1. Check for pending reseller applications
        // ================================================================
        try {
            const { data: pendingApps, error: appsError } = await supabase
                .from('reseller_applications')
                .select('id, company_name, contact_name, contact_email, created_at')
                .eq('status', 'pending')

            if (!appsError && pendingApps && pendingApps.length > 0) {
                for (const app of pendingApps) {
                    const taskTitle = `Process reseller application: ${app.company_name}`

                    // Skip if a similar task already exists
                    if (activeTaskTitles.some((t: string) => t.includes(app.company_name.toLowerCase()))) {
                        continue
                    }

                    const { data: task, error: taskError } = await supabase
                        .from('squad_tasks')
                        .insert({
                            title: taskTitle,
                            description: `New reseller application from ${app.company_name} (${app.contact_name}, ${app.contact_email}). Review their business details and determine reseller tier and pricing.`,
                            status: 'new',
                            assigned_agent: 'Marketing Agent',
                            priority: 'high',
                            mentions_kenny: true,
                            metadata: {
                                action: 'process_reseller_signup',
                                application_id: app.id,
                                company_name: app.company_name,
                            },
                        })
                        .select()
                        .single()

                    if (!taskError && task) {
                        tasksCreated.push(task)
                        await logToSquadMessages(
                            'Marketing Agent',
                            `📋 Created task: Process reseller application from ${app.company_name}`,
                            { application_id: app.id },
                            'Jarvis'
                        )
                    }
                }
            }
        } catch (appsCheckError: any) {
            errors.push(`Reseller check: ${appsCheckError.message}`)
        }

        // ================================================================
        // 2. Check if newsletter is overdue (14+ days)
        // ================================================================
        try {
            const { data: lastNewsletter } = await supabase
                .from('newsletter_drafts')
                .select('id, status, created_at')
                .eq('status', 'sent')
                .order('created_at', { ascending: false })
                .limit(1)

            const lastSentDate = lastNewsletter?.[0]?.created_at
            const daysSinceNewsletter = lastSentDate
                ? Math.floor((Date.now() - new Date(lastSentDate).getTime()) / (1000 * 60 * 60 * 24))
                : 999

            if (daysSinceNewsletter >= 14) {
                const taskTitle = 'Generate newsletter draft'

                if (!activeTaskTitles.some((t: string) => t.includes('newsletter'))) {
                    // Check for existing drafts that haven't been sent
                    const { data: existingDrafts } = await supabase
                        .from('newsletter_drafts')
                        .select('id')
                        .eq('status', 'draft')
                        .limit(1)

                    if (!existingDrafts || existingDrafts.length === 0) {
                        const { data: task, error: taskError } = await supabase
                            .from('squad_tasks')
                            .insert({
                                title: taskTitle,
                                description: `It's been ${daysSinceNewsletter} days since the last newsletter was sent. Generate a new newsletter draft with trending products, latest deals, and company updates.`,
                                status: 'new',
                                assigned_agent: 'Marketing Agent',
                                priority: daysSinceNewsletter >= 30 ? 'high' : 'medium',
                                mentions_kenny: true,
                                metadata: {
                                    action: 'generate_newsletter',
                                    days_since_last: daysSinceNewsletter,
                                },
                            })
                            .select()
                            .single()

                        if (!taskError && task) {
                            tasksCreated.push(task)
                            await logToSquadMessages(
                                'Marketing Agent',
                                `📋 Newsletter overdue (${daysSinceNewsletter} days) — created draft generation task`,
                                { days_since_last: daysSinceNewsletter }
                            )
                        }
                    }
                }
            }
        } catch (newsletterError: any) {
            errors.push(`Newsletter check: ${newsletterError.message}`)
        }

        // ================================================================
        // 3. Check for un-contacted influencers
        // ================================================================
        try {
            const { data: uncontacted } = await supabase
                .from('influencer_opportunities')
                .select('id, status')
                .neq('status', 'contacted')
                .neq('status', 'rejected')
                .limit(20)

            const uncontactedCount = uncontacted?.length || 0

            if (uncontactedCount > 0) {
                const taskTitle = `Send influencer outreach (${uncontactedCount} pending)`

                if (!activeTaskTitles.some((t: string) => t.includes('influencer'))) {
                    const { data: task, error: taskError } = await supabase
                        .from('squad_tasks')
                        .insert({
                            title: taskTitle,
                            description: `${uncontactedCount} influencer opportunities haven't been contacted yet. Send outreach emails to these potential brand ambassadors.`,
                            status: 'new',
                            assigned_agent: 'Marketing Agent',
                            priority: 'low',
                            mentions_kenny: false,
                            metadata: {
                                action: 'influencer_outreach',
                                uncontacted_count: uncontactedCount,
                            },
                        })
                        .select()
                        .single()

                    if (!taskError && task) {
                        tasksCreated.push(task)
                        await logToSquadMessages(
                            'Marketing Agent',
                            `📋 Created task: Send outreach to ${uncontactedCount} influencers`,
                            { uncontacted_count: uncontactedCount }
                        )
                    }
                }
            }
        } catch (influencerError: any) {
            errors.push(`Influencer check: ${influencerError.message}`)
        }

        // ================================================================
        // Summary
        // ================================================================
        const summary = tasksCreated.length > 0
            ? `Created ${tasksCreated.length} task(s): ${tasksCreated.map((t: any) => t.title).join(', ')}`
            : 'No new marketing actions needed'

        await logToSquadMessages(
            'Marketing Agent',
            `📊 Daily check complete: ${summary}${errors.length > 0 ? ` | ${errors.length} errors` : ''}`,
            { tasks_created: tasksCreated.length, errors }
        )

        await logAgentExecution('marketing_check', {
            status: 'completed',
            tasks_created: tasksCreated.length,
            errors: errors.length > 0 ? errors : undefined,
        })

        // Update agent status
        await supabase.from('squad_agents').update({
            status: 'active',
            last_active: new Date().toISOString(),
        }).eq('name', 'Marketing Agent')

        return NextResponse.json({
            success: true,
            tasksCreated: tasksCreated.length,
            tasks: tasksCreated,
            errors: errors.length > 0 ? errors : undefined,
            remaining: rateLimit.remaining,
        })
    } catch (error: any) {
        console.error('Marketing check cron error:', error)

        await logAgentActivity({
            agentName: 'marketing-agent',
            logLevel: 'error',
            eventType: 'daily_check_error',
            message: `Marketing daily check failed: ${error.message}`,
            errorDetails: { error: error.message, stack: error.stack },
            context: { action: 'check_error' },
        })

        await logToSquadMessages(
            'Marketing Agent',
            `❌ Daily check failed: ${error.message}`,
            { error: error.message }
        )

        return NextResponse.json(
            { error: 'Marketing check failed', details: error.message },
            { status: 500 }
        )
    }
}
