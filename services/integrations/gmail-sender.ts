import { google } from 'googleapis'

/**
 * Gmail Sender Service
 *
 * Handles sending emails via Gmail API:
 * - Send existing drafts
 * - Send direct emails
 * - Archive emails
 */

async function getGmailClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  )

  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN
  })

  return google.gmail({ version: 'v1', auth: oauth2Client })
}

/**
 * Send an existing Gmail draft
 * @param draftId - Gmail draft ID (e.g., "r123456789")
 * @returns Sent message data including message ID
 */
export async function sendDraft(draftId: string) {
  console.log('[GMAIL SENDER] Sending draft:', draftId)

  try {
    const gmail = await getGmailClient()
    const response = await gmail.users.drafts.send({
      userId: 'me',
      requestBody: { id: draftId }
    })

    console.log('[GMAIL SENDER] Draft sent successfully:', response.data.id)
    return response.data
  } catch (error: any) {
    console.error('[GMAIL SENDER] Error sending draft:', error)
    throw new Error(`Failed to send draft: ${error.message}`)
  }
}

/**
 * Send a direct email (not from draft)
 * @param to - Recipient email address
 * @param subject - Email subject
 * @param body - Email body (HTML)
 * @returns Sent message data including message ID
 */
export async function sendDirectEmail(to: string, subject: string, body: string) {
  console.log('[GMAIL SENDER] Sending direct email to:', to)

  try {
    const gmail = await getGmailClient()
    const message = createMimeMessage(to, subject, body)

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: message }
    })

    console.log('[GMAIL SENDER] Direct email sent successfully:', response.data.id)
    return response.data
  } catch (error: any) {
    console.error('[GMAIL SENDER] Error sending direct email:', error)
    throw new Error(`Failed to send email: ${error.message}`)
  }
}

/**
 * Archive an email (remove from inbox)
 * @param messageId - Gmail message ID
 */
export async function archiveEmail(messageId: string) {
  console.log('[GMAIL SENDER] Archiving email:', messageId)

  try {
    const gmail = await getGmailClient()
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['INBOX']
      }
    })

    console.log('[GMAIL SENDER] Email archived successfully')
  } catch (error: any) {
    console.error('[GMAIL SENDER] Error archiving email:', error)
    throw new Error(`Failed to archive email: ${error.message}`)
  }
}

/**
 * Create a MIME message for Gmail API
 * @param to - Recipient email
 * @param subject - Email subject
 * @param body - Email body (HTML)
 * @returns Base64url-encoded MIME message
 */
function createMimeMessage(to: string, subject: string, body: string): string {
  const messageParts = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    body
  ]

  const message = messageParts.join('\n')

  // Convert to base64url encoding (Gmail API format)
  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Get draft details (for preview/debugging)
 * @param draftId - Gmail draft ID
 * @returns Draft data including message content
 */
export async function getDraft(draftId: string) {
  console.log('[GMAIL SENDER] Fetching draft:', draftId)

  try {
    const gmail = await getGmailClient()
    const response = await gmail.users.drafts.get({
      userId: 'me',
      id: draftId,
      format: 'full'
    })

    return response.data
  } catch (error: any) {
    console.error('[GMAIL SENDER] Error fetching draft:', error)
    throw new Error(`Failed to fetch draft: ${error.message}`)
  }
}
