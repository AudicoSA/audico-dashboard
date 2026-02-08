export interface SocialPostDraft {
  platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'tiktok' | 'youtube'
  content: string
  mediaUrls?: string[]
  scheduledFor?: Date
  targetKeywords: string[]
  productContext?: any
}

export interface ProductCatalogItem {
  id: string
  name: string
  description?: string
  category?: string
  brand?: string
  price?: number
  features?: string[]
  tags?: string[]
  image_url?: string
  sku?: string
  stock_quantity?: number
  is_active?: boolean
  metadata?: any
}

export interface SocialPost {
  id: string
  platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'tiktok' | 'youtube'
  content: string
  media_urls: string[]
  status: 'draft' | 'scheduled' | 'published' | 'failed'
  scheduled_for: string | null
  published_at: string | null
  post_url: string | null
  engagement: {
    likes: number
    comments: number
    shares: number
  }
  created_by: string | null
  metadata: any
  created_at: string
  updated_at: string
}

export interface SocialAgentRequest {
  action: 'generate_post' | 'approve_post' | 'reject_post' | 'publish_post' | 'generate_bulk' | 'schedule_weekly' | 'get_scheduled'
  platform?: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'tiktok' | 'youtube'
  keywords?: string[]
  scheduledFor?: string
  productQuery?: string
  postId?: string
  reason?: string
  count?: number
}

export interface SocialAgentResponse {
  success?: boolean
  postId?: string
  taskId?: string
  postIds?: string[]
  count?: number
  posts?: SocialPost[]
  error?: string
}

export interface ScheduledPostingResult {
  success: boolean
  processed: number
  published: number
  failed: number
  errors: Array<{
    postId: string
    error: string
  }>
  timestamp: string
}
