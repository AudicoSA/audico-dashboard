'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Users, 
  CheckCircle2, 
  Clock, 
  XCircle,
  Mail,
  TrendingUp,
  Edit3,
  Send,
  Sparkles,
  DollarSign,
  Package,
  Calendar,
  Eye,
  MousePointer,
  Instagram,
  Youtube,
  Twitter,
  Linkedin,
  Facebook,
  MessageSquare,
  Plus,
  Filter,
  Search,
  ArrowUpRight,
  AlertCircle
} from 'lucide-react'
import { 
  ResellerApplication, 
  ApprovedReseller,
  ResellerOrder,
  NewsletterDraft,
  InfluencerOpportunity 
} from '@/lib/supabase'

// Mock data
const MOCK_PENDING_APPLICATIONS: ResellerApplication[] = [
  {
    id: '1',
    company_name: 'Tech Solutions SA',
    contact_name: 'Sarah Johnson',
    contact_email: 'sarah@techsolutions.co.za',
    contact_phone: '+27 82 123 4567',
    business_type: 'Retail',
    website: 'www.techsolutions.co.za',
    annual_revenue: 'R1M - R5M',
    target_market: 'Small Business',
    experience_level: 'intermediate',
    status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
    approval_notes: null,
    business_details: { employees: 15, locations: 2 },
    documents: [{ name: 'company_reg.pdf', url: '#' }],
    metadata: {},
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: '2',
    company_name: 'Audio Experts',
    contact_name: 'Mike Peterson',
    contact_email: 'mike@audioexperts.com',
    contact_phone: '+27 71 987 6543',
    business_type: 'Installation',
    website: 'www.audioexperts.com',
    annual_revenue: 'R500K - R1M',
    target_market: 'Residential',
    experience_level: 'advanced',
    status: 'under_review',
    reviewed_by: 'Naledi',
    reviewed_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    approval_notes: 'Checking references',
    business_details: { employees: 8, yearsInBusiness: 5 },
    documents: [],
    metadata: {},
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  }
]

const MOCK_APPROVED_RESELLERS: (ApprovedReseller & { recentOrders: ResellerOrder[] })[] = [
  {
    id: '1',
    application_id: '3',
    company_name: 'Smart Home Pro',
    contact_name: 'John Smith',
    contact_email: 'john@smarthomepro.co.za',
    contact_phone: '+27 83 555 1234',
    website: 'www.smarthomepro.co.za',
    commission_rate: 15.00,
    discount_tier: 'premium',
    total_orders: 24,
    total_revenue: 385000,
    last_order_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    notes: 'Top performer, excellent relationship',
    metadata: {},
    created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    recentOrders: [
      {
        id: '1',
        reseller_id: '1',
        order_reference: 'ORD-2024-001',
        order_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        total_amount: 45000,
        commission_amount: 6750,
        status: 'completed',
        items: [{ name: 'Sonos Arc', qty: 3 }],
        notes: null,
        metadata: {},
        created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: '2',
        reseller_id: '1',
        order_reference: 'ORD-2024-002',
        order_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        total_amount: 28000,
        commission_amount: 4200,
        status: 'completed',
        items: [{ name: 'Sonos Era 300', qty: 4 }],
        notes: null,
        metadata: {},
        created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
      }
    ]
  },
  {
    id: '2',
    application_id: '4',
    company_name: 'Audio Installs Pty',
    contact_name: 'Lisa Williams',
    contact_email: 'lisa@audioinstalls.co.za',
    contact_phone: '+27 82 777 8888',
    website: null,
    commission_rate: 10.00,
    discount_tier: 'standard',
    total_orders: 8,
    total_revenue: 120000,
    last_order_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    notes: null,
    metadata: {},
    created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    recentOrders: [
      {
        id: '3',
        reseller_id: '2',
        order_reference: 'ORD-2024-003',
        order_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        total_amount: 18000,
        commission_amount: 1800,
        status: 'completed',
        items: [{ name: 'Sonos Beam Gen 2', qty: 2 }],
        notes: null,
        metadata: {},
        created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
      }
    ]
  }
]

const MOCK_NEWSLETTERS: NewsletterDraft[] = [
  {
    id: '1',
    title: 'March Product Launch',
    subject_line: '🎉 New Arrivals: Premium Audio Equipment',
    preview_text: 'Discover the latest in home audio technology',
    content: 'We\'re excited to announce new products...',
    html_content: null,
    status: 'draft',
    scheduled_for: null,
    sent_at: null,
    recipient_count: 0,
    open_rate: null,
    click_rate: null,
    ai_suggestions: [
      { type: 'subject', text: 'Add urgency: "Limited Time: New Premium Audio"' },
      { type: 'content', text: 'Include customer testimonial in opening' },
      { type: 'cta', text: 'Use "Shop Now" instead of "View Products"' }
    ],
    created_by: 'Naledi',
    metadata: {},
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  },
  {
    id: '2',
    title: 'February Sales Report',
    subject_line: 'February Highlights & Special Offers',
    preview_text: 'Check out what was hot last month',
    content: 'February was amazing...',
    html_content: '<html>...</html>',
    status: 'sent',
    scheduled_for: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    sent_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    recipient_count: 1250,
    open_rate: 28.5,
    click_rate: 4.2,
    ai_suggestions: [],
    created_by: 'Naledi',
    metadata: {},
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  }
]

const MOCK_INFLUENCERS: InfluencerOpportunity[] = [
  {
    id: '1',
    name: 'Tech Review ZA',
    platform: 'youtube',
    handle: '@techreviewza',
    follower_count: 45000,
    engagement_rate: 6.8,
    niche: 'Tech Reviews',
    status: 'active',
    outreach_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    response_date: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
    campaign_start: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    campaign_end: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString(),
    budget_allocated: 25000,
    budget_spent: 12500,
    deliverables: [
      { type: 'video', title: 'Sonos Arc Review', status: 'completed' },
      { type: 'short', title: 'Quick Setup Guide', status: 'in_progress' }
    ],
    performance_metrics: {
      reach: 89000,
      impressions: 125000,
      clicks: 2100,
      conversions: 45
    },
    notes: 'Great engagement, professional content',
    managed_by: 'Naledi',
    metadata: {},
    created_at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: '2',
    name: 'Smart Home Sarah',
    platform: 'instagram',
    handle: '@smarthomesarah',
    follower_count: 28000,
    engagement_rate: 8.5,
    niche: 'Home Automation',
    status: 'negotiating',
    outreach_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    response_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    campaign_start: null,
    campaign_end: null,
    budget_allocated: 15000,
    budget_spent: 0,
    deliverables: [],
    performance_metrics: {
      reach: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0
    },
    notes: 'Discussing partnership details',
    managed_by: 'Naledi',
    metadata: {},
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: '3',
    name: 'Audio Enthusiast',
    platform: 'twitter',
    handle: '@audiophile_za',
    follower_count: 12000,
    engagement_rate: 5.2,
    niche: 'Audio Equipment',
    status: 'contacted',
    outreach_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    response_date: null,
    campaign_start: null,
    campaign_end: null,
    budget_allocated: 8000,
    budget_spent: 0,
    deliverables: [],
    performance_metrics: {
      reach: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0
    },
    notes: 'Waiting for response',
    managed_by: 'Naledi',
    metadata: {},
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  }
]

export default function MarketingAgentPage() {
  const [applications, setApplications] = useState<ResellerApplication[]>(MOCK_PENDING_APPLICATIONS)
  const [resellers, setResellers] = useState<(ApprovedReseller & { recentOrders: ResellerOrder[] })[]>(MOCK_APPROVED_RESELLERS)
  const [newsletters, setNewsletters] = useState<NewsletterDraft[]>(MOCK_NEWSLETTERS)
  const [influencers, setInfluencers] = useState<InfluencerOpportunity[]>(MOCK_INFLUENCERS)
  const [selectedTab, setSelectedTab] = useState<'resellers' | 'newsletters' | 'influencers'>('resellers')
  const [selectedNewsletter, setSelectedNewsletter] = useState<NewsletterDraft | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const res = await fetch('/api/agents/marketing')
      if (res.ok) {
        const data = await res.json()
        if (data.applications) setApplications(data.applications)
        if (data.resellers) setResellers(data.resellers)
        if (data.newsletters) setNewsletters(data.newsletters)
        if (data.influencers) setInfluencers(data.influencers)
      }
    } catch (err) {
      console.log('Using mock data - API not connected')
    }
  }

  const handleApplicationAction = async (id: string, action: 'approve' | 'reject') => {
    const application = applications.find(a => a.id === id)
    if (!application) return

    setApplications(prev => prev.map(a => 
      a.id === id 
        ? { ...a, status: action === 'approve' ? 'approved' as const : 'rejected' as const, reviewed_by: 'Naledi', reviewed_at: new Date().toISOString() }
        : a
    ))

    try {
      await fetch(`/api/agents/marketing/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
    } catch (err) {
      console.log('API not connected - action saved locally')
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 0 }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    const diff = Date.now() - date.getTime()
    const days = Math.floor(diff / (24 * 60 * 60 * 1000))
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    return date.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' })
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'instagram': return <Instagram size={16} />
      case 'youtube': return <Youtube size={16} />
      case 'twitter': return <Twitter size={16} />
      case 'linkedin': return <Linkedin size={16} />
      case 'facebook': return <Facebook size={16} />
      default: return <MessageSquare size={16} />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between"
      >
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <TrendingUp className="text-pink-400" />
            Marketing Agent
          </h2>
          <p className="text-gray-400 mt-1">Reseller management, newsletters, and influencer partnerships</p>
        </div>
      </motion.div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-white/5">
        <button
          onClick={() => setSelectedTab('resellers')}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
            selectedTab === 'resellers' 
              ? 'text-pink-400' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Users size={16} className="inline mr-2" />
          Resellers
          {selectedTab === 'resellers' && (
            <motion.div 
              layoutId="activeTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-pink-400"
            />
          )}
        </button>
        <button
          onClick={() => setSelectedTab('newsletters')}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
            selectedTab === 'newsletters' 
              ? 'text-pink-400' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Mail size={16} className="inline mr-2" />
          Newsletters
          {selectedTab === 'newsletters' && (
            <motion.div 
              layoutId="activeTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-pink-400"
            />
          )}
        </button>
        <button
          onClick={() => setSelectedTab('influencers')}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
            selectedTab === 'influencers' 
              ? 'text-pink-400' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Sparkles size={16} className="inline mr-2" />
          Influencers
          {selectedTab === 'influencers' && (
            <motion.div 
              layoutId="activeTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-pink-400"
            />
          )}
        </button>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {selectedTab === 'resellers' && (
          <motion.div
            key="resellers"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Pending Applications */}
            <div>
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Clock className="text-yellow-400" size={20} />
                Pending Applications ({applications.filter(a => a.status === 'pending' || a.status === 'under_review').length})
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {applications.filter(a => a.status === 'pending' || a.status === 'under_review').map(app => (
                  <motion.div
                    key={app.id}
                    layout
                    className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-4 hover:border-pink-500/30 transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="text-lg font-semibold text-white">{app.company_name}</h4>
                        <p className="text-sm text-gray-400">{app.contact_name} • {app.contact_email}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-md border ${
                        app.status === 'under_review' 
                          ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                          : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                      }`}>
                        {app.status === 'under_review' ? 'Under Review' : 'Pending'}
                      </span>
                    </div>
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-500">Type:</span>
                        <span className="text-white">{app.business_type}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-500">Experience:</span>
                        <span className="text-white capitalize">{app.experience_level}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-500">Revenue:</span>
                        <span className="text-white">{app.annual_revenue}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-500">Applied:</span>
                        <span className="text-white">{formatDate(app.created_at)}</span>
                      </div>
                    </div>
                    {app.status === 'under_review' && app.approval_notes && (
                      <div className="mb-4 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <p className="text-xs text-blue-300">{app.approval_notes}</p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApplicationAction(app.id, 'approve')}
                        className="flex-1 px-3 py-2 bg-lime-400/10 hover:bg-lime-400/20 text-lime-400 text-sm font-medium rounded-xl transition-colors border border-lime-500/30 flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 size={16} />
                        Approve
                      </button>
                      <button
                        onClick={() => handleApplicationAction(app.id, 'reject')}
                        className="flex-1 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-xl transition-colors border border-red-500/30 flex items-center justify-center gap-2"
                      >
                        <XCircle size={16} />
                        Reject
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Approved Resellers */}
            <div>
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <CheckCircle2 className="text-lime-400" size={20} />
                Approved Resellers ({resellers.length})
              </h3>
              <div className="space-y-4">
                {resellers.map(reseller => (
                  <motion.div
                    key={reseller.id}
                    layout
                    className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-4 hover:border-pink-500/30 transition-all"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-lg font-semibold text-white">{reseller.company_name}</h4>
                          <span className={`text-xs px-2 py-1 rounded-md border ${
                            reseller.discount_tier === 'platinum' 
                              ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                              : reseller.discount_tier === 'premium'
                              ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                              : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                          }`}>
                            {reseller.discount_tier}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400">{reseller.contact_name} • {reseller.contact_email}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">{reseller.total_orders}</div>
                        <div className="text-xs text-gray-500">Total Orders</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="bg-[#252525] rounded-xl p-3">
                        <div className="flex items-center gap-2 text-gray-400 mb-1">
                          <DollarSign size={14} />
                          <span className="text-xs">Total Revenue</span>
                        </div>
                        <div className="text-lg font-bold text-white">{formatCurrency(reseller.total_revenue)}</div>
                      </div>
                      <div className="bg-[#252525] rounded-xl p-3">
                        <div className="flex items-center gap-2 text-gray-400 mb-1">
                          <TrendingUp size={14} />
                          <span className="text-xs">Commission Rate</span>
                        </div>
                        <div className="text-lg font-bold text-white">{reseller.commission_rate}%</div>
                      </div>
                      <div className="bg-[#252525] rounded-xl p-3">
                        <div className="flex items-center gap-2 text-gray-400 mb-1">
                          <Calendar size={14} />
                          <span className="text-xs">Last Order</span>
                        </div>
                        <div className="text-sm font-semibold text-white">{formatDate(reseller.last_order_date)}</div>
                      </div>
                      <div className="bg-[#252525] rounded-xl p-3">
                        <div className="flex items-center gap-2 text-gray-400 mb-1">
                          <Package size={14} />
                          <span className="text-xs">Status</span>
                        </div>
                        <div className="text-sm font-semibold text-lime-400 capitalize">{reseller.status}</div>
                      </div>
                    </div>

                    {reseller.recentOrders.length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium text-gray-400 mb-2">Recent Orders</h5>
                        <div className="space-y-2">
                          {reseller.recentOrders.slice(0, 3).map(order => (
                            <div key={order.id} className="flex items-center justify-between p-2 bg-[#252525] rounded-lg">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-white">{order.order_reference}</div>
                                <div className="text-xs text-gray-500">{formatDate(order.order_date)}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-semibold text-white">{formatCurrency(order.total_amount)}</div>
                                <div className="text-xs text-gray-500">Commission: {formatCurrency(order.commission_amount)}</div>
                              </div>
                              <div className={`ml-3 text-xs px-2 py-1 rounded-md ${
                                order.status === 'completed' 
                                  ? 'bg-lime-500/20 text-lime-400'
                                  : order.status === 'processing'
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : 'bg-yellow-500/20 text-yellow-400'
                              }`}>
                                {order.status}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {selectedTab === 'newsletters' && (
          <motion.div
            key="newsletters"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Newsletter List */}
            <div className="lg:col-span-1 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Drafts & Sent</h3>
                <button className="p-2 bg-pink-400/10 hover:bg-pink-400/20 rounded-xl transition-colors text-pink-400">
                  <Plus size={18} />
                </button>
              </div>
              {newsletters.map(newsletter => (
                <motion.div
                  key={newsletter.id}
                  onClick={() => setSelectedNewsletter(newsletter)}
                  className={`bg-[#1c1c1c] border rounded-2xl p-4 cursor-pointer transition-all ${
                    selectedNewsletter?.id === newsletter.id
                      ? 'border-pink-500/50 bg-pink-500/5'
                      : 'border-white/5 hover:border-pink-500/30'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-semibold text-white">{newsletter.title}</h4>
                    <span className={`text-xs px-2 py-1 rounded-md border ${
                      newsletter.status === 'sent'
                        ? 'bg-lime-500/20 text-lime-400 border-lime-500/30'
                        : newsletter.status === 'scheduled'
                        ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                        : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                    }`}>
                      {newsletter.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">{newsletter.subject_line}</p>
                  {newsletter.status === 'sent' && newsletter.open_rate && (
                    <div className="flex gap-3 text-xs">
                      <div className="flex items-center gap-1 text-gray-500">
                        <Eye size={12} />
                        {newsletter.open_rate}%
                      </div>
                      <div className="flex items-center gap-1 text-gray-500">
                        <MousePointer size={12} />
                        {newsletter.click_rate}%
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Newsletter Editor */}
            <div className="lg:col-span-2">
              {selectedNewsletter ? (
                <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-white">{selectedNewsletter.title}</h3>
                      <p className="text-sm text-gray-400 mt-1">Last updated {formatDate(selectedNewsletter.updated_at)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white text-sm rounded-xl transition-colors flex items-center gap-2">
                        <Edit3 size={16} />
                        Edit
                      </button>
                      {selectedNewsletter.status === 'draft' && (
                        <button className="px-3 py-2 bg-pink-400/10 hover:bg-pink-400/20 text-pink-400 text-sm font-medium rounded-xl transition-colors border border-pink-500/30 flex items-center gap-2">
                          <Send size={16} />
                          Schedule
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Subject Line</label>
                      <input
                        type="text"
                        value={selectedNewsletter.subject_line}
                        readOnly
                        className="w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Preview Text</label>
                      <input
                        type="text"
                        value={selectedNewsletter.preview_text || ''}
                        readOnly
                        className="w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Content</label>
                      <textarea
                        value={selectedNewsletter.content}
                        readOnly
                        rows={8}
                        className="w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2 text-white resize-none"
                      />
                    </div>

                    {selectedNewsletter.ai_suggestions.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                          <Sparkles className="text-pink-400" size={16} />
                          AI Suggestions
                        </h4>
                        <div className="space-y-2">
                          {selectedNewsletter.ai_suggestions.map((suggestion: any, idx: number) => (
                            <div key={idx} className="bg-pink-500/5 border border-pink-500/20 rounded-xl p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <span className="text-xs font-medium text-pink-400 uppercase">{suggestion.type}</span>
                                  <p className="text-sm text-gray-300 mt-1">{suggestion.text}</p>
                                </div>
                                <button className="text-xs text-pink-400 hover:text-pink-300 transition-colors">
                                  Apply
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedNewsletter.status === 'sent' && (
                      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/5">
                        <div className="bg-[#252525] rounded-xl p-4 text-center">
                          <div className="text-2xl font-bold text-white">{selectedNewsletter.recipient_count}</div>
                          <div className="text-xs text-gray-500 mt-1">Recipients</div>
                        </div>
                        <div className="bg-[#252525] rounded-xl p-4 text-center">
                          <div className="text-2xl font-bold text-white">{selectedNewsletter.open_rate}%</div>
                          <div className="text-xs text-gray-500 mt-1">Open Rate</div>
                        </div>
                        <div className="bg-[#252525] rounded-xl p-4 text-center">
                          <div className="text-2xl font-bold text-white">{selectedNewsletter.click_rate}%</div>
                          <div className="text-xs text-gray-500 mt-1">Click Rate</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-12 text-center">
                  <Mail className="mx-auto text-gray-600 mb-4" size={48} />
                  <h3 className="text-lg font-semibold text-gray-400">Select a newsletter to edit</h3>
                  <p className="text-sm text-gray-600 mt-2">Choose from the list or create a new one</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {selectedTab === 'influencers' && (
          <motion.div
            key="influencers"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-2">
                <button className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white text-sm rounded-lg transition-colors">
                  All
                </button>
                <button className="px-3 py-1.5 text-gray-400 hover:text-white text-sm transition-colors">
                  Active
                </button>
                <button className="px-3 py-1.5 text-gray-400 hover:text-white text-sm transition-colors">
                  Negotiating
                </button>
                <button className="px-3 py-1.5 text-gray-400 hover:text-white text-sm transition-colors">
                  Contacted
                </button>
              </div>
              <button className="px-4 py-2 bg-pink-400/10 hover:bg-pink-400/20 text-pink-400 text-sm font-medium rounded-xl transition-colors border border-pink-500/30 flex items-center gap-2">
                <Plus size={16} />
                Add Opportunity
              </button>
            </div>

            {influencers.map(influencer => (
              <motion.div
                key={influencer.id}
                layout
                className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-5 hover:border-pink-500/30 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center text-white font-bold">
                      {influencer.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-white">{influencer.name}</h4>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        {getPlatformIcon(influencer.platform)}
                        <span>{influencer.handle}</span>
                        <span>•</span>
                        <span>{influencer.niche}</span>
                      </div>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-md border ${
                    influencer.status === 'active'
                      ? 'bg-lime-500/20 text-lime-400 border-lime-500/30'
                      : influencer.status === 'negotiating'
                      ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                      : influencer.status === 'contacted'
                      ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                      : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  }`}>
                    {influencer.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                  <div className="bg-[#252525] rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Followers</div>
                    <div className="text-lg font-bold text-white">
                      {influencer.follower_count ? (influencer.follower_count / 1000).toFixed(1) + 'K' : 'N/A'}
                    </div>
                  </div>
                  <div className="bg-[#252525] rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Engagement</div>
                    <div className="text-lg font-bold text-white">
                      {influencer.engagement_rate ? influencer.engagement_rate + '%' : 'N/A'}
                    </div>
                  </div>
                  <div className="bg-[#252525] rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Budget</div>
                    <div className="text-sm font-semibold text-white">
                      {influencer.budget_allocated ? formatCurrency(influencer.budget_allocated) : 'N/A'}
                    </div>
                  </div>
                  <div className="bg-[#252525] rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Spent</div>
                    <div className="text-sm font-semibold text-white">
                      {formatCurrency(influencer.budget_spent)}
                    </div>
                  </div>
                  <div className="bg-[#252525] rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Conversions</div>
                    <div className="text-lg font-bold text-white">
                      {influencer.performance_metrics.conversions}
                    </div>
                  </div>
                </div>

                {influencer.status === 'active' && influencer.performance_metrics.reach > 0 && (
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-[#252525] rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">Reach</div>
                      <div className="text-sm font-semibold text-white">
                        {(influencer.performance_metrics.reach / 1000).toFixed(1)}K
                      </div>
                    </div>
                    <div className="bg-[#252525] rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">Impressions</div>
                      <div className="text-sm font-semibold text-white">
                        {(influencer.performance_metrics.impressions / 1000).toFixed(1)}K
                      </div>
                    </div>
                    <div className="bg-[#252525] rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">Clicks</div>
                      <div className="text-sm font-semibold text-white">
                        {influencer.performance_metrics.clicks}
                      </div>
                    </div>
                  </div>
                )}

                {influencer.deliverables.length > 0 && (
                  <div className="mb-4">
                    <h5 className="text-sm font-medium text-gray-400 mb-2">Deliverables</h5>
                    <div className="space-y-2">
                      {influencer.deliverables.map((deliverable: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-[#252525] rounded-lg">
                          <div>
                            <span className="text-sm text-white">{deliverable.title}</span>
                            <span className="text-xs text-gray-500 ml-2">({deliverable.type})</span>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded ${
                            deliverable.status === 'completed'
                              ? 'bg-lime-500/20 text-lime-400'
                              : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {deliverable.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <div className="text-sm text-gray-400">
                    {influencer.outreach_date && (
                      <span>Contacted {formatDate(influencer.outreach_date)}</span>
                    )}
                  </div>
                  <button className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white text-sm rounded-lg transition-colors flex items-center gap-2">
                    View Details
                    <ArrowUpRight size={14} />
                  </button>
                </div>

                {influencer.notes && (
                  <div className="mt-3 p-2 bg-pink-500/5 border border-pink-500/10 rounded-lg">
                    <p className="text-xs text-gray-400">{influencer.notes}</p>
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
