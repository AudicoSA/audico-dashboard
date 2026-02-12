/**
 * Example: Complete Quote Email Workflow
 * 
 * This example shows how to integrate the quote template engine
 * into your quote generation workflow.
 */

import { generateQuoteEmail, trackEmailResponse } from './quote-template-engine'
import { gmailService } from '../services/integrations/gmail-service'
import { getServerSupabase } from './supabase'

/**
 * Example 1: Generate and Send Quote Email After PDF Creation
 */
export async function completeQuoteWorkflow(quoteRequestId: string, pdfUrl: string) {
  try {
    // Step 1: Generate personalized email using AI
    const emailResult = await generateQuoteEmail(quoteRequestId, pdfUrl)
    
    if (!emailResult.success || !emailResult.email) {
      throw new Error(`Failed to generate email: ${emailResult.error}`)
    }

    const { email, emailSendId } = emailResult

    console.log('Generated email:', {
      subject: email.subject,
      tone: email.tone,
      segment: email.customer_segment,
      urgency: email.urgency,
      valueProps: email.value_props_highlighted,
      followUpActions: email.follow_up_actions
    })

    // Step 2: Create draft for approval (optional)
    const supabase = getServerSupabase()
    const { data: draft } = await supabase
      .from('email_drafts')
      .insert({
        id: `draft-${emailSendId}`,
        to_email: email.customer_email,
        subject: email.subject,
        body: email.body,
        attachments: [pdfUrl],
        status: 'pending_approval',
        metadata: {
          email_send_id: emailSendId,
          tone: email.tone,
          template_id: email.template_id,
        }
      })
      .select()
      .single()

    // Step 3: Send email (after approval)
    const quoteNumber = `Q-${quoteRequestId.substring(0, 8).toUpperCase()}`
    const sentResult = await gmailService.sendEmail(
      email.customer_email,
      email.subject,
      email.body,
      undefined,
      undefined,
      [{ filename: `${quoteNumber}.pdf`, url: pdfUrl }]
    )

    if (!sentResult.success) {
      throw new Error(`Failed to send email: ${sentResult.error}`)
    }

    // Step 4: Update draft status
    await supabase
      .from('email_drafts')
      .update({ status: 'sent' })
      .eq('id', draft!.id)

    console.log('Quote email sent successfully:', {
      messageId: sentResult.messageId,
      emailSendId,
    })

    return {
      success: true,
      emailSendId,
      gmailMessageId: sentResult.messageId,
    }

  } catch (error: any) {
    console.error('Quote workflow error:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Example 2: Track Customer Response to Quote Email
 */
export async function handleCustomerReply(emailLogId: string) {
  try {
    // Track the response - system automatically:
    // - Matches to original quote email
    // - Classifies response type (acceptance/rejection/question/etc)
    // - Analyzes sentiment
    // - Calculates response time
    // - Updates performance metrics
    const result = await trackEmailResponse(emailLogId)

    if (!result.success) {
      throw new Error(`Failed to track response: ${result.error}`)
    }

    const supabase = getServerSupabase()
    
    // Fetch response details
    const { data: response } = await supabase
      .from('quote_email_responses')
      .select(`
        *,
        email_send:quote_email_sends(
          quote_request_id,
          customer_email,
          template_id
        )
      `)
      .eq('id', result.responseId)
      .single()

    console.log('Customer response tracked:', {
      responseType: response?.response_type,
      sentiment: response?.sentiment,
      responseTimeHours: response?.response_time_hours,
      converted: response?.converted,
    })

    // Handle different response types
    if (response?.response_type === 'acceptance') {
      // Create order, notify team, etc.
      console.log('🎉 Customer accepted the quote!')
    } else if (response?.response_type === 'question') {
      // Route to support, prepare answer, etc.
      console.log('❓ Customer has questions')
    } else if (response?.response_type === 'negotiation') {
      // Flag for pricing review
      console.log('💰 Customer wants to negotiate pricing')
    } else if (response?.response_type === 'rejection') {
      // Log feedback, analyze reasons
      console.log('❌ Customer rejected the quote')
    }

    return {
      success: true,
      response,
    }

  } catch (error: any) {
    console.error('Response tracking error:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Example 3: Manually Create Custom Template
 */
export async function createCustomTemplate() {
  const supabase = getServerSupabase()

  const { data, error } = await supabase
    .from('quote_email_templates')
    .insert({
      template_name: 'friendly_repeat_vip',
      variant_name: 'variant_a',
      tone: 'friendly',
      customer_segment: 'repeat',
      urgency_level: null,
      subject_template: 'Hey {customer_name}! Your Quote #{quote_number} is Ready 🎉',
      body_template: `Hi {customer_name}!

Great to see you again! I've got your quote ready and I think you're going to love this.

Here's what we've lined up for you:
{product_list}

Why this is a great deal:
{value_props}

Everything is {stock_availability} and we can {delivery_timeframe}.

Check out the full details in the attached PDF (Quote #{quote_number}).

{follow_up_action}

Looking forward to working with you again!`,
      signature_template: `Cheers,
{sender_name}
Your friendly quote specialist
{company_name}
{contact_info}

P.S. Got questions? Just hit reply - I'm here to help!`,
      follow_up_template: 'Any questions at all? I\'m just a message away. Always happy to jump on a quick call too!',
      active: true,
      priority: 120,
      metadata: {
        created_by: 'Kenny',
        notes: 'Extra friendly variant for loyal repeat customers'
      }
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create template:', error)
    return { success: false, error }
  }

  console.log('Created custom template:', data.id)
  return { success: true, template: data }
}

/**
 * Example 4: Analyze Template Performance
 */
export async function analyzeTemplatePerformance() {
  const supabase = getServerSupabase()

  const { data: performance } = await supabase
    .from('quote_template_performance')
    .select(`
      *,
      template:quote_email_templates(
        template_name,
        variant_name,
        tone,
        customer_segment
      )
    `)
    .gte('sends_count', 5)
    .order('conversion_rate', { ascending: false })

  console.log('Template Performance Analysis:')
  console.log('================================')

  performance?.forEach((p: any) => {
    console.log(`\n${p.template.template_name} (${p.template.variant_name})`)
    console.log(`  Tone: ${p.template.tone}`)
    console.log(`  Segment: ${p.customer_segment}`)
    console.log(`  Urgency: ${p.urgency_level || 'any'}`)
    console.log(`  Sends: ${p.sends_count}`)
    console.log(`  Reply Rate: ${p.reply_rate}%`)
    console.log(`  Conversion Rate: ${p.conversion_rate}%`)
    console.log(`  Avg Response Time: ${p.avg_response_time_hours?.toFixed(1)}h`)
    
    if (p.avg_conversion_amount) {
      console.log(`  Avg Deal Size: ZAR ${p.avg_conversion_amount.toFixed(2)}`)
    }
  })

  return performance
}

/**
 * Example 5: Get Best Template for Customer
 */
export async function getBestTemplateForCustomer(
  customerEmail: string,
  urgency: 'low' | 'medium' | 'high' | 'urgent'
) {
  const supabase = getServerSupabase()

  // Determine customer segment
  const { data: pastQuotes } = await supabase
    .from('quote_requests')
    .select('*')
    .eq('customer_email', customerEmail)
    .eq('status', 'sent_to_customer')

  const segment = pastQuotes && pastQuotes.length > 0 ? 'repeat' : 'first_time'

  // Get recommendations
  const { data: performance } = await supabase
    .from('quote_template_performance')
    .select(`
      *,
      template:quote_email_templates(*)
    `)
    .or(`customer_segment.eq.${segment},customer_segment.eq.any`)
    .or(`urgency_level.eq.${urgency},urgency_level.is.null`)
    .gte('sends_count', 3)
    .order('conversion_rate', { ascending: false })
    .limit(1)
    .single()

  if (performance) {
    console.log('Best template for customer:', {
      template: performance.template.template_name,
      variant: performance.template.variant_name,
      conversionRate: performance.conversion_rate,
      replyRate: performance.reply_rate,
      reason: `Based on ${performance.sends_count} sends with ${performance.conversion_rate}% conversion`
    })
  }

  return performance?.template
}

/**
 * Example 6: Integrate with Email Scanner
 * 
 * Add this to your email scanner to automatically track responses
 */
export async function emailScannerIntegration(emailLog: any) {
  // Check if this is a reply to a quote email
  const supabase = getServerSupabase()
  
  const { data: quoteSend } = await supabase
    .from('quote_email_sends')
    .select('id, quote_request_id')
    .eq('customer_email', emailLog.from_email)
    .order('sent_at', { ascending: false })
    .limit(1)
    .single()

  if (quoteSend) {
    // This is a response to a quote!
    console.log('Detected response to quote:', quoteSend.quote_request_id)
    
    // Track it automatically
    await trackEmailResponse(emailLog.id)
    
    // Optionally notify the team
    await supabase
      .from('squad_messages')
      .insert({
        from_agent: 'EmailScanner',
        to_agent: 'QuoteAgent',
        message: `Customer ${emailLog.from_email} responded to quote ${quoteSend.quote_request_id}`,
        data: {
          email_log_id: emailLog.id,
          quote_request_id: quoteSend.quote_request_id,
        }
      })
  }
}
