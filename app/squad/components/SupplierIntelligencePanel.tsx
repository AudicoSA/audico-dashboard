'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2,
  Mail,
  Phone,
  Package,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  AlertCircle,
  Calendar,
  DollarSign,
  RefreshCw,
  Search,
  Filter,
  Play,
  Pause,
  Activity,
  Database,
  FileText,
  Clock,
  MessageSquare,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Zap
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Supplier {
  id: string
  name: string
  company: string
  email: string
  phone?: string
  specialties: string[]
  relationship_strength: number
  reliability_score: number
  last_contact_date: string
  created_at: string
  updated_at: string
  supplier_products?: Array<{ id: string }>
}

interface SupplierProduct {
  id: string
  supplier_id: string
  product_name: string
  product_category?: string
  manufacturer?: string
  model_number?: string
  last_quoted_price?: number
  last_quoted_date?: string
  typical_lead_time_days?: number
  stock_reliability: string
  created_at: string
  updated_at: string
  pricing_history?: PricingHistory[]
}

interface PricingHistory {
  date: string
  price: number
  quantity?: number
}

interface SupplierInteraction {
  id: string
  email_log_id: string
  supplier_id: string
  interaction_type: string
  products_mentioned: string[]
  pricing_data: any
  stock_info: any
  extracted_at: string
  email_log?: {
    subject: string
    from_email: string
    created_at: string
  }
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
  error_message?: string
}

const STOCK_RELIABILITY_COLORS = {
  always_in_stock: 'bg-lime-500/20 text-lime-400 border-lime-500/30',
  usually_available: 'bg-green-500/20 text-green-400 border-green-500/30',
  often_delayed: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  unreliable: 'bg-red-500/20 text-red-400 border-red-500/30'
}

const INTERACTION_ICONS = {
  quote_request: FileText,
  quote_response: DollarSign,
  stock_inquiry: Package,
  order_placement: CheckCircle,
  support: MessageSquare
}

export default function SupplierIntelligencePanel() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>([])
  const [interactions, setInteractions] = useState<SupplierInteraction[]>([])
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<SupplierProduct | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterSpecialty, setFilterSpecialty] = useState('all')
  const [filterReliability, setFilterReliability] = useState('all')
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [scanStartDate, setScanStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString().split('T')[0]
  })
  const [scanEndDate, setScanEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    fetchAllData()
    
    const suppliersChannel = supabase
      .channel('suppliers_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, handleRealtimeUpdate)
      .subscribe()

    const productsChannel = supabase
      .channel('supplier_products_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supplier_products' }, handleRealtimeProductUpdate)
      .subscribe()

    const interactionsChannel = supabase
      .channel('email_supplier_interactions_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'email_supplier_interactions' }, handleRealtimeInteractionUpdate)
      .subscribe()

    return () => {
      supabase.removeChannel(suppliersChannel)
      supabase.removeChannel(productsChannel)
      supabase.removeChannel(interactionsChannel)
    }
  }, [])

  const handleRealtimeUpdate = (payload: any) => {
    if (payload.eventType === 'INSERT') {
      setSuppliers(prev => [payload.new, ...prev])
    } else if (payload.eventType === 'UPDATE') {
      setSuppliers(prev => prev.map(s => s.id === payload.new.id ? payload.new : s))
      if (selectedSupplier?.id === payload.new.id) {
        setSelectedSupplier(payload.new)
      }
    } else if (payload.eventType === 'DELETE') {
      setSuppliers(prev => prev.filter(s => s.id !== payload.old.id))
      if (selectedSupplier?.id === payload.old.id) {
        setSelectedSupplier(null)
      }
    }
  }

  const handleRealtimeProductUpdate = (payload: any) => {
    if (payload.eventType === 'INSERT') {
      setSupplierProducts(prev => [payload.new, ...prev])
    } else if (payload.eventType === 'UPDATE') {
      setSupplierProducts(prev => prev.map(p => p.id === payload.new.id ? payload.new : p))
    } else if (payload.eventType === 'DELETE') {
      setSupplierProducts(prev => prev.filter(p => p.id !== payload.old.id))
    }
  }

  const handleRealtimeInteractionUpdate = (payload: any) => {
    setInteractions(prev => [payload.new, ...prev])
  }

  const fetchAllData = async () => {
    setIsLoading(true)
    try {
      const [suppliersRes, productsRes, interactionsRes] = await Promise.all([
        supabase
          .from('suppliers')
          .select(`
            *,
            supplier_products(id)
          `)
          .order('relationship_strength', { ascending: false })
          .limit(100),
        supabase
          .from('supplier_products')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(200),
        supabase
          .from('email_supplier_interactions')
          .select(`
            *,
            email_log:email_logs(subject, from_email, created_at)
          `)
          .order('extracted_at', { ascending: false })
          .limit(100)
      ])

      if (suppliersRes.data) {
        setSuppliers(suppliersRes.data)
      }
      if (productsRes.data) {
        setSupplierProducts(productsRes.data)
      }
      if (interactionsRes.data) {
        setInteractions(interactionsRes.data as any)
      }
    } catch (error) {
      console.error('Failed to fetch supplier data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartScan = async () => {
    try {
      setIsScanning(true)
      
      const startDateTime = new Date(scanStartDate + 'T00:00:00Z')
      const endDateTime = new Date(scanEndDate + 'T23:59:59Z')

      const response = await fetch('/api/suppliers/intelligence/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: startDateTime.toISOString(),
          end_date: endDateTime.toISOString()
        })
      })

      const result = await response.json()
      
      if (result.success) {
        setScanProgress({
          job_id: result.job_id,
          status: result.status,
          total_emails: result.progress.total_emails,
          processed_count: result.progress.processed_count,
          suppliers_found: result.progress.suppliers_found,
          products_found: result.progress.products_found,
          contacts_found: 0,
          interactions_logged: 0
        })
        
        pollScanProgress(result.job_id)
      }
    } catch (error) {
      console.error('Failed to start scan:', error)
      setIsScanning(false)
    }
  }

  const pollScanProgress = async (jobId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/suppliers/intelligence/scan/progress/${jobId}`)
        const result = await response.json()
        
        if (result.success && result.progress) {
          setScanProgress(result.progress)
          
          if (result.progress.status === 'completed' || result.progress.status === 'error') {
            clearInterval(pollInterval)
            setIsScanning(false)
            await fetchAllData()
          }
        }
      } catch (error) {
        console.error('Failed to poll scan progress:', error)
      }
    }, 2000)

    setTimeout(() => {
      clearInterval(pollInterval)
      setIsScanning(false)
    }, 300000)
  }

  const formatTimeAgo = (dateString: string) => {
    const diff = Date.now() - new Date(dateString).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  const formatCurrency = (amount: number, currency: string = 'ZAR') => {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency }).format(amount)
  }

  const getRelationshipColor = (strength: number) => {
    if (strength >= 80) return 'text-lime-400'
    if (strength >= 60) return 'text-green-400'
    if (strength >= 40) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getReliabilityBadge = (score: number) => {
    if (score >= 80) return { color: 'bg-lime-500/20 text-lime-400 border-lime-500/30', text: 'Excellent' }
    if (score >= 60) return { color: 'bg-green-500/20 text-green-400 border-green-500/30', text: 'Good' }
    if (score >= 40) return { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', text: 'Fair' }
    return { color: 'bg-red-500/20 text-red-400 border-red-500/30', text: 'Poor' }
  }

  const filteredSuppliers = suppliers.filter(supplier => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesSearch = 
        supplier.name.toLowerCase().includes(query) ||
        supplier.company.toLowerCase().includes(query) ||
        supplier.email.toLowerCase().includes(query) ||
        supplier.specialties.some(s => s.toLowerCase().includes(query))
      if (!matchesSearch) return false
    }

    if (filterSpecialty !== 'all') {
      if (!supplier.specialties.includes(filterSpecialty)) return false
    }

    if (filterReliability !== 'all') {
      const minScore = parseInt(filterReliability)
      if (supplier.reliability_score < minScore) return false
    }

    return true
  })

  const allSpecialties = Array.from(
    new Set(suppliers.flatMap(s => s.specialties))
  ).sort()

  const selectedSupplierProducts = selectedSupplier 
    ? supplierProducts.filter(p => p.supplier_id === selectedSupplier.id)
    : []

  const selectedSupplierInteractions = selectedSupplier
    ? interactions.filter(i => i.supplier_id === selectedSupplier.id)
    : []

  return (
    <div className="space-y-6">
      {/* Email Scanner Control */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6"
      >
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Zap className="text-purple-400" />
          Email Intelligence Scanner
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs text-gray-400 mb-2">Start Date</label>
            <input
              type="date"
              value={scanStartDate}
              onChange={(e) => setScanStartDate(e.target.value)}
              disabled={isScanning}
              className="w-full bg-[#252525] border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500/50 disabled:opacity-50"
            />
          </div>
          
          <div>
            <label className="block text-xs text-gray-400 mb-2">End Date</label>
            <input
              type="date"
              value={scanEndDate}
              onChange={(e) => setScanEndDate(e.target.value)}
              disabled={isScanning}
              className="w-full bg-[#252525] border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500/50 disabled:opacity-50"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleStartScan}
              disabled={isScanning}
              className="w-full px-4 py-2 bg-lime-400 hover:bg-lime-500 text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_0_15px_rgba(163,230,53,0.3)]"
            >
              {isScanning ? (
                <>
                  <Pause size={18} className="animate-pulse" />
                  Scanning...
                </>
              ) : (
                <>
                  <Play size={18} />
                  Start Scan
                </>
              )}
            </button>
          </div>
        </div>

        {scanProgress && (
          <div className="space-y-3">
            <div className="relative w-full bg-white/5 rounded-full h-3 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-lime-400 to-green-500 transition-all duration-500"
                style={{ 
                  width: scanProgress.total_emails > 0 
                    ? `${(scanProgress.processed_count / scanProgress.total_emails) * 100}%` 
                    : '0%' 
                }}
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatBox
                label="Emails Scanned"
                value={`${scanProgress.processed_count} / ${scanProgress.total_emails}`}
                icon={Mail}
                color="text-blue-400"
              />
              <StatBox
                label="Suppliers Found"
                value={scanProgress.suppliers_found}
                icon={Building2}
                color="text-lime-400"
              />
              <StatBox
                label="Products Mapped"
                value={scanProgress.products_found}
                icon={Package}
                color="text-purple-400"
              />
              <StatBox
                label="Contacts"
                value={scanProgress.contacts_found}
                icon={MessageSquare}
                color="text-green-400"
              />
              <StatBox
                label="Status"
                value={scanProgress.status}
                icon={Activity}
                color={
                  scanProgress.status === 'completed' ? 'text-lime-400' :
                  scanProgress.status === 'error' ? 'text-red-400' :
                  'text-yellow-400'
                }
              />
            </div>

            {scanProgress.error_message && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">{scanProgress.error_message}</p>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Stats Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <StatCard
          label="Total Suppliers"
          value={suppliers.length}
          icon={Building2}
          color="text-blue-400"
        />
        <StatCard
          label="Active Products"
          value={supplierProducts.length}
          icon={Package}
          color="text-purple-400"
        />
        <StatCard
          label="Recent Interactions"
          value={interactions.length}
          icon={Activity}
          color="text-lime-400"
        />
        <StatCard
          label="Avg Reliability"
          value={suppliers.length > 0 
            ? `${Math.round(suppliers.reduce((sum, s) => sum + s.reliability_score, 0) / suppliers.length)}%`
            : '0%'
          }
          icon={CheckCircle}
          color="text-green-400"
        />
      </motion.div>

      {/* Search and Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col md:flex-row gap-3"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search suppliers, products, or specialties..."
            className="w-full bg-[#1c1c1c] border border-white/5 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-lime-500/50"
          />
        </div>

        <select
          value={filterSpecialty}
          onChange={(e) => setFilterSpecialty(e.target.value)}
          className="bg-[#1c1c1c] border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-lime-500/50"
        >
          <option value="all">All Specialties</option>
          {allSpecialties.map(specialty => (
            <option key={specialty} value={specialty}>{specialty}</option>
          ))}
        </select>

        <select
          value={filterReliability}
          onChange={(e) => setFilterReliability(e.target.value)}
          className="bg-[#1c1c1c] border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-lime-500/50"
        >
          <option value="all">All Reliability</option>
          <option value="80">Excellent (80+)</option>
          <option value="60">Good (60+)</option>
          <option value="40">Fair (40+)</option>
          <option value="0">All Levels</option>
        </select>

        <button
          onClick={fetchAllData}
          disabled={isLoading}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-white transition-all flex items-center gap-2"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Supplier Directory */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6"
          >
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Database className="text-blue-400" />
              Supplier Directory ({filteredSuppliers.length})
            </h3>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="animate-spin text-lime-400" size={32} />
                </div>
              ) : filteredSuppliers.length > 0 ? (
                filteredSuppliers.map(supplier => (
                  <SupplierCard
                    key={supplier.id}
                    supplier={supplier}
                    onClick={() => setSelectedSupplier(supplier)}
                    isSelected={selectedSupplier?.id === supplier.id}
                    getRelationshipColor={getRelationshipColor}
                    getReliabilityBadge={getReliabilityBadge}
                    formatTimeAgo={formatTimeAgo}
                  />
                ))
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <Building2 className="mx-auto mb-3 opacity-50" size={48} />
                  <p className="text-sm">No suppliers found</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Product-Supplier Mapping */}
          {selectedSupplier && selectedSupplierProducts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6"
            >
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Package className="text-purple-400" />
                Products from {selectedSupplier.company} ({selectedSupplierProducts.length})
              </h3>

              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                {selectedSupplierProducts.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onClick={() => setSelectedProduct(product)}
                    isSelected={selectedProduct?.id === product.id}
                    formatCurrency={formatCurrency}
                    formatTimeAgo={formatTimeAgo}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Detail Sidebar */}
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {selectedSupplier ? (
              <SupplierDetailPanel
                key={selectedSupplier.id}
                supplier={selectedSupplier}
                products={selectedSupplierProducts}
                interactions={selectedSupplierInteractions}
                onClose={() => {
                  setSelectedSupplier(null)
                  setSelectedProduct(null)
                }}
                getRelationshipColor={getRelationshipColor}
                getReliabilityBadge={getReliabilityBadge}
                formatTimeAgo={formatTimeAgo}
                formatCurrency={formatCurrency}
              />
            ) : (
              <EmptyState
                key="no-supplier"
                icon={Building2}
                message="Select a supplier to view details"
              />
            )}
          </AnimatePresence>

          {selectedProduct && (
            <ProductDetailPanel
              product={selectedProduct}
              onClose={() => setSelectedProduct(null)}
              formatCurrency={formatCurrency}
              formatTimeAgo={formatTimeAgo}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color }: {
  label: string
  value: number | string
  icon: any
  color: string
}) {
  return (
    <div className="bg-[#1c1c1c] border border-white/5 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={16} className={color} />
        <p className="text-xs text-gray-400">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function StatBox({ label, value, icon: Icon, color }: {
  label: string
  value: number | string
  icon: any
  color: string
}) {
  return (
    <div className="bg-[#252525] rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className={color} />
        <p className="text-xs text-gray-400">{label}</p>
      </div>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  )
}

function SupplierCard({ supplier, onClick, isSelected, getRelationshipColor, getReliabilityBadge, formatTimeAgo }: {
  supplier: Supplier
  onClick: () => void
  isSelected: boolean
  getRelationshipColor: (strength: number) => string
  getReliabilityBadge: (score: number) => { color: string; text: string }
  formatTimeAgo: (date: string) => string
}) {
  const reliabilityBadge = getReliabilityBadge(supplier.reliability_score)
  const productCount = supplier.supplier_products?.length || 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={`bg-[#252525] border rounded-xl p-4 hover:border-lime-500/30 transition-all cursor-pointer ${
        isSelected ? 'border-lime-500/50' : 'border-white/5'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Building2 size={16} className="text-blue-400 shrink-0" />
            <p className="text-sm font-medium text-white truncate">{supplier.company}</p>
          </div>
          <p className="text-xs text-gray-400 truncate">{supplier.name}</p>
          <p className="text-xs text-gray-500 truncate">{supplier.email}</p>
        </div>
        
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={`text-xs px-2 py-1 rounded border ${reliabilityBadge.color}`}>
            {reliabilityBadge.text}
          </span>
          <div className="flex items-center gap-1">
            <span className={`text-xs font-medium ${getRelationshipColor(supplier.relationship_strength)}`}>
              {supplier.relationship_strength}%
            </span>
          </div>
        </div>
      </div>

      {supplier.specialties.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {supplier.specialties.slice(0, 3).map((specialty, idx) => (
            <span key={idx} className="text-[10px] px-2 py-1 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
              {specialty}
            </span>
          ))}
          {supplier.specialties.length > 3 && (
            <span className="text-[10px] px-2 py-1 rounded bg-white/5 text-gray-400">
              +{supplier.specialties.length - 3}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-white/5">
        <span className="flex items-center gap-1">
          <Package size={12} />
          {productCount} products
        </span>
        <span className="flex items-center gap-1">
          <Clock size={12} />
          {formatTimeAgo(supplier.last_contact_date)}
        </span>
      </div>
    </motion.div>
  )
}

function ProductCard({ product, onClick, isSelected, formatCurrency, formatTimeAgo }: {
  product: SupplierProduct
  onClick: () => void
  isSelected: boolean
  formatCurrency: (amount: number) => string
  formatTimeAgo: (date: string) => string
}) {
  const reliabilityColor = STOCK_RELIABILITY_COLORS[product.stock_reliability as keyof typeof STOCK_RELIABILITY_COLORS] || STOCK_RELIABILITY_COLORS.usually_available

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={`bg-[#252525] border rounded-xl p-4 hover:border-lime-500/30 transition-all cursor-pointer ${
        isSelected ? 'border-lime-500/50' : 'border-white/5'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white mb-1">{product.product_name}</p>
          {product.manufacturer && (
            <p className="text-xs text-gray-400">by {product.manufacturer}</p>
          )}
          {product.model_number && (
            <p className="text-xs text-gray-500">Model: {product.model_number}</p>
          )}
        </div>
        
        <span className={`text-xs px-2 py-1 rounded border shrink-0 ${reliabilityColor}`}>
          {product.stock_reliability.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="flex items-center justify-between text-xs pt-3 border-t border-white/5">
        {product.last_quoted_price ? (
          <span className="flex items-center gap-1 text-lime-400 font-medium">
            <DollarSign size={12} />
            {formatCurrency(product.last_quoted_price)}
          </span>
        ) : (
          <span className="text-gray-500">No pricing</span>
        )}
        
        {product.typical_lead_time_days && (
          <span className="flex items-center gap-1 text-gray-400">
            <Clock size={12} />
            {product.typical_lead_time_days} days
          </span>
        )}
        
        {product.last_quoted_date && (
          <span className="text-gray-500">{formatTimeAgo(product.last_quoted_date)}</span>
        )}
      </div>
    </motion.div>
  )
}

function SupplierDetailPanel({ supplier, products, interactions, onClose, getRelationshipColor, getReliabilityBadge, formatTimeAgo, formatCurrency }: {
  supplier: Supplier
  products: SupplierProduct[]
  interactions: SupplierInteraction[]
  onClose: () => void
  getRelationshipColor: (strength: number) => string
  getReliabilityBadge: (score: number) => { color: string; text: string }
  formatTimeAgo: (date: string) => string
  formatCurrency: (amount: number) => string
}) {
  const reliabilityBadge = getReliabilityBadge(supplier.reliability_score)

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6 sticky top-6"
    >
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-bold text-white">Supplier Details</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded-lg transition-colors"
        >
          <AlertCircle size={20} className="text-gray-400" />
        </button>
      </div>

      <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-400 mb-1">Company</p>
            <p className="text-sm text-white font-medium">{supplier.company}</p>
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-1">Contact</p>
            <p className="text-sm text-white">{supplier.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <Mail size={12} className="text-gray-400" />
              <p className="text-xs text-gray-400">{supplier.email}</p>
            </div>
            {supplier.phone && (
              <div className="flex items-center gap-2 mt-1">
                <Phone size={12} className="text-gray-400" />
                <p className="text-xs text-gray-400">{supplier.phone}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#252525] rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-1">Relationship</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white/5 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${supplier.relationship_strength}%`,
                      background: `linear-gradient(to right, #f87171, #fbbf24, #a3e635)`
                    }}
                  />
                </div>
                <span className={`text-sm font-bold ${getRelationshipColor(supplier.relationship_strength)}`}>
                  {supplier.relationship_strength}%
                </span>
              </div>
            </div>

            <div className="bg-[#252525] rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-1">Reliability</p>
              <span className={`text-xs px-2 py-1 rounded border inline-block ${reliabilityBadge.color}`}>
                {reliabilityBadge.text} ({supplier.reliability_score}%)
              </span>
            </div>
          </div>

          {supplier.specialties.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-2">Specialties</p>
              <div className="flex flex-wrap gap-1">
                {supplier.specialties.map((specialty, idx) => (
                  <span key={idx} className="text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    {specialty}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs text-gray-400 mb-1">Last Contact</p>
            <p className="text-sm text-white">{formatTimeAgo(supplier.last_contact_date)}</p>
          </div>

          {products.length > 0 && (
            <div className="pt-3 border-t border-white/5">
              <p className="text-xs text-gray-400 mb-2">Product Summary</p>
              <div className="bg-[#252525] rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">Total Products</span>
                  <span className="text-sm font-bold text-white">{products.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Avg Lead Time</span>
                  <span className="text-sm font-bold text-lime-400">
                    {Math.round(
                      products
                        .filter(p => p.typical_lead_time_days)
                        .reduce((sum, p) => sum + (p.typical_lead_time_days || 0), 0) /
                      products.filter(p => p.typical_lead_time_days).length || 0
                    )} days
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Recent Interactions Timeline */}
        {interactions.length > 0 && (
          <div className="pt-4 border-t border-white/5">
            <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <Activity size={16} className="text-lime-400" />
              Recent Interactions ({interactions.length})
            </h4>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
              {interactions.slice(0, 10).map(interaction => {
                const Icon = INTERACTION_ICONS[interaction.interaction_type as keyof typeof INTERACTION_ICONS] || MessageSquare
                return (
                  <div key={interaction.id} className="bg-[#252525] rounded-lg p-3">
                    <div className="flex items-start gap-2 mb-2">
                      <Icon size={14} className="text-purple-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white capitalize">
                          {interaction.interaction_type.replace(/_/g, ' ')}
                        </p>
                        {interaction.email_log && (
                          <p className="text-xs text-gray-400 mt-1 truncate">
                            {interaction.email_log.subject}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-500 shrink-0">
                        {formatTimeAgo(interaction.extracted_at)}
                      </span>
                    </div>
                    {interaction.products_mentioned.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-white/5">
                        {interaction.products_mentioned.slice(0, 2).map((product, idx) => (
                          <span key={idx} className="text-[10px] px-2 py-1 rounded bg-white/5 text-gray-400">
                            {product}
                          </span>
                        ))}
                        {interaction.products_mentioned.length > 2 && (
                          <span className="text-[10px] px-2 py-1 rounded bg-white/5 text-gray-400">
                            +{interaction.products_mentioned.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function ProductDetailPanel({ product, onClose, formatCurrency, formatTimeAgo }: {
  product: SupplierProduct
  onClose: () => void
  formatCurrency: (amount: number) => string
  formatTimeAgo: (date: string) => string
}) {
  const reliabilityColor = STOCK_RELIABILITY_COLORS[product.stock_reliability as keyof typeof STOCK_RELIABILITY_COLORS] || STOCK_RELIABILITY_COLORS.usually_available

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6"
    >
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-bold text-white">Product Details</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded-lg transition-colors"
        >
          <AlertCircle size={20} className="text-gray-400" />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-xs text-gray-400 mb-1">Product Name</p>
          <p className="text-sm text-white font-medium">{product.product_name}</p>
        </div>

        {product.manufacturer && (
          <div>
            <p className="text-xs text-gray-400 mb-1">Manufacturer</p>
            <p className="text-sm text-white">{product.manufacturer}</p>
          </div>
        )}

        {product.model_number && (
          <div>
            <p className="text-xs text-gray-400 mb-1">Model Number</p>
            <p className="text-sm text-white">{product.model_number}</p>
          </div>
        )}

        {product.product_category && (
          <div>
            <p className="text-xs text-gray-400 mb-1">Category</p>
            <p className="text-sm text-white">{product.product_category}</p>
          </div>
        )}

        <div>
          <p className="text-xs text-gray-400 mb-1">Stock Reliability</p>
          <span className={`text-xs px-2 py-1 rounded border inline-block ${reliabilityColor}`}>
            {product.stock_reliability.replace(/_/g, ' ')}
          </span>
        </div>

        {product.last_quoted_price && (
          <div className="bg-[#252525] rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-2">Last Quoted Price</p>
            <p className="text-xl font-bold text-lime-400">{formatCurrency(product.last_quoted_price)}</p>
            {product.last_quoted_date && (
              <p className="text-xs text-gray-500 mt-1">{formatTimeAgo(product.last_quoted_date)}</p>
            )}
          </div>
        )}

        {product.typical_lead_time_days && (
          <div>
            <p className="text-xs text-gray-400 mb-1">Typical Lead Time</p>
            <p className="text-sm text-white">{product.typical_lead_time_days} days</p>
          </div>
        )}

        <div className="pt-3 border-t border-white/5">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Created</span>
            <span>{formatTimeAgo(product.created_at)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-2">
            <span>Last Updated</span>
            <span>{formatTimeAgo(product.updated_at)}</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function EmptyState({ icon: Icon, message }: {
  icon: any
  message: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6 flex items-center justify-center min-h-[400px]"
    >
      <div className="text-center text-gray-400">
        <Icon className="mx-auto mb-2 opacity-50" size={48} />
        <p className="text-sm">{message}</p>
      </div>
    </motion.div>
  )
}
