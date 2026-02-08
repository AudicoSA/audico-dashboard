export const PLATFORMS = ['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok', 'youtube'] as const
export type Platform = typeof PLATFORMS[number]

export const POST_STATUS = ['draft', 'scheduled', 'published', 'failed'] as const
export type PostStatus = typeof POST_STATUS[number]

export const HOME_AUTOMATION_KEYWORDS = [
  'smart home',
  'home automation',
  'smart lighting',
  'smart security',
  'voice control',
  'smart speakers',
  'connected home',
  'IoT devices',
  'smart thermostat',
  'home assistant',
  'smart locks',
  'smart cameras',
  'wireless home',
  'automated living',
  'smart devices',
  'intelligent home',
  'home control',
  'smart entertainment',
  'multiroom audio',
  'smart switches',
  'smart plugs',
  'motion sensors',
  'smart blinds',
  'smart garage',
  'energy monitoring'
]

export const PLATFORM_GUIDELINES = {
  facebook: {
    name: 'Facebook',
    maxLength: 63206,
    recommended: 400,
    tone: 'Engaging post with emojis, 1-2 paragraphs, conversational tone, includes call-to-action',
    hashtagLimit: 5,
    tips: [
      'Use emojis to add personality',
      'Ask questions to boost engagement',
      'Include a clear call-to-action',
      'Share valuable content, not just sales pitches'
    ]
  },
  instagram: {
    name: 'Instagram',
    maxLength: 2200,
    recommended: 300,
    tone: 'Visual-focused caption with 3-5 relevant hashtags, short punchy sentences, emoji-rich',
    hashtagLimit: 30,
    tips: [
      'Start with a strong hook',
      'Use line breaks for readability',
      '3-5 hashtags work best',
      'Encourage saves and shares'
    ]
  },
  twitter: {
    name: 'Twitter/X',
    maxLength: 280,
    recommended: 280,
    tone: 'Concise tweet under 280 characters, 1-2 hashtags, engaging hook',
    hashtagLimit: 2,
    tips: [
      'Front-load the most important info',
      'Use 1-2 hashtags max',
      'Ask questions or share hot takes',
      'Thread longer content'
    ]
  },
  linkedin: {
    name: 'LinkedIn',
    maxLength: 3000,
    recommended: 1300,
    tone: 'Professional tone, value-driven content, 2-3 paragraphs, business benefits focused',
    hashtagLimit: 5,
    tips: [
      'Lead with value proposition',
      'Focus on business benefits',
      'Use professional language',
      'Share insights and expertise'
    ]
  },
  tiktok: {
    name: 'TikTok',
    maxLength: 2200,
    recommended: 150,
    tone: 'Short, trendy caption with viral potential, youth-oriented language, 3-5 hashtags',
    hashtagLimit: 10,
    tips: [
      'Keep it short and punchy',
      'Use trending sounds/hashtags',
      'Create curiosity gap',
      'Encourage duets and stitches'
    ]
  },
  youtube: {
    name: 'YouTube',
    maxLength: 5000,
    recommended: 1000,
    tone: 'Compelling video description, keyword-rich, includes timestamps and links',
    hashtagLimit: 15,
    tips: [
      'First 2-3 lines are crucial',
      'Include timestamps for longer videos',
      'Add relevant links',
      'Use keywords naturally'
    ]
  }
} as const

export function getRandomKeywords(count: number = 3): string[] {
  const shuffled = [...HOME_AUTOMATION_KEYWORDS].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, count)
}

export function getPlatformGuideline(platform: Platform) {
  return PLATFORM_GUIDELINES[platform] || PLATFORM_GUIDELINES.facebook
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

export function formatScheduledDate(date: Date): string {
  return date.toISOString()
}

export function isValidPlatform(platform: string): platform is Platform {
  return PLATFORMS.includes(platform as Platform)
}

export function isValidStatus(status: string): status is PostStatus {
  return POST_STATUS.includes(status as PostStatus)
}

export function getPostPreview(content: string, length: number = 100): string {
  return truncateText(content, length)
}

export function generateScheduleDates(count: number, startDate?: Date): Date[] {
  const dates: Date[] = []
  const start = startDate || new Date()
  
  for (let i = 0; i < count; i++) {
    const date = new Date(start)
    date.setDate(date.getDate() + i + 1)
    date.setHours(10, 0, 0, 0)
    dates.push(date)
  }
  
  return dates
}

export function calculateEngagementRate(engagement: { likes: number; comments: number; shares: number }, followers?: number): number {
  if (!followers || followers === 0) return 0
  const totalEngagement = engagement.likes + engagement.comments + engagement.shares
  return (totalEngagement / followers) * 100
}

export function extractHashtags(content: string): string[] {
  const hashtagRegex = /#[\w]+/g
  return content.match(hashtagRegex) || []
}

export function countHashtags(content: string): number {
  return extractHashtags(content).length
}

export function validatePostLength(content: string, platform: Platform): { valid: boolean; message?: string } {
  const guideline = getPlatformGuideline(platform)
  
  if (content.length > guideline.maxLength) {
    return {
      valid: false,
      message: `Content exceeds ${platform} maximum length of ${guideline.maxLength} characters`
    }
  }
  
  if (content.length > guideline.recommended) {
    return {
      valid: true,
      message: `Content is longer than recommended ${guideline.recommended} characters for ${platform}`
    }
  }
  
  return { valid: true }
}
