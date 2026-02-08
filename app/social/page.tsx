'use client'

import { useState, useEffect } from 'react'
import { Facebook, Instagram, Twitter, Plus, Trash2, CheckCircle, XCircle, RefreshCw } from 'lucide-react'

interface SocialAccount {
  id: string
  platform: 'facebook' | 'instagram' | 'twitter'
  account_id: string
  account_name: string
  access_token: string
  refresh_token?: string
  token_expires_at?: string
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

export default function SocialPage() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAccounts()
  }, [])

  const fetchAccounts = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/social/accounts')
      if (!response.ok) throw new Error('Failed to fetch accounts')
      const data = await response.json()
      setAccounts(data.accounts || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts')
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = (platform: string) => {
    window.location.href = `/api/social/oauth/${platform}`
  }

  const handleDisconnect = async (id: string) => {
    if (!confirm('Are you sure you want to disconnect this account?')) return

    try {
      const response = await fetch(`/api/social/accounts?id=${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to disconnect account')
      await fetchAccounts()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to disconnect account')
    }
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'facebook':
        return <Facebook size={20} />
      case 'instagram':
        return <Instagram size={20} />
      case 'twitter':
        return <Twitter size={20} />
      default:
        return null
    }
  }

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'facebook':
        return 'from-blue-500 to-blue-600'
      case 'instagram':
        return 'from-pink-500 to-purple-600'
      case 'twitter':
        return 'from-sky-400 to-blue-500'
      default:
        return 'from-gray-500 to-gray-600'
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
          <h1 className="text-3xl font-bold text-white">Social Media Accounts</h1>
          <p className="text-gray-400 mt-2">Connect and manage your social media accounts for automated posting</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
          <XCircle className="text-red-400" size={20} />
          <p className="text-red-400">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {['facebook', 'instagram', 'twitter'].map((platform) => {
          const connectedAccount = accounts.find((acc) => acc.platform === platform)
          const isConnected = !!connectedAccount

          return (
            <div
              key={platform}
              className="bg-[#1c1c1c] border border-white/5 rounded-xl p-6 hover:border-white/10 transition-all"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getPlatformColor(platform)} flex items-center justify-center text-white`}>
                  {getPlatformIcon(platform)}
                </div>
                {isConnected && (
                  <CheckCircle className="text-lime-400" size={20} />
                )}
              </div>

              <h3 className="text-xl font-semibold text-white capitalize mb-2">
                {platform}
              </h3>

              {isConnected ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-400">
                    Connected as <span className="text-white font-medium">{connectedAccount.account_name}</span>
                  </p>
                  <button
                    onClick={() => handleDisconnect(connectedAccount.id)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 size={16} />
                    Disconnect
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-400">
                    Not connected
                  </p>
                  <button
                    onClick={() => handleConnect(platform)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-lime-500/10 border border-lime-500/20 rounded-lg text-lime-400 hover:bg-lime-500/20 transition-colors"
                  >
                    <Plus size={16} />
                    Connect
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {accounts.length > 0 && (
        <div className="bg-[#1c1c1c] border border-white/5 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Connected Accounts</h2>
          <div className="space-y-3">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/5"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getPlatformColor(account.platform)} flex items-center justify-center text-white`}>
                    {getPlatformIcon(account.platform)}
                  </div>
                  <div>
                    <p className="text-white font-medium">{account.account_name}</p>
                    <p className="text-sm text-gray-400 capitalize">{account.platform}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleDisconnect(account.id)}
                  className="p-2 hover:bg-red-500/10 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
