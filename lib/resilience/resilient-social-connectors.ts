import { 
  FacebookConnector, 
  InstagramConnector, 
  TwitterConnector, 
  PostResult 
} from '../social-connectors'
import { withResilience } from './index'

export class ResilientFacebookConnector extends FacebookConnector {
  async post(content: string, mediaUrls: string[] = []): Promise<PostResult> {
    return withResilience(
      'facebook-api',
      () => super.post(content, mediaUrls),
      {
        fallbackValue: {
          success: false,
          error: 'Facebook API circuit breaker is open - service temporarily unavailable',
          platform: 'facebook'
        }
      }
    )
  }

  async verifyToken(): Promise<boolean> {
    return withResilience(
      'facebook-api',
      () => super.verifyToken(),
      { 
        skipRetry: true,
        fallbackValue: false 
      }
    )
  }
}

export class ResilientInstagramConnector extends InstagramConnector {
  async post(content: string, mediaUrls: string[] = []): Promise<PostResult> {
    return withResilience(
      'instagram-api',
      () => super.post(content, mediaUrls),
      {
        fallbackValue: {
          success: false,
          error: 'Instagram API circuit breaker is open - service temporarily unavailable',
          platform: 'instagram'
        }
      }
    )
  }

  async verifyToken(): Promise<boolean> {
    return withResilience(
      'instagram-api',
      () => super.verifyToken(),
      { 
        skipRetry: true,
        fallbackValue: false 
      }
    )
  }
}

export class ResilientTwitterConnector extends TwitterConnector {
  async post(content: string, mediaUrls: string[] = []): Promise<PostResult> {
    return withResilience(
      'twitter-api',
      () => super.post(content, mediaUrls),
      {
        fallbackValue: {
          success: false,
          error: 'Twitter API circuit breaker is open - service temporarily unavailable',
          platform: 'twitter'
        }
      }
    )
  }

  async verifyToken(): Promise<boolean> {
    return withResilience(
      'twitter-api',
      () => super.verifyToken(),
      { 
        skipRetry: true,
        fallbackValue: false 
      }
    )
  }
}
