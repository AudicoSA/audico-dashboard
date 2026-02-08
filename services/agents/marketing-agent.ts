import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface GooglePlaceResult {
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

interface Product {
  id: string
  name: string
  price: number
  cost: number
  category?: string
  sku?: string
  metadata?: any
}

interface NewsletterDraft {
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

interface InfluencerOpportunity {
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

export class MarketingAgent {
  private agentName = 'marketing'

  async verifyBusinessViaGooglePlaces(
    businessName: string,
    address?: string,
    phone?: string
  ): Promise<GooglePlaceResult | null> {
    const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY

    if (!GOOGLE_PLACES_API_KEY) {
      console.error('Google Places API key not configured')
      throw new Error('Google Places API key not configured')
    }

    try {
      const searchQuery = address 
        ? `${businessName} ${address}`
        : businessName

      const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(searchQuery)}&inputtype=textquery&fields=place_id,name,formatted_address,business_status,types&key=${GOOGLE_PLACES_API_KEY}`
      
      const searchResponse = await fetch(searchUrl)
      const searchData = await searchResponse.json()

      if (!searchData.candidates || searchData.candidates.length === 0) {
        return null
      }

      const placeId = searchData.candidates[0].place_id

      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,business_status,types,rating,user_ratings_total,website,formatted_phone_number&key=${GOOGLE_PLACES_API_KEY}`
      
      const detailsResponse = await fetch(detailsUrl)
      const detailsData = await detailsResponse.json()

      if (!detailsData.result) {
        return null
      }

      const result = detailsData.result
      const verified = result.business_status === 'OPERATIONAL' && 
                      (result.user_ratings_total || 0) > 0

      return {
        name: result.name,
        formatted_address: result.formatted_address,
        business_status: result.business_status,
        place_id: placeId,
        types: result.types || [],
        rating: result.rating,
        user_ratings_total: result.user_ratings_total,
        website: result.website,
        formatted_phone_number: result.formatted_phone_number,
        verified
      }
    } catch (error) {
      console.error('Error verifying business via Google Places:', error)
      throw error
    }
  }

  async processResellerSignup(applicationId: string): Promise<void> {
    try {
      const { data: application, error: fetchError } = await supabase
        .from('reseller_applications')
        .select('*')
        .eq('id', applicationId)
        .single()

      if (fetchError || !application) {
        throw new Error(`Failed to fetch application: ${fetchError?.message}`)
      }

      await supabase
        .from('reseller_applications')
        .update({ status: 'under_review' })
        .eq('id', applicationId)

      let googlePlaceData: GooglePlaceResult | null = null
      try {
        googlePlaceData = await this.verifyBusinessViaGooglePlaces(
          application.company_name,
          application.business_details?.address,
          application.contact_phone
        )
      } catch (error) {
        console.error('Google Places verification failed:', error)
      }

      const businessDetails = {
        ...application.business_details,
        google_verification: googlePlaceData ? {
          verified: googlePlaceData.verified,
          place_id: googlePlaceData.place_id,
          business_status: googlePlaceData.business_status,
          google_name: googlePlaceData.name,
          google_address: googlePlaceData.formatted_address,
          google_rating: googlePlaceData.rating,
          google_reviews: googlePlaceData.user_ratings_total,
          google_website: googlePlaceData.website,
          google_phone: googlePlaceData.formatted_phone_number,
          verified_at: new Date().toISOString()
        } : {
          verified: false,
          error: 'Business not found on Google Places',
          verified_at: new Date().toISOString()
        }
      }

      const newStatus = googlePlaceData?.verified ? 'approved' : 'on_hold'
      const approvalNotes = googlePlaceData?.verified
        ? 'Business verified via Google Places API'
        : 'Business could not be verified on Google Places - requires manual review'

      await supabase
        .from('reseller_applications')
        .update({
          status: newStatus,
          reviewed_by: this.agentName,
          reviewed_at: new Date().toISOString(),
          approval_notes: approvalNotes,
          business_details: businessDetails
        })
        .eq('id', applicationId)

      await this.logActivity(
        'reseller_signup_processed',
        `Processed reseller signup for ${application.company_name}`,
        { 
          application_id: applicationId,
          verification_status: googlePlaceData?.verified ? 'verified' : 'unverified',
          new_status: newStatus
        }
      )
    } catch (error) {
      console.error('Error processing reseller signup:', error)
      throw error
    }
  }

  async calculateResellerPricing(): Promise<Array<Product & { reseller_price: number, margin: number }>> {
    try {
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, price, cost, category, sku, metadata')

      if (error) {
        console.error('Error fetching products:', error)
        return []
      }

      if (!products || products.length === 0) {
        return []
      }

      return products.map((product: any) => {
        const cost = product.cost || product.price * 0.6
        const resellerPrice = cost * 1.10
        const margin = ((resellerPrice - cost) / resellerPrice) * 100

        return {
          ...product,
          reseller_price: Math.round(resellerPrice * 100) / 100,
          margin: Math.round(margin * 100) / 100
        }
      })
    } catch (error) {
      console.error('Error calculating reseller pricing:', error)
      throw error
    }
  }

  async getTrendingProductsFromSEO(limit: number = 10): Promise<any[]> {
    try {
      const { data: audits, error } = await supabase
        .from('seo_audits')
        .select('*')
        .eq('status', 'completed')
        .not('metrics', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('Error fetching SEO audits:', error)
        return []
      }

      if (!audits || audits.length === 0) {
        return []
      }

      const productMentions: { [key: string]: any } = {}

      audits.forEach((audit: any) => {
        const metrics = audit.metrics || {}
        const keywords = metrics.keywords || []
        const topPages = metrics.top_pages || []
        
        keywords.forEach((keyword: any) => {
          const keywordText = typeof keyword === 'string' ? keyword : keyword.term || ''
          const volume = typeof keyword === 'object' ? keyword.volume || 1 : 1
          
          if (keywordText.length > 0) {
            if (!productMentions[keywordText]) {
              productMentions[keywordText] = {
                keyword: keywordText,
                mentions: 0,
                total_volume: 0,
                urls: []
              }
            }
            productMentions[keywordText].mentions += 1
            productMentions[keywordText].total_volume += volume
            if (audit.url && !productMentions[keywordText].urls.includes(audit.url)) {
              productMentions[keywordText].urls.push(audit.url)
            }
          }
        })
      })

      const trending = Object.values(productMentions)
        .sort((a: any, b: any) => {
          const scoreA = a.mentions * Math.log(a.total_volume + 1)
          const scoreB = b.mentions * Math.log(b.total_volume + 1)
          return scoreB - scoreA
        })
        .slice(0, limit)

      return trending
    } catch (error) {
      console.error('Error getting trending products from SEO:', error)
      return []
    }
  }

  async generateNewsletterDraft(): Promise<NewsletterDraft | null> {
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

    if (!ANTHROPIC_API_KEY) {
      console.error('Anthropic API key not configured')
      throw new Error('Anthropic API key not configured')
    }

    try {
      const trendingData = await this.getTrendingProductsFromSEO(15)
      const resellerPricing = await this.calculateResellerPricing()
      
      const topProducts = resellerPricing
        .slice(0, 10)
        .map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          category: p.category
        }))

      const trendingKeywords = trendingData.map((t: any) => t.keyword)
      
      const prompt = `You are a marketing expert creating a newsletter for an e-commerce business. 

Based on the following data, create an engaging newsletter:

TRENDING TOPICS (from SEO data):
${trendingData.map((t: any) => `- ${t.keyword} (${t.mentions} mentions, volume: ${t.total_volume})`).join('\n')}

TOP PRODUCTS TO FEATURE:
${topProducts.map(p => `- ${p.name} - R${p.price} (${p.category || 'General'})`).join('\n')}

Please create:
1. A catchy subject line (max 60 characters)
2. Newsletter content in HTML format with:
   - Engaging introduction referencing trending topics
   - Featured products section highlighting 3-5 products
   - Call-to-action buttons
   - Professional styling

Format your response as JSON:
{
  "subject": "subject line here",
  "html_content": "full HTML newsletter here",
  "text_preview": "preview text for email clients"
}`

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      })

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.statusText}`)
      }

      const data = await response.json()
      const content = data.content[0].text
      
      let newsletterData
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          newsletterData = JSON.parse(jsonMatch[0])
        } else {
          newsletterData = {
            subject: 'New Products & Trending Items',
            html_content: content,
            text_preview: 'Check out our latest products'
          }
        }
      } catch {
        newsletterData = {
          subject: 'New Products & Trending Items',
          html_content: content,
          text_preview: 'Check out our latest products'
        }
      }

      const draft: NewsletterDraft = {
        subject: newsletterData.subject,
        content: newsletterData.html_content,
        products: topProducts.slice(0, 5).map((p, idx) => ({
          ...p,
          trending_score: trendingData[idx]?.mentions || 0
        })),
        metadata: {
          generated_at: new Date().toISOString(),
          trending_keywords: trendingKeywords.slice(0, 10),
          seo_insights: trendingData.slice(0, 5).map((t: any) => 
            `${t.keyword}: ${t.mentions} mentions across ${t.urls.length} pages`
          )
        }
      }

      await this.logActivity(
        'newsletter_draft_generated',
        `Generated newsletter draft: ${draft.subject}`,
        { 
          subject: draft.subject,
          product_count: draft.products.length,
          trending_keywords: draft.metadata.trending_keywords
        }
      )

      return draft
    } catch (error) {
      console.error('Error generating newsletter draft:', error)
      throw error
    }
  }

  async searchTechInfluencers(niche: string = 'tech', limit: number = 20): Promise<InfluencerOpportunity[]> {
    const influencers: InfluencerOpportunity[] = []

    try {
      await this.searchTwitterInfluencers(niche, influencers, Math.ceil(limit / 4))
    } catch (error) {
      console.error('Twitter search failed:', error)
    }

    try {
      await this.searchInstagramInfluencers(niche, influencers, Math.ceil(limit / 4))
    } catch (error) {
      console.error('Instagram search failed:', error)
    }

    try {
      await this.searchYouTubeInfluencers(niche, influencers, Math.ceil(limit / 4))
    } catch (error) {
      console.error('YouTube search failed:', error)
    }

    try {
      await this.searchLinkedInInfluencers(niche, influencers, Math.ceil(limit / 4))
    } catch (error) {
      console.error('LinkedIn search failed:', error)
    }

    return influencers.slice(0, limit)
  }

  private async searchTwitterInfluencers(niche: string, influencers: InfluencerOpportunity[], limit: number): Promise<void> {
    const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN

    if (!TWITTER_BEARER_TOKEN) {
      console.log('Twitter API token not configured, skipping Twitter search')
      return
    }

    try {
      const query = `${niche} tech reviewer -is:retweet`
      const response = await fetch(
        `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=10&expansions=author_id&user.fields=username,name,public_metrics,description`,
        {
          headers: {
            'Authorization': `Bearer ${TWITTER_BEARER_TOKEN}`
          }
        }
      )

      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.includes?.users) {
        data.includes.users.forEach((user: any) => {
          influencers.push({
            platform: 'twitter',
            handle: user.username,
            name: user.name,
            followers: user.public_metrics?.followers_count,
            engagement_rate: this.calculateTwitterEngagement(user.public_metrics),
            niche: niche,
            metadata: {
              description: user.description,
              verified: user.verified || false,
              tweet_count: user.public_metrics?.tweet_count
            }
          })
        })
      }
    } catch (error) {
      console.error('Twitter influencer search error:', error)
    }
  }

  private async searchInstagramInfluencers(niche: string, influencers: InfluencerOpportunity[], limit: number): Promise<void> {
    const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN

    if (!INSTAGRAM_ACCESS_TOKEN) {
      console.log('Instagram API token not configured, skipping Instagram search')
      return
    }

    try {
      const response = await fetch(
        `https://graph.instagram.com/v18.0/ig_hashtag_search?user_id=${process.env.INSTAGRAM_USER_ID}&q=${encodeURIComponent(niche)}&access_token=${INSTAGRAM_ACCESS_TOKEN}`
      )

      if (!response.ok) {
        throw new Error(`Instagram API error: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.data && data.data.length > 0) {
        for (const hashtag of data.data.slice(0, 2)) {
          const postsResponse = await fetch(
            `https://graph.instagram.com/v18.0/${hashtag.id}/top_media?user_id=${process.env.INSTAGRAM_USER_ID}&fields=username,caption,like_count,comments_count,media_type&access_token=${INSTAGRAM_ACCESS_TOKEN}`
          )
          
          if (postsResponse.ok) {
            const postsData = await postsResponse.json()
            
            if (postsData.data) {
              postsData.data.slice(0, 3).forEach((post: any) => {
                influencers.push({
                  platform: 'instagram',
                  handle: post.username,
                  name: post.username,
                  engagement_rate: this.calculateInstagramEngagement(post),
                  niche: niche,
                  metadata: {
                    media_type: post.media_type,
                    likes: post.like_count,
                    comments: post.comments_count
                  }
                })
              })
            }
          }
        }
      }
    } catch (error) {
      console.error('Instagram influencer search error:', error)
    }
  }

  private async searchYouTubeInfluencers(niche: string, influencers: InfluencerOpportunity[], limit: number): Promise<void> {
    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY

    if (!YOUTUBE_API_KEY) {
      console.log('YouTube API key not configured, skipping YouTube search')
      return
    }

    try {
      const query = `${niche} tech review`
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=channel&maxResults=${limit}&key=${YOUTUBE_API_KEY}`
      )

      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.items) {
        for (const item of data.items) {
          const channelId = item.snippet.channelId
          
          const channelResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelId}&key=${YOUTUBE_API_KEY}`
          )
          
          if (channelResponse.ok) {
            const channelData = await channelResponse.json()
            
            if (channelData.items && channelData.items.length > 0) {
              const channel = channelData.items[0]
              const stats = channel.statistics
              
              influencers.push({
                platform: 'youtube',
                handle: channel.snippet.customUrl || channelId,
                name: channel.snippet.title,
                followers: parseInt(stats.subscriberCount || '0'),
                engagement_rate: this.calculateYouTubeEngagement(stats),
                niche: niche,
                metadata: {
                  description: channel.snippet.description,
                  video_count: stats.videoCount,
                  view_count: stats.viewCount,
                  channel_url: `https://youtube.com/channel/${channelId}`
                }
              })
            }
          }
        }
      }
    } catch (error) {
      console.error('YouTube influencer search error:', error)
    }
  }

  private async searchLinkedInInfluencers(niche: string, influencers: InfluencerOpportunity[], limit: number): Promise<void> {
    const LINKEDIN_ACCESS_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN

    if (!LINKEDIN_ACCESS_TOKEN) {
      console.log('LinkedIn API token not configured, skipping LinkedIn search')
      return
    }

    try {
      const response = await fetch(
        `https://api.linkedin.com/v2/search?q=people&keywords=${encodeURIComponent(niche + ' tech')}&count=${limit}`,
        {
          headers: {
            'Authorization': `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
            'X-Restli-Protocol-Version': '2.0.0'
          }
        }
      )

      if (!response.ok) {
        throw new Error(`LinkedIn API error: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.elements) {
        data.elements.forEach((person: any) => {
          influencers.push({
            platform: 'linkedin',
            handle: person.publicIdentifier || person.id,
            name: `${person.firstName} ${person.lastName}`,
            niche: niche,
            metadata: {
              headline: person.headline,
              profile_url: person.publicProfileUrl
            }
          })
        })
      }
    } catch (error) {
      console.error('LinkedIn influencer search error:', error)
    }
  }

  private calculateTwitterEngagement(metrics: any): number {
    if (!metrics) return 0
    const followers = metrics.followers_count || 1
    const tweets = metrics.tweet_count || 0
    return Math.min(((tweets / followers) * 100), 100)
  }

  private calculateInstagramEngagement(post: any): number {
    const likes = post.like_count || 0
    const comments = post.comments_count || 0
    return ((likes + comments * 2) / 100)
  }

  private calculateYouTubeEngagement(stats: any): number {
    const subscribers = parseInt(stats.subscriberCount || '1')
    const views = parseInt(stats.viewCount || '0')
    const videos = parseInt(stats.videoCount || '1')
    const avgViews = views / videos
    return Math.min((avgViews / subscribers) * 100, 100)
  }

  async storeInfluencerOpportunities(influencers: InfluencerOpportunity[]): Promise<void> {
    try {
      for (const influencer of influencers) {
        const taskTitle = `Reach out to ${influencer.name} (${influencer.platform})`
        const taskDescription = `Contact ${influencer.platform} influencer @${influencer.handle} for potential collaboration.
        
Followers: ${influencer.followers?.toLocaleString() || 'Unknown'}
Engagement Rate: ${influencer.engagement_rate?.toFixed(2)}%
Niche: ${influencer.niche}
${influencer.metadata?.channel_url || influencer.metadata?.profile_url || ''}`

        await supabase
          .from('squad_tasks')
          .insert({
            title: taskTitle,
            description: taskDescription,
            status: 'new',
            assigned_agent: this.agentName,
            priority: influencer.followers && influencer.followers > 100000 ? 'high' : 'medium',
            mentions_kenny: false,
            deliverable_url: influencer.metadata?.channel_url || influencer.metadata?.profile_url || null
          })

        await this.logActivity(
          'influencer_opportunity_created',
          `Created task to reach out to ${influencer.name} on ${influencer.platform}`,
          {
            influencer_handle: influencer.handle,
            platform: influencer.platform,
            followers: influencer.followers,
            engagement_rate: influencer.engagement_rate
          }
        )
      }
    } catch (error) {
      console.error('Error storing influencer opportunities:', error)
      throw error
    }
  }

  async findAndStoreInfluencers(niches: string[] = ['tech', 'audio', 'smart home']): Promise<void> {
    const allInfluencers: InfluencerOpportunity[] = []

    for (const niche of niches) {
      try {
        const influencers = await this.searchTechInfluencers(niche, 10)
        allInfluencers.push(...influencers)
      } catch (error) {
        console.error(`Error searching influencers for niche ${niche}:`, error)
      }
    }

    const uniqueInfluencers = allInfluencers.filter((influencer, index, self) =>
      index === self.findIndex((i) => 
        i.platform === influencer.platform && i.handle === influencer.handle
      )
    )

    await this.storeInfluencerOpportunities(uniqueInfluencers)
    
    await this.logActivity(
      'influencer_search_completed',
      `Found and stored ${uniqueInfluencers.length} influencer opportunities`,
      {
        niches: niches,
        total_influencers: uniqueInfluencers.length,
        by_platform: this.groupByPlatform(uniqueInfluencers)
      }
    )
  }

  private groupByPlatform(influencers: InfluencerOpportunity[]): { [key: string]: number } {
    return influencers.reduce((acc, inf) => {
      acc[inf.platform] = (acc[inf.platform] || 0) + 1
      return acc
    }, {} as { [key: string]: number })
  }

  private async logActivity(eventType: string, message: string, context: any = {}): Promise<void> {
    try {
      await supabase
        .from('squad_messages')
        .insert({
          from_agent: this.agentName,
          to_agent: null,
          message: message,
          task_id: null,
          data: {
            event_type: eventType,
            timestamp: new Date().toISOString(),
            ...context
          }
        })
    } catch (error) {
      console.error('Error logging activity:', error)
    }
  }

  async runMarketingWorkflow(): Promise<void> {
    try {
      await this.logActivity('workflow_started', 'Marketing Agent workflow initiated')

      const pendingApplications = await supabase
        .from('reseller_applications')
        .select('id')
        .eq('status', 'pending')
        .limit(5)

      if (pendingApplications.data && pendingApplications.data.length > 0) {
        for (const app of pendingApplications.data) {
          try {
            await this.processResellerSignup(app.id)
          } catch (error) {
            console.error(`Error processing application ${app.id}:`, error)
          }
        }
      }

      try {
        await this.generateNewsletterDraft()
      } catch (error) {
        console.error('Error generating newsletter:', error)
      }

      try {
        await this.findAndStoreInfluencers()
      } catch (error) {
        console.error('Error finding influencers:', error)
      }

      await this.logActivity('workflow_completed', 'Marketing Agent workflow completed successfully')
    } catch (error) {
      console.error('Error in marketing workflow:', error)
      await this.logActivity('workflow_failed', 'Marketing Agent workflow failed', { error: String(error) })
      throw error
    }
  }
}

export default MarketingAgent
