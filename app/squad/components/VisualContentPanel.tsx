'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Image,
  FileImage,
  Video,
  Download,
  RefreshCw,
  Trash2,
  X,
  Plus,
  Instagram,
  Facebook,
  Linkedin,
  Mail,
  FileText,
  Users,
  Eye,
  Calendar,
  Sparkles
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

type VisualType = 'infographic' | 'slides' | 'video'
type SourceType = 'social' | 'newsletter' | 'reseller'
type Orientation = 'square' | 'portrait' | 'landscape'
type Audience = 'general' | 'technical' | 'business' | 'reseller'
type VisualStyle = 'modern' | 'minimal' | 'bold' | 'professional'

interface VisualContent {
  id: string
  type: VisualType
  title: string
  source: SourceType
  source_reference?: string
  notebook_id?: string
  thumbnail_url: string
  file_url: string
  metadata: {
    orientation?: Orientation
    audience?: Audience
    visual_style?: VisualStyle
    dimensions?: string
    duration?: number
    slide_count?: number
  }
  status: 'generated' | 'regenerating' | 'failed'
  created_at: string
  updated_at: string
  created_by: string
}

interface VisualContentPanelProps {
  agentName: 'Naledi' | 'Lerato'
}

const SOURCE_LABELS = {
  social: 'Social Posts',
  newsletter: 'Newsletters',
  reseller: 'Reseller Materials'
}

const SOURCE_ICONS = {
  social: Instagram,
  newsletter: Mail,
  reseller: Users
}

const TYPE_ICONS = {
  infographic: FileImage,
  slides: FileText,
  video: Video
}

const TYPE_LABELS = {
  infographic: 'Infographic',
  slides: 'Slide Deck',
  video: 'Video Overview'
}

export default function VisualContentPanel({ agentName }: VisualContentPanelProps) {
  const [visuals, setVisuals] = useState<VisualContent[]>([])
  const [selectedVisual, setSelectedVisual] = useState<VisualContent | null>(null)
  const [showGenerateForm, setShowGenerateForm] = useState(false)
  const [activeSourceFilter, setActiveSourceFilter] = useState<SourceType | 'all'>('all')
  const [activeTypeFilter, setActiveTypeFilter] = useState<VisualType | 'all'>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchVisuals()
    setupRealtimeSubscription()
  }, [agentName])

  const fetchVisuals = async () => {
    try {
      const { data, error } = await supabase
        .from('visual_content')
        .select('*')
        .eq('created_by', agentName)
        .order('created_at', { ascending: false })

      if (data) {
        setVisuals(data)
      }
      setLoading(false)
    } catch (err) {
      console.log('Using mock data - DB not connected')
      setVisuals(getMockVisuals(agentName))
      setLoading(false)
    }
  }

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('visual_content_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'visual_content',
          filter: `created_by=eq.${agentName}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setVisuals(prev => [payload.new as VisualContent, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setVisuals(prev => prev.map(v => v.id === payload.new.id ? payload.new as VisualContent : v))
          } else if (payload.eventType === 'DELETE') {
            setVisuals(prev => prev.filter(v => v.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const filteredVisuals = useMemo(() => {
    let filtered = visuals

    if (activeSourceFilter !== 'all') {
      filtered = filtered.filter(v => v.source === activeSourceFilter)
    }

    if (activeTypeFilter !== 'all') {
      filtered = filtered.filter(v => v.type === activeTypeFilter)
    }

    return filtered
  }, [visuals, activeSourceFilter, activeTypeFilter])

  const groupedVisuals = useMemo(() => {
    const groups: Record<SourceType, VisualContent[]> = {
      social: [],
      newsletter: [],
      reseller: []
    }

    filteredVisuals.forEach(visual => {
      groups[visual.source].push(visual)
    })

    return groups
  }, [filteredVisuals])

  const handleDownload = async (visual: VisualContent) => {
    const link = document.createElement('a')
    link.href = visual.file_url
    link.download = `${visual.title}.${visual.type === 'video' ? 'mp4' : visual.type === 'slides' ? 'pdf' : 'png'}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleRegenerate = async (visual: VisualContent) => {
    try {
      await supabase
        .from('visual_content')
        .update({ status: 'regenerating', updated_at: new Date().toISOString() })
        .eq('id', visual.id)

      await supabase
        .from('squad_messages')
        .insert({
          from_agent: 'System',
          to_agent: agentName,
          message: `Regeneration requested for ${visual.type}: "${visual.title}"`
        })
    } catch (err) {
      console.log('Failed to trigger regeneration')
    }
  }

  const handleDelete = async (visual: VisualContent) => {
    if (!confirm(`Delete ${visual.type} "${visual.title}"?`)) return

    try {
      await supabase
        .from('visual_content')
        .delete()
        .eq('id', visual.id)

      setVisuals(prev => prev.filter(v => v.id !== visual.id))
      setSelectedVisual(null)
    } catch (err) {
      console.log('Failed to delete visual')
    }
  }

  const stats = useMemo(() => {
    return {
      total: visuals.length,
      byType: {
        infographic: visuals.filter(v => v.type === 'infographic').length,
        slides: visuals.filter(v => v.type === 'slides').length,
        video: visuals.filter(v => v.type === 'video').length
      },
      bySource: {
        social: visuals.filter(v => v.source === 'social').length,
        newsletter: visuals.filter(v => v.source === 'newsletter').length,
        reseller: visuals.filter(v => v.source === 'reseller').length
      }
    }
  }, [visuals])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-400">Loading visual content...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="text-purple-400" size={20} />
            Visual Content Library
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            {stats.total} visuals generated • {stats.byType.infographic} infographics • {stats.byType.slides} slide decks • {stats.byType.video} videos
          </p>
        </div>
        <button
          onClick={() => setShowGenerateForm(true)}
          className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2"
        >
          <Plus size={16} />
          Generate Visual
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Source:</span>
          <button
            onClick={() => setActiveSourceFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeSourceFilter === 'all'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10'
            }`}
          >
            All
          </button>
          {(Object.keys(SOURCE_LABELS) as SourceType[]).map(source => {
            const Icon = SOURCE_ICONS[source]
            return (
              <button
                key={source}
                onClick={() => setActiveSourceFilter(source)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  activeSourceFilter === source
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10'
                }`}
              >
                <Icon size={12} />
                {SOURCE_LABELS[source]}
              </button>
            )
          })}
        </div>

        <div className="h-4 w-px bg-white/10" />

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Type:</span>
          <button
            onClick={() => setActiveTypeFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTypeFilter === 'all'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10'
            }`}
          >
            All
          </button>
          {(Object.keys(TYPE_LABELS) as VisualType[]).map(type => {
            const Icon = TYPE_ICONS[type]
            return (
              <button
                key={type}
                onClick={() => setActiveTypeFilter(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  activeTypeFilter === type
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10'
                }`}
              >
                <Icon size={12} />
                {TYPE_LABELS[type]}
              </button>
            )
          })}
        </div>
      </div>

      {filteredVisuals.length === 0 ? (
        <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-12 text-center">
          <Sparkles className="mx-auto text-gray-600 mb-4" size={48} />
          <p className="text-gray-400 mb-2">No visual content yet</p>
          <p className="text-sm text-gray-500">Generate your first visual to get started</p>
        </div>
      ) : (
        <div className="space-y-6">
          {(Object.keys(groupedVisuals) as SourceType[]).map(source => {
            const items = groupedVisuals[source]
            if (items.length === 0 && activeSourceFilter !== 'all' && activeSourceFilter !== source) return null
            
            const Icon = SOURCE_ICONS[source]
            
            return (
              <div key={source} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Icon className="text-gray-500" size={16} />
                  <h4 className="text-sm font-semibold text-gray-400">{SOURCE_LABELS[source]}</h4>
                  <span className="text-xs text-gray-600">({items.length})</span>
                </div>
                
                {items.length === 0 ? (
                  <div className="bg-[#1c1c1c] border border-white/5 rounded-xl p-6 text-center">
                    <p className="text-sm text-gray-500">No {SOURCE_LABELS[source].toLowerCase()} yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {items.map(visual => (
                      <VisualCard
                        key={visual.id}
                        visual={visual}
                        onClick={() => setSelectedVisual(visual)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {selectedVisual && (
          <PreviewModal
            visual={selectedVisual}
            onClose={() => setSelectedVisual(null)}
            onDownload={handleDownload}
            onRegenerate={handleRegenerate}
            onDelete={handleDelete}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showGenerateForm && (
          <GenerateVisualModal
            agentName={agentName}
            onClose={() => setShowGenerateForm(false)}
            onSubmit={async (data) => {
              try {
                await supabase.from('visual_content').insert({
                  ...data,
                  created_by: agentName,
                  status: 'generated'
                })
                await supabase.from('squad_messages').insert({
                  from_agent: 'System',
                  to_agent: agentName,
                  message: `Manual generation requested: ${data.type} - "${data.title}"`
                })
                setShowGenerateForm(false)
                fetchVisuals()
              } catch (err) {
                console.log('Failed to create visual')
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function VisualCard({ visual, onClick }: { visual: VisualContent; onClick: () => void }) {
  const TypeIcon = TYPE_ICONS[visual.type]
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      onClick={onClick}
      className="bg-[#1c1c1c] border border-white/5 rounded-xl overflow-hidden cursor-pointer hover:border-purple-500/30 transition-all group"
    >
      <div className="aspect-video bg-gradient-to-br from-purple-500/10 to-pink-500/10 relative overflow-hidden">
        {visual.thumbnail_url ? (
          <img
            src={visual.thumbnail_url}
            alt={visual.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <TypeIcon className="text-purple-400/30" size={48} />
          </div>
        )}
        
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Eye className="text-white" size={24} />
        </div>

        {visual.status === 'regenerating' && (
          <div className="absolute top-2 right-2 bg-yellow-500/90 text-yellow-900 text-xs px-2 py-1 rounded-md flex items-center gap-1">
            <RefreshCw size={10} className="animate-spin" />
            Regenerating
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="text-sm font-medium text-white line-clamp-2 leading-tight">{visual.title}</h4>
          <TypeIcon className="text-gray-500 shrink-0" size={14} />
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">{TYPE_LABELS[visual.type]}</span>
          {visual.metadata.slide_count && (
            <span className="text-gray-600">{visual.metadata.slide_count} slides</span>
          )}
          {visual.metadata.duration && (
            <span className="text-gray-600">{visual.metadata.duration}s</span>
          )}
        </div>

        {visual.source_reference && (
          <div className="mt-2 pt-2 border-t border-white/5">
            <p className="text-xs text-gray-600 truncate">{visual.source_reference}</p>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function PreviewModal({
  visual,
  onClose,
  onDownload,
  onRegenerate,
  onDelete
}: {
  visual: VisualContent
  onClose: () => void
  onDownload: (visual: VisualContent) => void
  onRegenerate: (visual: VisualContent) => void
  onDelete: (visual: VisualContent) => void
}) {
  const TypeIcon = TYPE_ICONS[visual.type]
  const SourceIcon = SOURCE_ICONS[visual.source]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#1c1c1c] border border-white/10 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <TypeIcon className="text-purple-400" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{visual.title}</h3>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <SourceIcon size={12} />
                <span>{SOURCE_LABELS[visual.source]}</span>
                <span>•</span>
                <span>{TYPE_LABELS[visual.type]}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="aspect-video bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl overflow-hidden mb-6">
            {visual.thumbnail_url ? (
              visual.type === 'video' ? (
                <video
                  src={visual.file_url}
                  controls
                  className="w-full h-full object-contain"
                  poster={visual.thumbnail_url}
                />
              ) : (
                <img
                  src={visual.thumbnail_url}
                  alt={visual.title}
                  className="w-full h-full object-contain"
                />
              )
            ) : (
              <div className="flex items-center justify-center h-full">
                <TypeIcon className="text-purple-400/30" size={64} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Created</p>
                <p className="text-sm text-white">{new Date(visual.created_at).toLocaleDateString()}</p>
              </div>
              {visual.metadata.orientation && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Orientation</p>
                  <p className="text-sm text-white capitalize">{visual.metadata.orientation}</p>
                </div>
              )}
              {visual.metadata.slide_count && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Slides</p>
                  <p className="text-sm text-white">{visual.metadata.slide_count}</p>
                </div>
              )}
            </div>
            <div className="space-y-3">
              {visual.metadata.audience && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Audience</p>
                  <p className="text-sm text-white capitalize">{visual.metadata.audience}</p>
                </div>
              )}
              {visual.metadata.visual_style && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Style</p>
                  <p className="text-sm text-white capitalize">{visual.metadata.visual_style}</p>
                </div>
              )}
              {visual.metadata.duration && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Duration</p>
                  <p className="text-sm text-white">{visual.metadata.duration} seconds</p>
                </div>
              )}
            </div>
          </div>

          {visual.source_reference && (
            <div className="mt-4 p-3 bg-white/5 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Source Reference</p>
              <p className="text-sm text-gray-300">{visual.source_reference}</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 p-4 border-t border-white/10">
          <button
            onClick={() => onDownload(visual)}
            className="flex-1 px-4 py-2 bg-lime-400 hover:bg-lime-500 text-black font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Download size={16} />
            Download
          </button>
          <button
            onClick={() => {
              onRegenerate(visual)
              onClose()
            }}
            disabled={visual.status === 'regenerating'}
            className="flex-1 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 font-medium rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <RefreshCw size={16} className={visual.status === 'regenerating' ? 'animate-spin' : ''} />
            Regenerate
          </button>
          <button
            onClick={() => {
              onDelete(visual)
            }}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function GenerateVisualModal({
  agentName,
  onClose,
  onSubmit
}: {
  agentName: string
  onClose: () => void
  onSubmit: (data: Partial<VisualContent>) => void
}) {
  const [notebookId, setNotebookId] = useState('')
  const [visualType, setVisualType] = useState<VisualType>('infographic')
  const [source, setSource] = useState<SourceType>('social')
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [orientation, setOrientation] = useState<Orientation>('square')
  const [audience, setAudience] = useState<Audience>('general')
  const [visualStyle, setVisualStyle] = useState<VisualStyle>('modern')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    const metadata: VisualContent['metadata'] = {}
    
    if (visualType === 'infographic') {
      metadata.orientation = orientation
    } else if (visualType === 'slides') {
      metadata.audience = audience
    } else if (visualType === 'video') {
      metadata.visual_style = visualStyle
    }

    onSubmit({
      type: visualType,
      title,
      source,
      notebook_id: notebookId || undefined,
      thumbnail_url: '',
      file_url: `https://example.com/generated/${Date.now()}`,
      metadata,
      source_reference: prompt
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#1c1c1c] border border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-white">Generate Visual Content</h3>
            <p className="text-sm text-gray-400 mt-1">Create infographics, slide decks, or video overviews</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500/50"
              placeholder="Visual content title"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Notebook Selection</label>
            <input
              type="text"
              value={notebookId}
              onChange={e => setNotebookId(e.target.value)}
              className="w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500/50"
              placeholder="Notebook ID (optional)"
            />
            <p className="text-xs text-gray-500 mt-1">Reference a specific notebook for content generation</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Source Category</label>
            <div className="grid grid-cols-3 gap-3">
              {(Object.keys(SOURCE_LABELS) as SourceType[]).map(sourceType => {
                const Icon = SOURCE_ICONS[sourceType]
                return (
                  <button
                    key={sourceType}
                    type="button"
                    onClick={() => setSource(sourceType)}
                    className={`p-3 rounded-xl border transition-all ${
                      source === sourceType
                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-400'
                        : 'bg-[#252525] border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    <Icon className="mx-auto mb-1" size={20} />
                    <p className="text-xs font-medium">{SOURCE_LABELS[sourceType]}</p>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Visual Type</label>
            <div className="grid grid-cols-3 gap-3">
              {(Object.keys(TYPE_LABELS) as VisualType[]).map(type => {
                const Icon = TYPE_ICONS[type]
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setVisualType(type)}
                    className={`p-3 rounded-xl border transition-all ${
                      visualType === type
                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-400'
                        : 'bg-[#252525] border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    <Icon className="mx-auto mb-1" size={20} />
                    <p className="text-xs font-medium">{TYPE_LABELS[type]}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {visualType === 'infographic' && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Orientation</label>
              <div className="grid grid-cols-3 gap-3">
                {(['square', 'portrait', 'landscape'] as Orientation[]).map(orient => (
                  <button
                    key={orient}
                    type="button"
                    onClick={() => setOrientation(orient)}
                    className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      orientation === orient
                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-400'
                        : 'bg-[#252525] border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    {orient.charAt(0).toUpperCase() + orient.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {visualType === 'slides' && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Target Audience</label>
              <div className="grid grid-cols-2 gap-3">
                {(['general', 'technical', 'business', 'reseller'] as Audience[]).map(aud => (
                  <button
                    key={aud}
                    type="button"
                    onClick={() => setAudience(aud)}
                    className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      audience === aud
                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-400'
                        : 'bg-[#252525] border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    {aud.charAt(0).toUpperCase() + aud.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {visualType === 'video' && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Visual Style</label>
              <div className="grid grid-cols-2 gap-3">
                {(['modern', 'minimal', 'bold', 'professional'] as VisualStyle[]).map(style => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => setVisualStyle(style)}
                    className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      visualStyle === style
                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-400'
                        : 'bg-[#252525] border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    {style.charAt(0).toUpperCase() + style.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Custom Prompt</label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              className="w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500/50 resize-none"
              rows={4}
              placeholder="Provide specific instructions or context for generation..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-xl transition-colors"
            >
              Generate
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

function getMockVisuals(agentName: string): VisualContent[] {
  const baseDate = new Date()
  
  return [
    {
      id: '1',
      type: 'infographic',
      title: 'Q1 Product Launch Timeline',
      source: 'social',
      source_reference: 'Instagram campaign for new smart speakers',
      thumbnail_url: '',
      file_url: '',
      metadata: { orientation: 'portrait' },
      status: 'generated',
      created_at: new Date(baseDate.getTime() - 2 * 86400000).toISOString(),
      updated_at: new Date(baseDate.getTime() - 2 * 86400000).toISOString(),
      created_by: agentName
    },
    {
      id: '2',
      type: 'slides',
      title: 'Partner Onboarding Deck',
      source: 'reseller',
      source_reference: 'Reseller training materials',
      thumbnail_url: '',
      file_url: '',
      metadata: { audience: 'reseller', slide_count: 24 },
      status: 'generated',
      created_at: new Date(baseDate.getTime() - 5 * 86400000).toISOString(),
      updated_at: new Date(baseDate.getTime() - 5 * 86400000).toISOString(),
      created_by: agentName
    },
    {
      id: '3',
      type: 'video',
      title: 'February Newsletter Highlights',
      source: 'newsletter',
      source_reference: 'Video overview for email campaign',
      thumbnail_url: '',
      file_url: '',
      metadata: { visual_style: 'modern', duration: 45 },
      status: 'generated',
      created_at: new Date(baseDate.getTime() - 1 * 86400000).toISOString(),
      updated_at: new Date(baseDate.getTime() - 1 * 86400000).toISOString(),
      created_by: agentName
    }
  ]
}
