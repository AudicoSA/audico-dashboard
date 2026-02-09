'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Save,
  Palette,
  Package,
  Users,
  Key,
  BarChart3,
  Settings,
  Globe,
  Shield
} from 'lucide-react'
import Link from 'next/link'

export default function TenantDetailPage() {
  const params = useParams()
  const router = useRouter()
  const tenantId = params.id as string

  const [tenant, setTenant] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('general')

  useEffect(() => {
    fetchTenant()
  }, [tenantId])

  const fetchTenant = async () => {
    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}`)
      const data = await response.json()
      setTenant(data.tenant)
    } catch (error) {
      console.error('Error fetching tenant:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tenant),
      })

      if (response.ok) {
        alert('Tenant updated successfully!')
      }
    } catch (error) {
      console.error('Error updating tenant:', error)
      alert('Failed to update tenant')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">Loading tenant...</div>
        </div>
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-gray-500">Tenant not found</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Link
            href="/admin-portal/tenants"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft size={20} />
            Back to Tenants
          </Link>
          
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{tenant.company_name}</h1>
              <p className="text-gray-600">{tenant.subdomain}.audico-platform.com</p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-lime-500 text-black px-6 py-3 rounded-lg font-semibold hover:bg-lime-400 transition-colors disabled:opacity-50"
            >
              <Save size={20} />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        <div className="flex gap-4 mb-6 border-b border-gray-200">
          {[
            { id: 'general', label: 'General', icon: Settings },
            { id: 'branding', label: 'Branding', icon: Palette },
            { id: 'products', label: 'Products', icon: Package },
            { id: 'customers', label: 'Customers', icon: Users },
            { id: 'api', label: 'API Keys', icon: Key },
            { id: 'usage', label: 'Usage', icon: BarChart3 },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-lime-600 border-b-2 border-lime-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <tab.icon size={20} />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'general' && (
          <GeneralTab tenant={tenant} setTenant={setTenant} />
        )}
        {activeTab === 'branding' && (
          <BrandingTab tenant={tenant} setTenant={setTenant} />
        )}
        {activeTab === 'products' && (
          <ProductsTab tenantId={tenantId} tenant={tenant} />
        )}
        {activeTab === 'customers' && (
          <CustomersTab tenantId={tenantId} />
        )}
        {activeTab === 'api' && (
          <ApiKeysTab tenantId={tenantId} />
        )}
        {activeTab === 'usage' && (
          <UsageTab tenantId={tenantId} />
        )}
      </div>
    </div>
  )
}

function GeneralTab({ tenant, setTenant }: any) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Tenant Information</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
            <input
              type="text"
              value={tenant.company_name}
              onChange={(e) => setTenant({ ...tenant, company_name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subdomain</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={tenant.subdomain}
                onChange={(e) => setTenant({ ...tenant, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500"
              />
              <span className="text-gray-600">.audico-platform.com</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Custom Domain</label>
            <input
              type="text"
              value={tenant.custom_domain || ''}
              onChange={(e) => setTenant({ ...tenant, custom_domain: e.target.value })}
              placeholder="custom.domain.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={tenant.status}
              onChange={(e) => setTenant({ ...tenant, status: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
              <option value="pending_setup">Pending Setup</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Billing & Plan</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Plan Tier</label>
            <select
              value={tenant.plan_tier}
              onChange={(e) => setTenant({ ...tenant, plan_tier: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500"
            >
              <option value="basic">Basic</option>
              <option value="professional">Professional</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Fee (ZAR)</label>
            <input
              type="number"
              value={tenant.monthly_fee}
              onChange={(e) => setTenant({ ...tenant, monthly_fee: parseFloat(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Product Markup %</label>
            <input
              type="number"
              value={tenant.product_markup_percentage}
              onChange={(e) => setTenant({ ...tenant, product_markup_percentage: parseFloat(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Billing Status</label>
            <select
              value={tenant.billing_status}
              onChange={(e) => setTenant({ ...tenant, billing_status: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500"
            >
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="suspended">Suspended</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}

function BrandingTab({ tenant, setTenant }: any) {
  const branding = tenant.branding_config || {}

  const updateBranding = (key: string, value: any) => {
    setTenant({
      ...tenant,
      branding_config: { ...branding, [key]: value }
    })
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Branding Configuration</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Logo URL</label>
          <input
            type="text"
            value={branding.logo_url || ''}
            onChange={(e) => updateBranding('logo_url', e.target.value)}
            placeholder="https://example.com/logo.png"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Favicon URL</label>
          <input
            type="text"
            value={branding.favicon_url || ''}
            onChange={(e) => updateBranding('favicon_url', e.target.value)}
            placeholder="https://example.com/favicon.ico"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
          <div className="flex gap-2">
            <input
              type="color"
              value={branding.primary_color || '#84cc16'}
              onChange={(e) => updateBranding('primary_color', e.target.value)}
              className="w-16 h-10 border border-gray-300 rounded-lg cursor-pointer"
            />
            <input
              type="text"
              value={branding.primary_color || '#84cc16'}
              onChange={(e) => updateBranding('primary_color', e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Secondary Color</label>
          <div className="flex gap-2">
            <input
              type="color"
              value={branding.secondary_color || '#000000'}
              onChange={(e) => updateBranding('secondary_color', e.target.value)}
              className="w-16 h-10 border border-gray-300 rounded-lg cursor-pointer"
            />
            <input
              type="text"
              value={branding.secondary_color || '#000000'}
              onChange={(e) => updateBranding('secondary_color', e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Accent Color</label>
          <div className="flex gap-2">
            <input
              type="color"
              value={branding.accent_color || '#ffffff'}
              onChange={(e) => updateBranding('accent_color', e.target.value)}
              className="w-16 h-10 border border-gray-300 rounded-lg cursor-pointer"
            />
            <input
              type="text"
              value={branding.accent_color || '#ffffff'}
              onChange={(e) => updateBranding('accent_color', e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Font Family</label>
          <select
            value={branding.font_family || 'Inter'}
            onChange={(e) => updateBranding('font_family', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500"
          >
            <option value="Inter">Inter</option>
            <option value="Roboto">Roboto</option>
            <option value="Open Sans">Open Sans</option>
            <option value="Lato">Lato</option>
            <option value="Montserrat">Montserrat</option>
          </select>
        </div>
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium text-gray-900 mb-2">Preview</h3>
        <div 
          className="p-6 rounded-lg" 
          style={{ 
            backgroundColor: branding.primary_color,
            color: branding.accent_color,
            fontFamily: branding.font_family
          }}
        >
          <h4 className="text-2xl font-bold mb-2">{tenant.company_name}</h4>
          <p>Sample branded content preview</p>
        </div>
      </div>
    </div>
  )
}

function ProductsTab({ tenantId, tenant }: any) {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProducts()
  }, [tenantId])

  const fetchProducts = async () => {
    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}/products`)
      const data = await response.json()
      setProducts(data.products || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  const syncProducts = async () => {
    try {
      await fetch(`/api/admin/tenants/${tenantId}/products/sync`, { method: 'POST' })
      fetchProducts()
      alert('Products synced successfully!')
    } catch (error) {
      console.error('Error syncing products:', error)
      alert('Failed to sync products')
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">Product Catalog</h2>
        <button
          onClick={syncProducts}
          className="px-4 py-2 bg-lime-500 text-black rounded-lg font-medium hover:bg-lime-400"
        >
          Sync Products
        </button>
      </div>

      <div className="mb-4">
        <p className="text-sm text-gray-600">
          Markup: <strong>{tenant.product_markup_percentage}%</strong>
        </p>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading products...</div>
      ) : (
        <div className="divide-y divide-gray-200">
          {products.map((product) => (
            <div key={product.id} className="py-4 flex justify-between items-center">
              <div>
                <h3 className="font-medium text-gray-900">{product.name}</h3>
                <p className="text-sm text-gray-600">{product.category}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500 line-through">R{product.base_price}</p>
                <p className="font-bold text-lime-600">R{product.final_price}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CustomersTab({ tenantId }: any) {
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCustomers()
  }, [tenantId])

  const fetchCustomers = async () => {
    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}/customers`)
      const data = await response.json()
      setCustomers(data.customers || [])
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Customer Management</h2>

      {loading ? (
        <div className="text-center py-8">Loading customers...</div>
      ) : customers.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No customers yet</div>
      ) : (
        <div className="divide-y divide-gray-200">
          {customers.map((customer) => (
            <div key={customer.id} className="py-4">
              <h3 className="font-medium text-gray-900">{customer.full_name}</h3>
              <p className="text-sm text-gray-600">{customer.email}</p>
              <p className="text-sm text-gray-500">
                {customer.total_orders} orders • R{customer.total_spent} spent
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ApiKeysTab({ tenantId }: any) {
  const [apiKeys, setApiKeys] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchApiKeys()
  }, [tenantId])

  const fetchApiKeys = async () => {
    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}/api-keys`)
      const data = await response.json()
      setApiKeys(data.apiKeys || [])
    } catch (error) {
      console.error('Error fetching API keys:', error)
    } finally {
      setLoading(false)
    }
  }

  const createApiKey = async () => {
    const keyName = prompt('Enter API key name:')
    if (!keyName) return

    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key_name: keyName }),
      })
      const data = await response.json()
      
      if (response.ok && data.key) {
        alert(`API Key Created!\n\nKey: ${data.key}\n\nSave this key securely, it won't be shown again.`)
        fetchApiKeys()
      }
    } catch (error) {
      console.error('Error creating API key:', error)
      alert('Failed to create API key')
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">API Keys</h2>
        <button
          onClick={createApiKey}
          className="px-4 py-2 bg-lime-500 text-black rounded-lg font-medium hover:bg-lime-400"
        >
          Create API Key
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading API keys...</div>
      ) : apiKeys.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No API keys created</div>
      ) : (
        <div className="divide-y divide-gray-200">
          {apiKeys.map((key) => (
            <div key={key.id} className="py-4 flex justify-between items-center">
              <div>
                <h3 className="font-medium text-gray-900">{key.key_name}</h3>
                <p className="text-sm text-gray-600">{key.key_prefix}...</p>
                <p className="text-xs text-gray-500">
                  Used {key.usage_count} times • Last used: {key.last_used_at ? new Date(key.last_used_at).toLocaleString() : 'Never'}
                </p>
              </div>
              <div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  key.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {key.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function UsageTab({ tenantId }: any) {
  const [usage, setUsage] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUsage()
  }, [tenantId])

  const fetchUsage = async () => {
    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}/usage`)
      const data = await response.json()
      setUsage(data.usage || [])
    } catch (error) {
      console.error('Error fetching usage:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Usage Metrics</h2>

      {loading ? (
        <div className="text-center py-8">Loading usage data...</div>
      ) : usage.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No usage data yet</div>
      ) : (
        <div className="space-y-4">
          {usage.map((metric) => (
            <div key={metric.id} className="p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-medium text-gray-900">{metric.metric_date}</h3>
                <span className="text-sm text-gray-600">Est. Cost: R{metric.estimated_cost}</span>
              </div>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">API Calls</p>
                  <p className="font-medium">{metric.api_calls}</p>
                </div>
                <div>
                  <p className="text-gray-600">Agent Actions</p>
                  <p className="font-medium">{metric.agent_actions}</p>
                </div>
                <div>
                  <p className="text-gray-600">Orders</p>
                  <p className="font-medium">{metric.orders_processed}</p>
                </div>
                <div>
                  <p className="text-gray-600">Customers</p>
                  <p className="font-medium">{metric.customers_managed}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
