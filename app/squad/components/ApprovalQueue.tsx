'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface ApprovalTask {
  id: string
  title: string
  description: string
  assigned_agent: string
  priority: string
  created_at: string
  deliverable_url?: string
  metadata?: any
}

export default function ApprovalQueue() {
  const [tasks, setTasks] = useState<ApprovalTask[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  useEffect(() => {
    fetchTasks()

    // Poll every 30 seconds
    const interval = setInterval(fetchTasks, 30000)

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('approval_queue')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'squad_tasks',
        filter: 'requires_approval=eq.true'
      }, () => {
        fetchTasks()
      })
      .subscribe()

    return () => {
      clearInterval(interval)
      subscription.unsubscribe()
    }
  }, [])

  async function fetchTasks() {
    try {
      const { data, error } = await supabase
        .from('squad_tasks')
        .select('*')
        .eq('requires_approval', true)
        .is('approved_at', null)
        .is('rejected_at', null)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(20)

      if (!error && data) {
        setTasks(data)
      }
    } catch (error) {
      console.error('Failed to fetch approval tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  async function approveTask(taskId: string) {
    setProcessing(taskId)
    try {
      const { error } = await supabase
        .from('squad_tasks')
        .update({
          approved_by: 'Kenny',
          approved_at: new Date().toISOString()
        })
        .eq('id', taskId)

      if (error) throw error

      // Remove from list immediately
      setTasks(tasks.filter(t => t.id !== taskId))

      // Show success message
      alert('✅ Task approved! It will be executed within 2 minutes.')
    } catch (error: any) {
      console.error('Failed to approve task:', error)
      alert('❌ Failed to approve task: ' + error.message)
    } finally {
      setProcessing(null)
    }
  }

  async function rejectTask(taskId: string) {
    const reason = prompt('Why are you rejecting this task?\n\n(This helps improve the AI)')
    if (!reason || reason.trim() === '') {
      return
    }

    setProcessing(taskId)
    try {
      const { error } = await supabase
        .from('squad_tasks')
        .update({
          status: 'rejected',
          rejected_by: 'Kenny',
          rejected_at: new Date().toISOString(),
          rejection_reason: reason.trim()
        })
        .eq('id', taskId)

      if (error) throw error

      // Remove from list immediately
      setTasks(tasks.filter(t => t.id !== taskId))

      // Show success message
      alert('❌ Task rejected. The reason has been logged.')
    } catch (error: any) {
      console.error('Failed to reject task:', error)
      alert('❌ Failed to reject task: ' + error.message)
    } finally {
      setProcessing(null)
    }
  }

  function getPriorityColor(priority: string) {
    switch (priority) {
      case 'urgent': return 'border-red-500 bg-red-50'
      case 'high': return 'border-orange-500 bg-orange-50'
      case 'medium': return 'border-yellow-500 bg-yellow-50'
      case 'low': return 'border-blue-500 bg-blue-50'
      default: return 'border-gray-500 bg-gray-50'
    }
  }

  function getPriorityBadge(priority: string) {
    switch (priority) {
      case 'urgent': return '🚨 Urgent'
      case 'high': return '🔴 High'
      case 'medium': return '🟡 Medium'
      case 'low': return '🔵 Low'
      default: return priority
    }
  }

  function formatTimeAgo(dateString: string) {
    const date = new Date(dateString)
    const now = new Date()
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg shadow border-2 border-green-200 p-6">
        <div className="flex items-center gap-3">
          <div className="text-3xl">✅</div>
          <div>
            <h3 className="text-lg font-semibold text-green-800">All Clear!</h3>
            <p className="text-green-600 text-sm">No tasks waiting for approval</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl">⏸️</div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                Pending Approvals
              </h3>
              <p className="text-sm text-gray-500">
                {tasks.length} task{tasks.length !== 1 ? 's' : ''} waiting for your review
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="divide-y divide-gray-200">
        {tasks.map(task => (
          <div
            key={task.id}
            className={`p-6 border-l-4 ${getPriorityColor(task.priority)} transition-all hover:shadow-md`}
          >
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1 min-w-0">
                {/* Header */}
                <div className="flex items-start gap-3 mb-2">
                  <h4 className="font-semibold text-gray-900 text-base">
                    {task.title}
                  </h4>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-700 mb-3 whitespace-pre-wrap line-clamp-3">
                  {task.description}
                </p>

                {/* Metadata badges */}
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {task.assigned_agent}
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    task.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                    task.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                    task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {getPriorityBadge(task.priority)}
                  </span>
                  {task.metadata?.email_category && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      {task.metadata.email_category}
                    </span>
                  )}
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    {formatTimeAgo(task.created_at)}
                  </span>
                </div>

                {/* Preview link */}
                {task.deliverable_url && (
                  <a
                    href={task.deliverable_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    👁️ Preview draft
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-2 ml-4">
                <button
                  onClick={() => approveTask(task.id)}
                  disabled={processing === task.id}
                  className="px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm hover:shadow-md whitespace-nowrap"
                >
                  {processing === task.id ? '⏳ Processing...' : '✅ Approve'}
                </button>
                <button
                  onClick={() => rejectTask(task.id)}
                  disabled={processing === task.id}
                  className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm hover:shadow-md whitespace-nowrap"
                >
                  {processing === task.id ? '⏳ Processing...' : '❌ Reject'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
