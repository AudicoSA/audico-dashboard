'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface EmailLog {
  id: string
  from_email: string
  subject: string
  category: string
  status: string
  payload: any
  created_at: string
}

interface Task {
  id: string
  title: string
  description: string
  metadata: any
}

export default function DraftPreviewPage() {
  const params = useParams()
  const router = useRouter()
  const emailId = params.id as string

  const [email, setEmail] = useState<EmailLog | null>(null)
  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDraft()
  }, [emailId])

  async function fetchDraft() {
    try {
      // First, try to fetch the task by metadata email_id
      const { data: taskData, error: taskError } = await supabase
        .from('squad_tasks')
        .select('*')
        .eq('metadata->>email_id', emailId)
        .maybeSingle()

      if (taskData) {
        setTask(taskData)
      }

      // Then try to fetch email log (might not exist for test tasks)
      const { data: emailData, error: emailError } = await supabase
        .from('email_logs')
        .select('*')
        .eq('id', emailId)
        .maybeSingle()

      // If no email log found but we have a task, create a mock email from task metadata
      if (!emailData && taskData) {
        setEmail({
          id: emailId,
          from_email: taskData.metadata?.from_email || 'Test Email',
          subject: taskData.metadata?.subject || taskData.title,
          category: taskData.metadata?.email_category || 'test',
          status: 'draft',
          payload: { body: 'Preview not available for test tasks' },
          created_at: taskData.created_at
        } as EmailLog)
      } else if (emailData) {
        setEmail(emailData)
      } else {
        throw new Error('Email not found')
      }

      setLoading(false)
    } catch (err: any) {
      console.error('Failed to fetch draft:', err)
      setError(err.message || 'Failed to load draft')
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading draft preview...</p>
        </div>
      </div>
    )
  }

  if (error || (!email && !task)) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="max-w-md mx-auto p-6 bg-red-500/10 border border-red-500/30 rounded-xl">
          <h2 className="text-xl font-bold text-red-400 mb-2">Error Loading Draft</h2>
          <p className="text-gray-300">{error || 'Email or task not found'}</p>
          <button
            onClick={() => router.push('/squad')}
            className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          >
            ← Back to Mission Control
          </button>
        </div>
      </div>
    )
  }

  const draftId = task?.metadata?.draft_id
  const category = email.category || 'unknown'

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/squad')}
            className="text-lime-400 hover:text-lime-300 mb-4 flex items-center gap-2"
          >
            ← Back to Mission Control
          </button>
          <h1 className="text-3xl font-bold">Email Draft Preview</h1>
          <p className="text-gray-400 mt-1">Review the draft response before approval</p>
        </div>

        {/* Email Info */}
        <div className="bg-[#1c1c1c] border border-white/10 rounded-xl p-6 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-500">From</label>
              <p className="text-white font-medium">{email.from_email}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Category</label>
              <p className="text-white">
                <span className={`inline-block px-2 py-1 rounded text-xs ${
                  category === 'complaint' ? 'bg-red-500/20 text-red-400' :
                  category === 'order' ? 'bg-blue-500/20 text-blue-400' :
                  category === 'support' ? 'bg-purple-500/20 text-purple-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {category}
                </span>
              </p>
            </div>
            <div className="col-span-2">
              <label className="text-sm text-gray-500">Subject</label>
              <p className="text-white font-medium">{email.subject}</p>
            </div>
            <div className="col-span-2">
              <label className="text-sm text-gray-500">Status</label>
              <p className="text-white">{email.status}</p>
            </div>
          </div>
        </div>

        {/* Original Email */}
        {email.payload?.body && (
          <div className="bg-[#1c1c1c] border border-white/10 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4 text-lime-400">Original Email</h3>
            <div className="bg-black/50 rounded-lg p-4 max-h-64 overflow-y-auto">
              <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                {email.payload.body}
              </pre>
            </div>
          </div>
        )}

        {/* Draft Response */}
        {task && (
          <div className="bg-[#1c1c1c] border border-white/10 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4 text-lime-400">Draft Response</h3>
            <div className="bg-black/50 rounded-lg p-4 max-h-96 overflow-y-auto">
              <pre className="text-sm text-gray-300 whitespace-pre-wrap">
                {task.description}
              </pre>
            </div>
          </div>
        )}

        {/* Draft ID Info */}
        {draftId && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="text-blue-400 text-2xl">ℹ️</div>
              <div>
                <h4 className="font-semibold text-blue-400 mb-1">Gmail Draft Created</h4>
                <p className="text-sm text-gray-300">
                  Draft ID: <code className="bg-black/50 px-2 py-1 rounded text-xs">{draftId}</code>
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  This draft is saved in Gmail and will be sent upon approval.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={() => router.push('/squad')}
            className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-medium transition-colors"
          >
            Back to Approvals
          </button>
          <a
            href="https://mail.google.com/mail/u/0/#drafts"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-6 py-3 bg-lime-400 hover:bg-lime-500 text-black font-bold rounded-xl text-center transition-colors"
          >
            View in Gmail →
          </a>
        </div>

        {/* DRY RUN Notice */}
        {process.env.NEXT_PUBLIC_AGENT_DRY_RUN === 'true' && (
          <div className="mt-6 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="text-yellow-400 text-2xl">⚠️</div>
              <div>
                <h4 className="font-semibold text-yellow-400 mb-1">DRY RUN MODE ACTIVE</h4>
                <p className="text-sm text-gray-300">
                  Emails will NOT actually be sent when you approve. Only logs will be created for testing.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
