import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

export interface ChatContext {
  customerName?: string
  customerEmail?: string
  companyName?: string
  recentOrders?: Array<{
    order_id: number
    order_status: string
    order_total: number
  }>
  recentTickets?: Array<{
    ticket_number: string
    subject: string
    status: string
  }>
  knowledgeBase?: Array<{
    title: string
    content: string
    category: string
  }>
}

export async function generateChatbotResponse(
  message: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  context: ChatContext
): Promise<{ message: string; sources: string[] }> {
  const systemPrompt = buildSystemPrompt(context)
  
  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: 'user',
        content: message,
      },
    ],
  })

  const botMessage = response.content[0].type === 'text' ? response.content[0].text : ''
  const sources = extractSources(context)

  return {
    message: botMessage,
    sources,
  }
}

function buildSystemPrompt(context: ChatContext): string {
  let prompt = `You are a helpful customer support assistant for Audico, a leading audio equipment retailer in South Africa. 
Your role is to provide accurate, friendly, and professional support to customers.

IMPORTANT GUIDELINES:
- Be friendly, professional, and concise
- Use the customer's context to personalize responses
- Reference knowledge base articles when relevant
- If you don't know something, admit it and offer to escalate to a human agent
- For complex issues, suggest creating a support ticket
- Always prioritize customer satisfaction
- Use South African English and be aware of local context
- Currency is South African Rand (ZAR)

`

  // Add customer context
  if (context.customerName || context.customerEmail) {
    prompt += `\nCUSTOMER INFORMATION:\n`
    if (context.customerName) prompt += `Name: ${context.customerName}\n`
    if (context.customerEmail) prompt += `Email: ${context.customerEmail}\n`
    if (context.companyName) prompt += `Company: ${context.companyName}\n`
  }

  // Add order history
  if (context.recentOrders && context.recentOrders.length > 0) {
    prompt += `\nRECENT ORDERS:\n`
    context.recentOrders.forEach(order => {
      prompt += `- Order #${order.order_id}: ${order.order_status} (ZAR ${order.order_total})\n`
    })
  }

  // Add ticket history
  if (context.recentTickets && context.recentTickets.length > 0) {
    prompt += `\nRECENT SUPPORT TICKETS:\n`
    context.recentTickets.forEach(ticket => {
      prompt += `- ${ticket.ticket_number}: ${ticket.subject} (${ticket.status})\n`
    })
  }

  // Add knowledge base
  if (context.knowledgeBase && context.knowledgeBase.length > 0) {
    prompt += `\nKNOWLEDGE BASE ARTICLES:\n`
    context.knowledgeBase.forEach(article => {
      prompt += `\n[${article.category}] ${article.title}\n${article.content.substring(0, 300)}...\n`
    })
  }

  return prompt
}

function extractSources(context: ChatContext): string[] {
  const sources: string[] = []
  
  if (context.knowledgeBase) {
    sources.push(...context.knowledgeBase.map(kb => kb.title))
  }
  
  return sources
}

export function detectCustomerIntent(message: string): string {
  const lowerMessage = message.toLowerCase()
  
  // Order-related
  if (lowerMessage.includes('order') || lowerMessage.includes('track') || lowerMessage.includes('shipping')) {
    return 'order_inquiry'
  }
  
  // Product-related
  if (lowerMessage.includes('product') || lowerMessage.includes('speaker') || lowerMessage.includes('price')) {
    return 'product_inquiry'
  }
  
  // Support-related
  if (lowerMessage.includes('help') || lowerMessage.includes('problem') || lowerMessage.includes('issue')) {
    return 'support_request'
  }
  
  // Quote-related
  if (lowerMessage.includes('quote') || lowerMessage.includes('quotation') || lowerMessage.includes('pricing')) {
    return 'quote_request'
  }
  
  return 'general_inquiry'
}

export function shouldEscalateToTicket(message: string, intent: string): boolean {
  const escalationKeywords = [
    'urgent',
    'broken',
    'defective',
    'not working',
    'complaint',
    'refund',
    'return',
    'damaged',
  ]
  
  const lowerMessage = message.toLowerCase()
  return escalationKeywords.some(keyword => lowerMessage.includes(keyword))
}
