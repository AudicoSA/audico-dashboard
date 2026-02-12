import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'

export class GmailService {
  private oauth2Client: OAuth2Client

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    )

    this.oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN
    })
  }

  async sendEmail(
    to: string,
    subject: string,
    body: string,
    cc?: string[],
    bcc?: string[],
    attachments?: Array<{ filename: string; url: string }>
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client })

      const email = await this.createEmailMessage(to, subject, body, cc, bcc, attachments)
      const encodedMessage = Buffer.from(email)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')

      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      })

      return {
        success: true,
        messageId: response.data.id || undefined,
      }
    } catch (error: any) {
      console.error('Error sending email via Gmail API:', error)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  async createDraft(
    to: string,
    subject: string,
    body: string,
    cc?: string[],
    bcc?: string[],
    attachments?: Array<{ filename: string; url: string }>
  ): Promise<{ success: boolean; draftId?: string; error?: string }> {
    try {
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client })

      const email = await this.createEmailMessage(to, subject, body, cc, bcc, attachments)
      const encodedMessage = Buffer.from(email)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')

      const response = await gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            raw: encodedMessage,
          },
        },
      })

      return {
        success: true,
        draftId: response.data.id || undefined,
      }
    } catch (error: any) {
      console.error('Error creating Gmail draft:', error)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  async listMessages(
    query: string,
    pageToken?: string,
    maxResults: number = 100
  ): Promise<{ messages: Array<{ id: string; threadId: string }>; nextPageToken?: string }> {
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client })
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      pageToken,
      maxResults,
    })
    return {
      messages: (response.data.messages || []) as Array<{ id: string; threadId: string }>,
      nextPageToken: response.data.nextPageToken || undefined,
    }
  }

  async getMessage(messageId: string): Promise<{
    id: string
    from: string
    to: string
    subject: string
    date: string
    body: string
    snippet: string
  }> {
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client })
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    })

    const headers = response.data.payload?.headers || []
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || ''

    let body = ''
    if (response.data.payload?.body?.data) {
      body = Buffer.from(response.data.payload.body.data, 'base64').toString('utf-8')
    } else if (response.data.payload?.parts) {
      const textPart = response.data.payload.parts.find((p) => p.mimeType === 'text/plain')
      if (textPart?.body?.data) {
        body = Buffer.from(textPart.body.data, 'base64').toString('utf-8')
      } else {
        const htmlPart = response.data.payload.parts.find((p) => p.mimeType === 'text/html')
        if (htmlPart?.body?.data) {
          body = Buffer.from(htmlPart.body.data, 'base64').toString('utf-8')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
        }
      }
    }

    return {
      id: response.data.id || messageId,
      from: getHeader('From'),
      to: getHeader('To'),
      subject: getHeader('Subject'),
      date: getHeader('Date'),
      body,
      snippet: response.data.snippet || '',
    }
  }

  async collectAllMessageIds(query: string): Promise<string[]> {
    const allIds: string[] = []
    let pageToken: string | undefined

    do {
      const result = await this.listMessages(query, pageToken)
      for (const msg of result.messages) {
        allIds.push(msg.id)
      }
      pageToken = result.nextPageToken
    } while (pageToken)

    return allIds
  }

  private async createEmailMessage(
    to: string,
    subject: string,
    body: string,
    cc?: string[],
    bcc?: string[],
    attachments?: Array<{ filename: string; url: string }>
  ): Promise<string> {
    if (!attachments || attachments.length === 0) {
      const messageParts = [
        `To: ${to}`,
        ...(cc && cc.length > 0 ? [`Cc: ${cc.join(', ')}`] : []),
        ...(bcc && bcc.length > 0 ? [`Bcc: ${bcc.join(', ')}`] : []),
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${subject}`,
        '',
        body,
      ]

      return messageParts.join('\r\n')
    }

    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const messageParts = [
      `To: ${to}`,
      ...(cc && cc.length > 0 ? [`Cc: ${cc.join(', ')}`] : []),
      ...(bcc && bcc.length > 0 ? [`Bcc: ${bcc.join(', ')}`] : []),
      'MIME-Version: 1.0',
      `Subject: ${subject}`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      body,
    ]

    for (const attachment of attachments) {
      try {
        const response = await fetch(attachment.url)
        const buffer = await response.arrayBuffer()
        const base64Content = Buffer.from(buffer).toString('base64')
        
        messageParts.push(
          `--${boundary}`,
          `Content-Type: application/pdf; name="${attachment.filename}"`,
          'Content-Transfer-Encoding: base64',
          `Content-Disposition: attachment; filename="${attachment.filename}"`,
          '',
          base64Content
        )
      } catch (error) {
        console.error(`Error fetching attachment ${attachment.filename}:`, error)
      }
    }

    messageParts.push(`--${boundary}--`)

    return messageParts.join('\r\n')
  }
}

export const gmailService = new GmailService()
