/**
 * SEO Audit Cron Route
 *
 * Runs weekly on Monday at 6 AM SAST (0 4 * * 1 UTC).
 * Performs rotating batch product audits, checks Core Web Vitals,
 * reviews schema coverage, and creates tasks for issues found.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth'
import { checkRateLimit, logAgentExecution } from '@/lib/rate-limiter'
import { logAgentActivity, logToSquadMessages } from '@/lib/logger'
import { seoHandler } from '@/services/execution-handlers/seo-handler'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
    return NextResponse.json({
        status: 'seo-audit-active',
        message: 'SEO audit cron ready',
        timestamp: new Date().toISOString(),
    })
}

export async function POST(request: NextRequest) {
    if (!verifyCronRequest(request)) {
        return unauthorizedResponse()
    }

    try {
        const rateLimit = await checkRateLimit({
            agentName: 'seo_audit',
            maxExecutions: 1,
            windowSeconds: 86400,
        })

        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: 'Rate limit exceeded', remaining: rateLimit.remaining },
                { status: 429 }
            )
        }

        await logAgentActivity({
            agentName: 'seo-agent',
            logLevel: 'info',
            eventType: 'weekly_audit_start',
            message: 'Weekly SEO audit cycle started',
            context: { action: 'audit_start' },
        })

        await logToSquadMessages(
            'SEO Agent',
            '🔍 Starting weekly SEO audit cycle'
        )

        const results: any = {
            product_audit: null,
            vitals_check: null,
            schema_check: null,
            tasks_created: 0,
            errors: [] as string[],
        }

        // ================================================================
        // 1. Product SEO Audit — batch of 10 products
        // ================================================================
        try {
            const now = new Date().toISOString()
            const auditTask = {
                id: crypto.randomUUID(),
                title: 'SEO: audit_products (weekly batch)',
                description: 'Weekly rotating batch product SEO audit',
                status: 'in_progress' as const,
                assigned_agent: 'seo-agent',
                priority: 'medium' as const,
                mentions_kenny: false,
                requires_approval: false,
                execution_attempts: 0,
                created_at: now,
                updated_at: now,
                metadata: {
                    action: 'audit_products',
                    limit: 10,
                    applyFixes: false,
                },
            }

            const auditResult = await seoHandler(auditTask)
            results.product_audit = {
                success: auditResult.success,
                tokens_used: auditResult.tokens_used,
            }

            if (auditResult.success) {
                await logToSquadMessages(
                    'SEO Agent',
                    `✅ Product audit complete — ${auditResult.tokens_used || 0} tokens used`,
                    { data: auditResult.data }
                )
            } else {
                results.errors.push(`Product audit: ${auditResult.error}`)
            }
        } catch (auditError: any) {
            results.errors.push(`Product audit: ${auditError.message}`)
            results.product_audit = { success: false, error: auditError.message }
        }

        // ================================================================
        // 2. Core Web Vitals check for the main site
        // ================================================================
        try {
            const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.audicoonline.co.za'
            const now = new Date().toISOString()
            const vitalsTask = {
                id: crypto.randomUUID(),
                title: 'SEO: check_vitals (weekly)',
                description: 'Weekly Core Web Vitals health check',
                status: 'in_progress' as const,
                assigned_agent: 'seo-agent',
                priority: 'medium' as const,
                mentions_kenny: false,
                requires_approval: false,
                execution_attempts: 0,
                created_at: now,
                updated_at: now,
                metadata: {
                    action: 'check_vitals',
                    urls: [siteUrl],
                },
            }

            const vitalsResult = await seoHandler(vitalsTask)
            results.vitals_check = {
                success: vitalsResult.success,
            }

            if (vitalsResult.success) {
                await logToSquadMessages(
                    'SEO Agent',
                    `✅ Core Web Vitals check complete`,
                    { data: vitalsResult.data }
                )
            } else {
                results.errors.push(`Vitals check: ${vitalsResult.error}`)
            }
        } catch (vitalsError: any) {
            results.errors.push(`Vitals check: ${vitalsError.message}`)
            results.vitals_check = { success: false, error: vitalsError.message }
        }

        // ================================================================
        // 3. Schema coverage check — find products missing Schema.org
        // ================================================================
        try {
            const { data: missingSchema, error: schemaError } = await supabase
                .from('seo_schema_audits')
                .select('id, product_id')
                .eq('has_product_schema', false)
                .limit(50)

            const missingCount = missingSchema?.length || 0
            results.schema_check = {
                products_without_schema: missingCount,
            }

            if (missingCount > 0) {
                // Create a task for schema generation
                const { error: taskError } = await supabase
                    .from('squad_tasks')
                    .insert({
                        title: `Generate Schema.org for ${missingCount} products`,
                        description: `${missingCount} products are missing Schema.org markup, which prevents Google rich snippets. Run generate_schema to fix this.`,
                        status: 'new',
                        assigned_agent: 'SEO Agent',
                        priority: missingCount > 20 ? 'high' : 'medium',
                        mentions_kenny: false,
                        metadata: { action: 'generate_schema', product_count: missingCount },
                    })

                if (!taskError) {
                    results.tasks_created++
                    await logToSquadMessages(
                        'SEO Agent',
                        `📋 Created task: Generate schema for ${missingCount} untagged products`,
                        { missing_count: missingCount }
                    )
                }
            } else {
                await logToSquadMessages(
                    'SEO Agent',
                    '✅ All products have Schema.org markup — no action needed'
                )
            }
        } catch (schemaCheckError: any) {
            results.errors.push(`Schema check: ${schemaCheckError.message}`)
        }

        // ================================================================
        // Summary
        // ================================================================
        const summaryParts = []
        if (results.product_audit?.success) summaryParts.push('✅ Product audit')
        if (results.vitals_check?.success) summaryParts.push('✅ Vitals check')
        if (results.schema_check) summaryParts.push(`Schema gaps: ${results.schema_check.products_without_schema}`)
        if (results.tasks_created > 0) summaryParts.push(`${results.tasks_created} tasks created`)
        if (results.errors.length > 0) summaryParts.push(`${results.errors.length} errors`)

        await logToSquadMessages(
            'SEO Agent',
            `🔍 Weekly audit complete: ${summaryParts.join(' | ')}`,
            results
        )

        await logAgentExecution('seo_audit', {
            status: 'completed',
            ...results,
        })

        // Update agent status
        await supabase.from('squad_agents').update({
            status: 'active',
            last_active: new Date().toISOString(),
        }).eq('name', 'SEO Agent')

        return NextResponse.json({
            success: true,
            ...results,
            remaining: rateLimit.remaining,
        })
    } catch (error: any) {
        console.error('SEO audit cron error:', error)

        await logAgentActivity({
            agentName: 'seo-agent',
            logLevel: 'error',
            eventType: 'weekly_audit_error',
            message: `SEO weekly audit failed: ${error.message}`,
            errorDetails: { error: error.message, stack: error.stack },
            context: { action: 'audit_error' },
        })

        await logToSquadMessages(
            'SEO Agent',
            `❌ Weekly audit cycle failed: ${error.message}`,
            { error: error.message }
        )

        return NextResponse.json(
            { error: 'SEO audit cycle failed', details: error.message },
            { status: 500 }
        )
    }
}
