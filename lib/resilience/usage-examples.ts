import { withResilience } from './index'
import { ResilientFacebookConnector, ResilientInstagramConnector, ResilientTwitterConnector } from './resilient-social-connectors'
import ResilientNotebookLMService from '../../services/integrations/resilient-notebooklm-service'

export async function exampleGmailAPIUsage() {
  const sendEmail = async () => {
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GMAIL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        raw: 'base64_encoded_email'
      })
    })
    
    if (!response.ok) {
      throw new Error(`Gmail API error: ${response.statusText}`)
    }
    
    return response.json()
  }

  try {
    const result = await withResilience('gmail-api', sendEmail)
    console.log('Email sent successfully:', result)
    return result
  } catch (error) {
    console.error('Failed to send email after retries:', error)
    throw error
  }
}

export async function exampleFacebookPostUsage() {
  const facebookConnector = new ResilientFacebookConnector(
    process.env.FACEBOOK_ACCESS_TOKEN!,
    process.env.FACEBOOK_PAGE_ID
  )

  const result = await facebookConnector.post(
    'Check out our latest smart home products! 🏠✨',
    ['https://example.com/product-image.jpg']
  )

  if (result.success) {
    console.log('Posted to Facebook:', result.post_url)
  } else {
    console.error('Facebook post failed:', result.error)
  }

  return result
}

export async function exampleInstagramPostUsage() {
  const instagramConnector = new ResilientInstagramConnector(
    process.env.INSTAGRAM_ACCESS_TOKEN!,
    process.env.INSTAGRAM_ACCOUNT_ID
  )

  const result = await instagramConnector.post(
    'Transform your home with smart automation! 🎯 #SmartHome #HomeAutomation',
    ['https://example.com/product-image.jpg']
  )

  if (result.success) {
    console.log('Posted to Instagram:', result.post_url)
  } else {
    console.error('Instagram post failed:', result.error)
  }

  return result
}

export async function exampleTwitterPostUsage() {
  const twitterConnector = new ResilientTwitterConnector(
    process.env.TWITTER_ACCESS_TOKEN!,
    process.env.TWITTER_ACCESS_TOKEN_SECRET!,
    process.env.TWITTER_CONSUMER_KEY!,
    process.env.TWITTER_CONSUMER_SECRET!
  )

  const result = await twitterConnector.post(
    'Upgrade your home with the latest smart automation tech! 🏠⚡',
    ['https://example.com/product-image.jpg']
  )

  if (result.success) {
    console.log('Posted to Twitter:', result.post_url)
  } else {
    console.error('Twitter post failed:', result.error)
  }

  return result
}

export async function exampleGoogleAdsUsage() {
  const monitorCampaigns = async () => {
    const response = await fetch(
      `https://googleads.googleapis.com/v14/customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/campaigns`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.GOOGLE_ADS_ACCESS_TOKEN}`,
          'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Google Ads API error: ${response.statusText}`)
    }

    return response.json()
  }

  try {
    const campaigns = await withResilience('google-ads-api', monitorCampaigns)
    console.log('Fetched campaigns:', campaigns)
    return campaigns
  } catch (error) {
    console.error('Failed to fetch campaigns:', error)
    throw error
  }
}

export async function exampleOpenCartMySQLUsage() {
  const mysql = require('mysql2/promise')

  const queryProducts = async () => {
    const connection = await mysql.createConnection({
      host: process.env.OPENCART_DB_HOST,
      user: process.env.OPENCART_DB_USER,
      password: process.env.OPENCART_DB_PASSWORD,
      database: process.env.OPENCART_DB_NAME
    })

    try {
      const [rows] = await connection.execute('SELECT * FROM oc_product LIMIT 10')
      return rows
    } finally {
      await connection.end()
    }
  }

  try {
    const products = await withResilience('opencart-mysql', queryProducts, {
      fallbackValue: []
    })
    console.log('Fetched products:', products)
    return products
  } catch (error) {
    console.error('Failed to fetch products:', error)
    return []
  }
}

export async function exampleNotebookLMUsage() {
  const notebookLM = new ResilientNotebookLMService()

  try {
    const notebook = await notebookLM.createNotebook(
      'Product Marketing Content',
      'Generate visuals for social media posts'
    )

    await notebookLM.addSources(notebook.notebookId, [
      {
        type: 'text',
        content: 'Our smart home automation products include intelligent lighting, climate control, and security systems.',
        title: 'Product Overview'
      }
    ])

    const infographicId = await notebookLM.generateInfographic(
      notebook.notebookId,
      'Create an eye-catching infographic showcasing smart home benefits',
      'landscape'
    )

    console.log('Generated infographic:', infographicId)
    return infographicId
  } catch (error) {
    console.error('NotebookLM operation failed:', error)
    throw error
  }
}

export async function exampleCombinedWorkflow() {
  console.log('Starting combined workflow with resilience...')

  const notebookLM = new ResilientNotebookLMService()
  const notebook = await notebookLM.createNotebook(
    'Weekly Social Content',
    'Generate visuals for social media posts'
  )

  await notebookLM.addSources(notebook.notebookId, [
    {
      type: 'text',
      content: 'Latest smart home automation trends and product highlights',
      title: 'Content Brief'
    }
  ])

  const infographicId = await notebookLM.generateInfographic(
    notebook.notebookId,
    'Create a compelling social media infographic',
    'square'
  )

  const facebookConnector = new ResilientFacebookConnector(
    process.env.FACEBOOK_ACCESS_TOKEN!,
    process.env.FACEBOOK_PAGE_ID
  )

  const fbResult = await facebookConnector.post(
    'Check out this week\'s smart home highlights! 🏠',
    [`https://example.com/infographic/${infographicId}.png`]
  )

  console.log('Facebook post result:', fbResult)

  const instagramConnector = new ResilientInstagramConnector(
    process.env.INSTAGRAM_ACCESS_TOKEN!,
    process.env.INSTAGRAM_ACCOUNT_ID
  )

  const igResult = await instagramConnector.post(
    'Transform your living space with smart automation! ✨ #SmartHome',
    [`https://example.com/infographic/${infographicId}.png`]
  )

  console.log('Instagram post result:', igResult)

  return {
    notebook: notebook.notebookId,
    infographic: infographicId,
    facebook: fbResult,
    instagram: igResult
  }
}
