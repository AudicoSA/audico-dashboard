'use client'

import { useEffect, useState } from 'react'
import { Phone, Plus, Calendar, Clock, FileText } from 'lucide-react'

export default function CallsPage() {
  const [calls, setCalls] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showScheduleModal, setShowScheduleModal] = useState(false)

  useEffect(() => {
    fetchCalls()
  }, [])

  const fetchCalls = async () => {
    try {
      // TODO: Get actual user ID from auth context
      const userId = 'placeholder-user-id'
      const response = await fetch(`/api/portal/calls?userId=${userId}`)
      const data = await response.json()
      setCalls(data.calls || [])
    } catch (error) {
      console.error('Error fetching calls:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      scheduled: 'bg-blue-100 text-blue-800',
      confirmed: 'bg-green-100 text-green-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
      no_show: 'bg-orange-100 text-orange-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Scheduled Calls</h1>
          <p className="text-gray-600">Manage your scheduled calls and view transcripts</p>
        </div>
        <button
          onClick={() => setShowScheduleModal(true)}
          className="flex items-center gap-2 bg-lime-500 text-black px-6 py-3 rounded-lg font-semibold hover:bg-lime-400 transition-colors"
        >
          <Plus size={20} />
          Schedule Call
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-200">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading calls...</div>
        ) : calls.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Phone size={48} className="mx-auto mb-4 text-gray-300" />
            <p>No scheduled calls</p>
          </div>
        ) : (
          calls.map((call) => (
            <div key={call.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {call.purpose || 'General Discussion'}
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(call.status)}`}>
                      {call.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} />
                      {new Date(call.scheduled_for).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={16} />
                      {new Date(call.scheduled_for).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone size={16} />
                      {call.duration_minutes} minutes
                    </div>
                  </div>
                </div>
              </div>

              {call.notes && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">{call.notes}</p>
                </div>
              )}

              {call.assigned_agent && (
                <p className="text-sm text-gray-500 mb-4">
                  Assigned to: <span className="font-medium">{call.assigned_agent}</span>
                </p>
              )}

              {call.call_transcripts && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-blue-900 flex items-center gap-2">
                      <FileText size={16} />
                      Call Transcript Available
                    </h4>
                    <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                      View Transcript
                    </button>
                  </div>
                  {call.call_transcripts.summary && (
                    <p className="text-sm text-blue-800 mt-2">
                      Summary: {call.call_transcripts.summary}
                    </p>
                  )}
                </div>
              )}

              {call.status === 'scheduled' && (
                <div className="mt-4 flex gap-3">
                  <button className="px-4 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
                    Join Call
                  </button>
                  <button className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    Reschedule
                  </button>
                  <button className="px-4 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors">
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showScheduleModal && (
        <ScheduleCallModal onClose={() => setShowScheduleModal(false)} onScheduled={fetchCalls} />
      )}
    </div>
  )
}

function ScheduleCallModal({ onClose, onScheduled }: { onClose: () => void, onScheduled: () => void }) {
  const [scheduledFor, setScheduledFor] = useState('')
  const [duration, setDuration] = useState(30)
  const [purpose, setPurpose] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      // TODO: Get actual user ID from auth context
      const userId = 'placeholder-user-id'
      
      const response = await fetch('/api/portal/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portal_user_id: userId,
          scheduled_for: scheduledFor,
          duration_minutes: duration,
          purpose,
          phone,
        }),
      })

      if (response.ok) {
        onScheduled()
        onClose()
      }
    } catch (error) {
      console.error('Error scheduling call:', error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Schedule a Call</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date & Time</label>
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Duration (minutes)</label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500"
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Purpose</label>
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-lime-500 text-black px-6 py-3 rounded-lg font-semibold hover:bg-lime-400 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Scheduling...' : 'Schedule Call'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
