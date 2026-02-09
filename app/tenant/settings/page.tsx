'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Key, Copy, Check } from 'lucide-react'

export default function TenantSettingsPage() {
  const searchParams = useSearchParams()
  const tenantSlug = searchParams.get('tenant')
  const [apiKeys, setApiKeys] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  useEffect(() => {
    if (tenantSlug) {
      fetchApiKeys()
    }
  }, [tenantSlug])

  const fetchApiKeys = async () => {
    try {
      const response = await fetch(`/api/tenant/api-keys?tenant=${tenantSlug}`)
      const data = await response.json()
      setApiKeys(data.apiKeys || [])
    } catch (error) {
      console.error('Error fetching API keys:', error)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(keyId)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">Manage your tenant configuration and API access</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">API Keys</h2>
          
          <p className="text-gray-600 mb-6">
            Use API keys to integrate your applications with Mission Control. Keep your keys secure and never share them publicly.
          </p>

          {loading ? (
            <div className="text-center py-8">Loading API keys...</div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8">
              <Key size={64} className="mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">No API keys found</p>
              <p className="text-sm text-gray-400 mt-2">Contact support to generate an API key</p>
            </div>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((key) => (
                <div key={key.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-gray-900">{key.key_name}</h3>
                      <p className="text-sm text-gray-600">Created {new Date(key.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      key.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {key.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg">
                    <code className="flex-1 text-sm font-mono text-gray-700">
                      {key.key_prefix}...
                    </code>
                    <button
                      onClick={() => copyToClipboard(key.key_prefix, key.id)}
                      className="p-2 hover:bg-gray-200 rounded transition-colors"
                    >
                      {copiedKey === key.id ? (
                        <Check size={16} className="text-green-600" />
                      ) : (
                        <Copy size={16} className="text-gray-600" />
                      )}
                    </button>
                  </div>

                  <div className="mt-3 text-xs text-gray-500">
                    <p>Usage: {key.usage_count} calls</p>
                    {key.last_used_at && (
                      <p>Last used: {new Date(key.last_used_at).toLocaleString()}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
