'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Megaphone,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  Mail,
  Phone,
  MessageSquare,
  Sparkles,
  TrendingUp,
  Users,
  FileText,
  Send,
  Edit3,
  Calendar,
  DollarSign,
  Package,
  Eye,
  Twitter,
  Instagram,
  Youtube,
  Facebook,
  Linkedin,
  ExternalLink,
  UserPlus,
  Target,
  Filter,
  Search,
  BarChart3
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ResellerApplication {
  id: string
  company_name: string
  contact_name: string
  contact_email: string
  contact_phone: string | null
  business_type: string | null
  website: string | null
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'on_hold'
  reviewed_by: string | null
  reviewed_at: string | null
  approval_notes: string | null
  business_details: any
  created_at: string
  updated_at: string
}

interface ResellerOrder {
  id: string
  reseller_id: string
  order_number: string
  total_amount: number
  currency: string
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
  items: any[]
  payment_status: 'unpaid' | 'partial' | 'paid' | 'refunded'
  ordered_at: string
  created_at: string
}

interface NewsletterDraft {
  id: string
  title: string
  subject_line: string
  content: string
  status: 'draft' | 'ai_suggested' | 'reviewed' | 'scheduled' | 'sent'
  scheduled_for: string | null
  sent_at: string | null
  recipient_count: number
  open_rate: number
  click_rate: number
  ai_suggestions: Array<{
    type: string
    suggestion: string
  }>
  created_by: string | null
  created_at: string
}

interface InfluencerOpportunity {
  id: string
  influencer_name: string
  platform: 'instagram' | 'youtube' | 'tiktok' | 'twitter' | 'facebook' | 'linkedin'
  handle: string
  followers_count: number
  engagement_rate: number
  niche: string | null
  status: 'identified' | 'contacted' | 'in_discussion' | 'agreed' | 'active' | 'completed' | 'rejected'
  contact_email: string | null
  deal_type: 'sponsored_post' | 'product_review' | 'affiliate' | 'brand_ambassador' | 'giveaway' | 'collaboration' | null
  compensation_offered: string | null
  expected_reach: number
  engagement_metrics: {
    likes: number
    comments: number
    shares: number
    views: number
  }
  notes: string | null
  contacted_at: string | null
  created_at: string
}

interface OutreachTracking {
  id: string
  campaign_name: string
  outreach_type: 'email' | 'social_dm' | 'phone_call' | 'linkedin_message' | 'partnership_inquiry'
  target_name: string
  target_email: string | null
  target_company: string | null
  status: 'pending' | 'sent' | 'opened' | 'replied' | 'meeting_scheduled' | 'deal_closed' | 'no_response' | 'rejected'
  message_content: string | null
  response_content: string | null
  follow_up_date: string | null
  outcome: string | null
  conversion_value: number | null
  sent_at: string | null
  replied_at: string | null
  created_at: string
}

const PLATFORM_ICONS = {
  instagram: Instagram,
  youtube: Youtube,
  tiktok: MessageSquare,
  twitter: Twitter,
  facebook: Facebook,
  linkedin: Linkedin
}

const PLATFORM_COLORS = {
  instagram: '#E4405F',
  youtube: '#FF0000',
  tiktok: '#000000',
  twitter: '#1DA1F2',
  facebook: '#1877F2',
  linkedin: '#0A66C2'
}

const STATUS_COLORS = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  under_review: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  approved: 'bg-lime-500/20 text-lime-400 border-lime-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  on_hold: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  identified: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  contacted: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  in_discussion: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  agreed: 'bg-lime-500/20 text-lime-400 border-lime-500/30',
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  completed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  sent: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  opened: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  replied: 'bg-lime-500/20 text-lime-400 border-lime-500/30',
  meeting_scheduled: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  deal_closed: 'bg-green-500/20 text-green-400 border-green-500/30',
  no_response: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  ai_suggested: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  reviewed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  scheduled: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  confirmed: 'bg-lime-500/20 text-lime-400 border-lime-500/30',
  shipped: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  delivered: 'bg-green-500/20 text-green-400 border-green-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  unpaid: 'bg-red-500/20 text-red-400 border-red-500/30',
  partial: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  paid: 'bg-lime-500/20 text-lime-400 border-lime-500/30',
  refunded: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
}

export default function MarketingAgentPanel() {
  const [applications, setApplications] = useState<ResellerApplication[]>([])
  const [newsletters, setNewsletters] = useState<NewsletterDraft[]>([])
  const [influencers, setInfluencers] = useState<InfluencerOpportunity[]>([])
  const [outreach, setOutreach] = useState<OutreachTracking[]>([])
  const [resellerOrders, setResellerOrders] = useState<ResellerOrder[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedApplication, setSelectedApplication] = useState<ResellerApplication | null>(null)
  const [selectedNewsletter, setSelectedNewsletter] = useState<NewsletterDraft | null>(null)
  const [selectedInfluencer, setSelectedInfluencer] = useState<InfluencerOpportunity | null>(null)
  const [activeSection, setActiveSection] = useState<'resellers' | 'newsletters' | 'influencers' | 'outreach'>('resellers')
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  useEffect(() => {
    fetchAllData()
    
    const channels = [
      supabase.channel('reseller_applications_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reseller_applications' }, handleRealtimeUpdate('applications'))
        .subscribe(),
      supabase.channel('newsletter_drafts_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'newsletter_drafts' }, handleRealtimeUpdate('newsletters'))
        .subscribe(),
      supabase.channel('influencer_opportunities_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'influencer_opportunities' }, handleRealtimeUpdate('influencers'))
        .subscribe(),
      supabase.channel('outreach_tracking_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'outreach_tracking' }, handleRealtimeUpdate('outreach'))
        .subscribe(),
      supabase.channel('reseller_orders_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reseller_orders' }, handleRealtimeUpdate('orders'))
        .subscribe()
    ]

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel))
    }
  }, [])

  const handleRealtimeUpdate = (type: string) => (payload: any) => {
    if (payload.eventType === 'INSERT') {
      if (type === 'applications') setApplications(prev => [payload.new, ...prev])
      else if (type === 'newsletters') setNewsletters(prev => [payload.new, ...prev])
      else if (type === 'influencers') setInfluencers(prev => [payload.new, ...prev])
      else if (type === 'outreach') setOutreach(prev => [payload.new, ...prev])
      else if (type === 'orders') setResellerOrders(prev => [payload.new, ...prev])
    } else if (payload.eventType === 'UPDATE') {
      if (type === 'applications') {
        setApplications(prev => prev.map(a => a.id === payload.new.id ? payload.new : a))
        if (selectedApplication?.id === payload.new.id) setSelectedApplication(payload.new)
      } else if (type === 'newsletters') {
        setNewsletters(prev => prev.map(n => n.id === payload.new.id ? payload.new : n))
        if (selectedNewsletter?.id === payload.new.id) setSelectedNewsletter(payload.new)
      } else if (type === 'influencers') {
        setInfluencers(prev => prev.map(i => i.id === payload.new.id ? payload.new : i))
        if (selectedInfluencer?.id === payload.new.id) setSelectedInfluencer(payload.new)
      } else if (type === 'outreach') {
        setOutreach(prev => prev.map(o => o.id === payload.new.id ? payload.new : o))
      } else if (type === 'orders') {
        setResellerOrders(prev => prev.map(o => o.id === payload.new.id ? payload.new : o))
      }
    } else if (payload.eventType === 'DELETE') {
      if (type === 'applications') setApplications(prev => prev.filter(a => a.id !== payload.old.id))
      else if (type === 'newsletters') setNewsletters(prev => prev.filter(n => n.id !== payload.old.id))
      else if (type === 'influencers') setInfluencers(prev => prev.filter(i => i.id !== payload.old.id))
      else if (type === 'outreach') setOutreach(prev => prev.filter(o => o.id !== payload.old.id))
      else if (type === 'orders') setResellerOrders(prev => prev.filter(o => o.id !== payload.old.id))
    }
  }

  const fetchAllData = async () => {
    setIsLoading(true)
    try {
      const [appsData, newslettersData, influencersData, outreachData, ordersData] = await Promise.all([
        supabase.from('reseller_applications').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('newsletter_drafts').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('influencer_opportunities').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('outreach_tracking').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('reseller_orders').select('*').order('created_at', { ascending: false }).limit(100)
      ])

      if (appsData.data) setApplications(appsData.data)
      if (newslettersData.data) setNewsletters(newslettersData.data)
      if (influencersData.data) setInfluencers(influencersData.data)
      if (outreachData.data) setOutreach(outreachData.data)
      if (ordersData.data) setResellerOrders(ordersData.data)
    } catch (err) {
      console.error('Failed to fetch marketing data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleApproveApplication = async (app: ResellerApplication) => {
    setActioningId(app.id)
    try {
      const { error } = await supabase
        .from('reseller_applications')
        .update({ 
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', app.id)
      
      if (!error) await fetchAllData()
    } catch (err) {
      console.error('Failed to approve application:', err)
    } finally {
      setActioningId(null)
    }
  }

  const handleRejectApplication = async (app: ResellerApplication) => {
    setActioningId(app.id)
    try {
      const { error } = await supabase
        .from('reseller_applications')
        .update({ 
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', app.id)
      
      if (!error) await fetchAllData()
    } catch (err) {
      console.error('Failed to reject application:', err)
    } finally {
      setActioningId(null)
    }
  }

  const handleUpdateInfluencer = async (id: string, status: string) => {
    setActioningId(id)
    try {
      const { error } = await supabase
        .from('influencer_opportunities')
        .update({ 
          status,
          contacted_at: status === 'contacted' ? new Date().toISOString() : undefined,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
      
      if (!error) await fetchAllData()
    } catch (err) {
      console.error('Failed to update influencer:', err)
    } finally {
      setActioningId(null)
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const diff = Date.now() - new Date(dateString).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  const formatCurrency = (amount: number, currency: string = 'ZAR') => {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency }).format(amount)
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const filteredApplications = applications.filter(app => {
    if (filterStatus !== 'all' && app.status !== filterStatus) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        app.company_name.toLowerCase().includes(query) ||
        app.contact_name.toLowerCase().includes(query) ||
        app.contact_email.toLowerCase().includes(query)
      )
    }
    return true
  })

  const filteredInfluencers = influencers.filter(inf => {
    if (filterStatus !== 'all' && inf.status !== filterStatus) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        inf.influencer_name.toLowerCase().includes(query) ||
        inf.handle.toLowerCase().includes(query) ||
        inf.niche?.toLowerCase().includes(query)
      )
    }
    return true
  })

  const filteredOutreach = outreach.filter(out => {
    if (filterStatus !== 'all' && out.status !== filterStatus) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        out.campaign_name.toLowerCase().includes(query) ||
        out.target_name.toLowerCase().includes(query) ||
        out.target_company?.toLowerCase().includes(query)
      )
    }
    return true
  })

  const pendingApplications = filteredApplications.filter(a => a.status === 'pending' || a.status === 'under_review')
  const approvedResellers = filteredApplications.filter(a => a.status === 'approved')
  const activeInfluencers = filteredInfluencers.filter(i => i.status === 'active' || i.status === 'agreed')
  const potentialInfluencers = filteredInfluencers.filter(i => i.status === 'identified' || i.status === 'contacted')

  const totalResellerRevenue = resellerOrders
    .filter(o => o.status !== 'cancelled' && o.payment_status !== 'refunded')
    .reduce((sum, o) => sum + o.total_amount, 0)

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between"
      >
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={fetchAllData}
            disabled={isLoading}
            className="px-4 py-2 bg-lime-400 hover:bg-lime-500 text-black font-bold rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 shadow-[0_0_15px_rgba(163,230,53,0.3)]"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="bg-[#1c1c1c] border border-white/5 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-lime-500/50 w-64"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-[#1c1c1c] border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-lime-500/50 appearance-none cursor-pointer"
          >
            <option value="all">All Status</option>
            {activeSection === 'resellers' && (
              <>
                <option value="pending">Pending</option>
                <option value="under_review">Under Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </>
            )}
            {activeSection === 'influencers' && (
              <>
                <option value="identified">Identified</option>
                <option value="contacted">Contacted</option>
                <option value="in_discussion">In Discussion</option>
                <option value="agreed">Agreed</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </>
            )}
            {activeSection === 'outreach' && (
              <>
                <option value="pending">Pending</option>
                <option value="sent">Sent</option>
                <option value="opened">Opened</option>
                <option value="replied">Replied</option>
                <option value="deal_closed">Deal Closed</option>
              </>
            )}
          </select>
        </div>
      </motion.div>

      {/* Section Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { id: 'resellers' as const, name: 'Reseller Applications', icon: Users },
          { id: 'newsletters' as const, name: 'Newsletter Drafts', icon: Mail },
          { id: 'influencers' as const, name: 'Influencer Opportunities', icon: TrendingUp },
          { id: 'outreach' as const, name: 'Outreach Tracking', icon: Target }
        ].map((section) => {
          const Icon = section.icon
          return (
            <button
              key={section.id}
              onClick={() => {
                setActiveSection(section.id)
                setFilterStatus('all')
              }}
              className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-all ${
                activeSection === section.id
                  ? 'bg-lime-400 text-black'
                  : 'bg-[#1c1c1c] text-gray-400 hover:text-white border border-white/5'
              }`}
            >
              <Icon size={16} />
              {section.name}
            </button>
          )
        })}
      </div>

      {/* Stats Row */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <StatCard label="Pending Applications" value={pendingApplications.length} color="text-yellow-400" icon={Clock} />
        <StatCard label="Approved Resellers" value={approvedResellers.length} color="text-lime-400" icon={CheckCircle2} />
        <StatCard label="Active Influencers" value={activeInfluencers.length} color="text-purple-400" icon={TrendingUp} />
        <StatCard label="Reseller Revenue" value={formatCurrency(totalResellerRevenue)} color="text-green-400" icon={DollarSign} isValue />
      </motion.div>

      {/* Content Sections */}
      <AnimatePresence mode="wait">
        {activeSection === 'resellers' && (
          <ResellerSection
            pendingApplications={pendingApplications}
            approvedResellers={approvedResellers}
            resellerOrders={resellerOrders}
            selectedApplication={selectedApplication}
            setSelectedApplication={setSelectedApplication}
            handleApproveApplication={handleApproveApplication}
            handleRejectApplication={handleRejectApplication}
            actioningId={actioningId}
            formatTimeAgo={formatTimeAgo}
            formatCurrency={formatCurrency}
          />
        )}

        {activeSection === 'newsletters' && (
          <NewsletterSection
            newsletters={newsletters}
            selectedNewsletter={selectedNewsletter}
            setSelectedNewsletter={setSelectedNewsletter}
            formatTimeAgo={formatTimeAgo}
          />
        )}

        {activeSection === 'influencers' && (
          <InfluencerSection
            potentialInfluencers={potentialInfluencers}
            activeInfluencers={activeInfluencers}
            selectedInfluencer={selectedInfluencer}
            setSelectedInfluencer={setSelectedInfluencer}
            handleUpdateInfluencer={handleUpdateInfluencer}
            actioningId={actioningId}
            formatTimeAgo={formatTimeAgo}
            formatNumber={formatNumber}
          />
        )}

        {activeSection === 'outreach' && (
          <OutreachSection
            outreach={filteredOutreach}
            formatTimeAgo={formatTimeAgo}
            formatCurrency={formatCurrency}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function StatCard({ label, value, color, icon: Icon, isValue = false }: { 
  label: string
  value: number | string
  color: string
  icon: any
  isValue?: boolean
}) {
  return (
    <div className="bg-[#1c1c1c] border border-white/5 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={16} className={color} />
        <p className="text-xs text-gray-400">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function ResellerSection({ 
  pendingApplications, 
  approvedResellers, 
  resellerOrders,
  selectedApplication, 
  setSelectedApplication,
  handleApproveApplication,
  handleRejectApplication,
  actioningId,
  formatTimeAgo,
  formatCurrency
}: any) {
  return (
    <motion.div
      key="resellers"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-6"
    >
      <div className="lg:col-span-2 space-y-6">
        {/* Pending Applications */}
        {pendingApplications.length > 0 && (
          <Section title="Pending Applications" icon={Clock} iconColor="text-yellow-400" count={pendingApplications.length}>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {pendingApplications.map((app: ResellerApplication) => (
                <ApplicationCard
                  key={app.id}
                  application={app}
                  onApprove={() => handleApproveApplication(app)}
                  onReject={() => handleRejectApplication(app)}
                  onView={() => setSelectedApplication(app)}
                  formatTimeAgo={formatTimeAgo}
                  isActioning={actioningId === app.id}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Approved Resellers */}
        <Section title="Approved Resellers" icon={CheckCircle2} iconColor="text-lime-400" count={approvedResellers.length}>
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {approvedResellers.map((reseller: ResellerApplication) => {
              const orders = resellerOrders.filter((o: ResellerOrder) => o.reseller_id === reseller.id)
              const totalRevenue = orders.reduce((sum: number, o: ResellerOrder) => sum + o.total_amount, 0)
              
              return (
                <div
                  key={reseller.id}
                  onClick={() => setSelectedApplication(reseller)}
                  className="bg-[#252525] border border-white/5 rounded-xl p-4 hover:border-lime-500/30 transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{reseller.company_name}</p>
                      <p className="text-xs text-gray-400 mt-1">{reseller.contact_name} • {reseller.contact_email}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded border ${STATUS_COLORS[reseller.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.pending}`}>
                      {reseller.status}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-gray-400 pt-3 border-t border-white/5">
                    <span className="flex items-center gap-1">
                      <Package size={12} />
                      {orders.length} orders
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign size={12} />
                      {formatCurrency(totalRevenue)}
                    </span>
                    <span className="ml-auto">{formatTimeAgo(reseller.created_at)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </Section>
      </div>

      {/* Detail Panel */}
      <div>
        <AnimatePresence mode="wait">
          {selectedApplication ? (
            <ApplicationDetailPanel
              key={selectedApplication.id}
              application={selectedApplication}
              orders={resellerOrders.filter((o: ResellerOrder) => o.reseller_id === selectedApplication.id)}
              onClose={() => setSelectedApplication(null)}
              onApprove={() => handleApproveApplication(selectedApplication)}
              onReject={() => handleRejectApplication(selectedApplication)}
              isActioning={actioningId === selectedApplication.id}
              formatTimeAgo={formatTimeAgo}
              formatCurrency={formatCurrency}
            />
          ) : (
            <EmptyState icon={Users} message="Select an application to view details" />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

function NewsletterSection({ newsletters, selectedNewsletter, setSelectedNewsletter, formatTimeAgo }: any) {
  const draftNewsletters = newsletters.filter((n: NewsletterDraft) => n.status === 'draft' || n.status === 'ai_suggested')
  const scheduledNewsletters = newsletters.filter((n: NewsletterDraft) => n.status === 'scheduled')
  const sentNewsletters = newsletters.filter((n: NewsletterDraft) => n.status === 'sent')

  return (
    <motion.div
      key="newsletters"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-6"
    >
      <div className="lg:col-span-2 space-y-6">
        {/* Draft Newsletters */}
        {draftNewsletters.length > 0 && (
          <Section title="Draft Newsletters" icon={Edit3} iconColor="text-gray-400" count={draftNewsletters.length}>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {draftNewsletters.map((newsletter: NewsletterDraft) => (
                <NewsletterCard
                  key={newsletter.id}
                  newsletter={newsletter}
                  onClick={() => setSelectedNewsletter(newsletter)}
                  formatTimeAgo={formatTimeAgo}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Scheduled Newsletters */}
        {scheduledNewsletters.length > 0 && (
          <Section title="Scheduled Newsletters" icon={Calendar} iconColor="text-indigo-400" count={scheduledNewsletters.length}>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {scheduledNewsletters.map((newsletter: NewsletterDraft) => (
                <NewsletterCard
                  key={newsletter.id}
                  newsletter={newsletter}
                  onClick={() => setSelectedNewsletter(newsletter)}
                  formatTimeAgo={formatTimeAgo}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Sent Newsletters */}
        <Section title="Sent Newsletters" icon={Send} iconColor="text-lime-400" count={sentNewsletters.length}>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {sentNewsletters.map((newsletter: NewsletterDraft) => (
              <NewsletterCard
                key={newsletter.id}
                newsletter={newsletter}
                onClick={() => setSelectedNewsletter(newsletter)}
                formatTimeAgo={formatTimeAgo}
              />
            ))}
          </div>
        </Section>
      </div>

      {/* Detail Panel */}
      <div>
        <AnimatePresence mode="wait">
          {selectedNewsletter ? (
            <NewsletterDetailPanel
              key={selectedNewsletter.id}
              newsletter={selectedNewsletter}
              onClose={() => setSelectedNewsletter(null)}
              formatTimeAgo={formatTimeAgo}
            />
          ) : (
            <EmptyState icon={Mail} message="Select a newsletter to view details" />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

function InfluencerSection({ 
  potentialInfluencers, 
  activeInfluencers, 
  selectedInfluencer, 
  setSelectedInfluencer,
  handleUpdateInfluencer,
  actioningId,
  formatTimeAgo,
  formatNumber
}: any) {
  return (
    <motion.div
      key="influencers"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-6"
    >
      <div className="lg:col-span-2 space-y-6">
        {/* Potential Influencers */}
        {potentialInfluencers.length > 0 && (
          <Section title="Potential Opportunities" icon={Target} iconColor="text-purple-400" count={potentialInfluencers.length}>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {potentialInfluencers.map((influencer: InfluencerOpportunity) => (
                <InfluencerCard
                  key={influencer.id}
                  influencer={influencer}
                  onView={() => setSelectedInfluencer(influencer)}
                  onContact={() => handleUpdateInfluencer(influencer.id, 'contacted')}
                  isActioning={actioningId === influencer.id}
                  formatNumber={formatNumber}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Active Influencers */}
        <Section title="Active Partnerships" icon={TrendingUp} iconColor="text-lime-400" count={activeInfluencers.length}>
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {activeInfluencers.map((influencer: InfluencerOpportunity) => (
              <InfluencerCard
                key={influencer.id}
                influencer={influencer}
                onView={() => setSelectedInfluencer(influencer)}
                isActioning={actioningId === influencer.id}
                formatNumber={formatNumber}
                isActive
              />
            ))}
          </div>
        </Section>
      </div>

      {/* Detail Panel */}
      <div>
        <AnimatePresence mode="wait">
          {selectedInfluencer ? (
            <InfluencerDetailPanel
              key={selectedInfluencer.id}
              influencer={selectedInfluencer}
              onClose={() => setSelectedInfluencer(null)}
              formatNumber={formatNumber}
              formatTimeAgo={formatTimeAgo}
            />
          ) : (
            <EmptyState icon={TrendingUp} message="Select an influencer to view details" />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

function OutreachSection({ outreach, formatTimeAgo, formatCurrency }: any) {
  const activeOutreach = outreach.filter((o: OutreachTracking) => 
    ['pending', 'sent', 'opened', 'replied'].includes(o.status)
  )
  const completedOutreach = outreach.filter((o: OutreachTracking) => 
    ['deal_closed', 'meeting_scheduled'].includes(o.status)
  )

  return (
    <motion.div
      key="outreach"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Active Outreach */}
      <Section title="Active Outreach" icon={Target} iconColor="text-blue-400" count={activeOutreach.length}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-2">
          {activeOutreach.map((item: OutreachTracking) => (
            <OutreachCard key={item.id} outreach={item} formatTimeAgo={formatTimeAgo} />
          ))}
        </div>
      </Section>

      {/* Completed Outreach */}
      {completedOutreach.length > 0 && (
        <Section title="Successful Outreach" icon={CheckCircle2} iconColor="text-lime-400" count={completedOutreach.length}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
            {completedOutreach.map((item: OutreachTracking) => (
              <OutreachCard key={item.id} outreach={item} formatTimeAgo={formatTimeAgo} formatCurrency={formatCurrency} />
            ))}
          </div>
        </Section>
      )}
    </motion.div>
  )
}

function Section({ title, icon: Icon, iconColor, count, children }: any) {
  return (
    <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <Icon className={iconColor} />
        {title} ({count})
      </h3>
      {children}
    </div>
  )
}

function ApplicationCard({ application, onApprove, onReject, onView, formatTimeAgo, isActioning }: any) {
  return (
    <div className="bg-[#252525] border border-yellow-500/20 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-white">{application.company_name}</p>
          <p className="text-xs text-gray-400 mt-1">{application.contact_name} • {application.contact_email}</p>
          {application.business_type && (
            <p className="text-xs text-gray-500 mt-1">Type: {application.business_type}</p>
          )}
        </div>
        <span className={`text-xs px-2 py-1 rounded border ${STATUS_COLORS[application.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.pending}`}>
          {application.status.replace('_', ' ')}
        </span>
      </div>

      <div className="flex gap-2 pt-3 border-t border-white/5">
        <button
          onClick={onApprove}
          disabled={isActioning}
          className="flex-1 px-3 py-2 bg-lime-500/20 hover:bg-lime-500/30 text-lime-400 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50"
        >
          <ThumbsUp size={14} />
          Approve
        </button>
        <button
          onClick={onReject}
          disabled={isActioning}
          className="flex-1 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50"
        >
          <ThumbsDown size={14} />
          Reject
        </button>
        <button
          onClick={onView}
          className="px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors text-sm"
        >
          <Eye size={14} />
        </button>
      </div>

      <div className="text-xs text-gray-500 mt-2">
        Applied {formatTimeAgo(application.created_at)}
      </div>
    </div>
  )
}

function NewsletterCard({ newsletter, onClick, formatTimeAgo }: any) {
  const hasAISuggestions = newsletter.ai_suggestions && newsletter.ai_suggestions.length > 0

  return (
    <div
      onClick={onClick}
      className="bg-[#252525] border border-white/5 rounded-xl p-4 hover:border-lime-500/30 transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-white">{newsletter.title}</p>
          <p className="text-xs text-gray-400 mt-1">{newsletter.subject_line}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded border ${STATUS_COLORS[newsletter.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.draft}`}>
          {newsletter.status.replace('_', ' ')}
        </span>
      </div>

      {hasAISuggestions && (
        <div className="flex items-center gap-2 mb-3 px-2 py-1 bg-purple-500/10 rounded-lg border border-purple-500/20">
          <Sparkles size={12} className="text-purple-400" />
          <span className="text-xs text-purple-400">{newsletter.ai_suggestions.length} AI suggestions</span>
        </div>
      )}

      <p className="text-xs text-gray-500 line-clamp-2 mb-3">{newsletter.content}</p>

      <div className="flex items-center gap-4 text-xs text-gray-400 pt-3 border-t border-white/5">
        {newsletter.status === 'sent' && (
          <>
            <span className="flex items-center gap-1">
              <Mail size={12} />
              {newsletter.recipient_count} recipients
            </span>
            <span className="flex items-center gap-1">
              <Eye size={12} />
              {newsletter.open_rate}% open rate
            </span>
          </>
        )}
        <span className="ml-auto">{formatTimeAgo(newsletter.created_at)}</span>
      </div>
    </div>
  )
}

function InfluencerCard({ influencer, onView, onContact, isActioning, formatNumber, isActive = false }: any) {
  const PlatformIcon = PLATFORM_ICONS[influencer.platform as keyof typeof PLATFORM_ICONS] || MessageSquare
  const platformColor = PLATFORM_COLORS[influencer.platform as keyof typeof PLATFORM_COLORS] || '#999999'

  return (
    <div className="bg-[#252525] border border-white/5 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-1">
          <PlatformIcon size={20} style={{ color: platformColor }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{influencer.influencer_name}</p>
            <p className="text-xs text-gray-400">{influencer.handle}</p>
          </div>
        </div>
        <span className={`text-xs px-2 py-1 rounded border ${STATUS_COLORS[influencer.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.identified}`}>
          {influencer.status.replace('_', ' ')}
        </span>
      </div>

      {influencer.niche && (
        <p className="text-xs text-gray-500 mb-2">Niche: {influencer.niche}</p>
      )}

      <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
        <span className="flex items-center gap-1">
          <Users size={12} />
          {formatNumber(influencer.followers_count)}
        </span>
        <span className="flex items-center gap-1">
          <BarChart3 size={12} />
          {influencer.engagement_rate}% engagement
        </span>
      </div>

      {isActive && (
        <div className="flex items-center gap-4 text-xs text-gray-400 mb-3 pt-3 border-t border-white/5">
          <span>{influencer.engagement_metrics.likes} likes</span>
          <span>{influencer.engagement_metrics.views} views</span>
        </div>
      )}

      <div className="flex gap-2 pt-3 border-t border-white/5">
        {!isActive && onContact && (
          <button
            onClick={onContact}
            disabled={isActioning || influencer.status !== 'identified'}
            className="flex-1 px-3 py-2 bg-lime-500/20 hover:bg-lime-500/30 text-lime-400 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50"
          >
            <UserPlus size={14} />
            Contact
          </button>
        )}
        <button
          onClick={onView}
          className="flex-1 px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors text-sm"
        >
          <Eye size={14} />
        </button>
      </div>
    </div>
  )
}

function OutreachCard({ outreach, formatTimeAgo, formatCurrency }: any) {
  const typeIcons = {
    email: Mail,
    social_dm: MessageSquare,
    phone_call: Phone,
    linkedin_message: Linkedin,
    partnership_inquiry: Target
  }
  const Icon = typeIcons[outreach.outreach_type as keyof typeof typeIcons] || Target

  return (
    <div className="bg-[#252525] border border-white/5 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-1">
          <Icon size={16} className="text-gray-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{outreach.target_name}</p>
            <p className="text-xs text-gray-400">{outreach.campaign_name}</p>
          </div>
        </div>
        <span className={`text-xs px-2 py-1 rounded border ${STATUS_COLORS[outreach.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.pending}`}>
          {outreach.status.replace('_', ' ')}
        </span>
      </div>

      {outreach.target_company && (
        <p className="text-xs text-gray-500 mb-2">Company: {outreach.target_company}</p>
      )}

      {outreach.conversion_value && (
        <div className="flex items-center gap-2 mb-2 px-2 py-1 bg-green-500/10 rounded-lg border border-green-500/20">
          <DollarSign size={12} className="text-green-400" />
          <span className="text-xs text-green-400">{formatCurrency(outreach.conversion_value)}</span>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-gray-500 pt-3 border-t border-white/5">
        <span>{outreach.outreach_type.replace('_', ' ')}</span>
        {outreach.sent_at && <span>• {formatTimeAgo(outreach.sent_at)}</span>}
      </div>
    </div>
  )
}

function ApplicationDetailPanel({ application, orders, onClose, onApprove, onReject, isActioning, formatTimeAgo, formatCurrency }: any) {
  const totalRevenue = orders.reduce((sum: number, o: ResellerOrder) => sum + o.total_amount, 0)

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6 sticky top-6"
    >
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-bold text-white">Application Details</h3>
        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
          <XCircle size={20} className="text-gray-400" />
        </button>
      </div>

      <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-400 mb-1">Company</p>
            <p className="text-sm text-white font-medium">{application.company_name}</p>
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-1">Contact Person</p>
            <p className="text-sm text-white">{application.contact_name}</p>
            <p className="text-xs text-gray-400 mt-1">{application.contact_email}</p>
            {application.contact_phone && <p className="text-xs text-gray-400">{application.contact_phone}</p>}
          </div>

          {application.website && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Website</p>
              <a href={application.website} target="_blank" rel="noopener noreferrer" className="text-sm text-lime-400 hover:text-lime-300 flex items-center gap-1">
                {application.website}
                <ExternalLink size={12} />
              </a>
            </div>
          )}

          {application.business_type && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Business Type</p>
              <p className="text-sm text-white">{application.business_type}</p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded border ${STATUS_COLORS[application.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.pending}`}>
              {application.status.replace('_', ' ')}
            </span>
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-1">Applied</p>
            <p className="text-sm text-white">{formatTimeAgo(application.created_at)}</p>
          </div>

          {application.reviewed_at && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Reviewed</p>
              <p className="text-sm text-white">{formatTimeAgo(application.reviewed_at)}</p>
              {application.reviewed_by && <p className="text-xs text-gray-400">by {application.reviewed_by}</p>}
            </div>
          )}
        </div>

        {application.status === 'approved' && orders.length > 0 && (
          <div className="pt-4 border-t border-white/5">
            <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <Package size={16} className="text-lime-400" />
              Order History
            </h4>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {orders.map((order: ResellerOrder) => (
                <div key={order.id} className="bg-[#252525] rounded-lg p-3 text-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium">{order.order_number}</span>
                    <span className={`px-2 py-0.5 rounded border text-[10px] ${STATUS_COLORS[order.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.pending}`}>
                      {order.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-gray-400">
                    <span>{formatCurrency(order.total_amount, order.currency)}</span>
                    <span>{formatTimeAgo(order.ordered_at)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-white/5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Total Revenue</span>
                <span className="text-lime-400 font-bold">{formatCurrency(totalRevenue)}</span>
              </div>
            </div>
          </div>
        )}

        {(application.status === 'pending' || application.status === 'under_review') && (
          <div className="pt-4 border-t border-white/5 space-y-2">
            <button
              onClick={onApprove}
              disabled={isActioning}
              className="w-full px-4 py-2 bg-lime-500/20 hover:bg-lime-500/30 text-lime-400 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <ThumbsUp size={16} />
              Approve Application
            </button>
            <button
              onClick={onReject}
              disabled={isActioning}
              className="w-full px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <ThumbsDown size={16} />
              Reject Application
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function NewsletterDetailPanel({ newsletter, onClose, formatTimeAgo }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6 sticky top-6"
    >
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-bold text-white">Newsletter Details</h3>
        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
          <XCircle size={20} className="text-gray-400" />
        </button>
      </div>

      <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-400 mb-1">Title</p>
            <p className="text-sm text-white font-medium">{newsletter.title}</p>
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-1">Subject Line</p>
            <p className="text-sm text-white">{newsletter.subject_line}</p>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded border ${STATUS_COLORS[newsletter.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.draft}`}>
              {newsletter.status.replace('_', ' ')}
            </span>
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-2">Content</p>
            <div className="bg-[#252525] border border-white/5 rounded-lg p-3 text-sm text-white whitespace-pre-wrap max-h-[200px] overflow-y-auto">
              {newsletter.content}
            </div>
          </div>

          {newsletter.ai_suggestions && newsletter.ai_suggestions.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-2 flex items-center gap-2">
                <Sparkles size={12} className="text-purple-400" />
                AI Suggestions
              </p>
              <div className="space-y-2">
                {newsletter.ai_suggestions.map((suggestion: any, idx: number) => (
                  <div key={idx} className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                    <p className="text-xs text-purple-400 font-medium mb-1">{suggestion.type}</p>
                    <p className="text-xs text-gray-300">{suggestion.suggestion}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {newsletter.status === 'sent' && (
            <div className="pt-3 border-t border-white/5">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#252525] rounded-lg p-3 text-center">
                  <Mail size={16} className="text-blue-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-white">{newsletter.recipient_count}</p>
                  <p className="text-xs text-gray-400">Recipients</p>
                </div>
                <div className="bg-[#252525] rounded-lg p-3 text-center">
                  <Eye size={16} className="text-lime-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-white">{newsletter.open_rate}%</p>
                  <p className="text-xs text-gray-400">Open Rate</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <p className="text-xs text-gray-400 mb-1">Created</p>
            <p className="text-sm text-white">{formatTimeAgo(newsletter.created_at)}</p>
            {newsletter.created_by && <p className="text-xs text-gray-400">by {newsletter.created_by}</p>}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function InfluencerDetailPanel({ influencer, onClose, formatNumber, formatTimeAgo }: any) {
  const PlatformIcon = PLATFORM_ICONS[influencer.platform as keyof typeof PLATFORM_ICONS] || MessageSquare
  const platformColor = PLATFORM_COLORS[influencer.platform as keyof typeof PLATFORM_COLORS] || '#999999'

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6 sticky top-6"
    >
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-bold text-white">Influencer Details</h3>
        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
          <XCircle size={20} className="text-gray-400" />
        </button>
      </div>

      <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
        <div className="flex items-center gap-3 mb-4">
          <PlatformIcon size={32} style={{ color: platformColor }} />
          <div>
            <p className="text-lg font-bold text-white">{influencer.influencer_name}</p>
            <p className="text-sm text-gray-400">{influencer.handle}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded border ${STATUS_COLORS[influencer.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.identified}`}>
              {influencer.status.replace('_', ' ')}
            </span>
          </div>

          {influencer.niche && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Niche</p>
              <p className="text-sm text-white">{influencer.niche}</p>
            </div>
          )}

          {influencer.deal_type && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Deal Type</p>
              <p className="text-sm text-white capitalize">{influencer.deal_type.replace('_', ' ')}</p>
            </div>
          )}

          {influencer.compensation_offered && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Compensation</p>
              <p className="text-sm text-white">{influencer.compensation_offered}</p>
            </div>
          )}

          {influencer.contact_email && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Contact Email</p>
              <p className="text-sm text-white">{influencer.contact_email}</p>
            </div>
          )}

          <div className="pt-3 border-t border-white/5">
            <p className="text-xs text-gray-400 mb-3">Metrics</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#252525] rounded-lg p-3 text-center">
                <Users size={16} className="text-blue-400 mx-auto mb-1" />
                <p className="text-lg font-bold text-white">{formatNumber(influencer.followers_count)}</p>
                <p className="text-xs text-gray-400">Followers</p>
              </div>
              <div className="bg-[#252525] rounded-lg p-3 text-center">
                <BarChart3 size={16} className="text-lime-400 mx-auto mb-1" />
                <p className="text-lg font-bold text-white">{influencer.engagement_rate}%</p>
                <p className="text-xs text-gray-400">Engagement</p>
              </div>
            </div>
          </div>

          {influencer.notes && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Notes</p>
              <div className="bg-[#252525] border border-white/5 rounded-lg p-3 text-sm text-gray-300 whitespace-pre-wrap">
                {influencer.notes}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs text-gray-400 mb-1">Added</p>
            <p className="text-sm text-white">{formatTimeAgo(influencer.created_at)}</p>
          </div>

          {influencer.contacted_at && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Last Contact</p>
              <p className="text-sm text-white">{formatTimeAgo(influencer.contacted_at)}</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function EmptyState({ icon: Icon, message }: { icon: any, message: string }) {
  return (
    <motion.div
      key="no-selection"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6 flex items-center justify-center min-h-[400px] sticky top-6"
    >
      <div className="text-center text-gray-400">
        <Icon className="mx-auto mb-2 opacity-50" size={48} />
        <p className="text-sm">{message}</p>
      </div>
    </motion.div>
  )
}
