'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2,
  Mail,
  Phone,
  Plus,
  Upload,
  Download,
  Edit2,
  Trash2,
  Save,
  X,
  Search,
  Filter,
  Star,
  Tag,
  MessageSquare,
  Calendar,
  TrendingUp,
  TrendingDown,
  Archive,
  AlertCircle,
  Users,
  FileText,
  DollarSign,
  BarChart3,
  Clock,
  Send,
  CheckCircle,
  XCircle,
  Package
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  SupplierDetailPanel,
  SupplierFormModal,
  ContactFormModal,
  MarkupModal,
  BulkEmailModal,
  ImportCSVModal
} from './components'

interface Supplier {
  id: string
  name: string
  company: string
  email: string
  phone: string | null
  specialties: string[]
  notes: string | null
  tags: string[]
  relationship_strength: number
  reliability_score: number
  last_contact_date: string
  is_active: boolean
  created_at: string
  updated_at: string
  metadata: any
}

interface SupplierContact {
  id: string
  supplier_id: string
  contact_name: string
  email: string
  phone: string | null
  role: string | null
  specializes_in: string[]
  response_quality_score: number | null
  preferred_contact: boolean
  created_at: string
  updated_at: string
}

interface EmailInteraction {
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

interface SupplierProduct {
  id: string
  supplier_id: string
  product_name: string
  avg_markup_percentage: number | null
  custom_markup_percentage: number | null
  last_quoted_price: number | null
}

const SPECIALTY_OPTIONS = [
  'Audio Equipment',
  'Video Equipment',
  'Smart Home',
  'Lighting',
  'Security Systems',
  'Networking',
  'Installation Services',
  'Cables & Accessories',
  'Commercial AV',
  'Residential AV'
]

export default function SupplierContactsPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [contacts, setContacts] = useState<Record<string, SupplierContact[]>>({})
  const [interactions, setInteractions] = useState<Record<string, EmailInteraction[]>>({})
  const [products, setProducts] = useState<Record<string, SupplierProduct[]>>({})
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterSpecialty, setFilterSpecialty] = useState('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('active')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showContactModal, setShowContactModal] = useState(false)
  const [showMarkupModal, setShowMarkupModal] = useState(false)
  const [showBulkEmailModal, setShowBulkEmailModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)

  useEffect(() => {
    fetchSuppliers()
    setupRealtimeSubscriptions()
  }, [])

  useEffect(() => {
    if (selectedSupplier) {
      fetchSupplierDetails(selectedSupplier.id)
    }
  }, [selectedSupplier])

  const setupRealtimeSubscriptions = () => {
    const suppliersChannel = supabase
      .channel('suppliers_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, handleSupplierUpdate)
      .subscribe()

    const contactsChannel = supabase
      .channel('supplier_contacts_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supplier_contacts' }, handleContactUpdate)
      .subscribe()

    return () => {
      supabase.removeChannel(suppliersChannel)
      supabase.removeChannel(contactsChannel)
    }
  }

  const handleSupplierUpdate = (payload: any) => {
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

  const handleContactUpdate = (payload: any) => {
    const supplierId = payload.new?.supplier_id || payload.old?.supplier_id
    if (payload.eventType === 'INSERT') {
      setContacts(prev => ({
        ...prev,
        [supplierId]: [...(prev[supplierId] || []), payload.new]
      }))
    } else if (payload.eventType === 'UPDATE') {
      setContacts(prev => ({
        ...prev,
        [supplierId]: (prev[supplierId] || []).map(c => c.id === payload.new.id ? payload.new : c)
      }))
    } else if (payload.eventType === 'DELETE') {
      setContacts(prev => ({
        ...prev,
        [supplierId]: (prev[supplierId] || []).filter(c => c.id !== payload.old.id)
      }))
    }
  }

  const fetchSuppliers = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('company', { ascending: true })

      if (error) throw error
      setSuppliers(data || [])
    } catch (error) {
      console.error('Failed to fetch suppliers:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchSupplierDetails = async (supplierId: string) => {
    try {
      const [contactsRes, interactionsRes, productsRes] = await Promise.all([
        supabase
          .from('supplier_contacts')
          .select('*')
          .eq('supplier_id', supplierId)
          .order('preferred_contact', { ascending: false }),
        supabase
          .from('email_supplier_interactions')
          .select(`
            *,
            email_log:email_logs(subject, from_email, created_at)
          `)
          .eq('supplier_id', supplierId)
          .order('extracted_at', { ascending: false })
          .limit(50),
        supabase
          .from('supplier_products')
          .select('id, supplier_id, product_name, avg_markup_percentage, last_quoted_price')
          .eq('supplier_id', supplierId)
      ])

      if (contactsRes.data) {
        setContacts(prev => ({ ...prev, [supplierId]: contactsRes.data }))
      }
      if (interactionsRes.data) {
        setInteractions(prev => ({ ...prev, [supplierId]: interactionsRes.data as any }))
      }
      if (productsRes.data) {
        setProducts(prev => ({ ...prev, [supplierId]: productsRes.data as any }))
      }
    } catch (error) {
      console.error('Failed to fetch supplier details:', error)
    }
  }

  const handleAddSupplier = async (data: any) => {
    try {
      const { data: newSupplier, error } = await supabase
        .from('suppliers')
        .insert({
          name: data.name,
          company: data.company,
          email: data.email,
          phone: data.phone || null,
          specialties: data.specialties || [],
          tags: data.tags || [],
          notes: data.notes || null,
          relationship_strength: 50,
          reliability_score: 50,
          last_contact_date: new Date().toISOString(),
          is_active: true
        })
        .select()
        .single()

      if (error) throw error
      setShowAddModal(false)
    } catch (error) {
      console.error('Failed to add supplier:', error)
      alert('Failed to add supplier')
    }
  }

  const handleUpdateSupplier = async (data: any) => {
    if (!editingSupplier) return
    try {
      const { error } = await supabase
        .from('suppliers')
        .update({
          name: data.name,
          company: data.company,
          email: data.email,
          phone: data.phone || null,
          specialties: data.specialties || [],
          tags: data.tags || [],
          notes: data.notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingSupplier.id)

      if (error) throw error
      setShowEditModal(false)
      setEditingSupplier(null)
    } catch (error) {
      console.error('Failed to update supplier:', error)
      alert('Failed to update supplier')
    }
  }

  const handleToggleActive = async (supplier: Supplier) => {
    try {
      const { error } = await supabase
        .from('suppliers')
        .update({ is_active: !supplier.is_active })
        .eq('id', supplier.id)

      if (error) throw error
    } catch (error) {
      console.error('Failed to toggle supplier status:', error)
    }
  }

  const handleAddContact = async (supplierId: string, data: any) => {
    try {
      const { error } = await supabase
        .from('supplier_contacts')
        .insert({
          supplier_id: supplierId,
          contact_name: data.name,
          email: data.email,
          phone: data.phone || null,
          role: data.role || null,
          specializes_in: data.specializes_in || [],
          preferred_contact: data.preferred || false
        })

      if (error) throw error
    } catch (error) {
      console.error('Failed to add contact:', error)
      alert('Failed to add contact')
    }
  }

  const handleTogglePreferredContact = async (contact: SupplierContact) => {
    try {
      if (!contact.preferred_contact) {
        await supabase
          .from('supplier_contacts')
          .update({ preferred_contact: false })
          .eq('supplier_id', contact.supplier_id)
      }

      const { error } = await supabase
        .from('supplier_contacts')
        .update({ preferred_contact: !contact.preferred_contact })
        .eq('id', contact.id)

      if (error) throw error
    } catch (error) {
      console.error('Failed to toggle preferred contact:', error)
    }
  }

  const handleExportSuppliers = () => {
    const csvData = filteredSuppliers.map(s => ({
      Company: s.company,
      Name: s.name,
      Email: s.email,
      Phone: s.phone || '',
      Specialties: s.specialties.join('; '),
      Tags: (s.tags || []).join('; '),
      'Relationship Strength': s.relationship_strength,
      'Reliability Score': s.reliability_score,
      Status: s.is_active ? 'Active' : 'Inactive',
      'Last Contact': s.last_contact_date
    }))

    const headers = Object.keys(csvData[0] || {})
    const csv = [
      headers.join(','),
      ...csvData.map(row => headers.map(h => `"${(row as any)[h]}"`).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `suppliers_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportCSV = async (file: File) => {
    try {
      const text = await file.text()
      const lines = text.split('\n')
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
      
      const importData = lines.slice(1).filter(line => line.trim()).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
        const row: any = {}
        headers.forEach((header, i) => {
          row[header] = values[i] || ''
        })
        return row
      })

      for (const row of importData) {
        await supabase.from('suppliers').insert({
          company: row.Company || row.company,
          name: row.Name || row.name,
          email: row.Email || row.email,
          phone: row.Phone || row.phone || null,
          specialties: (row.Specialties || row.specialties || '').split(';').map((s: string) => s.trim()).filter(Boolean),
          tags: (row.Tags || row.tags || '').split(';').map((t: string) => t.trim()).filter(Boolean),
          relationship_strength: 50,
          reliability_score: 50,
          last_contact_date: new Date().toISOString(),
          is_active: true
        })
      }

      setShowImportModal(false)
      fetchSuppliers()
      alert(`Successfully imported ${importData.length} suppliers`)
    } catch (error) {
      console.error('Failed to import CSV:', error)
      alert('Failed to import CSV file')
    }
  }

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(supplier => {
      if (filterStatus !== 'all' && supplier.is_active !== (filterStatus === 'active')) {
        return false
      }

      if (filterSpecialty !== 'all' && !supplier.specialties.includes(filterSpecialty)) {
        return false
      }

      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return (
          supplier.company.toLowerCase().includes(query) ||
          supplier.name.toLowerCase().includes(query) ||
          supplier.email.toLowerCase().includes(query) ||
          supplier.specialties.some(s => s.toLowerCase().includes(query)) ||
          (supplier.tags || []).some(t => t.toLowerCase().includes(query))
        )
      }

      return true
    })
  }, [suppliers, searchQuery, filterSpecialty, filterStatus])

  const supplierInteractions = selectedSupplier ? (interactions[selectedSupplier.id] || []) : []
  const supplierContacts = selectedSupplier ? (contacts[selectedSupplier.id] || []) : []
  const supplierProducts = selectedSupplier ? (products[selectedSupplier.id] || []) : []

  const interactionsByMonth = useMemo(() => {
    if (!selectedSupplier) return []
    const data = supplierInteractions.reduce((acc, interaction) => {
      const month = new Date(interaction.extracted_at).toISOString().slice(0, 7)
      acc[month] = (acc[month] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return Object.entries(data)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, count]) => ({ month, count }))
  }, [supplierInteractions, selectedSupplier])

  const reliabilityTrend = useMemo(() => {
    if (!selectedSupplier) return []
    return interactionsByMonth.map((item, idx) => ({
      month: item.month,
      score: Math.min(100, 50 + (item.count * 5) + (idx * 2))
    }))
  }, [interactionsByMonth, selectedSupplier])

  const formatTimeAgo = (dateString: string) => {
    const diff = Date.now() - new Date(dateString).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days}d ago`
    return `${Math.floor(days / 30)}mo ago`
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Building2 className="text-lime-400" />
            Supplier Contacts
          </h1>
          <p className="text-gray-400 mt-1">Manage your supplier network and relationships</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition-all flex items-center gap-2"
          >
            <Upload size={18} />
            Import CSV
          </button>
          <button
            onClick={handleExportSuppliers}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition-all flex items-center gap-2"
          >
            <Download size={18} />
            Export
          </button>
          <button
            onClick={() => setShowBulkEmailModal(true)}
            className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 rounded-xl transition-all flex items-center gap-2"
          >
            <Send size={18} />
            Bulk Email
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-lime-400 hover:bg-lime-500 text-black font-bold rounded-xl transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(163,230,53,0.3)]"
          >
            <Plus size={18} />
            Add Supplier
          </button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <StatCard
          label="Total Suppliers"
          value={suppliers.length}
          icon={Building2}
          color="text-blue-400"
        />
        <StatCard
          label="Active Suppliers"
          value={suppliers.filter(s => s.is_active).length}
          icon={CheckCircle}
          color="text-lime-400"
        />
        <StatCard
          label="Avg Reliability"
          value={`${Math.round(suppliers.reduce((acc, s) => acc + (s.reliability_score || 0), 0) / Math.max(suppliers.length, 1))}%`}
          icon={TrendingUp}
          color="text-green-400"
        />
        <StatCard
          label="Total Contacts"
          value={Object.values(contacts).reduce((acc, arr) => acc + arr.length, 0)}
          icon={Users}
          color="text-purple-400"
        />
      </motion.div>

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
            placeholder="Search suppliers by name, company, email, specialties, or tags..."
            className="w-full bg-[#1c1c1c] border border-white/5 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-lime-500/50"
          />
        </div>
        <select
          value={filterSpecialty}
          onChange={(e) => setFilterSpecialty(e.target.value)}
          className="bg-[#1c1c1c] border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-lime-500/50"
        >
          <option value="all">All Specialties</option>
          {SPECIALTY_OPTIONS.map(spec => (
            <option key={spec} value={spec}>{spec}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="bg-[#1c1c1c] border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-lime-500/50"
        >
          <option value="all">All Status</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
        </select>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6"
          >
            <h2 className="text-xl font-bold text-white mb-4">
              Suppliers ({filteredSuppliers.length})
            </h2>
            <div className="space-y-2 max-h-[800px] overflow-y-auto pr-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lime-400" />
                </div>
              ) : filteredSuppliers.length > 0 ? (
                filteredSuppliers.map(supplier => (
                  <SupplierCard
                    key={supplier.id}
                    supplier={supplier}
                    isSelected={selectedSupplier?.id === supplier.id}
                    onClick={() => setSelectedSupplier(supplier)}
                    onEdit={() => {
                      setEditingSupplier(supplier)
                      setShowEditModal(true)
                    }}
                    onToggleActive={() => handleToggleActive(supplier)}
                    formatTimeAgo={formatTimeAgo}
                  />
                ))
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <Building2 className="mx-auto mb-3 opacity-50" size={48} />
                  <p>No suppliers found</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        <div>
          <AnimatePresence mode="wait">
            {selectedSupplier ? (
              <SupplierDetailPanel
                key={selectedSupplier.id}
                supplier={selectedSupplier}
                contacts={supplierContacts}
                interactions={supplierInteractions}
                products={supplierProducts}
                interactionsByMonth={interactionsByMonth}
                reliabilityTrend={reliabilityTrend}
                onClose={() => setSelectedSupplier(null)}
                onAddContact={() => setShowContactModal(true)}
                onTogglePreferredContact={handleTogglePreferredContact}
                onSetCustomMarkup={() => setShowMarkupModal(true)}
                formatTimeAgo={formatTimeAgo}
              />
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6 flex items-center justify-center min-h-[400px]"
              >
                <div className="text-center text-gray-400">
                  <Building2 className="mx-auto mb-2 opacity-50" size={48} />
                  <p>Select a supplier to view details</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {showAddModal && (
          <SupplierFormModal
            title="Add New Supplier"
            onClose={() => setShowAddModal(false)}
            onSubmit={handleAddSupplier}
          />
        )}
        {showEditModal && editingSupplier && (
          <SupplierFormModal
            title="Edit Supplier"
            supplier={editingSupplier}
            onClose={() => {
              setShowEditModal(false)
              setEditingSupplier(null)
            }}
            onSubmit={handleUpdateSupplier}
          />
        )}
        {showContactModal && selectedSupplier && (
          <ContactFormModal
            supplierId={selectedSupplier.id}
            onClose={() => setShowContactModal(false)}
            onSubmit={(data) => {
              handleAddContact(selectedSupplier.id, data)
              setShowContactModal(false)
            }}
          />
        )}
        {showMarkupModal && selectedSupplier && (
          <MarkupModal
            supplier={selectedSupplier}
            products={supplierProducts}
            onClose={() => setShowMarkupModal(false)}
          />
        )}
        {showBulkEmailModal && (
          <BulkEmailModal
            suppliers={filteredSuppliers}
            onClose={() => setShowBulkEmailModal(false)}
          />
        )}
        {showImportModal && (
          <ImportCSVModal
            onClose={() => setShowImportModal(false)}
            onImport={handleImportCSV}
          />
        )}
      </AnimatePresence>
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

function SupplierCard({ supplier, isSelected, onClick, onEdit, onToggleActive, formatTimeAgo }: {
  supplier: Supplier
  isSelected: boolean
  onClick: () => void
  onEdit: () => void
  onToggleActive: () => void
  formatTimeAgo: (date: string) => string
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-[#252525] border rounded-xl p-4 hover:border-lime-500/30 transition-all cursor-pointer ${
        isSelected ? 'border-lime-500/50' : 'border-white/5'
      } ${!supplier.is_active ? 'opacity-60' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Building2 size={16} className="text-blue-400 shrink-0" />
            <p className="text-sm font-medium text-white truncate">{supplier.company}</p>
            {!supplier.is_active && (
              <span className="text-xs px-2 py-0.5 rounded bg-gray-500/20 text-gray-400 border border-gray-500/30">
                Inactive
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 truncate">{supplier.name}</p>
          <p className="text-xs text-gray-500 truncate">{supplier.email}</p>
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
            className="p-1.5 hover:bg-white/10 rounded transition-colors"
            title="Edit"
          >
            <Edit2 size={14} className="text-gray-400" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleActive()
            }}
            className="p-1.5 hover:bg-white/10 rounded transition-colors"
            title={supplier.is_active ? 'Deactivate' : 'Activate'}
          >
            {supplier.is_active ? (
              <Archive size={14} className="text-gray-400" />
            ) : (
              <CheckCircle size={14} className="text-lime-400" />
            )}
          </button>
        </div>
      </div>

      {supplier.specialties.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {supplier.specialties.slice(0, 3).map((spec, idx) => (
            <span key={idx} className="text-[10px] px-2 py-1 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
              {spec}
            </span>
          ))}
          {supplier.specialties.length > 3 && (
            <span className="text-[10px] px-2 py-1 rounded bg-white/5 text-gray-400">
              +{supplier.specialties.length - 3}
            </span>
          )}
        </div>
      )}

      {(supplier.tags || []).length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {(supplier.tags || []).slice(0, 2).map((tag, idx) => (
            <span key={idx} className="text-[10px] px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 flex items-center gap-1">
              <Tag size={8} />
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-white/5">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <TrendingUp size={12} />
            {supplier.relationship_strength}%
          </span>
          <span className="flex items-center gap-1">
            <BarChart3 size={12} />
            {supplier.reliability_score}%
          </span>
        </div>
        <span className="flex items-center gap-1">
          <Clock size={12} />
          {formatTimeAgo(supplier.last_contact_date)}
        </span>
      </div>
    </motion.div>
  )
}
