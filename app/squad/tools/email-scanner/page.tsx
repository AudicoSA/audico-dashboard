'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail,
  Calendar,
  Filter,
  Play,
  Pause,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Users,
  Package,
  Activity,
  RefreshCw,
  Search,
  XCircle,
  BarChart3,
  FileText,
  DollarSign,
  Eye
} from 'lucide-react'

interface ScanConfig {
  start_date: string
  end_date: string
  email_account: string
  scope: 'all' | 'sent' | 'received' | 'threads'
  sender_domain?: string
}

interface ScanProgress {
  job_id: string
  status: 'running' | 'paused' | 'completed' | 'error'
  total_emails: number
  processed_count: number
  suppliers_found: number
  products_found: number
  contacts_found: number
  interactions_logged: number
  percentage: number
  start_date: string
  end_date: string
  error_message?: string
  last_updated?: string
}

interface SampleEmail {
  id: string
  from: string
  subject: string
  date: string
  preview: string
}

interface SupplierDiscovery {
  id: string
  company: string
  email: string
  products_count: number
  last_contact: string
}

interface ErrorLog {
  id: string
  email_id: string
  error: string
  timestamp: string
  retried: boolean
}

export default function EmailScannerPage() {
  const [config, setConfig] = useState<ScanConfig>({
    start_date: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    email_account: 'support@audicoonline.co.za',
    scope: 'all',
    sender_domain: ''
  })

  const [showPreview, setShowPreview] = useState(false)
  const [sampleEmails, setSampleEmails] = useState<SampleEmail[]>([])
  const [estimatedCount, setEstimatedCount] = useState(0)
  const [estimatedCost, setEstimatedCost] = useState(0)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)

  const [currentJob, setCurrentJob] = useState<ScanProgress | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [suppliers, setSuppliers] = useState<SupplierDiscovery[]>([])
  const [errors, setErrors] = useState<ErrorLog[]>([])

  const [processingRate, setProcessingRate] = useState(0)
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(0)
  const previousProcessedRef = useRef(0)
  const previousTimeRef = useRef(Date.now())

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (currentJob && currentJob.status === 'running') {
      const timeDiff = (Date.now() - previousTimeRef.current) / 1000
      const processedDiff = currentJob.processed_count - previousProcessedRef.current

      if (timeDiff > 0 && processedDiff > 0) {
        const rate = processedDiff / timeDiff
        setProcessingRate(rate)

        const remaining = currentJob.total_emails - currentJob.processed_count
        const secondsRemaining = remaining / rate
        setEstimatedTimeRemaining(secondsRemaining)
      }

      previousProcessedRef.current = currentJob.processed_count
      previousTimeRef.current = Date.now()
    }
  }, [currentJob])

  const handlePreview = async () => {
    setIsLoadingPreview(true)
    try {
      const params = new URLSearchParams({
        start_date: new Date(config.start_date).toISOString(),
        end_date: new Date(config.end_date).toISOString(),
        scope: config.scope,
        ...(config.sender_domain && { sender_domain: config.sender_domain })
      })

      const response = await fetch(`/api/email-scanner/preview?${params}`)
      const data = await response.json()

      if (data.success) {
        setSampleEmails(data.sample_emails)
        setEstimatedCount(data.estimated_count)
        setEstimatedCost(data.estimated_cost)
        setShowPreview(true)
      }
    } catch (error) {
      console.error('Failed to load preview:', error)
    } finally {
      setIsLoadingPreview(false)
    }
  }

  const handleStartScan = async () => {
    try {
      const response = await fetch('/api/email-scanner/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: new Date(config.start_date).toISOString(),
          end_date: new Date(config.end_date).toISOString(),
          scope: config.scope,
          sender_domain: config.sender_domain || null
        })
      })

      const data = await response.json()

      if (data.success) {
        setCurrentJob(data.progress)
        setIsScanning(true)
        startPolling(data.job_id)
      }
    } catch (error) {
      console.error('Failed to start scan:', error)
    }
  }

  const handlePauseScan = async () => {
    if (!currentJob) return

    try {
      const response = await fetch('/api/email-scanner/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: currentJob.job_id })
      })

      const data = await response.json()

      if (data.success) {
        setIsScanning(false)
        stopPolling()
      }
    } catch (error) {
      console.error('Failed to pause scan:', error)
    }
  }

  const handleResumeScan = async () => {
    if (!currentJob) return

    try {
      const response = await fetch('/api/email-scanner/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: currentJob.job_id })
      })

      const data = await response.json()

      if (data.success) {
        setIsScanning(true)
        startPolling(currentJob.job_id)
      }
    } catch (error) {
      console.error('Failed to resume scan:', error)
    }
  }

  const handleRetryError = async (errorId: string) => {
    try {
      const response = await fetch('/api/email-scanner/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error_id: errorId })
      })

      if (response.ok) {
        setErrors(prev => prev.map(e => e.id === errorId ? { ...e, retried: true } : e))
      }
    } catch (error) {
      console.error('Failed to retry error:', error)
    }
  }

  const handleExport = async (format: 'csv' | 'json') => {
    if (!currentJob) return

    try {
      const response = await fetch(`/api/email-scanner/export?job_id=${currentJob.job_id}&format=${format}`)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `email-scan-${currentJob.job_id}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Failed to export:', error)
    }
  }

  const startPolling = (jobId: string) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/email-scanner/progress/${jobId}`)
        const data = await response.json()

        if (data.success) {
          setCurrentJob(data.progress)

          const suppliersResponse = await fetch(`/api/email-scanner/suppliers?job_id=${jobId}`)
          const suppliersData = await suppliersResponse.json()
          if (suppliersData.success) {
            setSuppliers(suppliersData.suppliers)
          }

          const errorsResponse = await fetch(`/api/email-scanner/errors?job_id=${jobId}`)
          const errorsData = await errorsResponse.json()
          if (errorsData.success) {
            setErrors(errorsData.errors)
          }

          if (data.progress.status === 'completed' || data.progress.status === 'error') {
            stopPolling()
            setIsScanning(false)
          }
        }
      } catch (error) {
        console.error('Failed to poll progress:', error)
      }
    }, 2000)
  }

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
  }

  const formatTimeRemaining = (seconds: number): string => {
    if (seconds <= 0 || !isFinite(seconds)) return 'Calculating...'
    
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)

    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s remaining`
    } else {
      return `${secs}s remaining`
    }
  }

  const formatProcessingRate = (rate: number): string => {
    if (rate <= 0 || !isFinite(rate)) return '0 emails/s'
    return `${rate.toFixed(2)} emails/s`
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Mail className="text-lime-400" />
              Historical Email Bulk Scanner
            </h1>
            <p className="text-gray-400 mt-2">Scan historical emails to discover suppliers, products, and pricing data</p>
          </div>
        </motion.div>

        {!currentJob && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6"
          >
            <h2 className="text-xl font-bold mb-6">Scan Configuration</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  <Calendar className="inline mr-2" size={16} />
                  Start Date
                </label>
                <input
                  type="date"
                  value={config.start_date}
                  onChange={(e) => setConfig({ ...config, start_date: e.target.value })}
                  className="w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-lime-500/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  <Calendar className="inline mr-2" size={16} />
                  End Date
                </label>
                <input
                  type="date"
                  value={config.end_date}
                  onChange={(e) => setConfig({ ...config, end_date: e.target.value })}
                  className="w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-lime-500/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  <Mail className="inline mr-2" size={16} />
                  Email Account
                </label>
                <select
                  value={config.email_account}
                  onChange={(e) => setConfig({ ...config, email_account: e.target.value })}
                  className="w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-lime-500/50"
                >
                  <option value="support@audicoonline.co.za">support@audicoonline.co.za</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  <Filter className="inline mr-2" size={16} />
                  Scan Scope
                </label>
                <select
                  value={config.scope}
                  onChange={(e) => setConfig({ ...config, scope: e.target.value as any })}
                  className="w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-lime-500/50"
                >
                  <option value="all">All Emails</option>
                  <option value="sent">Only Sent Items</option>
                  <option value="received">Only Received</option>
                  <option value="threads">Threads Only</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  <Search className="inline mr-2" size={16} />
                  Filter by Sender Domain (optional)
                </label>
                <input
                  type="text"
                  value={config.sender_domain}
                  onChange={(e) => setConfig({ ...config, sender_domain: e.target.value })}
                  placeholder="e.g., @planetworld.co.za"
                  className="w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-lime-500/50"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handlePreview}
                disabled={isLoadingPreview}
                className="px-6 py-3 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 font-bold rounded-xl transition-all flex items-center gap-2 border border-purple-500/30 disabled:opacity-50"
              >
                <Eye size={18} />
                {isLoadingPreview ? 'Loading Preview...' : 'Preview Emails'}
              </button>

              <button
                onClick={handleStartScan}
                className="px-6 py-3 bg-lime-400 hover:bg-lime-500 text-black font-bold rounded-xl transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(163,230,53,0.3)]"
              >
                <Play size={18} />
                Start Scan
              </button>
            </div>
          </motion.div>
        )}

        {showPreview && !currentJob && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Scan Preview</h2>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <XCircle size={20} className="text-gray-400" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-[#252525] border border-white/5 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Mail size={16} className="text-blue-400" />
                  <p className="text-xs text-gray-400">Estimated Emails</p>
                </div>
                <p className="text-2xl font-bold text-blue-400">{estimatedCount.toLocaleString()}</p>
              </div>

              <div className="bg-[#252525] border border-white/5 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign size={16} className="text-lime-400" />
                  <p className="text-xs text-gray-400">Estimated Cost</p>
                </div>
                <p className="text-2xl font-bold text-lime-400">${estimatedCost.toFixed(2)}</p>
              </div>

              <div className="bg-[#252525] border border-white/5 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={16} className="text-orange-400" />
                  <p className="text-xs text-gray-400">Estimated Time</p>
                </div>
                <p className="text-2xl font-bold text-orange-400">{Math.ceil(estimatedCount / 5)} min</p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3">Sample Emails</h3>
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                {sampleEmails.map((email) => (
                  <div key={email.id} className="bg-[#252525] border border-white/5 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{email.subject}</p>
                        <p className="text-xs text-gray-400 mt-1">{email.from}</p>
                      </div>
                      <span className="text-xs text-gray-500">{new Date(email.date).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2">{email.preview}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {currentJob && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Activity className={currentJob.status === 'running' ? 'text-lime-400 animate-pulse' : 'text-gray-400'} />
                  Scan Progress
                </h2>
                <div className="flex gap-2">
                  {currentJob.status === 'running' && (
                    <button
                      onClick={handlePauseScan}
                      className="px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 font-bold rounded-xl transition-all flex items-center gap-2 border border-orange-500/30"
                    >
                      <Pause size={16} />
                      Pause
                    </button>
                  )}
                  {currentJob.status === 'paused' && (
                    <button
                      onClick={handleResumeScan}
                      className="px-4 py-2 bg-lime-400 hover:bg-lime-500 text-black font-bold rounded-xl transition-all flex items-center gap-2"
                    >
                      <Play size={16} />
                      Resume
                    </button>
                  )}
                  <button
                    onClick={() => handleExport('csv')}
                    className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-bold rounded-xl transition-all flex items-center gap-2 border border-blue-500/30"
                  >
                    <Download size={16} />
                    CSV
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 font-bold rounded-xl transition-all flex items-center gap-2 border border-purple-500/30"
                  >
                    <Download size={16} />
                    JSON
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">
                      {currentJob.processed_count.toLocaleString()} / {currentJob.total_emails.toLocaleString()} emails processed
                    </span>
                    <span className="text-sm font-bold text-lime-400">{currentJob.percentage}%</span>
                  </div>
                  <div className="h-3 bg-[#252525] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${currentJob.percentage}%` }}
                      transition={{ duration: 0.5 }}
                      className="h-full bg-gradient-to-r from-lime-400 to-green-500"
                    />
                  </div>
                </div>

                {currentJob.status === 'running' && (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Activity size={16} className="text-blue-400" />
                      <span className="text-gray-400">Processing Rate:</span>
                      <span className="font-bold text-blue-400">{formatProcessingRate(processingRate)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-orange-400" />
                      <span className="text-gray-400">Est. Time Remaining:</span>
                      <span className="font-bold text-orange-400">{formatTimeRemaining(estimatedTimeRemaining)}</span>
                    </div>
                  </div>
                )}

                {currentJob.status === 'error' && currentJob.error_message && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2">
                    <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-red-400 font-medium">Scan Error</p>
                      <p className="text-xs text-gray-400 mt-1">{currentJob.error_message}</p>
                    </div>
                  </div>
                )}

                {currentJob.status === 'completed' && (
                  <div className="bg-lime-500/10 border border-lime-500/20 rounded-lg p-3 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-lime-400" />
                    <p className="text-sm text-lime-400 font-medium">Scan completed successfully!</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <StatCard
                  label="Suppliers Discovered"
                  value={currentJob.suppliers_found}
                  icon={Users}
                  color="text-purple-400"
                />
                <StatCard
                  label="Products Found"
                  value={currentJob.products_found}
                  icon={Package}
                  color="text-blue-400"
                />
                <StatCard
                  label="Contacts Found"
                  value={currentJob.contacts_found}
                  icon={Mail}
                  color="text-orange-400"
                />
                <StatCard
                  label="Interactions Logged"
                  value={currentJob.interactions_logged}
                  icon={TrendingUp}
                  color="text-lime-400"
                />
              </div>
            </motion.div>

            {suppliers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6"
              >
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Users className="text-purple-400" />
                  Suppliers Discovered ({suppliers.length})
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="text-left text-xs font-medium text-gray-400 pb-3">Company</th>
                        <th className="text-left text-xs font-medium text-gray-400 pb-3">Email</th>
                        <th className="text-left text-xs font-medium text-gray-400 pb-3">Products</th>
                        <th className="text-left text-xs font-medium text-gray-400 pb-3">Last Contact</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suppliers.map((supplier) => (
                        <tr key={supplier.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-3 text-sm text-white font-medium">{supplier.company}</td>
                          <td className="py-3 text-sm text-gray-400">{supplier.email}</td>
                          <td className="py-3 text-sm text-blue-400">{supplier.products_count}</td>
                          <td className="py-3 text-sm text-gray-400">{new Date(supplier.last_contact).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {errors.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6"
              >
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <AlertTriangle className="text-red-400" />
                  Errors Encountered ({errors.length})
                </h2>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  {errors.map((error) => (
                    <div key={error.id} className="bg-[#252525] border border-red-500/20 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-400 mb-1">Email ID: {error.email_id}</p>
                          <p className="text-sm text-red-400">{error.error}</p>
                          <p className="text-xs text-gray-500 mt-1">{new Date(error.timestamp).toLocaleString()}</p>
                        </div>
                        {!error.retried && (
                          <button
                            onClick={() => handleRetryError(error.id)}
                            className="px-3 py-1 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 text-xs rounded-lg transition-colors flex items-center gap-1 border border-orange-500/30"
                          >
                            <RefreshCw size={12} />
                            Retry
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color }: { label: string, value: number, icon: any, color: string }) {
  return (
    <div className="bg-[#252525] border border-white/5 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className={color} />
        <p className="text-xs text-gray-400">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</p>
    </div>
  )
}
