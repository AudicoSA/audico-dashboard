import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// OAuth 2.0 with PKCE
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(
        new URL(`/social/connect?error=${encodeURIComponent(error)}`, request.url)
      )
    }

    // If no code, initiate OAuth flow
    if (!code || !state) {
      return await initiateTwitterOAuth2(request)
    }

    // Verify state and get PKCE verifier
    const { data: pkceData, error: fetchError } = await supabase
      .from('oauth_temp_tokens')
      .select('*')
      .eq('oauth_token', state)
      .single()

    if (fetchError || !pkceData) {
      throw new Error('Invalid or expired OAuth state')
    }

    const codeVerifier = pkceData.oauth_token_secret

    // Exchange code for access token
    const clientId = process.env.TWITTER_CLIENT_ID!
    const clientSecret = process.env.TWITTER_CLIENT_SECRET!
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/social/oauth/twitter`

    const tokenUrl = 'https://api.twitter.com/2/oauth2/token'
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      throw new Error(`Token exchange failed: ${errorText}`)
    }

    const tokenData = await tokenResponse.json()

    // Get user info
    const userResponse = await fetch('https://api.twitter.com/2/users/me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    })

    if (!userResponse.ok) {
      throw new Error('Failed to fetch user info')
    }

    const userData = await userResponse.json()

    // Clean up temp token
    await supabase
      .from('oauth_temp_tokens')
      .delete()
      .eq('oauth_token', state)

    // Prepare account data
    const accountsData = encodeURIComponent(
      JSON.stringify({
        user_id: userData.data.id,
        screen_name: userData.data.username,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in,
      })
    )

    return NextResponse.redirect(
      new URL(`/social/connect?platform=twitter&data=${accountsData}`, request.url)
    )
  } catch (error) {
    console.error('Twitter OAuth 2.0 error:', error)
    return NextResponse.redirect(
      new URL(
        `/social/connect?error=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`,
        request.url
      )
    )
  }
}

async function initiateTwitterOAuth2(request: NextRequest): Promise<NextResponse> {
  const clientId = process.env.TWITTER_CLIENT_ID!
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/social/oauth/twitter`

  // Generate PKCE challenge
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)
  const state = crypto.randomBytes(32).toString('hex')

  // Store code verifier and state temporarily
  await supabase.from('oauth_temp_tokens').insert({
    oauth_token: state,
    oauth_token_secret: codeVerifier,
    platform: 'twitter',
  })

  // Build authorization URL
  const authUrl = new URL('https://twitter.com/i/oauth2/authorize')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', 'tweet.read tweet.write users.read offline.access')
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('code_challenge', codeChallenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')

  return NextResponse.redirect(authUrl.toString())
}

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url')
}

function generateCodeChallenge(verifier: string): string {
  return crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url')
}
