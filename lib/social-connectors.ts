export interface SocialAccount {
  id: string
  platform: 'facebook' | 'instagram' | 'twitter'
  account_id: string
  account_name: string
  access_token: string
  refresh_token?: string
  token_expires_at?: string
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

export interface PostResult {
  success: boolean
  post_id?: string
  post_url?: string
  error?: string
  platform: string
}

export interface MediaUpload {
  url: string
  type: 'image' | 'video'
}

export class FacebookConnector {
  private accessToken: string
  private pageId?: string

  constructor(accessToken: string, pageId?: string) {
    this.accessToken = accessToken
    this.pageId = pageId
  }

  async post(content: string, mediaUrls: string[] = []): Promise<PostResult> {
    try {
      if (!this.pageId) {
        throw new Error('Facebook Page ID is required')
      }

      let postData: any = {
        message: content,
        access_token: this.accessToken,
      }

      if (mediaUrls.length > 0) {
        const photoIds = await this.uploadPhotos(mediaUrls)
        
        if (photoIds.length === 1) {
          postData.url = mediaUrls[0]
        } else if (photoIds.length > 1) {
          postData.attached_media = photoIds.map((id) => ({ media_fbid: id }))
        }
      }

      const endpoint = `https://graph.facebook.com/v18.0/${this.pageId}/feed`
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Facebook API error')
      }

      return {
        success: true,
        post_id: data.id,
        post_url: `https://facebook.com/${data.id}`,
        platform: 'facebook',
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        platform: 'facebook',
      }
    }
  }

  private async uploadPhotos(urls: string[]): Promise<string[]> {
    const photoIds: string[] = []

    for (const url of urls) {
      try {
        const endpoint = `https://graph.facebook.com/v18.0/${this.pageId}/photos`
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url,
            published: false,
            access_token: this.accessToken,
          }),
        })

        const data = await response.json()
        if (data.id) {
          photoIds.push(data.id)
        }
      } catch (error) {
        console.error('Error uploading photo:', error)
      }
    }

    return photoIds
  }

  async verifyToken(): Promise<boolean> {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/me?access_token=${this.accessToken}`
      )
      return response.ok
    } catch {
      return false
    }
  }
}

export class InstagramConnector {
  private accessToken: string
  private instagramAccountId?: string

  constructor(accessToken: string, instagramAccountId?: string) {
    this.accessToken = accessToken
    this.instagramAccountId = instagramAccountId
  }

  async post(content: string, mediaUrls: string[] = []): Promise<PostResult> {
    try {
      if (!this.instagramAccountId) {
        throw new Error('Instagram Account ID is required')
      }

      if (mediaUrls.length === 0) {
        throw new Error('Instagram posts require at least one image or video')
      }

      let containerId: string

      if (mediaUrls.length === 1) {
        containerId = await this.createSingleMediaContainer(content, mediaUrls[0])
      } else {
        containerId = await this.createCarouselContainer(content, mediaUrls)
      }

      const postId = await this.publishContainer(containerId)

      return {
        success: true,
        post_id: postId,
        post_url: `https://instagram.com/p/${postId}`,
        platform: 'instagram',
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        platform: 'instagram',
      }
    }
  }

  private async createSingleMediaContainer(
    caption: string,
    mediaUrl: string
  ): Promise<string> {
    const isVideo = mediaUrl.match(/\.(mp4|mov|avi)$/i)
    const endpoint = `https://graph.facebook.com/v18.0/${this.instagramAccountId}/media`

    const params: any = {
      caption,
      access_token: this.accessToken,
    }

    if (isVideo) {
      params.media_type = 'VIDEO'
      params.video_url = mediaUrl
    } else {
      params.image_url = mediaUrl
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error?.message || 'Instagram API error')
    }

    return data.id
  }

  private async createCarouselContainer(
    caption: string,
    mediaUrls: string[]
  ): Promise<string> {
    const childrenIds: string[] = []

    for (const url of mediaUrls) {
      const isVideo = url.match(/\.(mp4|mov|avi)$/i)
      const endpoint = `https://graph.facebook.com/v18.0/${this.instagramAccountId}/media`

      const params: any = {
        access_token: this.accessToken,
        is_carousel_item: true,
      }

      if (isVideo) {
        params.media_type = 'VIDEO'
        params.video_url = url
      } else {
        params.image_url = url
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      })

      const data = await response.json()
      if (data.id) {
        childrenIds.push(data.id)
      }
    }

    const carouselEndpoint = `https://graph.facebook.com/v18.0/${this.instagramAccountId}/media`
    const response = await fetch(carouselEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        media_type: 'CAROUSEL',
        caption,
        children: childrenIds,
        access_token: this.accessToken,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error?.message || 'Instagram carousel creation error')
    }

    return data.id
  }

  private async publishContainer(containerId: string): Promise<string> {
    const endpoint = `https://graph.facebook.com/v18.0/${this.instagramAccountId}/media_publish`

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: this.accessToken,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error?.message || 'Instagram publish error')
    }

    return data.id
  }

  async verifyToken(): Promise<boolean> {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${this.instagramAccountId}?fields=id,username&access_token=${this.accessToken}`
      )
      return response.ok
    } catch {
      return false
    }
  }
}

export class TwitterConnector {
  private accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  async post(content: string, mediaUrls: string[] = []): Promise<PostResult> {
    try {
      let mediaIds: string[] = []

      if (mediaUrls.length > 0) {
        mediaIds = await this.uploadMedia(mediaUrls)
      }

      const tweetData: any = {
        text: content,
      }

      if (mediaIds.length > 0) {
        tweetData.media = {
          media_ids: mediaIds,
        }
      }

      const response = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tweetData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || errorData.title || 'Twitter API error')
      }

      const data = await response.json()

      return {
        success: true,
        post_id: data.data.id,
        post_url: `https://twitter.com/i/web/status/${data.data.id}`,
        platform: 'twitter',
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        platform: 'twitter',
      }
    }
  }

  private async uploadMedia(urls: string[]): Promise<string[]> {
    const mediaIds: string[] = []

    for (const url of urls) {
      try {
        const imageResponse = await fetch(url)
        const imageBuffer = await imageResponse.arrayBuffer()
        const base64Image = Buffer.from(imageBuffer).toString('base64')

        const uploadResponse = await fetch(
          'https://upload.twitter.com/1.1/media/upload.json',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              media_data: base64Image,
            }),
          }
        )

        const uploadData = await uploadResponse.json()
        if (uploadData.media_id_string) {
          mediaIds.push(uploadData.media_id_string)
        }
      } catch (error) {
        console.error('Error uploading media to Twitter:', error)
      }
    }

    return mediaIds
  }

  async verifyToken(): Promise<boolean> {
    try {
      const response = await fetch('https://api.twitter.com/2/users/me', {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      })
      return response.ok
    } catch {
      return false
    }
  }
}

export async function getSocialAccounts(): Promise<SocialAccount[]> {
  try {
    const response = await fetch('/api/social/accounts')
    if (!response.ok) {
      throw new Error('Failed to fetch social accounts')
    }
    return await response.json()
  } catch (error) {
    console.error('Error fetching social accounts:', error)
    return []
  }
}

export async function createConnector(
  account: SocialAccount
): Promise<FacebookConnector | InstagramConnector | TwitterConnector | null> {
  switch (account.platform) {
    case 'facebook':
      return new FacebookConnector(
        account.access_token,
        account.metadata.page_id
      )
    case 'instagram':
      return new InstagramConnector(
        account.access_token,
        account.metadata.instagram_account_id
      )
    case 'twitter':
      return new TwitterConnector(account.access_token)
    default:
      return null
  }
}
