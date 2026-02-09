import { getServerSupabase } from '../lib/supabase'

const knowledgeBaseArticles = [
  {
    category: 'faq',
    title: 'How do I track my order?',
    content: `To track your order:

1. Log in to your customer portal at https://yoursite.com/portal
2. Navigate to "Order History" from the sidebar
3. Find your order in the list
4. Click on the order to view detailed tracking information
5. If tracking is available, you'll see the current status and expected delivery date

You can also track your order using the tracking number provided in your confirmation email. If you have any issues tracking your order, please contact our support team or create a support ticket through the portal.`,
    keywords: ['order', 'tracking', 'shipping', 'delivery', 'status'],
  },
  {
    category: 'faq',
    title: 'What is your return policy?',
    content: `Our return policy:

- Returns accepted within 30 days of delivery
- Items must be unused and in original packaging
- Return shipping costs are the customer's responsibility unless the item is defective
- Refunds processed within 7-10 business days after receiving the return
- Custom orders and sale items may not be eligible for return

To initiate a return:
1. Create a support ticket through the customer portal
2. Select "Return Request" as the category
3. Provide your order number and reason for return
4. Our team will provide return instructions and authorization

For defective items, we cover return shipping and provide expedited replacements.`,
    keywords: ['return', 'refund', 'policy', 'exchange', 'money back'],
  },
  {
    category: 'product',
    title: 'Speaker Setup and Installation Guide',
    content: `Basic speaker setup instructions:

POSITIONING:
- Place speakers at ear level when seated
- Position them at equal distances from your listening position
- Angle speakers slightly towards the listening area
- Keep speakers away from walls to reduce bass buildup

CONNECTION:
1. Turn off all equipment before connecting
2. Connect speaker cables to amplifier outputs (red to red, black to black)
3. Ensure secure connections at both ends
4. Keep cables away from power cords to prevent interference

CALIBRATION:
- Start with volume at minimum
- Gradually increase to comfortable listening level
- Adjust balance and tone controls as needed
- Use room correction features if available

For specific product instructions, refer to the manual included with your speakers or download it from our website.`,
    keywords: ['speaker', 'setup', 'installation', 'connect', 'positioning', 'calibration'],
  },
  {
    category: 'product',
    title: 'Amplifier and Receiver Specifications Explained',
    content: `Understanding amplifier specifications:

POWER OUTPUT (Watts):
- RMS Power: Continuous power output (most important)
- Peak Power: Maximum short-term output
- Higher wattage doesn't always mean better sound

IMPEDANCE (Ohms):
- Typically 4, 6, or 8 ohms
- Match amplifier impedance rating to speaker impedance
- Lower impedance draws more current

THD (Total Harmonic Distortion):
- Lower is better (below 0.1% is excellent)
- Indicates audio quality and clarity

SIGNAL-TO-NOISE RATIO (SNR):
- Higher is better (above 100dB is excellent)
- Indicates background noise level

INPUTS/OUTPUTS:
- HDMI, optical, coaxial for digital audio
- RCA, XLR for analog connections
- Check compatibility with your devices

For product-specific specifications, visit our product pages or contact our technical team.`,
    keywords: ['amplifier', 'receiver', 'specifications', 'watts', 'impedance', 'power', 'technical'],
  },
  {
    category: 'troubleshooting',
    title: 'Common Audio Issues and Solutions',
    content: `Troubleshooting common audio problems:

NO SOUND:
- Check all connections are secure
- Verify equipment is powered on
- Check volume levels on all devices
- Ensure correct input source is selected
- Test with different audio source

BUZZING OR HUMMING:
- Separate audio cables from power cables
- Check for ground loops (try a ground loop isolator)
- Ensure all equipment shares the same electrical circuit
- Check for damaged cables

DISTORTED SOUND:
- Reduce volume levels
- Check speaker wire polarity (+ to +, - to -)
- Verify impedance matching between amp and speakers
- Check for blown speakers or damaged drivers

ONE CHANNEL NOT WORKING:
- Swap left/right cables to identify if issue is source or speaker
- Check balance control on amplifier
- Test speakers with different source
- Inspect cables for damage

If problems persist after these steps, contact our technical support team through the portal.`,
    keywords: ['troubleshooting', 'problem', 'issue', 'no sound', 'buzzing', 'distortion', 'fix'],
  },
  {
    category: 'policy',
    title: 'Warranty Information',
    content: `Warranty coverage details:

STANDARD WARRANTY:
- Most products: 12 months from purchase date
- Premium products: 24-36 months (varies by brand)
- Covers manufacturing defects and component failures
- Does not cover physical damage, misuse, or normal wear

WHAT'S COVERED:
- Manufacturing defects
- Component failures under normal use
- Workmanship issues

NOT COVERED:
- Accidental damage
- Water damage
- Modifications or unauthorized repairs
- Commercial or professional use (unless specified)
- Cosmetic damage that doesn't affect functionality

MAKING A WARRANTY CLAIM:
1. Create a support ticket in the customer portal
2. Provide purchase proof and product details
3. Describe the issue with photos if applicable
4. Our team will assess and provide repair/replacement options

Extended warranty options available at purchase for select products.`,
    keywords: ['warranty', 'guarantee', 'coverage', 'repair', 'replacement', 'claim'],
  },
  {
    category: 'faq',
    title: 'How do I schedule a consultation call?',
    content: `Scheduling a consultation call:

ONLINE SCHEDULING:
1. Log in to the customer portal
2. Navigate to "Scheduled Calls"
3. Click "Schedule Call"
4. Select your preferred date and time
5. Provide call purpose and contact details
6. Receive confirmation email

WHAT TO EXPECT:
- Calls typically last 15-30 minutes
- Technical expert will call you at scheduled time
- Have your questions and product information ready
- Call recordings and transcripts available in portal after call

CALL PURPOSES:
- Product recommendations
- Technical support
- Installation guidance
- Custom system design
- General inquiries

You can reschedule or cancel calls up to 24 hours before the scheduled time through the portal.`,
    keywords: ['call', 'consultation', 'schedule', 'appointment', 'talk', 'expert'],
  },
  {
    category: 'faq',
    title: 'Payment Methods and Options',
    content: `Available payment methods:

ONLINE PAYMENTS:
- Credit/Debit Cards (Visa, Mastercard)
- Instant EFT
- PayFast
- SnapScan
- Zapper

PAYMENT PLANS:
- Payflex (4 interest-free installments)
- Layaway options available
- Terms and conditions apply

BUSINESS ACCOUNTS:
- Net 30 terms for approved accounts
- Volume discounts available
- Apply through customer portal

PAYMENT SECURITY:
- All transactions encrypted with SSL
- PCI DSS compliant processing
- We never store full credit card details

For payment issues or questions, create a support ticket with category "Billing" in the customer portal.`,
    keywords: ['payment', 'pay', 'credit card', 'eft', 'financing', 'installments'],
  },
]

async function seedKnowledgeBase() {
  const supabase = getServerSupabase()
  
  console.log('Starting knowledge base seeding...')
  
  try {
    // Clear existing knowledge base (optional)
    const { error: deleteError } = await supabase
      .from('knowledge_base')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all
    
    if (deleteError) {
      console.error('Error clearing knowledge base:', deleteError)
    }
    
    // Insert new articles
    for (const article of knowledgeBaseArticles) {
      const { data, error } = await supabase
        .from('knowledge_base')
        .insert({
          ...article,
          status: 'active',
          source_type: 'manual',
          view_count: 0,
          helpful_count: 0,
          unhelpful_count: 0,
        })
        .select()
        .single()
      
      if (error) {
        console.error(`Error inserting article "${article.title}":`, error)
      } else {
        console.log(`✓ Inserted: ${article.title}`)
      }
    }
    
    console.log('\nKnowledge base seeding completed!')
    console.log(`Total articles: ${knowledgeBaseArticles.length}`)
  } catch (error) {
    console.error('Error seeding knowledge base:', error)
    throw error
  }
}

// Run if called directly
if (require.main === module) {
  seedKnowledgeBase()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error)
      process.exit(1)
    })
}

export { seedKnowledgeBase, knowledgeBaseArticles }
