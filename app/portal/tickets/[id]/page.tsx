'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Send, Paperclip, Upload } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

export default function TicketDetailPage() {
  const params = useParams()
  const ticketId = params.id as string
  
  const [ticket, setTicket] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (ticketId) {
      fetchTicketDetails()
    }
  }, [ticketId])

  const fetchTicketDetails = async () => {
    try {
      // TODO: Get actual user ID from auth context
      const userId = 'placeholder-user-id'
      
      // Fetch ticket details
      const ticketResponse = await fetch(`/api/portal/tickets?userId=${userId}`)
      const ticketData = await ticketResponse.json()
      const foundTicket = ticketData.tickets?.find((t: any) => t.id === ticketId)
      setTicket(foundTicket)

      // Fetch messages
      const messagesResponse = await fetch(`/api/portal/tickets/${ticketId}/messages`)
      const messagesData = await messagesResponse.json()
      setMessages(messagesData.messages || [])
    } catch (error) {
      console.error('Error fetching ticket details:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending) return

    setSending(true)
    try {
      // TODO: Get actual user ID from auth context
      const userId = 'placeholder-user-id'

      const response = await fetch(`/api/portal/tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portal_user_id: userId,
          message: newMessage,
        }),
      })

      if (response.ok) {
        setNewMessage('')
        fetchTicketDetails()
      }
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setSending(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      // TODO: Get actual user ID from auth context
      const userId = 'placeholder-user-id'

      const formData = new FormData()
      formData.append('file', file)
      formData.append('ticket_id', ticketId)
      formData.append('portal_user_id', userId)

      const response = await fetch('/api/portal/uploads', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        alert('File uploaded successfully!')
        fetchTicketDetails()
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      alert('Failed to upload file')
    } finally {
      setUploading(false)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      open: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      waiting_customer: 'bg-orange-100 text-orange-800',
      waiting_internal: 'bg-purple-100 text-purple-800',
      resolved: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="text-center py-12">Loading ticket details...</div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="text-center py-12">Ticket not found</div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      <Link
        href="/portal/tickets"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft size={20} />
        Back to Tickets
      </Link>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{ticket.subject}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>#{ticket.ticket_number}</span>
                <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                <span className="capitalize">{ticket.priority} Priority</span>
              </div>
            </div>
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(ticket.status)}`}>
              {ticket.status.replace('_', ' ')}
            </span>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-gray-700">{ticket.description}</p>
          </div>

          {ticket.ai_generated_status && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-medium text-blue-900 mb-1">AI Status Update</p>
              <p className="text-sm text-blue-800">{ticket.ai_generated_status}</p>
              <p className="text-xs text-blue-600 mt-1">
                Generated {new Date(ticket.ai_generated_at).toLocaleString()}
              </p>
            </div>
          )}
        </div>

        <div className="p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Conversation</h2>
          
          <div className="space-y-4 mb-6">
            {messages.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No messages yet</p>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.sender_type === 'customer' ? 'flex-row-reverse' : ''}`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      msg.sender_type === 'customer'
                        ? 'bg-lime-500 text-black'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {msg.sender_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 max-w-2xl">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{msg.sender_name}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(msg.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div
                      className={`p-4 rounded-lg ${
                        msg.sender_type === 'customer'
                          ? 'bg-lime-100 text-gray-900'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.message}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {ticket.status !== 'closed' && ticket.status !== 'resolved' && (
            <div className="border-t border-gray-200 pt-6">
              <div className="flex gap-3 mb-3">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  rows={3}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500 resize-none"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sending}
                  className="flex items-center gap-2 bg-lime-500 text-black px-6 py-2 rounded-lg font-semibold hover:bg-lime-400 transition-colors disabled:opacity-50"
                >
                  <Send size={18} />
                  {sending ? 'Sending...' : 'Send Message'}
                </button>
                
                <label className="flex items-center gap-2 px-6 py-2 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors cursor-pointer">
                  <Paperclip size={18} />
                  {uploading ? 'Uploading...' : 'Attach File'}
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  />
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Maximum file size: 10MB. Accepted: Images, PDF, Word, Excel, Text
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
