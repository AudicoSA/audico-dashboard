export const testProducts = [
  {
    id: 'prod-1',
    name: 'Smart LED Light Bulb',
    description: 'Wi-Fi enabled LED bulb with color changing capabilities',
    price: 29.99,
    cost: 15.00,
    category: 'Lighting',
    brand: 'SmartTech',
    sku: 'LED-001',
    features: ['Wi-Fi', 'Color changing', 'Voice control']
  },
  {
    id: 'prod-2',
    name: 'Smart Door Lock',
    description: 'Keyless entry smart lock with remote access',
    price: 149.99,
    cost: 80.00,
    category: 'Security',
    brand: 'SecureHome',
    sku: 'LOCK-001',
    features: ['Keyless', 'Remote access', 'Auto-lock']
  }
]

export const testSocialPosts = [
  {
    id: 'post-1',
    platform: 'facebook',
    content: 'Check out our new smart lighting collection!',
    status: 'draft',
    created_by: 'Lerato',
    metadata: {
      target_keywords: ['smart home', 'lighting', 'automation'],
      products_referenced: [{ id: 'prod-1', name: 'Smart LED Light Bulb' }]
    }
  },
  {
    id: 'post-2',
    platform: 'instagram',
    content: 'Secure your home with our smart door locks 🔒',
    status: 'scheduled',
    scheduled_for: new Date(Date.now() + 86400000).toISOString(),
    created_by: 'Lerato',
    metadata: {
      target_keywords: ['security', 'smart lock', 'home security'],
      products_referenced: [{ id: 'prod-2', name: 'Smart Door Lock' }]
    }
  }
]

export const testEmailLogs = [
  {
    id: 'email-1',
    message_id: 'msg123',
    from: 'customer@example.com',
    to: 'support@audico.com',
    subject: 'Product Question',
    body: 'I would like to know more about your smart lighting products.',
    category: 'unclassified',
    status: 'received',
    received_at: new Date().toISOString()
  },
  {
    id: 'email-2',
    message_id: 'msg456',
    from: 'vendor@supplier.com',
    to: 'orders@audico.com',
    subject: 'Invoice INV-001',
    body: 'Please find attached invoice for your recent order.',
    category: 'vendor',
    status: 'classified',
    received_at: new Date().toISOString()
  }
]

export const testAdCampaigns = [
  {
    id: 'campaign-1',
    name: 'Smart Home Summer Sale',
    platform: 'google_ads',
    status: 'active',
    budget_total: 5000,
    budget_spent: 2500,
    currency: 'ZAR',
    performance_metrics: {
      impressions: 10000,
      clicks: 500,
      conversions: 25,
      ctr: 5.0,
      cpc: 5.0,
      cpa: 100.0,
      roas: 3.0,
      spend: 2500,
      revenue: 7500
    },
    managed_by: 'Marcus',
    metadata: {
      google_campaign_id: '123456'
    }
  }
]

export const testSEOAudits = [
  {
    id: 'audit-1',
    url: 'https://example.com/product/smart-bulb',
    audit_type: 'content',
    status: 'completed',
    score: 65,
    issues_found: [
      { type: 'short_description', severity: 'high', field: 'description', message: 'Description too short' }
    ],
    recommendations: [
      { type: 'content', priority: 'high', action: 'Expand description', details: 'Add at least 200 words' }
    ],
    metrics: {
      product_id: 1,
      product_name: 'Smart LED Bulb'
    },
    performed_by: 'seo_agent',
    completed_at: new Date().toISOString()
  }
]

export const testResellerApplications = [
  {
    id: 'app-1',
    company_name: 'Tech Retailers Inc',
    contact_name: 'John Smith',
    contact_email: 'john@techretailers.com',
    contact_phone: '+1234567890',
    status: 'pending',
    business_details: {
      address: '123 Business St, City',
      type: 'retail'
    }
  }
]

export const testApprovedResellers = [
  {
    id: 'reseller-1',
    company_name: 'Best Electronics',
    contact_name: 'Jane Doe',
    contact_email: 'jane@bestelectronics.com',
    status: 'active',
    discount_tier: 'standard',
    commission_rate: 10,
    total_orders: 5,
    total_revenue: 5000,
    metadata: {}
  }
]

export const testSquadMessages = [
  {
    from_agent: 'orchestrator',
    to_agent: null,
    message: 'System initialized',
    data: { action: 'startup' }
  }
]
