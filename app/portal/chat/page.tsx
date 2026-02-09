'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, Bot, User, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function ChatPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<any[]>([
    {
      sender_type: 'bot',
      message: 'Hello! I\'m your AI assistant. How can I help you today?',
      created_at: new Date().toISOString(),
    },
  ])
  const [inputMessage, setInputMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSend = async () => {
    if (!inputMessage.trim() || sending) return

    const userMessage = {
      sender_type: 'customer',
      message: inputMessage,
      created_at: new Date().toISOString(),
    }

    setMessages([...messages, userMessage])
    setInputMessage('')
    setSending(true)

    try {
      // TODO: Get actual user ID from auth context
      const userId = 'placeholder-user-id'

      const response = await fetch('/api/portal/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          portal_user_id: userId,
          message: inputMessage,
        }),
      })

      const data = await response.json()

      if (data.session_id) {
        setSessionId(data.session_id)
      }

      if (data.message) {
        setMessages((prev) => [
          ...prev,
          {
            sender_type: 'bot',
            message: data.message.message,
            sources: data.sources,
            created_at: new Date().toISOString(),
          },
        ])
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setMessages((prev) => [
        ...prev,
        {
          sender_type: 'bot',
          message: 'Sorry, I encountered an error. Please try again.',
          created_at: new Date().toISOString(),
        },
      ])
    } finally {
      setSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full h-[600px] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-lime-500 flex items-center justify-center">
              <Bot size={24} className="text-black" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">AI Assistant</h2>
              <p className="text-xs text-gray-500">Always here to help</p>
            </div>
          </div>
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.sender_type === 'customer' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.sender_type === 'customer'
                    ? 'bg-lime-500 text-black'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {msg.sender_type === 'customer' ? <User size={18} /> : <Bot size={18} />}
              </div>
              <div
                className={`max-w-[70%] rounded-lg p-4 ${
                  msg.sender_type === 'customer'
                    ? 'bg-lime-500 text-black'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.message}</p>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-300">
                    <p className="text-xs opacity-75 mb-1">Sources:</p>
                    <ul className="text-xs opacity-75 list-disc list-inside">
                      {msg.sources.map((source: string, i: number) => (
                        <li key={i}>{source}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                <Bot size={18} className="text-gray-600" />
              </div>
              <div className="bg-gray-100 rounded-lg p-4">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-gray-200">
          <div className="flex gap-3">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              rows={2}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500 resize-none"
            />
            <button
              onClick={handleSend}
              disabled={!inputMessage.trim() || sending}
              className="px-6 py-2 bg-lime-500 text-black rounded-lg font-semibold hover:bg-lime-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={20} />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  )
}
