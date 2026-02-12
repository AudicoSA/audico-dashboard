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
