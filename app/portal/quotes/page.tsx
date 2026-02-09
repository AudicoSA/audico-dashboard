'use client'

import { useEffect, useState } from 'react'
import { FileText, Search, Download } from 'lucide-react'

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchQuotes()
  }, [])

  const fetchQuotes = async () => {
    try {
      // TODO: Get actual user ID from auth context
      const userId = 'placeholder-user-id'
      const response = await fetch(`/api/portal/quotes?userId=${userId}`)
      const data = await response.json()
      setQuotes(data.quotes || [])
    } catch (error) {
      console.error('Error fetching quotes:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      sent: 'bg-purple-100 text-purple-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Quote Requests</h1>
        <p className="text-gray-600">Track your quote requests and view proposals</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search quotes..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500"
            />
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading quotes...</div>
          ) : quotes.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <FileText size={48} className="mx-auto mb-4 text-gray-300" />
              <p>No quote requests found</p>
            </div>
          ) : (
            quotes.map((quote) => (
              <div key={quote.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {quote.quote_number || `Quote Request`}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(quote.status)}`}>
                        {quote.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mb-2">
                      Requested on {new Date(quote.created_at).toLocaleDateString()}
                    </p>
                    {quote.company_name && (
                      <p className="text-sm text-gray-600">Company: {quote.company_name}</p>
                    )}
                  </div>
                  {quote.quote_amount && (
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">
                        ZAR {quote.quote_amount.toFixed(2)}
                      </p>
                      {quote.valid_until && (
                        <p className="text-xs text-gray-500">
                          Valid until {new Date(quote.valid_until).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {quote.items && quote.items.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Requested Items:</p>
                    <div className="space-y-1">
                      {quote.items.map((item: any, idx: number) => (
                        <div key={idx} className="text-sm text-gray-600">
                          • {item.description || item.name} {item.quantity && `(Qty: ${item.quantity})`}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {quote.notes && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">{quote.notes}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  {quote.quote_pdf_url && (
                    <button className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                      <Download size={16} />
                      Download Quote
                    </button>
                  )}
                  {quote.status === 'sent' && (
                    <>
                      <button className="px-4 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
                        Accept Quote
                      </button>
                      <button className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                        Request Changes
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
