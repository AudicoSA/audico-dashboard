import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const oauth_token = searchParams.get('oauth_token')
    const oauth_verifier = searchParams.get('oauth_verifier')
    const denied = searchParams.get('denied')

    if (denied) {
      return NextResponse.redirect(
        new URL(`/social/connect?error=User denied access`, request.url)
      )
    }

    if (!oauth_token || !oauth_verifier) {
      return await initiateTwitterOAuth(request)
    }

    const { data: oauthData, error: fetchError } = await supabase
      .from('oauth_temp_tokens')
      .select('*')
      .eq('oauth_token', oauth_token)
      .single()

    if (fetchError || !oauthData) {
      throw new Error('OAuth token not found or expired')
    }

    const accessTokenUrl = 'https://api.twitter.com/oauth/access_token'
    const params = new URLSearchParams({
      oauth_token,
      oauth_verifier,
    })

    const tokenResponse = await fetch(`${accessTokenUrl}?${params.toString()}`, {
      method: 'POST',
    })

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange verifier for access token')
    }

    const tokenText = await tokenResponse.text()
    const tokenParams = new URLSearchParams(tokenText)

    const accessToken = tokenParams.get('oauth_token')
    const accessTokenSecret = tokenParams.get('oauth_token_secret')
    const userId = tokenParams.get('user_id')
    const screenName = tokenParams.get('screen_name')

    if (!accessToken || !accessTokenSecret) {
      throw new Error('Invalid token response from Twitter')
    }

    await supabase
      .from('oauth_temp_tokens')
      .delete()
      .eq('oauth_token', oauth_token)

    const accountsData = encodeURIComponent(
      JSON.stringify({
        user_id: userId,
        screen_name: screenName,
        access_token: accessToken,
        access_token_secret: accessTokenSecret,
      })
    )

    return NextResponse.redirect(
      new URL(`/social/connect?platform=twitter&data=${accountsData}`, request.url)
    )
  } catch (error) {
    console.error('Twitter OAuth error:', error)
    return NextResponse.redirect(
      new URL(
        `/social/connect?error=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`,
        request.url
      )
    )
  }
}

async function initiateTwitterOAuth(request: NextRequest): Promise<NextResponse> {
  const consumerKey = process.env.TWITTER_CONSUMER_KEY!
  const consumerSecret = process.env.TWITTER_CONSUMER_SECRET!
  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/social/oauth/twitter`

  const requestTokenUrl = 'https://api.twitter.com/oauth/request_token'

  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = Math.random().toString(36).substring(2, 15)

  const params: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_nonce: nonce,
    oauth_version: '1.0',
    oauth_callback: callbackUrl,
  }

  const signature = await generateOAuthSignature(
    'POST',
    requestTokenUrl,
    params,
    consumerSecret,
    ''
  )
  params.oauth_signature = signature

  const authHeader = buildAuthorizationHeader(params)

  const response = await fetch(requestTokenUrl, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to get request token from Twitter')
  }

  const responseText = await response.text()
  const responseParams = new URLSearchParams(responseText)

  const oauthToken = responseParams.get('oauth_token')
  const oauthTokenSecret = responseParams.get('oauth_token_secret')

  if (!oauthToken || !oauthTokenSecret) {
    throw new Error('Invalid request token response')
  }

  await supabase.from('oauth_temp_tokens').insert({
    oauth_token: oauthToken,
    oauth_token_secret: oauthTokenSecret,
    platform: 'twitter',
  })

  const authorizeUrl = `https://api.twitter.com/oauth/authorize?oauth_token=${oauthToken}`
  return NextResponse.redirect(authorizeUrl)
}

async function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): Promise<string> {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&')

  const signatureBase = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`

  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`

  const crypto = await import('crypto')
  const hmac = crypto.createHmac('sha1', signingKey)
  hmac.update(signatureBase)
  return hmac.digest('base64')
}

function buildAuthorizationHeader(params: Record<string, string>): string {
  const authParams = Object.keys(params)
    .sort()
    .map((key) => `${key}="${encodeURIComponent(params[key])}"`)
    .join(', ')

  return `OAuth ${authParams}`
}
