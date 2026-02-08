import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(
        new URL(`/social/connect?error=${error}`, request.url)
      )
    }

    if (!code) {
      const clientId = process.env.FACEBOOK_APP_ID!
      const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/social/oauth/facebook`
      const scope = 'pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish'

      const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&response_type=code`

      return NextResponse.redirect(authUrl)
    }

    const clientId = process.env.FACEBOOK_APP_ID!
    const clientSecret = process.env.FACEBOOK_APP_SECRET!
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/social/oauth/facebook`

    const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${clientId}&client_secret=${clientSecret}&code=${code}&redirect_uri=${encodeURIComponent(redirectUri)}`

    const tokenResponse = await fetch(tokenUrl)
    const tokenData = await tokenResponse.json()

    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error(tokenData.error?.message || 'Failed to exchange code for token')
    }

    const userToken = tokenData.access_token

    const userResponse = await fetch(
      `https://graph.facebook.com/v18.0/me?fields=id,name,accounts{id,name,access_token}&access_token=${userToken}`
    )
    const userData = await userResponse.json()

    if (!userResponse.ok) {
      throw new Error(userData.error?.message || 'Failed to fetch user data')
    }

    const accounts = userData.accounts?.data || []
    
    const accountsData = encodeURIComponent(
      JSON.stringify({
        user_id: userData.id,
        user_name: userData.name,
        pages: accounts.map((page: any) => ({
          id: page.id,
          name: page.name,
          access_token: page.access_token,
        })),
      })
    )

    return NextResponse.redirect(
      new URL(`/social/connect?platform=facebook&data=${accountsData}`, request.url)
    )
  } catch (error) {
    console.error('Facebook OAuth error:', error)
    return NextResponse.redirect(
      new URL(
        `/social/connect?error=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`,
        request.url
      )
    )
  }
}
