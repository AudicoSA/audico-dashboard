'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Package, Users, ShoppingCart, TrendingUp, Settings } from 'lucide-react'

export default function TenantDashboardPage() {
  const searchParams = useSearchParams()
  const tenantSlug = searchParams.get('tenant')
  const [tenant, setTenant] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (tenantSlug) {
      fetchTenantData()
    }
  }, [tenantSlug])

  const fetchTenantData = async () => {
    try {
      const response = await fetch(`/api/tenant/context?tenant=${tenantSlug}`)
      const data = await response.json()
      setTenant(data.tenant)
      
      const statsResponse = await fetch(`/api/tenant/stats?tenant=${tenantSlug}`)
      const statsData = await statsResponse.json()
      setStats(statsData.stats)
    } catch (error) {
      console.error('Error fetching tenant data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Tenant Not Found</h1>
          <p className="text-gray-600">The requested tenant does not exist or is not active.</p>
        </div>
      </div>
    )
  }

  const primaryColor = tenant.branding_config?.primary_color || '#84cc16'
  const fontFamily = tenant.branding_config?.font_family || 'Inter'

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily }}>
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            {tenant.branding_config?.logo_url && (
              <img src={tenant.branding_config.logo_url} alt="Logo" className="h-10" />
            )}
            <h1 className="text-2xl font-bold" style={{ color: primaryColor }}>
              {tenant.company_name}
            </h1>
          </div>
          <nav className="flex gap-6">
            <Link href={`/tenant/dashboard?tenant=${tenantSlug}`} className="text-gray-700 hover:text-gray-900">
              Dashboard
            </Link>
            <Link href={`/tenant/products?tenant=${tenantSlug}`} className="text-gray-700 hover:text-gray-900">
              Products
            </Link>
            <Link href={`/tenant/customers?tenant=${tenantSlug}`} className="text-gray-700 hover:text-gray-900">
              Customers
            </Link>
            <Link href={`/tenant/settings?tenant=${tenantSlug}`} className="text-gray-700 hover:text-gray-900">
              Settings
            </Link>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome to your Mission Control</h2>
          <p className="text-gray-600">Manage your business operations powered by AI agents</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard 
            title="Products" 
            value={stats?.products_count || 0} 
            icon={Package} 
            color={primaryColor}
          />
          <StatCard 
            title="Customers" 
            value={stats?.customers_count || 0} 
            icon={Users} 
            color={primaryColor}
          />
          <StatCard 
            title="Orders" 
            value={stats?.orders_count || 0} 
            icon={ShoppingCart} 
            color={primaryColor}
          />
          <StatCard 
            title="Revenue" 
            value={`R${stats?.total_revenue || 0}`} 
            icon={TrendingUp} 
            color={primaryColor}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Link
                href={`/tenant/products?tenant=${tenantSlug}`}
                className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Package size={24} style={{ color: primaryColor }} />
                  <div>
                    <h4 className="font-medium text-gray-900">Manage Products</h4>
                    <p className="text-sm text-gray-600">View and configure your product catalog</p>
                  </div>
                </div>
              </Link>
              <Link
                href={`/tenant/customers?tenant=${tenantSlug}`}
                className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Users size={24} style={{ color: primaryColor }} />
                  <div>
                    <h4 className="font-medium text-gray-900">Customer Management</h4>
                    <p className="text-sm text-gray-600">View and manage your customers</p>
                  </div>
                </div>
              </Link>
              <Link
                href={`/tenant/settings?tenant=${tenantSlug}`}
                className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Settings size={24} style={{ color: primaryColor }} />
                  <div>
                    <h4 className="font-medium text-gray-900">Settings</h4>
                    <p className="text-sm text-gray-600">Configure branding and preferences</p>
                  </div>
                </div>
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Active Features</h3>
            <div className="space-y-2">
              {Object.entries(tenant.features_enabled || {}).map(([feature, enabled]: any) => (
                <div key={feature} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">
                    {feature.replace(/_/g, ' ').toUpperCase()}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon: Icon, color }: any) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-600 text-sm font-medium">{title}</h3>
        <Icon size={24} style={{ color }} />
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
    </div>
  )
}
