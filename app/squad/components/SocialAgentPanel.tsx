'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Twitter,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  RefreshCw,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Edit3,
  Send,
  Image as ImageIcon,
  Video,
  FileText,
  Plus,
  Filter,
  ThumbsUp,
  ThumbsDown,
  Heart,
  MessageSquare,
  Share2,
  Eye,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Search,
  Tag
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface SocialPost {
  id: string
  platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'tiktok' | 'youtube'
  content: string
  media_urls: string[]
  status: 'draft' | 'scheduled' | 'published' | 'failed'
  scheduled_for: string | null
  published_at: string | null
  post_url: string | null
  engagement: {
    likes: number
    comments: number
    shares: number
  }
  created_by: string | null
  metadata: {
    keywords?: string[]
    target_audience?: string
    campaign_id?: string
    approval_notes?: string
    rejected_reason?: string
  }
  created_at: string
  updated_at: string
}

const PLATFORMS = [
  { id: 'twitter' as const, name: 'Twitter', icon: Twitter, color: '#1DA1F2' },
  { id: 'facebook' as const, name: 'Facebook', icon: Facebook, color: '#1877F2' },
  { id: 'instagram' as const, name: 'Instagram', icon: Instagram, color: '#E4405F' },
  { id: 'linkedin' as const, name: 'LinkedIn', icon: Linkedin, color: '#0A66C2' },
  { id: 'youtube' as const, name: 'YouTube', icon: Youtube, color: '#FF0000' },
]

const STATUS_BADGES = {
  draft: { color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', label: 'Draft' },
  scheduled: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: 'Scheduled' },
  published: { color: 'bg-lime-500/20 text-lime-400 border-lime-500/30', label: 'Published' },
  failed: { color: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Failed' }
}

export default function SocialAgentPanel() {
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPlatform, setFilterPlatform] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [actioningPost, setActioningPost] = useState<string | null>(null)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [calendarView, setCalendarView] = useState<'week' | 'month'>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [editingPost, setEditingPost] = useState(false)
  const [editedContent, setEditedContent] = useState('')
  const [editedScheduledFor, setEditedScheduledFor] = useState('')

  useEffect(() => {
    fetchPosts()
    
    const channel = supabase
      .channel('social_posts_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'social_posts' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setPosts(prev => [payload.new as SocialPost, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setPosts(prev => prev.map(p => p.id === payload.new.id ? payload.new as SocialPost : p))
            if (selectedPost?.id === payload.new.id) {
              setSelectedPost(payload.new as SocialPost)
            }
          } else if (payload.eventType === 'DELETE') {
            setPosts(prev => prev.filter(p => p.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchPosts = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('social_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      
      if (data) {
        setPosts(data)
      }
      if (error) {
        console.error('Error fetching posts:', error)
      }
    } catch (err) {
      console.error('Failed to fetch posts:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleApprove = async (post: SocialPost) => {
    setActioningPost(post.id)
    try {
      const scheduledFor = post.scheduled_for || new Date(Date.now() + 3600000).toISOString()
      const { error } = await supabase
        .from('social_posts')
        .update({ 
          status: 'scheduled',
          scheduled_for: scheduledFor,
          metadata: { ...post.metadata, approval_notes: 'Approved for publishing' },
          updated_at: new Date().toISOString()
        })
        .eq('id', post.id)
      
      if (!error) {
        await fetchPosts()
      }
    } catch (err) {
      console.error('Failed to approve post:', err)
    } finally {
      setActioningPost(null)
    }
  }

  const handleReject = async (post: SocialPost, reason: string = 'Content needs revision') => {
    setActioningPost(post.id)
    try {
      const { error } = await supabase
        .from('social_posts')
        .update({ 
          metadata: { ...post.metadata, rejected_reason: reason },
          updated_at: new Date().toISOString()
        })
        .eq('id', post.id)
      
      if (!error) {
        await fetchPosts()
      }
    } catch (err) {
      console.error('Failed to reject post:', err)
    } finally {
      setActioningPost(null)
    }
  }

  const handleReschedule = async (post: SocialPost, newDate: string) => {
    setActioningPost(post.id)
    try {
      const { error } = await supabase
        .from('social_posts')
        .update({ 
          scheduled_for: newDate,
          status: 'scheduled',
          updated_at: new Date().toISOString()
        })
        .eq('id', post.id)
      
      if (!error) {
        await fetchPosts()
      }
    } catch (err) {
      console.error('Failed to reschedule post:', err)
    } finally {
      setActioningPost(null)
    }
  }

  const handleUpdatePost = async (post: SocialPost) => {
    setActioningPost(post.id)
    try {
      const { error } = await supabase
        .from('social_posts')
        .update({ 
          content: editedContent,
          scheduled_for: editedScheduledFor || post.scheduled_for,
          updated_at: new Date().toISOString()
        })
        .eq('id', post.id)
      
      if (!error) {
        await fetchPosts()
        setEditingPost(false)
      }
    } catch (err) {
      console.error('Failed to update post:', err)
    } finally {
      setActioningPost(null)
    }
  }

  const handlePublishNow = async (post: SocialPost) => {
    setActioningPost(post.id)
    try {
      const { error } = await supabase
        .from('social_posts')
        .update({ 
          status: 'published',
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', post.id)
      
      if (!error) {
        await fetchPosts()
      }
    } catch (err) {
      console.error('Failed to publish post:', err)
    } finally {
      setActioningPost(null)
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

  const formatScheduledTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = date.getTime() - now.getTime()
    const hours = Math.floor(diff / 3600000)
    
    if (hours < 0) return 'Overdue'
    if (hours < 1) return `${Math.floor(diff / 60000)}m`
    if (hours < 24) return `${hours}h`
    return `${Math.floor(hours / 24)}d`
  }

  const filteredPosts = posts.filter(post => {
    if (filterStatus !== 'all' && post.status !== filterStatus) return false
    if (filterPlatform !== 'all' && post.platform !== filterPlatform) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        post.content.toLowerCase().includes(query) ||
        post.metadata.keywords?.some(k => k.toLowerCase().includes(query))
      )
    }
    return true
  })

  const draftPosts = filteredPosts.filter(p => p.status === 'draft')
  const scheduledPosts = filteredPosts.filter(p => p.status === 'scheduled')
  const publishedPosts = filteredPosts.filter(p => p.status === 'published')
  const failedPosts = filteredPosts.filter(p => p.status === 'failed')

  const totalEngagement = publishedPosts.reduce((acc, post) => ({
    likes: acc.likes + (post.engagement?.likes || 0),
    comments: acc.comments + (post.engagement?.comments || 0),
    shares: acc.shares + (post.engagement?.shares || 0)
  }), { likes: 0, comments: 0, shares: 0 })

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
            onClick={() => setShowGenerateModal(true)}
            className="px-4 py-2 bg-lime-400 hover:bg-lime-500 text-black font-bold rounded-xl transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(163,230,53,0.3)]"
          >
            <Sparkles size={18} />
            Generate Posts
          </button>

          <button
            onClick={fetchPosts}
            disabled={isLoading}
            className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 font-bold rounded-xl transition-all flex items-center gap-2 border border-purple-500/30 disabled:opacity-50"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search posts..."
              className="bg-[#1c1c1c] border border-white/5 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-lime-500/50 w-64"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-[#1c1c1c] border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-lime-500/50 appearance-none cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="published">Published</option>
            <option value="failed">Failed</option>
          </select>

          <select
            value={filterPlatform}
            onChange={(e) => setFilterPlatform(e.target.value)}
            className="bg-[#1c1c1c] border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-lime-500/50 appearance-none cursor-pointer"
          >
            <option value="all">All Platforms</option>
            {PLATFORMS.map(platform => (
              <option key={platform.id} value={platform.id}>{platform.name}</option>
            ))}
          </select>
        </div>
      </motion.div>

      {/* Stats Row */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4"
      >
        <StatCard label="Total Posts" value={filteredPosts.length} color="text-white" icon={FileText} />
        <StatCard label="Drafts" value={draftPosts.length} color="text-gray-400" icon={Edit3} />
        <StatCard label="Scheduled" value={scheduledPosts.length} color="text-blue-400" icon={Clock} />
        <StatCard label="Published" value={publishedPosts.length} color="text-lime-400" icon={CheckCircle2} />
        <StatCard label="Total Likes" value={totalEngagement.likes} color="text-pink-400" icon={Heart} />
        <StatCard label="Comments" value={totalEngagement.comments} color="text-purple-400" icon={MessageSquare} />
        <StatCard label="Shares" value={totalEngagement.shares} color="text-blue-400" icon={Share2} />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Post Lists */}
        <div className="lg:col-span-2 space-y-6">
          {/* Draft Posts */}
          {draftPosts.length > 0 && (
            <PostSection
              title="Draft Posts"
              icon={Edit3}
              iconColor="text-gray-400"
              count={draftPosts.length}
            >
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {draftPosts.map(post => (
                  <DraftPostCard
                    key={post.id}
                    post={post}
                    onApprove={() => handleApprove(post)}
                    onReject={() => handleReject(post)}
                    onView={() => {
                      setSelectedPost(post)
                      setEditedContent(post.content)
                      setEditedScheduledFor(post.scheduled_for || '')
                    }}
                    formatTimeAgo={formatTimeAgo}
                    isActioning={actioningPost === post.id}
                  />
                ))}
              </div>
            </PostSection>
          )}

          {/* Scheduled Posts */}
          {scheduledPosts.length > 0 && (
            <PostSection
              title="Scheduled Posts"
              icon={Clock}
              iconColor="text-blue-400"
              count={scheduledPosts.length}
            >
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {scheduledPosts.map(post => (
                  <ScheduledPostCard
                    key={post.id}
                    post={post}
                    onReschedule={(newDate) => handleReschedule(post, newDate)}
                    onPublishNow={() => handlePublishNow(post)}
                    onView={() => {
                      setSelectedPost(post)
                      setEditedContent(post.content)
                      setEditedScheduledFor(post.scheduled_for || '')
                    }}
                    formatScheduledTime={formatScheduledTime}
                    isActioning={actioningPost === post.id}
                  />
                ))}
              </div>
            </PostSection>
          )}

          {/* Published Posts */}
          <PostSection
            title="Published Posts"
            icon={CheckCircle2}
            iconColor="text-lime-400"
            count={publishedPosts.length}
          >
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="animate-spin text-lime-400" size={32} />
                </div>
              ) : publishedPosts.length > 0 ? (
                publishedPosts.map(post => (
                  <PublishedPostCard
                    key={post.id}
                    post={post}
                    onView={() => setSelectedPost(post)}
                    formatTimeAgo={formatTimeAgo}
                  />
                ))
              ) : (
                <p className="text-gray-400 text-sm text-center py-8">No published posts yet</p>
              )}
            </div>
          </PostSection>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Calendar View */}
          <PostingCalendar
            posts={scheduledPosts}
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            view={calendarView}
            onViewChange={setCalendarView}
          />

          {/* Post Detail Panel */}
          <AnimatePresence mode="wait">
            {selectedPost ? (
              <PostDetailPanel
                key={selectedPost.id}
                post={selectedPost}
                onClose={() => {
                  setSelectedPost(null)
                  setEditingPost(false)
                }}
                onApprove={() => handleApprove(selectedPost)}
                onReject={() => handleReject(selectedPost)}
                onReschedule={(date) => handleReschedule(selectedPost, date)}
                onPublishNow={() => handlePublishNow(selectedPost)}
                editingPost={editingPost}
                editedContent={editedContent}
                editedScheduledFor={editedScheduledFor}
                setEditedContent={setEditedContent}
                setEditedScheduledFor={setEditedScheduledFor}
                onStartEdit={() => setEditingPost(true)}
                onSaveEdit={() => handleUpdatePost(selectedPost)}
                onCancelEdit={() => {
                  setEditingPost(false)
                  setEditedContent(selectedPost.content)
                }}
                isActioning={actioningPost === selectedPost.id}
                formatTimeAgo={formatTimeAgo}
                formatScheduledTime={formatScheduledTime}
              />
            ) : (
              <motion.div
                key="no-selection"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6 flex items-center justify-center min-h-[400px]"
              >
                <div className="text-center text-gray-400">
                  <Twitter className="mx-auto mb-2 opacity-50" size={48} />
                  <p className="text-sm">Select a post to view details</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Generate Posts Modal */}
      <AnimatePresence>
        {showGenerateModal && (
          <GeneratePostsModal
            onClose={() => setShowGenerateModal(false)}
            onGenerate={async (config) => {
              console.log('Generating posts with config:', config)
              setShowGenerateModal(false)
              await fetchPosts()
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function StatCard({ label, value, color, icon: Icon }: { label: string, value: number, color: string, icon: any }) {
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

function PostSection({ title, icon: Icon, iconColor, count, children }: {
  title: string
  icon: any
  iconColor: string
  count: number
  children: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6"
    >
      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <Icon className={iconColor} />
        {title} ({count})
      </h3>
      {children}
    </motion.div>
  )
}

function DraftPostCard({ post, onApprove, onReject, onView, formatTimeAgo, isActioning }: {
  post: SocialPost
  onApprove: () => void
  onReject: () => void
  onView: () => void
  formatTimeAgo: (date: string) => string
  isActioning: boolean
}) {
  const platform = PLATFORMS.find(p => p.id === post.platform)
  const PlatformIcon = platform?.icon || Twitter

  return (
    <div className="bg-[#252525] border border-white/5 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <PlatformIcon size={18} style={{ color: platform?.color }} />
          <span className="text-xs text-gray-400 uppercase font-medium">{post.platform}</span>
        </div>
        <span className={`text-xs px-2 py-1 rounded border ${STATUS_BADGES[post.status].color}`}>
          {STATUS_BADGES[post.status].label}
        </span>
      </div>
      
      <p className="text-sm text-white mb-3 line-clamp-3">{post.content}</p>
      
      {post.media_urls && post.media_urls.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <ImageIcon size={14} className="text-gray-400" />
          <span className="text-xs text-gray-400">{post.media_urls.length} media file(s)</span>
        </div>
      )}

      {post.metadata.keywords && post.metadata.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {post.metadata.keywords.slice(0, 3).map((keyword, idx) => (
            <span key={idx} className="text-[10px] px-2 py-1 bg-white/5 rounded text-gray-400">
              #{keyword}
            </span>
          ))}
        </div>
      )}

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

      <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
        <span>{formatTimeAgo(post.created_at)}</span>
        {post.created_by && <span>• by {post.created_by}</span>}
      </div>
    </div>
  )
}

function ScheduledPostCard({ post, onReschedule, onPublishNow, onView, formatScheduledTime, isActioning }: {
  post: SocialPost
  onReschedule: (date: string) => void
  onPublishNow: () => void
  onView: () => void
  formatScheduledTime: (date: string) => string
  isActioning: boolean
}) {
  const platform = PLATFORMS.find(p => p.id === post.platform)
  const PlatformIcon = platform?.icon || Twitter

  return (
    <div className="bg-[#252525] border border-blue-500/20 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <PlatformIcon size={18} style={{ color: platform?.color }} />
          <span className="text-xs text-gray-400 uppercase font-medium">{post.platform}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-blue-400" />
          <span className="text-xs text-blue-400 font-medium">
            {post.scheduled_for && formatScheduledTime(post.scheduled_for)}
          </span>
        </div>
      </div>
      
      <p className="text-sm text-white mb-3 line-clamp-3">{post.content}</p>
      
      {post.scheduled_for && (
        <div className="text-xs text-gray-400 mb-3">
          Scheduled: {new Date(post.scheduled_for).toLocaleString()}
        </div>
      )}

      <div className="flex gap-2 pt-3 border-t border-white/5">
        <button
          onClick={onPublishNow}
          disabled={isActioning}
          className="flex-1 px-3 py-2 bg-lime-500/20 hover:bg-lime-500/30 text-lime-400 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50"
        >
          <Send size={14} />
          Publish Now
        </button>
        <button
          onClick={onView}
          className="px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors text-sm"
        >
          <Edit3 size={14} />
        </button>
      </div>
    </div>
  )
}

function PublishedPostCard({ post, onView, formatTimeAgo }: {
  post: SocialPost
  onView: () => void
  formatTimeAgo: (date: string) => string
}) {
  const platform = PLATFORMS.find(p => p.id === post.platform)
  const PlatformIcon = platform?.icon || Twitter

  return (
    <div
      onClick={onView}
      className="bg-[#252525] border border-white/5 rounded-xl p-4 hover:border-lime-500/30 transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <PlatformIcon size={18} style={{ color: platform?.color }} />
          <span className="text-xs text-gray-400 uppercase font-medium">{post.platform}</span>
        </div>
        <span className={`text-xs px-2 py-1 rounded border ${STATUS_BADGES[post.status].color}`}>
          {STATUS_BADGES[post.status].label}
        </span>
      </div>
      
      <p className="text-sm text-white mb-3 line-clamp-2">{post.content}</p>
      
      <div className="flex items-center gap-4 text-xs text-gray-400 pt-3 border-t border-white/5">
        <span className="flex items-center gap-1">
          <Heart size={12} />
          {post.engagement?.likes || 0}
        </span>
        <span className="flex items-center gap-1">
          <MessageSquare size={12} />
          {post.engagement?.comments || 0}
        </span>
        <span className="flex items-center gap-1">
          <Share2 size={12} />
          {post.engagement?.shares || 0}
        </span>
        <span className="ml-auto">{post.published_at && formatTimeAgo(post.published_at)}</span>
      </div>
    </div>
  )
}

function PostingCalendar({ posts, currentDate, onDateChange, view, onViewChange }: {
  posts: SocialPost[]
  currentDate: Date
  onDateChange: (date: Date) => void
  view: 'week' | 'month'
  onViewChange: (view: 'week' | 'month') => void
}) {
  const getDaysInView = () => {
    if (view === 'week') {
      const start = new Date(currentDate)
      start.setDate(start.getDate() - start.getDay())
      return Array.from({ length: 7 }, (_, i) => {
        const date = new Date(start)
        date.setDate(date.getDate() + i)
        return date
      })
    } else {
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth()
      const firstDay = new Date(year, month, 1)
      const lastDay = new Date(year, month + 1, 0)
      const days = []
      
      for (let i = 0; i < firstDay.getDay(); i++) {
        days.push(null)
      }
      
      for (let d = 1; d <= lastDay.getDate(); d++) {
        days.push(new Date(year, month, d))
      }
      
      return days
    }
  }

  const getPostsForDate = (date: Date | null) => {
    if (!date) return []
    return posts.filter(post => {
      if (!post.scheduled_for) return false
      const postDate = new Date(post.scheduled_for)
      return postDate.toDateString() === date.toDateString()
    })
  }

  const navigatePrevious = () => {
    const newDate = new Date(currentDate)
    if (view === 'week') {
      newDate.setDate(newDate.getDate() - 7)
    } else {
      newDate.setMonth(newDate.getMonth() - 1)
    }
    onDateChange(newDate)
  }

  const navigateNext = () => {
    const newDate = new Date(currentDate)
    if (view === 'week') {
      newDate.setDate(newDate.getDate() + 7)
    } else {
      newDate.setMonth(newDate.getMonth() + 1)
    }
    onDateChange(newDate)
  }

  const days = getDaysInView()

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6 sticky top-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Calendar className="text-indigo-400" />
          Schedule
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onViewChange(view === 'week' ? 'month' : 'week')}
            className="px-2 py-1 text-xs bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded transition-colors"
          >
            {view === 'week' ? 'Month' : 'Week'}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <button
          onClick={navigatePrevious}
          className="p-1 hover:bg-white/10 rounded transition-colors"
        >
          <ChevronLeft size={20} className="text-gray-400" />
        </button>
        <span className="text-sm font-medium text-white">
          {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button
          onClick={navigateNext}
          className="p-1 hover:bg-white/10 rounded transition-colors"
        >
          <ChevronRight size={20} className="text-gray-400" />
        </button>
      </div>

      <div className={`grid ${view === 'week' ? 'grid-cols-7' : 'grid-cols-7'} gap-2`}>
        {view === 'week' && ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-xs text-gray-400 font-medium mb-1">
            {day}
          </div>
        ))}
        
        {days.map((date, idx) => {
          const postsForDate = getPostsForDate(date)
          const isToday = date && date.toDateString() === new Date().toDateString()
          
          return (
            <div
              key={idx}
              className={`aspect-square rounded-lg p-1 border ${
                !date ? 'border-transparent' :
                isToday ? 'border-lime-400 bg-lime-400/10' :
                postsForDate.length > 0 ? 'border-blue-400/30 bg-blue-400/10' :
                'border-white/5 bg-[#252525]'
              } ${date ? 'cursor-pointer hover:border-white/20' : ''} transition-all`}
            >
              {date && (
                <>
                  <div className={`text-xs text-center ${isToday ? 'text-lime-400 font-bold' : 'text-gray-400'}`}>
                    {date.getDate()}
                  </div>
                  {postsForDate.length > 0 && (
                    <div className="flex justify-center mt-1">
                      <div className="w-1 h-1 rounded-full bg-blue-400"></div>
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      {view === 'week' && (
        <div className="mt-4 pt-4 border-t border-white/5">
          <h4 className="text-sm font-medium text-gray-400 mb-2">This Week</h4>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {posts
              .filter(post => {
                if (!post.scheduled_for) return false
                const postDate = new Date(post.scheduled_for)
                const weekStart = days[0]
                const weekEnd = days[6]
                if (!weekStart || !weekEnd) return false
                return postDate >= weekStart && postDate <= weekEnd
              })
              .sort((a, b) => new Date(a.scheduled_for!).getTime() - new Date(b.scheduled_for!).getTime())
              .map(post => {
                const platform = PLATFORMS.find(p => p.id === post.platform)
                const PlatformIcon = platform?.icon || Twitter
                return (
                  <div key={post.id} className="bg-[#252525] rounded-lg p-2 text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <PlatformIcon size={12} style={{ color: platform?.color }} />
                      <span className="text-gray-400">
                        {new Date(post.scheduled_for!).toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-white line-clamp-2">{post.content}</p>
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </motion.div>
  )
}

function PostDetailPanel({ post, onClose, onApprove, onReject, onReschedule, onPublishNow, editingPost, editedContent, editedScheduledFor, setEditedContent, setEditedScheduledFor, onStartEdit, onSaveEdit, onCancelEdit, isActioning, formatTimeAgo, formatScheduledTime }: {
  post: SocialPost
  onClose: () => void
  onApprove: () => void
  onReject: () => void
  onReschedule: (date: string) => void
  onPublishNow: () => void
  editingPost: boolean
  editedContent: string
  editedScheduledFor: string
  setEditedContent: (content: string) => void
  setEditedScheduledFor: (date: string) => void
  onStartEdit: () => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  isActioning: boolean
  formatTimeAgo: (date: string) => string
  formatScheduledTime: (date: string) => string
}) {
  const platform = PLATFORMS.find(p => p.id === post.platform)
  const PlatformIcon = platform?.icon || Twitter

  return (
    <motion.div
      key={post.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6"
    >
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-bold text-white">Post Details</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded-lg transition-colors"
        >
          <XCircle size={20} className="text-gray-400" />
        </button>
      </div>

      <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PlatformIcon size={24} style={{ color: platform?.color }} />
            <span className="text-sm font-medium text-white">{platform?.name}</span>
          </div>
          <span className={`text-xs px-2 py-1 rounded border ${STATUS_BADGES[post.status].color}`}>
            {STATUS_BADGES[post.status].label}
          </span>
        </div>

        {editingPost ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Content</label>
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="w-full bg-[#252525] border border-white/5 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-lime-500/50 resize-none min-h-[150px]"
                placeholder="Post content..."
              />
            </div>
            {post.status !== 'published' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Schedule For</label>
                <input
                  type="datetime-local"
                  value={editedScheduledFor ? new Date(editedScheduledFor).toISOString().slice(0, 16) : ''}
                  onChange={(e) => setEditedScheduledFor(new Date(e.target.value).toISOString())}
                  className="w-full bg-[#252525] border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500/50"
                />
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={onSaveEdit}
                disabled={isActioning}
                className="flex-1 px-3 py-2 bg-lime-500/20 hover:bg-lime-500/30 text-lime-400 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={onCancelEdit}
                className="flex-1 px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div>
              <p className="text-xs text-gray-400 mb-2">Content</p>
              <div className="bg-[#252525] border border-white/5 rounded-lg p-3 text-sm text-white whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                {post.content}
              </div>
            </div>

            {post.media_urls && post.media_urls.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-2">Media</p>
                <div className="grid grid-cols-2 gap-2">
                  {post.media_urls.map((url, idx) => (
                    <div key={idx} className="bg-[#252525] border border-white/5 rounded-lg p-2 flex items-center gap-2">
                      <ImageIcon size={16} className="text-gray-400" />
                      <span className="text-xs text-gray-400 truncate">Media {idx + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {post.metadata.keywords && post.metadata.keywords.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-2">Keywords</p>
            <div className="flex flex-wrap gap-2">
              {post.metadata.keywords.map((keyword, idx) => (
                <span key={idx} className="text-xs px-2 py-1 bg-white/5 rounded text-gray-400 flex items-center gap-1">
                  <Tag size={10} />
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}

        {post.scheduled_for && (
          <div>
            <p className="text-xs text-gray-400 mb-1">Scheduled For</p>
            <p className="text-sm text-white">{new Date(post.scheduled_for).toLocaleString()}</p>
            <p className="text-xs text-blue-400 mt-1">in {formatScheduledTime(post.scheduled_for)}</p>
          </div>
        )}

        {post.published_at && (
          <div>
            <p className="text-xs text-gray-400 mb-1">Published</p>
            <p className="text-sm text-white">{formatTimeAgo(post.published_at)}</p>
          </div>
        )}

        {post.status === 'published' && (
          <div>
            <p className="text-xs text-gray-400 mb-2">Engagement</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#252525] rounded-lg p-3 text-center">
                <Heart size={16} className="text-pink-400 mx-auto mb-1" />
                <p className="text-lg font-bold text-white">{post.engagement?.likes || 0}</p>
                <p className="text-xs text-gray-400">Likes</p>
              </div>
              <div className="bg-[#252525] rounded-lg p-3 text-center">
                <MessageSquare size={16} className="text-purple-400 mx-auto mb-1" />
                <p className="text-lg font-bold text-white">{post.engagement?.comments || 0}</p>
                <p className="text-xs text-gray-400">Comments</p>
              </div>
              <div className="bg-[#252525] rounded-lg p-3 text-center">
                <Share2 size={16} className="text-blue-400 mx-auto mb-1" />
                <p className="text-lg font-bold text-white">{post.engagement?.shares || 0}</p>
                <p className="text-xs text-gray-400">Shares</p>
              </div>
            </div>
          </div>
        )}

        {post.created_by && (
          <div>
            <p className="text-xs text-gray-400 mb-1">Created By</p>
            <p className="text-sm text-white">{post.created_by}</p>
          </div>
        )}

        {!editingPost && (
          <div className="pt-4 border-t border-white/5 space-y-2">
            {post.status === 'draft' && (
              <>
                <button
                  onClick={onApprove}
                  disabled={isActioning}
                  className="w-full px-4 py-2 bg-lime-500/20 hover:bg-lime-500/30 text-lime-400 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <ThumbsUp size={16} />
                  Approve & Schedule
                </button>
                <button
                  onClick={onReject}
                  disabled={isActioning}
                  className="w-full px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <ThumbsDown size={16} />
                  Reject
                </button>
              </>
            )}

            {post.status === 'scheduled' && (
              <>
                <button
                  onClick={onPublishNow}
                  disabled={isActioning}
                  className="w-full px-4 py-2 bg-lime-500/20 hover:bg-lime-500/30 text-lime-400 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Send size={16} />
                  Publish Now
                </button>
              </>
            )}

            {post.status !== 'published' && (
              <button
                onClick={onStartEdit}
                className="w-full px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Edit3 size={16} />
                Edit Post
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

function GeneratePostsModal({ onClose, onGenerate }: {
  onClose: () => void
  onGenerate: (config: { platforms: string[], keywords: string[], count: number }) => void
}) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['twitter'])
  const [keywords, setKeywords] = useState<string>('')
  const [count, setCount] = useState<number>(5)

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platformId)
        ? prev.filter(p => p !== platformId)
        : [...prev, platformId]
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const keywordList = keywords.split(',').map(k => k.trim()).filter(k => k)
    onGenerate({ platforms: selectedPlatforms, keywords: keywordList, count })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#1c1c1c] border border-white/10 rounded-2xl p-6 w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Sparkles className="text-lime-400" />
          Generate Posts
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Select Platforms</label>
            <div className="grid grid-cols-2 gap-2">
              {PLATFORMS.map(platform => {
                const Icon = platform.icon
                const isSelected = selectedPlatforms.includes(platform.id)
                return (
                  <button
                    key={platform.id}
                    type="button"
                    onClick={() => togglePlatform(platform.id)}
                    className={`p-3 rounded-lg border transition-all flex items-center gap-2 ${
                      isSelected
                        ? 'border-lime-500/50 bg-lime-500/10'
                        : 'border-white/10 bg-[#252525] hover:border-white/20'
                    }`}
                  >
                    <Icon size={16} style={{ color: platform.color }} />
                    <span className="text-sm text-white">{platform.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Keywords (comma-separated)</label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-lime-500/50"
              placeholder="audio, home theater, speakers"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Number of Posts</label>
            <input
              type="number"
              min="1"
              max="20"
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value))}
              className="w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-lime-500/50"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={selectedPlatforms.length === 0}
              className="flex-1 px-4 py-2 bg-lime-400 hover:bg-lime-500 text-black font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              Generate
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
