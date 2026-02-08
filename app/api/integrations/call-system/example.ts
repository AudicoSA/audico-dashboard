export const exampleCallTranscriptPayload = {
  call_id: 'call-2024-02-08-001',
  customer_phone: '+27123456789',
  customer_name: 'John Smith',
  customer_email: 'john.smith@example.com',
  call_duration: 245,
  call_start_time: '2024-02-08T10:30:00Z',
  call_end_time: '2024-02-08T10:34:05Z',
  transcript: `
Agent: Hello, thank you for calling Audico. How can I help you today?

Customer: Hi, I'm looking for information about your Sonos sound systems. I saw some products on your website.

Agent: Great! We have a wide range of Sonos products. Are you looking for something specific?

Customer: Yes, I'm interested in the Sonos Arc soundbar. Do you have it in stock?

Agent: Let me check that for you... Yes, we do have the Sonos Arc in stock. It's one of our most popular soundbars.

Customer: That's perfect. What's the price, and do you offer any warranties?

Agent: The Sonos Arc is priced at R18,999. It comes with a standard manufacturer's warranty, and we also offer extended warranty options.

Customer: That sounds good. I'd like to think about it and get back to you. Can you send me more details via email?

Agent: Absolutely! I'll send you all the details including specifications, warranty information, and current promotions to john.smith@example.com. Is there anything else I can help you with?

Customer: No, that's all for now. Thank you!

Agent: You're welcome! Have a great day, and feel free to reach out if you have any questions.
  `.trim(),
  summary: 'Customer inquiry about Sonos Arc soundbar. Interested in purchasing but wants to review details first. Requested email with product information, pricing (R18,999), and warranty details.',
  sentiment: 'positive',
  call_outcome: 'inquiry',
  customer_intent: 'product information and potential purchase',
  key_topics: ['sonos arc', 'soundbar', 'pricing', 'warranty', 'stock availability'],
  metadata: {
    recording_url: 'https://storage.example.com/calls/call-2024-02-08-001.mp3',
    agent_name: 'Sarah Johnson',
    call_quality_score: 0.95,
    keywords_detected: ['sonos', 'arc', 'soundbar', 'price', 'warranty', 'stock']
  }
}

export const exampleEscalationPayload = {
  call_id: 'call-2024-02-08-002',
  customer_phone: '+27987654321',
  customer_name: 'Mary Williams',
  customer_email: 'mary.w@example.com',
  call_duration: 420,
  call_start_time: '2024-02-08T11:15:00Z',
  call_end_time: '2024-02-08T11:22:00Z',
  transcript: 'Customer called regarding delayed delivery of order #12345...',
  summary: 'Customer upset about delivery delay. Order #12345 was supposed to arrive 5 days ago. Customer wants immediate resolution or refund. Escalation required.',
  sentiment: 'negative',
  call_outcome: 'escalation',
  customer_intent: 'complaint resolution',
  key_topics: ['delivery delay', 'order 12345', 'refund request', 'customer dissatisfaction'],
  metadata: {
    order_number: '12345',
    days_delayed: 5,
    urgency_level: 'high'
  }
}

export const exampleOrderPayload = {
  call_id: 'call-2024-02-08-003',
  customer_phone: '+27555123456',
  customer_name: 'David Lee',
  customer_email: 'david.lee@example.com',
  call_duration: 180,
  call_start_time: '2024-02-08T14:00:00Z',
  call_end_time: '2024-02-08T14:03:00Z',
  transcript: 'Customer ready to place order for Samsung TV and soundbar system...',
  summary: 'Customer wants to place an order for Samsung 65" TV and Sonos Beam soundbar. Has all details ready and wants to proceed with payment.',
  sentiment: 'positive',
  call_outcome: 'order',
  customer_intent: 'place order',
  key_topics: ['samsung tv', 'sonos beam', 'order placement', 'payment'],
  metadata: {
    items_interested: ['Samsung 65" TV', 'Sonos Beam'],
    estimated_order_value: 35000,
    payment_method: 'credit_card'
  }
}

export const exampleResolvedPayload = {
  call_id: 'call-2024-02-08-004',
  customer_phone: '+27444555666',
  customer_name: 'Sarah Johnson',
  call_duration: 120,
  call_start_time: '2024-02-08T15:30:00Z',
  call_end_time: '2024-02-08T15:32:00Z',
  transcript: 'Customer called to inquire about product specs, agent provided information...',
  summary: 'Customer had questions about Sonos One specifications. All questions answered satisfactorily.',
  sentiment: 'positive',
  call_outcome: 'resolved',
  customer_intent: 'information request',
  key_topics: ['sonos one', 'specifications', 'wifi compatibility']
}

export async function testWebhook(baseUrl = 'http://localhost:3001') {
  const examples = [
    { name: 'Inquiry Example', payload: exampleCallTranscriptPayload },
    { name: 'Escalation Example', payload: exampleEscalationPayload },
    { name: 'Order Example', payload: exampleOrderPayload },
    { name: 'Resolved Example', payload: exampleResolvedPayload },
  ]

  console.log('Testing Call System Webhook Integration...\n')

  for (const example of examples) {
    console.log(`Testing: ${example.name}`)
    console.log('=' .repeat(50))
    
    try {
      const response = await fetch(`${baseUrl}/api/integrations/call-system`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Uncomment if using webhook secret:
          // 'Authorization': `Bearer ${process.env.CALL_SYSTEM_WEBHOOK_SECRET}`
        },
        body: JSON.stringify(example.payload)
      })

      const result = await response.json()

      if (response.ok) {
        console.log('✅ Success!')
        console.log(`   Transcript ID: ${result.transcript.id}`)
        console.log(`   Tasks Generated: ${result.tasks_generated}`)
        console.log(`   Timeline Synced: ${result.timeline_synced}`)
      } else {
        console.log('❌ Error!')
        console.log(`   Status: ${response.status}`)
        console.log(`   Error: ${result.error}`)
      }
    } catch (error) {
      console.log('❌ Request Failed!')
      console.log(`   Error: ${error}`)
    }

    console.log('\n')
  }

  console.log('Testing complete!')
}
