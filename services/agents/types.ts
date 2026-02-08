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
  visual_content_url: string | null
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
  action: 'generate_post' | 'approve_post' | 'reject_post' | 'publish_post' | 'generate_bulk' | 'schedule_weekly' | 'get_scheduled' | 'generate_visual' | 'regenerate_visual'
  platform?: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'tiktok' | 'youtube'
  keywords?: string[]
  scheduledFor?: string
  productQuery?: string
  postId?: string
  reason?: string
  count?: number
  generateVisual?: boolean
  visualType?: 'infographic' | 'slide_deck' | 'video_overview'
  customPrompt?: string
}

export interface SocialAgentResponse {
  success?: boolean
  postId?: string
  taskId?: string
  postIds?: string[]
  count?: number
  posts?: SocialPost[]
  visualUrl?: string
  artifactId?: string
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

export interface GooglePlaceResult {
  name: string
  formatted_address: string
  business_status: string
  place_id: string
  types: string[]
  rating?: number
  user_ratings_total?: number
  website?: string
  formatted_phone_number?: string
  verified: boolean
}

export interface Product {
  id: string
  name: string
  price: number
  cost: number
  category?: string
  sku?: string
  metadata?: any
}

export interface ProductWithResellerPrice extends Product {
  reseller_price: number
  margin: number
}

export interface NewsletterDraft {
  subject: string
  content: string
  products: Array<{
    id: string
    name: string
    price: number
    trending_score: number
  }>
  metadata: {
    generated_at: string
    trending_keywords: string[]
    seo_insights: string[]
  }
}

export interface InfluencerOpportunity {
  platform: 'twitter' | 'instagram' | 'youtube' | 'linkedin' | 'tiktok'
  handle: string
  name: string
  followers?: number
  engagement_rate?: number
  niche?: string
  contact_info?: string
  estimated_reach?: number
  metadata?: any
}

export interface TrendingProduct {
  keyword: string
  mentions: number
  total_volume: number
  urls: string[]
}

export interface MarketingAgentAction {
  action: 
    | 'process_reseller_signup'
    | 'calculate_reseller_pricing'
    | 'generate_newsletter'
    | 'find_influencers'
    | 'search_influencers'
    | 'run_workflow'
    | 'get_trending_products'
  applicationId?: string
  niches?: string[]
  niche?: string
  limit?: number
}
