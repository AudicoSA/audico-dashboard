import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Building2,
  Mail,
  Phone,
  Plus,
  Upload,
  Save,
  X,
  Star,
  Tag,
  MessageSquare,
  TrendingUp,
  Users,
  DollarSign,
  Package,
  Send
} from 'lucide-react'

export function SupplierDetailPanel({
  supplier,
  contacts,
  interactions,
  products,
  interactionsByMonth,
  reliabilityTrend,
  onClose,
  onAddContact,
  onTogglePreferredContact,
  onSetCustomMarkup,
  formatTimeAgo
}: any) {
  const [activeTab, setActiveTab] = useState<'overview' | 'contacts' | 'emails' | 'timeline' | 'products'>('overview')

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-[#1c1c1c] border border-white/5 rounded-2xl overflow-hidden sticky top-6"
    >
      <div className="p-6 border-b border-white/5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white">{supplier.company}</h3>
            <p className="text-sm text-gray-400">{supplier.name}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          {(['overview', 'contacts', 'emails', 'timeline', 'products'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === tab ? 'bg-lime-400 text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 max-h-[calc(100vh-250px)] overflow-y-auto">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">Email</p>
              <p className="text-sm text-white">{supplier.email}</p>
            </div>
            {supplier.phone && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Phone</p>
                <p className="text-sm text-white">{supplier.phone}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#252525] rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Relationship</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white/5 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-red-400 via-yellow-400 to-lime-400"
                      style={{ width: `${supplier.relationship_strength}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-lime-400">{supplier.relationship_strength}%</span>
                </div>
              </div>
              <div className="bg-[#252525] rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Reliability</p>
                <p className="text-2xl font-bold text-lime-400">{supplier.reliability_score}%</p>
              </div>
            </div>
            {supplier.specialties.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-2">Specialties</p>
                <div className="flex flex-wrap gap-1">
                  {supplier.specialties.map((spec: string, idx: number) => (
                    <span key={idx} className="text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                      {spec}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {(supplier.tags || []).length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-2">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {(supplier.tags || []).map((tag: string, idx: number) => (
                    <span key={idx} className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 flex items-center gap-1">
                      <Tag size={10} />
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {supplier.notes && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Notes</p>
                <p className="text-sm text-white bg-[#252525] rounded-lg p-3">{supplier.notes}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'contacts' && (
          <div className="space-y-3">
            <button
              onClick={onAddContact}
              className="w-full px-4 py-2 bg-lime-400 hover:bg-lime-500 text-black font-medium rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              Add Contact
            </button>
            {contacts.length > 0 ? (
              contacts.map((contact: any) => (
                <div key={contact.id} className="bg-[#252525] rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white">{contact.contact_name}</p>
                        {contact.preferred_contact && <Star size={12} className="text-yellow-400 fill-yellow-400" />}
                      </div>
                      {contact.role && <p className="text-xs text-gray-400">{contact.role}</p>}
                    </div>
                    <button
                      onClick={() => onTogglePreferredContact(contact)}
                      className="p-1 hover:bg-white/10 rounded transition-colors"
                      title={contact.preferred_contact ? 'Remove preferred' : 'Set as preferred'}
                    >
                      <Star size={14} className={contact.preferred_contact ? 'text-yellow-400 fill-yellow-400' : 'text-gray-400'} />
                    </button>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Mail size={10} />
                      {contact.email}
                    </div>
                    {contact.phone && (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Phone size={10} />
                        {contact.phone}
                      </div>
                    )}
                  </div>
                  {contact.specializes_in.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-white/5">
                      {contact.specializes_in.map((spec: string, idx: number) => (
                        <span key={idx} className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">
                          {spec}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Users className="mx-auto mb-2 opacity-50" size={32} />
                <p className="text-sm">No contacts added</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'emails' && (
          <div className="space-y-3">
            {interactions.length > 0 ? (
              interactions.slice(0, 20).map((interaction: any) => (
                <div key={interaction.id} className="bg-[#252525] rounded-lg p-3">
                  <div className="flex items-start gap-2 mb-2">
                    <MessageSquare size={14} className="text-blue-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white capitalize">
                        {interaction.interaction_type.replace(/_/g, ' ')}
                      </p>
                      {interaction.email_log && (
                        <p className="text-xs text-gray-400 mt-1 truncate">{interaction.email_log.subject}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-500 shrink-0">
                      {formatTimeAgo(interaction.extracted_at)}
                    </span>
                  </div>
                  {interaction.products_mentioned.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-2 border-t border-white/5">
                      {interaction.products_mentioned.slice(0, 2).map((product: string, idx: number) => (
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
              ))
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Mail className="mx-auto mb-2 opacity-50" size={32} />
                <p className="text-sm">No email interactions</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-white mb-3">Interaction Frequency</h4>
              <div className="space-y-2">
                {interactionsByMonth.map((item: any) => (
                  <div key={item.month} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-16">{item.month}</span>
                    <div className="flex-1 bg-white/5 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-lime-400"
                        style={{
                          width: `${Math.min(
                            100,
                            (item.count / Math.max(...interactionsByMonth.map((i: any) => i.count))) * 100
                          )}%`
                        }}
                      />
                    </div>
                    <span className="text-xs text-white w-8 text-right">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-white mb-3">Reliability Trend</h4>
              <div className="space-y-2">
                {reliabilityTrend.map((item: any) => (
                  <div key={item.month} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-16">{item.month}</span>
                    <div className="flex-1 bg-white/5 rounded-full h-2">
                      <div className="h-2 rounded-full bg-green-400" style={{ width: `${item.score}%` }} />
                    </div>
                    <span className="text-xs text-white w-8 text-right">{item.score}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="space-y-3">
            <button
              onClick={onSetCustomMarkup}
              className="w-full px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 font-medium rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <DollarSign size={16} />
              Set Custom Markup
            </button>
            {products.length > 0 ? (
              products.map((product: any) => (
                <div key={product.id} className="bg-[#252525] rounded-lg p-3">
                  <p className="text-sm font-medium text-white mb-2">{product.product_name}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-gray-400">Avg Markup</p>
                      <p className="text-white font-medium">{product.avg_markup_percentage || 0}%</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Last Price</p>
                      <p className="text-lime-400 font-medium">
                        {product.last_quoted_price ? `R${product.last_quoted_price.toFixed(2)}` : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Package className="mx-auto mb-2 opacity-50" size={32} />
                <p className="text-sm">No products mapped</p>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

export function SupplierFormModal({ title, supplier, onClose, onSubmit }: any) {
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

  const [formData, setFormData] = useState({
    company: supplier?.company || '',
    name: supplier?.name || '',
    email: supplier?.email || '',
    phone: supplier?.phone || '',
    specialties: supplier?.specialties || [],
    tags: supplier?.tags || [],
    notes: supplier?.notes || ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const toggleSpecialty = (spec: string) => {
    setFormData(prev => ({
      ...prev,
      specialties: prev.specialties.includes(spec)
        ? prev.specialties.filter(s => s !== spec)
        : [...prev.specialties, spec]
    }))
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-[#1c1c1c] border border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-white mb-4">{title}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Company Name *</label>
              <input
                type="text"
                value={formData.company}
                onChange={e => setFormData(prev => ({ ...prev, company: e.target.value }))}
                className="w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-lime-500/50"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Contact Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-lime-500/50"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-lime-500/50"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-lime-500/50"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Specialties</label>
            <div className="flex flex-wrap gap-2">
              {SPECIALTY_OPTIONS.map(spec => (
                <button
                  key={spec}
                  type="button"
                  onClick={() => toggleSpecialty(spec)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    formData.specialties.includes(spec)
                      ? 'bg-purple-500/30 text-purple-400 border border-purple-500/50'
                      : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  {spec}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={(formData.tags || []).join(', ')}
              onChange={e =>
                setFormData(prev => ({
                  ...prev,
                  tags: e.target.value
                    .split(',')
                    .map(t => t.trim())
                    .filter(Boolean)
                }))
              }
              className="w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-lime-500/50"
              placeholder="e.g., Premium, Preferred, Fast Shipping"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-lime-500/50 resize-none"
              rows={3}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-lime-400 hover:bg-lime-500 text-black font-bold rounded-xl transition-colors"
            >
              {supplier ? 'Update' : 'Add'} Supplier
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

export function ContactFormModal({ supplierId, onClose, onSubmit }: any) {
  const SPECIALTY_OPTIONS = [
    'Audio Equipment',
    'Video Equipment',
    'Smart Home',
    'Lighting',
    'Security Systems',
    'Networking'
  ]

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    specializes_in: [] as string[],
    preferred: false
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const toggleSpecialty = (spec: string) => {
    setFormData(prev => ({
      ...prev,
      specializes_in: prev.specializes_in.includes(spec)
        ? prev.specializes_in.filter(s => s !== spec)
        : [...prev.specializes_in, spec]
    }))
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-[#1c1c1c] border border-white/10 rounded-2xl p-6 w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-white mb-4">Add Contact</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-lime-500/50"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email *</label>
            <input
              type="email"
              value={formData.email}
              onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-lime-500/50"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-lime-500/50"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Role</label>
            <input
              type="text"
              value={formData.role}
              onChange={e => setFormData(prev => ({ ...prev, role: e.target.value }))}
              className="w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-lime-500/50"
              placeholder="e.g., Sales Manager, Technical Support"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Specializes In</label>
            <div className="flex flex-wrap gap-2">
              {SPECIALTY_OPTIONS.map(spec => (
                <button
                  key={spec}
                  type="button"
                  onClick={() => toggleSpecialty(spec)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    formData.specializes_in.includes(spec)
                      ? 'bg-purple-500/30 text-purple-400 border border-purple-500/50'
                      : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  {spec}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="preferred"
              checked={formData.preferred}
              onChange={e => setFormData(prev => ({ ...prev, preferred: e.target.checked }))}
              className="w-4 h-4 rounded border-white/20 bg-[#252525]"
            />
            <label htmlFor="preferred" className="text-sm text-gray-400 flex items-center gap-1">
              <Star size={12} className="text-yellow-400" />
              Set as preferred contact
            </label>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-lime-400 hover:bg-lime-500 text-black font-bold rounded-xl transition-colors"
            >
              Add Contact
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

export function MarkupModal({ supplier, products, onClose }: any) {
  const { supabase } = require('@/lib/supabase')
  const [customMarkups, setCustomMarkups] = useState<Record<string, number>>({})

  const handleSave = async () => {
    try {
      for (const [productId, markup] of Object.entries(customMarkups)) {
        await supabase
          .from('supplier_products')
          .update({ custom_markup_percentage: markup })
          .eq('id', productId)
      }
      onClose()
    } catch (error) {
      console.error('Failed to save markups:', error)
      alert('Failed to save custom markups')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-[#1c1c1c] border border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-white mb-4">Set Custom Markup Rules</h3>
        <p className="text-sm text-gray-400 mb-4">Override learned markup defaults for {supplier.company}</p>
        <div className="flex-1 overflow-y-auto space-y-3 mb-4">
          {products.map((product: any) => (
            <div key={product.id} className="bg-[#252525] rounded-lg p-4">
              <p className="text-sm font-medium text-white mb-2">{product.product_name}</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Learned Markup</p>
                  <p className="text-lg font-bold text-gray-300">{product.avg_markup_percentage || 0}%</p>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Custom Markup (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="200"
                    step="0.1"
                    value={customMarkups[product.id] || ''}
                    onChange={e =>
                      setCustomMarkups(prev => ({
                        ...prev,
                        [product.id]: parseFloat(e.target.value) || 0
                      }))
                    }
                    className="w-full bg-[#1c1c1c] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-lime-500/50"
                    placeholder={(product.avg_markup_percentage || 0).toString()}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-lime-400 hover:bg-lime-500 text-black font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Save size={16} />
            Save Markups
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export function BulkEmailModal({ suppliers, onClose }: any) {
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

  const [selectedSpecialty, setSelectedSpecialty] = useState('all')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const filteredSuppliers =
    selectedSpecialty === 'all'
      ? suppliers
      : suppliers.filter((s: any) => s.specialties.includes(selectedSpecialty))

  const handleSend = async () => {
    if (!subject || !message) {
      alert('Please fill in subject and message')
      return
    }

    setSending(true)
    try {
      for (const supplier of filteredSuppliers) {
        console.log(`Would send email to ${supplier.email}: ${subject}`)
      }
      alert(`Email sent to ${filteredSuppliers.length} suppliers`)
      onClose()
    } catch (error) {
      console.error('Failed to send emails:', error)
      alert('Failed to send bulk emails')
    } finally {
      setSending(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-[#1c1c1c] border border-white/10 rounded-2xl p-6 w-full max-w-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-white mb-4">Send Bulk Email</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Filter by Specialty</label>
            <select
              value={selectedSpecialty}
              onChange={e => setSelectedSpecialty(e.target.value)}
              className="w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-lime-500/50"
            >
              <option value="all">All Suppliers ({suppliers.length})</option>
              {SPECIALTY_OPTIONS.map(spec => {
                const count = suppliers.filter((s: any) => s.specialties.includes(spec)).length
                return count > 0 ? (
                  <option key={spec} value={spec}>
                    {spec} ({count})
                  </option>
                ) : null
              })}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Will send to {filteredSuppliers.length} supplier{filteredSuppliers.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Subject *</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-lime-500/50"
              placeholder="Email subject"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Message *</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              className="w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-lime-500/50 resize-none"
              rows={6}
              placeholder="Email message"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={sending}
              className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {sending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Sending...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Send to {filteredSuppliers.length}
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

export function ImportCSVModal({ onClose, onImport }: any) {
  const [file, setFile] = useState<File | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (file) {
      onImport(file)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-[#1c1c1c] border border-white/10 rounded-2xl p-6 w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-white mb-4">Import Suppliers from CSV</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">CSV File *</label>
            <input
              type="file"
              accept=".csv"
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-lime-500/50 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-lime-400 file:text-black hover:file:bg-lime-500"
              required
            />
            <p className="text-xs text-gray-500 mt-2">
              Expected columns: Company, Name, Email, Phone, Specialties (semicolon-separated), Tags (semicolon-separated)
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!file}
              className="flex-1 px-4 py-2 bg-lime-400 hover:bg-lime-500 text-black font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Upload size={16} />
              Import
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
