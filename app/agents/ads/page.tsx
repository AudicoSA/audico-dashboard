'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  TrendingUp, 
  TrendingDown,
  DollarSign, 
  Eye, 
  MousePointer, 
  Target,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ChevronUp,
  ChevronDown,
  BarChart3,
  Activity,
  Lightbulb,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react'
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface Campaign {
  id: string
  name: string
  status: 'active' | 'paused' | 'ended'
  budget_daily: number
  budget_spent_today: number
  impressions: number
  clicks: number
  conversions: number
  cost: number
  ctr: number
  cpc: number
  conversion_rate: number
  roas: number
}

interface BidRecommendation {
  id: string
  campaign_id: string
  campaign_name: string
  current_bid: number
  recommended_bid: number
  reason: string
  expected_improvement: string
  confidence: 'high' | 'medium' | 'low'
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

interface PerformanceData {
  date: string
  impressions: number
  clicks: number
  conversions: number
  cost: number
  revenue: number
}

const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: '1',
    name: 'Sonos Audio Systems - Brand',
    status: 'active',
    budget_daily: 500,
    budget_spent_today: 342.50,
    impressions: 12450,
    clicks: 487,
    conversions: 23,
    cost: 342.50,
    ctr: 3.91,
    cpc: 0.70,
    conversion_rate: 4.72,
    roas: 5.2
  },
  {
    id: '2',
    name: 'Home Theater - Shopping',
    status: 'active',
    budget_daily: 750,
    budget_spent_today: 623.80,
    impressions: 18920,
    clicks: 723,
    conversions: 41,
    cost: 623.80,
    ctr: 3.82,
    cpc: 0.86,
    conversion_rate: 5.67,
    roas: 6.8
  },
  {
    id: '3',
    name: 'Smart Speakers - Search',
    status: 'active',
    budget_daily: 400,
    budget_spent_today: 289.20,
    impressions: 9340,
    clicks: 312,
    conversions: 18,
    cost: 289.20,
    ctr: 3.34,
    cpc: 0.93,
    conversion_rate: 5.77,
    roas: 4.9
  },
  {
    id: '4',
    name: 'Audio Accessories - Display',
    status: 'paused',
    budget_daily: 300,
    budget_spent_today: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    cost: 0,
    ctr: 0,
    cpc: 0,
    conversion_rate: 0,
    roas: 0
  }
]

const MOCK_BID_RECOMMENDATIONS: BidRecommendation[] = [
  {
    id: '1',
    campaign_id: '1',
    campaign_name: 'Sonos Audio Systems - Brand',
    current_bid: 0.70,
    recommended_bid: 0.85,
    reason: 'High conversion rate (4.72%) and ROAS (5.2x) indicate room for increased spend. Auction insights show we\'re losing impression share to competitors.',
    expected_improvement: '+15% impressions, +12% conversions',
    confidence: 'high',
    status: 'pending',
    created_at: new Date(Date.now() - 25 * 60000).toISOString()
  },
  {
    id: '2',
    campaign_id: '2',
    campaign_name: 'Home Theater - Shopping',
    current_bid: 0.86,
    recommended_bid: 0.92,
    reason: 'Top performer with 6.8x ROAS. Slightly increasing bid will capture more high-intent searches during peak hours.',
    expected_improvement: '+8% clicks, +10% revenue',
    confidence: 'high',
    status: 'pending',
    created_at: new Date(Date.now() - 45 * 60000).toISOString()
  },
  {
    id: '3',
    campaign_id: '3',
    campaign_name: 'Smart Speakers - Search',
    current_bid: 0.93,
    recommended_bid: 0.80,
    reason: 'CPC is trending higher than competitors. Slight reduction will maintain position while improving efficiency.',
    expected_improvement: '+5% profit margin, -3% clicks',
    confidence: 'medium',
    status: 'pending',
    created_at: new Date(Date.now() - 120 * 60000).toISOString()
  }
]

const MOCK_PERFORMANCE_DATA: PerformanceData[] = [
  { date: 'Mon', impressions: 45000, clicks: 1650, conversions: 78, cost: 1155, revenue: 6240 },
  { date: 'Tue', impressions: 48500, clicks: 1820, conversions: 89, cost: 1274, revenue: 7120 },
  { date: 'Wed', impressions: 52000, clicks: 1950, conversions: 94, cost: 1365, revenue: 7520 },
  { date: 'Thu', impressions: 49800, clicks: 1780, conversions: 85, cost: 1246, revenue: 6800 },
  { date: 'Fri', impressions: 54200, clicks: 2100, conversions: 102, cost: 1470, revenue: 8160 },
  { date: 'Sat', impressions: 41000, clicks: 1580, conversions: 76, cost: 1106, revenue: 6080 },
  { date: 'Today', impressions: 40710, clicks: 1522, conversions: 82, cost: 1255.50, revenue: 6560 }
]

export default function GoogleAdsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(MOCK_CAMPAIGNS)
  const [recommendations, setRecommendations] = useState<BidRecommendation[]>(MOCK_BID_RECOMMENDATIONS)
  const [performanceData] = useState<PerformanceData[]>(MOCK_PERFORMANCE_DATA)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [])

  const fetchData = async () => {
    try {
      const res = await fetch('/api/ads/campaigns')
      if (res.ok) {
        const data = await res.json()
        if (data.campaigns) setCampaigns(data.campaigns)
        if (data.recommendations) setRecommendations(data.recommendations)
      }
    } catch (err) {
      console.log('Using mock data - API not connected yet')
    }
  }

  const handleBidApproval = async (recommendationId: string, approved: boolean) => {
    setRecommendations(prev => prev.map(r => 
      r.id === recommendationId 
        ? { ...r, status: approved ? 'approved' : 'rejected' } 
        : r
    ))

    try {
      await fetch('/api/ads/bid-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendationId, approved })
      })
    } catch (err) {
      console.log('API not connected - bid approval saved locally')
    }
  }

  const totalBudget = campaigns.reduce((sum, c) => sum + c.budget_daily, 0)
  const totalSpent = campaigns.reduce((sum, c) => sum + c.budget_spent_today, 0)
  const budgetUtilization = (totalSpent / totalBudget) * 100

  const todayMetrics = {
    impressions: campaigns.reduce((sum, c) => sum + c.impressions, 0),
    clicks: campaigns.reduce((sum, c) => sum + c.clicks, 0),
    conversions: campaigns.reduce((sum, c) => sum + c.conversions, 0),
    cost: campaigns.reduce((sum, c) => sum + c.cost, 0),
    avgCtr: campaigns.filter(c => c.status === 'active').reduce((sum, c) => sum + c.ctr, 0) / campaigns.filter(c => c.status === 'active').length,
    avgRoas: campaigns.filter(c => c.status === 'active' && c.roas > 0).reduce((sum, c) => sum + c.roas, 0) / campaigns.filter(c => c.status === 'active' && c.roas > 0).length
  }

  const pendingRecommendations = recommendations.filter(r => r.status === 'pending')

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
            <BarChart3 className="text-lime-400" />
            Google Ads Dashboard
          </h2>
          <p className="text-gray-400 mt-1">Campaign performance and AI-powered bid recommendations</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-[#1c1c1c] border border-white/5 rounded-xl">
            <p className="text-xs text-gray-400">Last Updated</p>
            <p className="text-sm font-medium text-white">{new Date().toLocaleTimeString()}</p>
          </div>
        </div>
      </motion.div>

      {/* Budget Overview - Matches Main Dashboard Style */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Daily Budget Tracking</h3>
          <Activity size={18} className="text-lime-400" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <p className="text-sm text-gray-400 mb-1">Total Budget</p>
            <p className="text-2xl font-bold text-white">R {totalBudget.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-1">Spent Today</p>
            <p className="text-2xl font-bold text-white">R {totalSpent.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-1">Remaining</p>
            <p className="text-2xl font-bold text-white">R {(totalBudget - totalSpent).toFixed(2)}</p>
          </div>
        </div>
        <div>
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-gray-400">Budget Utilization</span>
            <span className="text-white font-medium">{budgetUtilization.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-lime-400 to-emerald-400"
              style={{ width: `${Math.min(budgetUtilization, 100)}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {budgetUtilization < 80 
              ? 'On track - healthy pacing' 
              : budgetUtilization < 95 
              ? 'Approaching limit - monitor closely'
              : 'Near or exceeded limit'}
          </p>
        </div>
      </motion.div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          label="Impressions"
          value={todayMetrics.impressions.toLocaleString()}
          change={+12.5}
          icon={Eye}
          color="blue"
        />
        <MetricCard
          label="Clicks"
          value={todayMetrics.clicks.toLocaleString()}
          change={+8.3}
          icon={MousePointer}
          color="purple"
        />
        <MetricCard
          label="Conversions"
          value={todayMetrics.conversions.toLocaleString()}
          change={+15.7}
          icon={Target}
          color="lime"
        />
        <MetricCard
          label="Cost"
          value={`R ${todayMetrics.cost.toFixed(2)}`}
          change={+5.2}
          icon={DollarSign}
          color="orange"
        />
      </div>

      {/* Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">7-Day Performance</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={performanceData}>
              <defs>
                <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a3e635" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#a3e635" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorConversions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2c2c2c" />
              <XAxis dataKey="date" stroke="#666" style={{ fontSize: '12px' }} />
              <YAxis stroke="#666" style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1c1c1c', border: '1px solid #333', borderRadius: '8px' }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend />
              <Area type="monotone" dataKey="clicks" stroke="#a3e635" fillOpacity={1} fill="url(#colorClicks)" name="Clicks" />
              <Area type="monotone" dataKey="conversions" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorConversions)" name="Conversions" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Cost vs Revenue</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2c2c2c" />
              <XAxis dataKey="date" stroke="#666" style={{ fontSize: '12px' }} />
              <YAxis stroke="#666" style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1c1c1c', border: '1px solid #333', borderRadius: '8px' }}
                labelStyle={{ color: '#fff' }}
                formatter={(value: number | undefined) => value !== undefined ? `R ${value.toFixed(2)}` : 'N/A'}
              />
              <Legend />
              <Bar dataKey="cost" fill="#f59e0b" name="Cost" />
              <Bar dataKey="revenue" fill="#10b981" name="Revenue" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* AI Recommendations */}
      {pendingRecommendations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <Lightbulb className="text-purple-400" size={24} />
            <div>
              <h3 className="text-lg font-semibold text-white">AI Bid Recommendations</h3>
              <p className="text-sm text-gray-400">{pendingRecommendations.length} pending approval</p>
            </div>
          </div>
          
          <div className="space-y-4">
            {pendingRecommendations.map(rec => (
              <BidRecommendationCard
                key={rec.id}
                recommendation={rec}
                onApprove={() => handleBidApproval(rec.id, true)}
                onReject={() => handleBidApproval(rec.id, false)}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* Campaign List */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6"
      >
        <h3 className="text-lg font-semibold text-white mb-4">Active Campaigns</h3>
        <div className="space-y-3">
          {campaigns.map(campaign => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      </motion.div>
    </div>
  )
}

function MetricCard({ label, value, change, icon: Icon, color }: {
  label: string
  value: string
  change: number
  icon: any
  color: string
}) {
  const isPositive = change > 0
  const colorClasses = {
    blue: 'text-blue-400 bg-blue-400/10',
    purple: 'text-purple-400 bg-purple-400/10',
    lime: 'text-lime-400 bg-lime-400/10',
    orange: 'text-orange-400 bg-orange-400/10'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-xl ${colorClasses[color as keyof typeof colorClasses]}`}>
          <Icon size={20} />
        </div>
        <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
          isPositive ? 'text-lime-400 bg-lime-400/10' : 'text-red-400 bg-red-400/10'
        }`}>
          {isPositive ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {Math.abs(change)}%
        </div>
      </div>
      <p className="text-sm text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
      <p className="text-xs text-gray-500 mt-2">vs yesterday</p>
    </motion.div>
  )
}

function BidRecommendationCard({ recommendation, onApprove, onReject }: {
  recommendation: BidRecommendation
  onApprove: () => void
  onReject: () => void
}) {
  const confidenceColors = {
    high: 'bg-lime-500/20 text-lime-400 border-lime-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }

  const bidChange = recommendation.recommended_bid - recommendation.current_bid
  const bidChangePercent = ((bidChange / recommendation.current_bid) * 100).toFixed(1)
  const isIncrease = bidChange > 0

  return (
    <div className="bg-[#1c1c1c] border border-purple-500/30 rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-white mb-1">{recommendation.campaign_name}</h4>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-400">
              Current: <span className="text-white font-medium">R {recommendation.current_bid.toFixed(2)}</span>
            </span>
            <span className={`flex items-center gap-1 font-medium ${isIncrease ? 'text-orange-400' : 'text-lime-400'}`}>
              {isIncrease ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              {isIncrease ? '+' : ''}{bidChangePercent}%
            </span>
            <span className="text-gray-400">
              Suggested: <span className="text-white font-medium">R {recommendation.recommended_bid.toFixed(2)}</span>
            </span>
          </div>
        </div>
        <span className={`text-xs px-3 py-1 rounded-full border ${confidenceColors[recommendation.confidence]}`}>
          {recommendation.confidence} confidence
        </span>
      </div>

      <p className="text-sm text-gray-300 mb-3">{recommendation.reason}</p>

      <div className="flex items-center justify-between pt-3 border-t border-white/5">
        <div className="flex items-center gap-2 text-sm">
          <TrendingUp size={16} className="text-lime-400" />
          <span className="text-gray-400">Expected: <span className="text-lime-400">{recommendation.expected_improvement}</span></span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onReject}
            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium border border-red-500/30"
          >
            <ThumbsDown size={16} />
            Reject
          </button>
          <button
            onClick={onApprove}
            className="px-4 py-2 bg-lime-400 hover:bg-lime-500 text-black rounded-lg transition-colors flex items-center gap-2 text-sm font-bold"
          >
            <ThumbsUp size={16} />
            Approve
          </button>
        </div>
      </div>
    </div>
  )
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const statusColors = {
    active: 'bg-lime-500/20 text-lime-400 border-lime-500/30',
    paused: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    ended: 'bg-red-500/20 text-red-400 border-red-500/30'
  }

  const budgetPercent = (campaign.budget_spent_today / campaign.budget_daily) * 100

  return (
    <div className="bg-[#252525] border border-white/5 rounded-xl p-4 hover:border-lime-500/30 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h4 className="font-semibold text-white">{campaign.name}</h4>
            <span className={`text-xs px-2 py-1 rounded-md border ${statusColors[campaign.status]}`}>
              {campaign.status}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span>Budget: R {campaign.budget_spent_today.toFixed(2)} / R {campaign.budget_daily.toFixed(2)}</span>
            <span className={budgetPercent > 90 ? 'text-orange-400' : 'text-gray-400'}>
              {budgetPercent.toFixed(1)}% used
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
        <div>
          <p className="text-xs text-gray-500">Impressions</p>
          <p className="text-sm font-semibold text-white">{campaign.impressions.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Clicks</p>
          <p className="text-sm font-semibold text-white">{campaign.clicks.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">CTR</p>
          <p className="text-sm font-semibold text-white">{campaign.ctr.toFixed(2)}%</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">ROAS</p>
          <p className={`text-sm font-semibold ${campaign.roas >= 4 ? 'text-lime-400' : campaign.roas >= 2 ? 'text-yellow-400' : 'text-orange-400'}`}>
            {campaign.roas > 0 ? `${campaign.roas.toFixed(1)}x` : 'N/A'}
          </p>
        </div>
      </div>

      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all ${
            budgetPercent > 95 ? 'bg-red-500' : 
            budgetPercent > 80 ? 'bg-orange-500' : 
            'bg-gradient-to-r from-lime-400 to-emerald-400'
          }`}
          style={{ width: `${Math.min(budgetPercent, 100)}%` }}
        ></div>
      </div>
    </div>
  )
}
