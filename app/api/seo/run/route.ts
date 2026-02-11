/**
 * SEO Run Action API Endpoint
 *
 * Triggers SEO actions from the dashboard.
 * This forwards requests to the main SEO agent endpoint.
 */

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      )
    }

    // Get the base URL for internal API calls
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
      || (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : (process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'http://localhost:3000'))

    // Call the SEO agent endpoint with cron auth
    const authToken = process.env.CRON_SECRET

    const response = await fetch(`${baseUrl}/api/agents/seo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        action,
        limit: 10, // Limit to 10 items for manual runs
        applyFixes: false // Don't auto-apply fixes from dashboard
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.error || `SEO action failed with status ${response.status}` },
        { status: response.status }
      )
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('SEO Run API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to run SEO action' },
      { status: 500 }
    )
  }
}
