'use client'

import { useState, useEffect } from 'react'
import { Send, Image, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react'

interface SocialPost {
  id: string
  platform: string
  content: string
  media_urls: string[]
  status: 'draft' | 'scheduled' | 'published' | 'failed'
  scheduled_for: string | null
  published_at: string | null
  post_url: string | null
  metadata: any
  created_at: string
}

export default function SocialPostsPage() {
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState<string | null>(null)

  useEffect(() => {
    fetchPosts()
  }, [])

  const fetchPosts = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/agents/social/post')
      if (!response.ok) throw new Error('Failed to fetch posts')
      const data = await response.json()
      setPosts(data.posts || [])
    } catch (err) {
      console.error('Error fetching posts:', err)
    } finally {
      setLoading(false)
    }
  }

  const handlePublish = async (postId: string, platforms: string[]) => {
    try {
      setPublishing(postId)
      const response = await fetch('/api/agents/social/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_id: postId,
          platforms,
        }),
      })

      if (!response.ok) throw new Error('Failed to publish post')

      const result = await response.json()
      
      if (result.success) {
        alert(`Published to ${result.published} platform(s)!`)
        await fetchPosts()
      } else {
        alert('Failed to publish to any platform')
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to publish post')
    } finally {
      setPublishing(null)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'published':
        return <CheckCircle className="text-lime-400" size={16} />
      case 'failed':
        return <XCircle className="text-red-400" size={16} />
      case 'scheduled':
        return <Clock className="text-yellow-400" size={16} />
      default:
        return <RefreshCw className="text-gray-400" size={16} />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-lime-500/10 text-lime-400 border-lime-500/20'
      case 'failed':
        return 'bg-red-500/10 text-red-400 border-red-500/20'
      case 'scheduled':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="animate-spin text-lime-400" size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Social Media Posts</h1>
          <p className="text-gray-400 mt-2">Manage and publish content across platforms</p>
        </div>
      </div>

      <div className="bg-[#1c1c1c] border border-white/5 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Recent Posts</h2>
        
        {posts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-2">No posts found.</p>
            <p className="text-sm text-gray-500">Create posts in the social_posts table or use the API endpoint.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <div
                key={post.id}
                className="bg-white/5 border border-white/5 rounded-lg p-4 hover:border-white/10 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border ${getStatusColor(post.status)}`}>
                        {getStatusIcon(post.status)}
                        {post.status}
                      </span>
                      {post.platform && (
                        <span className="px-2 py-1 rounded-lg text-xs font-medium bg-white/5 text-gray-400 border border-white/5 capitalize">
                          {post.platform}
                        </span>
                      )}
                    </div>
                    <p className="text-white mb-2">{post.content}</p>
                    {post.media_urls && post.media_urls.length > 0 && (
                      <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                        <Image size={14} />
                        <span>{post.media_urls.length} media file(s)</span>
                      </div>
                    )}
                    {post.post_url && (
                      <a
                        href={post.post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-lime-400 hover:text-lime-300"
                      >
                        View post →
                      </a>
                    )}
                  </div>
                  {(post.status === 'draft' || post.status === 'scheduled') && (
                    <button
                      onClick={() => handlePublish(post.id, ['facebook', 'instagram', 'twitter'])}
                      disabled={publishing === post.id}
                      className="flex items-center gap-2 px-4 py-2 bg-lime-500/10 border border-lime-500/20 rounded-lg text-lime-400 hover:bg-lime-500/20 transition-colors disabled:opacity-50"
                    >
                      {publishing === post.id ? (
                        <RefreshCw className="animate-spin" size={16} />
                      ) : (
                        <Send size={16} />
                      )}
                      Publish
                    </button>
                  )}
                </div>
                <div className="text-xs text-gray-500 pt-3 border-t border-white/5">
                  Created: {new Date(post.created_at).toLocaleString()}
                  {post.published_at && (
                    <> · Published: {new Date(post.published_at).toLocaleString()}</>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
