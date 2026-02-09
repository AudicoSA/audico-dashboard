'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'

export default function NewTenantPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    reseller_id: '',
    company_name: '',
    subdomain: '',
    plan_tier: 'basic',
    monthly_fee: 0,
    product_markup_percentage: 15,
    billing_status: 'trial',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const response = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        const data = await response.json()
        alert('Tenant created successfully!')
        router.push(`/admin-portal/tenants/${data.tenant.id}`)
      } else {
        const error = await response.json()
        alert(`Failed to create tenant: ${error.error}`)
      }
    } catch (error) {
      console.error('Error creating tenant:', error)
      alert('Failed to create tenant')
    } finally {
      setSaving(false)
    }
  }

  const updateField = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value })
  }

  const generateSubdomain = () => {
    if (formData.company_name) {
      const subdomain = formData.company_name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
      updateField('subdomain', subdomain)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link
            href="/admin-portal/tenants"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft size={20} />
            Back to Tenants
          </Link>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Tenant</h1>
          <p className="text-gray-600">Set up a white-label deployment for an approved reseller</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Tenant Information</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reseller ID (Optional)
                </label>
                <input
                  type="text"
                  value={formData.reseller_id}
                  onChange={(e) => updateField('reseller_id', e.target.value)}
                  placeholder="UUID of approved reseller"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Link to an existing reseller record or leave blank
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.company_name}
                  onChange={(e) => updateField('company_name', e.target.value)}
                  onBlur={generateSubdomain}
                  placeholder="Acme Corporation"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subdomain *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={formData.subdomain}
                    onChange={(e) => updateField('subdomain', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="acme"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500"
                  />
                  <span className="text-gray-600">.audico-platform.com</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Lowercase letters, numbers, and hyphens only
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Billing Configuration</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Plan Tier
                </label>
                <select
                  value={formData.plan_tier}
                  onChange={(e) => updateField('plan_tier', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500"
                >
                  <option value="basic">Basic</option>
                  <option value="professional">Professional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monthly Fee (ZAR)
                </label>
                <input
                  type="number"
                  value={formData.monthly_fee}
                  onChange={(e) => updateField('monthly_fee', parseFloat(e.target.value))}
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Markup %
                </label>
                <input
                  type="number"
                  value={formData.product_markup_percentage}
                  onChange={(e) => updateField('product_markup_percentage', parseFloat(e.target.value))}
                  min="0"
                  max="100"
                  step="0.1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Billing Status
                </label>
                <select
                  value={formData.billing_status}
                  onChange={(e) => updateField('billing_status', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500"
                >
                  <option value="trial">Trial</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-lime-500 text-black px-6 py-3 rounded-lg font-semibold hover:bg-lime-400 transition-colors disabled:opacity-50"
            >
              <Save size={20} />
              {saving ? 'Creating...' : 'Create Tenant'}
            </button>
            <Link
              href="/admin-portal/tenants"
              className="px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
