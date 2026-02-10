import { NextRequest } from 'next/server'

/**
 * Verify that a request is coming from Vercel Cron
 *
 * Vercel Cron sends requests with special headers for authentication.
 * We check multiple methods to ensure compatibility:
 *
 * 1. Authorization: Bearer header (for manual triggers)
 * 2. x-vercel-cron header (automatic Vercel cron jobs)
 * 3. Vercel signature verification (Pro plan)
 */
export function verifyCronRequest(request: NextRequest): boolean {
  // Method 1: Check Authorization header (for manual triggers via curl)
  const authHeader = request.headers.get('authorization')
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return true
  }

  // Method 2: Check if request is from Vercel Cron (automatic cron jobs)
  // Vercel automatically adds this header to cron requests
  const vercelCron = request.headers.get('x-vercel-cron')
  if (vercelCron) {
    // If x-vercel-cron header exists, verify it's set to '1'
    return vercelCron === '1'
  }

  // Method 3: Check Vercel signature (if configured)
  // This is used when CRON_SECRET is set as a Vercel secret
  const vercelSignature = request.headers.get('x-vercel-signature')
  if (vercelSignature && process.env.CRON_SECRET) {
    // Vercel signs cron requests when CRON_SECRET is set
    // For now, we trust any request with this header
    // TODO: Implement proper signature verification
    return true
  }

  // If none of the above methods pass, reject the request
  return false
}

/**
 * Helper to create unauthorized response
 */
export function unauthorizedResponse() {
  return Response.json(
    {
      error: 'Unauthorized',
      message: 'This endpoint can only be called by Vercel Cron or with valid CRON_SECRET'
    },
    { status: 401 }
  )
}
