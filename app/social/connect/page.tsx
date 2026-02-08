'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react'

function ConnectContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [availableAccounts, setAvailableAccounts] = useState<any[]>([])

  useEffect(() => {
    const error = searchParams.get('error')
    const platform = searchParams.get('platform')
    const data = searchParams.get('data')

    if (error) {
      setStatus('error')
      setMessage(error)
      return
    }

    if (platform && data) {
      try {
        const accountsData = JSON.parse(decodeURIComponent(data))
        
        if (platform === 'facebook') {
          if (accountsData.pages && accountsData.pages.length > 0) {
            setAvailableAccounts(accountsData.pages)
            setMessage('Select a Facebook page to connect')
          } else {
            setStatus('error')
            setMessage('No Facebook pages found. Please create a Facebook page first.')
          }
        } else if (platform === 'instagram') {
          if (accountsData.accounts && accountsData.accounts.length > 0) {
            setAvailableAccounts(accountsData.accounts)
            setMessage('Select an Instagram account to connect')
          } else {
            setStatus('error')
            setMessage('No Instagram Business accounts found. Please connect your Instagram account to a Facebook page first.')
          }
        } else if (platform === 'twitter') {
          saveAccount(platform, accountsData)
        }
      } catch (err) {
        setStatus('error')
        setMessage('Failed to process authentication data')
      }
    } else {
      setStatus('error')
      setMessage('Invalid callback parameters')
    }
  }, [searchParams])

  const saveAccount = async (platform: string, accountData: any) => {
    try {
      let payload: any = {}

      if (platform === 'facebook') {
        payload = {
          platform: 'facebook',
          account_id: accountData.id,
          account_name: accountData.name,
          access_token: accountData.access_token,
          metadata: {
            page_id: accountData.id,
          },
        }
      } else if (platform === 'instagram') {
        payload = {
          platform: 'instagram',
          account_id: accountData.id,
          account_name: accountData.username,
          access_token: accountData.access_token,
          metadata: {
            instagram_account_id: accountData.id,
            page_id: accountData.page_id,
            page_name: accountData.page_name,
          },
        }
      } else if (platform === 'twitter') {
        payload = {
          platform: 'twitter',
          account_id: accountData.user_id,
          account_name: `@${accountData.screen_name}`,
          access_token: accountData.access_token,
          metadata: {
            access_token_secret: accountData.access_token_secret,
            screen_name: accountData.screen_name,
          },
        }
      }

      const response = await fetch('/api/social/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error('Failed to save account')
      }

      setStatus('success')
      setMessage(`Successfully connected ${platform} account!`)

      setTimeout(() => {
        router.push('/social')
      }, 2000)
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Failed to save account')
    }
  }

  const handleAccountSelect = async () => {
    if (!selectedAccount) return

    const platform = searchParams.get('platform')
    const account = availableAccounts.find((acc) => 
      platform === 'facebook' ? acc.id === selectedAccount : acc.id === selectedAccount
    )

    if (account) {
      await saveAccount(platform!, account)
    }
  }

  if (status === 'loading' && availableAccounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <RefreshCw className="animate-spin text-lime-400" size={48} />
        <p className="text-gray-400">Processing authentication...</p>
      </div>
    )
  }

  if (availableAccounts.length > 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-[#1c1c1c] border border-white/5 rounded-xl p-8">
          <h1 className="text-2xl font-bold text-white mb-2">Select Account</h1>
          <p className="text-gray-400 mb-6">{message}</p>

          <div className="space-y-3 mb-6">
            {availableAccounts.map((account) => (
              <label
                key={account.id}
                className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-all ${
                  selectedAccount === account.id
                    ? 'bg-lime-500/10 border-lime-500/50'
                    : 'bg-white/5 border-white/5 hover:border-white/10'
                }`}
              >
                <input
                  type="radio"
                  name="account"
                  value={account.id}
                  checked={selectedAccount === account.id}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="w-4 h-4 text-lime-500"
                />
                <div>
                  <p className="text-white font-medium">
                    {account.name || account.username}
                  </p>
                  <p className="text-sm text-gray-400">ID: {account.id}</p>
                </div>
              </label>
            ))}
          </div>

          <button
            onClick={handleAccountSelect}
            disabled={!selectedAccount}
            className="w-full px-6 py-3 bg-lime-500 text-black font-semibold rounded-lg hover:bg-lime-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Connect Account
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className={`bg-[#1c1c1c] border ${status === 'success' ? 'border-lime-500/20' : 'border-red-500/20'} rounded-xl p-8`}>
        <div className="flex items-center gap-4 mb-4">
          {status === 'success' ? (
            <CheckCircle className="text-lime-400" size={48} />
          ) : (
            <XCircle className="text-red-400" size={48} />
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">
              {status === 'success' ? 'Success!' : 'Error'}
            </h1>
            <p className={status === 'success' ? 'text-lime-400' : 'text-red-400'}>
              {message}
            </p>
          </div>
        </div>

        {status === 'success' ? (
          <p className="text-gray-400 mt-4">Redirecting to social accounts page...</p>
        ) : (
          <button
            onClick={() => router.push('/social')}
            className="mt-6 px-6 py-3 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            Back to Social Accounts
          </button>
        )}
      </div>
    </div>
  )
}

export default function ConnectPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="animate-spin text-lime-400" size={32} />
      </div>
    }>
      <ConnectContent />
    </Suspense>
  )
}
