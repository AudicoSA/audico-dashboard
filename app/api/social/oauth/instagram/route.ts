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
      const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/social/oauth/instagram`
      const scope = 'instagram_basic,instagram_content_publish,pages_read_engagement'

      const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&response_type=code`

      return NextResponse.redirect(authUrl)
    }

    const clientId = process.env.FACEBOOK_APP_ID!
    const clientSecret = process.env.FACEBOOK_APP_SECRET!
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/social/oauth/instagram`

    const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${clientId}&client_secret=${clientSecret}&code=${code}&redirect_uri=${encodeURIComponent(redirectUri)}`

    const tokenResponse = await fetch(tokenUrl)
    const tokenData = await tokenResponse.json()

    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error(tokenData.error?.message || 'Failed to exchange code for token')
    }

    const userToken = tokenData.access_token

    const pagesResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?access_token=${userToken}`
    )
    const pagesData = await pagesResponse.json()

    if (!pagesResponse.ok) {
      throw new Error(pagesData.error?.message || 'Failed to fetch pages')
    }

    const instagramAccounts: any[] = []

    for (const page of pagesData.data || []) {
      const igResponse = await fetch(
        `https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account{id,username}&access_token=${page.access_token}`
      )
      const igData = await igResponse.json()

      if (igData.instagram_business_account) {
        instagramAccounts.push({
          id: igData.instagram_business_account.id,
          username: igData.instagram_business_account.username,
          page_id: page.id,
          page_name: page.name,
          access_token: page.access_token,
        })
      }
    }

    const accountsData = encodeURIComponent(
      JSON.stringify({
        accounts: instagramAccounts,
      })
    )

    return NextResponse.redirect(
      new URL(`/social/connect?platform=instagram&data=${accountsData}`, request.url)
    )
  } catch (error) {
    console.error('Instagram OAuth error:', error)
    return NextResponse.redirect(
      new URL(
        `/social/connect?error=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`,
        request.url
      )
    )
  }
}
