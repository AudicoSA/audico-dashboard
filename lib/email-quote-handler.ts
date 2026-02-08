import { extractQuoteRequestFromEmail } from './quote-chat'
import { getServerSupabase } from './supabase'
import type { EmailLog } from './supabase'

export async function processEmailForQuoteRequest(emailLog: EmailLog): Promise<{
  isQuoteRequest: boolean
  processed: boolean
  quoteRequestId?: string
  error?: string
}> {
  try {
    const emailBody = emailLog.payload?.body || ''
    const quoteAnalysis = extractQuoteRequestFromEmail(
      emailLog.subject,
      emailBody,
      emailLog.from_email
    )

    if (!quoteAnalysis.isQuoteRequest) {
      return { isQuoteRequest: false, processed: false }
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/integrations/quote-chat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'process_email_quote',
          email_id: emailLog.id,
          email_sender: emailLog.from_email,
          email_subject: emailLog.subject,
          email_body: emailBody,
        }),
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to process quote request: ${response.statusText}`)
    }

    const result = await response.json()

    const supabase = getServerSupabase()
    await supabase
      .from('email_logs')
      .update({
        category: 'inquiry',
        status: 'quote_processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', emailLog.id)

    return {
      isQuoteRequest: true,
      processed: result.linked || false,
      quoteRequestId: result.quote_request?.id,
    }
  } catch (error: any) {
    console.error('Error processing email for quote request:', error)
    return {
      isQuoteRequest: true,
      processed: false,
      error: error.message,
    }
  }
}

export async function linkEmailToExistingQuoteSession(
  emailLog: EmailLog,
  sessionId: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/integrations/quote-chat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'link_email',
          email_id: emailLog.id,
          session_id: sessionId,
          email_sender: emailLog.from_email,
        }),
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to link email to session: ${response.statusText}`)
    }

    const result = await response.json()
    return result.linked || false
  } catch (error: any) {
    console.error('Error linking email to quote session:', error)
    return false
  }
}

export async function getQuoteSessionsForCustomer(
  customerEmail: string
): Promise<any[]> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/integrations/quote-chat?action=search&email=${encodeURIComponent(customerEmail)}`
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch quote sessions: ${response.statusText}`)
    }

    const result = await response.json()
    return result.sessions || []
  } catch (error: any) {
    console.error('Error fetching quote sessions:', error)
    return []
  }
}

export function shouldTriggerQuoteGeneration(emailLog: EmailLog): boolean {
  const subject = emailLog.subject.toLowerCase()
  const body = (emailLog.payload?.body || '').toLowerCase()
  const combined = subject + ' ' + body

  const triggerKeywords = [
    'send quote',
    'provide quote',
    'need quote',
    'request quote',
    'quote please',
    'pricing please',
    'send pricing',
    'what is the price',
    'how much does it cost',
    'can you quote',
  ]

  return triggerKeywords.some(keyword => combined.includes(keyword))
}

export function generateQuoteEmailResponse(
  customerName: string,
  quoteNumber: string,
  items: any[]
): string {
  const itemsList = items.length > 0 
    ? items.map((item, i) => `${i + 1}. ${item}`).join('\n')
    : 'As discussed'

  return `Dear ${customerName},

Thank you for your interest in our products/services. I've prepared a detailed quote for you.

Quote Reference: ${quoteNumber}

Items Quoted:
${itemsList}

Your formal quote will be generated and sent to you shortly as a PDF document. This quote is valid for 30 days from the date of issue.

If you have any questions about the quote or need any modifications, please don't hesitate to reach out.

Best regards,
Audico Sales Team`
}
