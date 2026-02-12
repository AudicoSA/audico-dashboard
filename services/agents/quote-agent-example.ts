/**
 * Quote Agent Usage Examples
 * 
 * This file demonstrates how to use the Quote Agent service
 */

import { quoteAgent } from './quote-agent'

// Example 1: Generate a customer quote
export async function generateQuoteExample(quoteRequestId: string) {
  console.log('Generating quote for request:', quoteRequestId)
  
  const result = await quoteAgent.generateCustomerQuote(quoteRequestId)
  
  if (result.success) {
    console.log('✓ Quote generated successfully')
    console.log('  Quote Number:', result.quoteNumber)
    console.log('  PDF URL:', result.pdfUrl)
    console.log('  Approval Task:', result.taskId)
    console.log('')
    console.log('Next steps:')
    console.log('1. Review the PDF at:', result.pdfUrl)
    console.log('2. Check the approval task for Kenny')
    console.log('3. Review and send the email draft')
  } else {
    console.error('✗ Failed to generate quote:', result.error)
  }
  
  return result
}

// Example 2: API Call Example
export async function apiCallExample(quoteRequestId: string) {
  const response = await fetch('/api/agents/quote', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'generate_customer_quote',
      quoteRequestId: quoteRequestId
    })
  })
  
  const result = await response.json()
  
  if (result.success) {
    console.log('Quote generated via API:', result.quoteNumber)
  } else {
    console.error('API error:', result.error)
  }
  
  return result
}

// Example 3: Complete Workflow
export async function completeWorkflowExample() {
  // This example shows the complete quote workflow
  
  // Step 1: Quote request is detected (done by email agent)
  const quoteRequestId = 'your-quote-request-id'
  
  // Step 2: Suppliers are contacted (done by supplier agent)
  console.log('Step 1: Suppliers contacted for pricing')
  
  // Step 3: Wait for supplier responses (24-48 hours)
  console.log('Step 2: Waiting for supplier responses...')
  
  // Step 4: Generate customer quote
  console.log('Step 3: Generating customer quote')
  const result = await quoteAgent.generateCustomerQuote(quoteRequestId)
  
  if (result.success) {
    console.log('Step 4: Quote generated, awaiting approval')
    console.log('       - Quote Number:', result.quoteNumber)
    console.log('       - PDF URL:', result.pdfUrl)
    
    // Step 5: Kenny approves (manual step)
    console.log('Step 5: Awaiting Kenny\'s approval...')
    
    // Step 6: Email sent to customer (manual step after approval)
    console.log('Step 6: Email will be sent after approval')
  }
  
  return result
}

// Example 4: Error Handling
export async function errorHandlingExample(quoteRequestId: string) {
  try {
    const result = await quoteAgent.generateCustomerQuote(quoteRequestId)
    
    if (!result.success) {
      // Handle different error scenarios
      if (result.error?.includes('not found')) {
        console.error('Quote request does not exist')
        // Create or fix quote request
      } else if (result.error?.includes('No supplier responses')) {
        console.error('Waiting for supplier responses')
        // Maybe send reminder to suppliers
      } else if (result.error?.includes('No valid pricing')) {
        console.error('Pricing data is invalid or missing')
        // Check supplier response format
      } else {
        console.error('Unknown error:', result.error)
      }
    }
    
    return result
  } catch (error) {
    console.error('Unexpected error:', error)
    throw error
  }
}

// Example 5: Testing with Mock Data
export async function testWithMockData() {
  // For testing, you would:
  // 1. Create a test quote request in the database
  // 2. Create mock supplier responses with pricing data
  // 3. Run the quote agent
  // 4. Verify the PDF and email draft
  
  console.log('Mock test workflow:')
  console.log('1. Create test quote request')
  console.log('2. Insert mock supplier responses')
  console.log('3. Generate quote')
  console.log('4. Verify PDF and draft email')
  console.log('5. Clean up test data')
}

// Example 6: Batch Processing
export async function batchProcessQuotes(quoteRequestIds: string[]) {
  const results = []
  
  for (const id of quoteRequestIds) {
    console.log(`Processing quote request: ${id}`)
    const result = await quoteAgent.generateCustomerQuote(id)
    results.push({ id, result })
    
    // Add delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  const successful = results.filter(r => r.result.success).length
  const failed = results.filter(r => !r.result.success).length
  
  console.log(`Batch processing complete:`)
  console.log(`  Successful: ${successful}`)
  console.log(`  Failed: ${failed}`)
  
  return results
}

// Example 7: Integration with Webhook
export async function webhookIntegrationExample(webhookPayload: any) {
  // This could be triggered by a webhook when supplier responds
  
  if (webhookPayload.event === 'supplier_response_received') {
    const quoteRequestId = webhookPayload.quote_request_id
    
    // Check if all suppliers have responded
    // If yes, generate the quote
    console.log('Supplier response received, checking completion...')
    
    // In a real implementation, you'd check if all contacted suppliers
    // have responded before generating the quote
    
    const result = await quoteAgent.generateCustomerQuote(quoteRequestId)
    return result
  }
}

// Usage in a Next.js API route:
/*
export async function POST(request: NextRequest) {
  const { quoteRequestId } = await request.json()
  
  const result = await quoteAgent.generateCustomerQuote(quoteRequestId)
  
  return NextResponse.json(result)
}
*/

// Usage in a cron job:
/*
export async function checkPendingQuotes() {
  // Find quote requests that are ready for quote generation
  const pendingQuotes = await supabase
    .from('quote_requests')
    .select('id')
    .eq('status', 'quotes_received')
  
  for (const quote of pendingQuotes.data || []) {
    await quoteAgent.generateCustomerQuote(quote.id)
  }
}
*/
