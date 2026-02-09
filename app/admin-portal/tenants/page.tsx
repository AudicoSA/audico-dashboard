'use client'

import { useEffect, useState } from 'react'
import { 
  Users, 
  Plus, 
  Search, 
  Building, 
  Globe, 
  Settings, 
  TrendingUp,
  DollarSign,
  Activity
} from 'lucide-react'
import Link from 'next/link'

export default function TenantsPage() {
  const [tenants, setTenants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetchTenants()
  }, [filter])

  const fetchTenants = async () => {
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('status', filter)
      
      const response = await fetch(`/api/admin/tenants?${params}`)
      const data = await response.json()
      setTenants(data.tenants || [])
    } catch (error) {
      console.error('Error fetching tenants:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      suspended: 'bg-red-100 text-red-800',
      pending_setup: 'bg-yellow-100 text-yellow-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getPlanBadge = (tier: string) => {
    const badges: Record<string, string> = {
      basic: 'bg-blue-100 text-blue-800',
      professional: 'bg-purple-100 text-purple-800',
      enterprise: 'bg-orange-100 text-orange-800',
    }
    return badges[tier] || badges.basic
  }

  const filteredTenants = tenants.filter(tenant =>
    tenant.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenant.subdomain.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Reseller Tenants</h1>
            <p className="text-gray-600">Manage white-label deployments for approved resellers</p>
          </div>
          <Link
            href="/admin-portal/tenants/new"
            className="flex items-center gap-2 bg-lime-500 text-black px-6 py-3 rounded-lg font-semibold hover:bg-lime-400 transition-colors"
          >
            <Plus size={20} />
            New Tenant
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard title="Total Tenants" value={tenants.length.toString()} icon={Users} color="blue" />
          <StatCard title="Active" value={tenants.filter(t => t.status === 'active').length.toString()} icon={Activity} color="green" />
          <StatCard title="Trial" value={tenants.filter(t => t.billing_status === 'trial').length.toString()} icon={TrendingUp} color="yellow" />
          <StatCard title="MRR" value={`R${tenants.reduce((sum, t) => sum + (t.monthly_fee || 0), 0).toLocaleString()}`} icon={DollarSign} color="purple" />
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search tenants by name or subdomain..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    filter === 'all'
                      ? 'bg-lime-500 text-black'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter('active')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    filter === 'active'
                      ? 'bg-lime-500 text-black'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => setFilter('trial')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    filter === 'trial'
                      ? 'bg-lime-500 text-black'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Trial
                </button>
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading tenants...</div>
            ) : filteredTenants.length === 0 ? (
              <div className="p-12 text-center">
                <Building size={64} className="mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500 text-lg">No tenants found</p>
                <p className="text-gray-400 text-sm mt-2">
                  Create a new tenant to get started
                </p>
              </div>
            ) : (
              filteredTenants.map((tenant) => (
                <Link
                  key={tenant.id}
                  href={`/admin-portal/tenants/${tenant.id}`}
                  className="block p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {tenant.company_name}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(tenant.status)}`}>
                          {tenant.status.replace('_', ' ')}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPlanBadge(tenant.plan_tier)}`}>
                          {tenant.plan_tier.toUpperCase()}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Globe size={16} />
                          <span>{tenant.subdomain}.audico-platform.com</span>
                        </div>
                        {tenant.custom_domain && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Globe size={16} />
                            <span>{tenant.custom_domain}</span>
                            {tenant.custom_domain_verified && (
                              <span className="text-green-600 text-xs">✓</span>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <DollarSign size={16} />
                          <span>R{tenant.monthly_fee.toLocaleString()}/mo</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <TrendingUp size={16} />
                          <span>{tenant.product_markup_percentage}% markup</span>
                        </div>
                      </div>
                    </div>
                    
                    <Settings size={20} className="text-gray-400" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon: Icon, color }: { 
  title: string
  value: string
  icon: any
  color: string 
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    purple: 'bg-purple-500',
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className={`w-12 h-12 rounded-lg ${colorClasses[color]} bg-opacity-10 flex items-center justify-center mb-4`}>
        <Icon className={`text-${color}-600`} size={24} />
      </div>
      <h3 className="text-gray-600 text-sm font-medium mb-1">{title}</h3>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
    </div>
  )
}
