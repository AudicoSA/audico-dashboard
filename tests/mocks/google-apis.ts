import { vi } from 'vitest'

export class MockGoogleAdsAPI {
  private campaigns: Map<string, any> = new Map()
  private queryResults: any[] = []

  setCampaigns(campaigns: any[]) {
    this.campaigns.clear()
    campaigns.forEach(campaign => {
      this.campaigns.set(campaign.campaign.id, campaign)
    })
  }

  setQueryResults(results: any[]) {
    this.queryResults = results
  }

  clearAll() {
    this.campaigns.clear()
    this.queryResults = []
  }

  createMockClient() {
    return {
      Customer: vi.fn((config: any) => ({
        query: vi.fn(async (query: string) => {
          return this.queryResults
        }),

        campaigns: {
          update: vi.fn(async (operations: any[]) => {
            operations.forEach(op => {
              const campaignId = op.resource_name.split('/').pop()
              if (this.campaigns.has(campaignId)) {
                const campaign = this.campaigns.get(campaignId)
                Object.assign(campaign.campaign, op)
              }
            })
            return { results: operations }
          })
        }
      }))
    }
  }
}

export class MockGooglePlacesAPI {
  private places: Map<string, any> = new Map()

  setPlaces(places: any[]) {
    this.places.clear()
    places.forEach(place => {
      this.places.set(place.place_id, place)
    })
  }

  clearAll() {
    this.places.clear()
  }

  async findPlace(query: string) {
    const candidates = Array.from(this.places.values()).filter(place =>
      place.name.toLowerCase().includes(query.toLowerCase())
    )

    if (candidates.length === 0) {
      return { candidates: [] }
    }

    return {
      candidates: candidates.map(place => ({
        place_id: place.place_id,
        name: place.name,
        formatted_address: place.formatted_address,
        business_status: place.business_status,
        types: place.types
      }))
    }
  }

  async getPlaceDetails(placeId: string) {
    const place = this.places.get(placeId)
    
    if (!place) {
      return { result: null }
    }

    return { result: place }
  }
}

export class MockYouTubeAPI {
  private channels: any[] = []
  private videos: any[] = []

  setChannels(channels: any[]) {
    this.channels = channels
  }

  setVideos(videos: any[]) {
    this.videos = videos
  }

  clearAll() {
    this.channels = []
    this.videos = []
  }

  async searchChannels(query: string, maxResults: number = 5) {
    const filtered = this.channels.filter(channel =>
      channel.snippet.title.toLowerCase().includes(query.toLowerCase())
    )

    return {
      items: filtered.slice(0, maxResults)
    }
  }

  async getChannelDetails(channelId: string) {
    const channel = this.channels.find(c => c.id === channelId)
    return {
      items: channel ? [channel] : []
    }
  }
}

export const mockGoogleAdsAPI = new MockGoogleAdsAPI()
export const mockGooglePlacesAPI = new MockGooglePlacesAPI()
export const mockYouTubeAPI = new MockYouTubeAPI()
