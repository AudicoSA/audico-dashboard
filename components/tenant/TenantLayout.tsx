'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface TenantLayoutProps {
  children: React.ReactNode
}

export default function TenantLayout({ children }: TenantLayoutProps) {
  const searchParams = useSearchParams()
  const tenantSlug = searchParams.get('tenant')
  const [tenant, setTenant] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (tenantSlug) {
      fetchTenant()
    }
  }, [tenantSlug])

  const fetchTenant = async () => {
    try {
      const response = await fetch(`/api/tenant/context?tenant=${tenantSlug}`)
      const data = await response.json()
      setTenant(data.tenant)
      
      if (data.tenant) {
        applyBranding(data.tenant.branding_config)
      }
    } catch (error) {
      console.error('Error fetching tenant:', error)
    } finally {
      setLoading(false)
    }
  }

  const applyBranding = (branding: any) => {
    if (!branding) return

    document.documentElement.style.setProperty('--tenant-primary', branding.primary_color || '#84cc16')
    document.documentElement.style.setProperty('--tenant-secondary', branding.secondary_color || '#000000')
    document.documentElement.style.setProperty('--tenant-accent', branding.accent_color || '#ffffff')
    
    if (branding.favicon_url) {
      const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement || document.createElement('link')
      link.type = 'image/x-icon'
      link.rel = 'shortcut icon'
      link.href = branding.favicon_url
      document.getElementsByTagName('head')[0].appendChild(link)
    }
    
    if (branding.font_family) {
      document.body.style.fontFamily = branding.font_family
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-8 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href={`/tenant?tenant=${tenantSlug}`} className="flex items-center gap-3">
            {tenant.branding_config?.logo_url && (
              <img src={tenant.branding_config.logo_url} alt="Logo" className="h-10" />
            )}
            <h1 className="text-2xl font-bold" style={{ color: primaryColor }}>
              {tenant.company_name}
            </h1>
          </Link>
          
          <nav className="flex gap-6">
            {tenant.features_enabled?.dashboard && (
              <Link 
                href={`/tenant?tenant=${tenantSlug}`} 
                className="text-gray-700 hover:text-gray-900 font-medium"
              >
                Dashboard
              </Link>
            )}
            {tenant.features_enabled?.products && (
              <Link 
                href={`/tenant/products?tenant=${tenantSlug}`} 
                className="text-gray-700 hover:text-gray-900 font-medium"
              >
                Products
              </Link>
            )}
            {tenant.features_enabled?.customers && (
              <Link 
                href={`/tenant/customers?tenant=${tenantSlug}`} 
                className="text-gray-700 hover:text-gray-900 font-medium"
              >
                Customers
              </Link>
            )}
            <Link 
              href={`/tenant/settings?tenant=${tenantSlug}`} 
              className="text-gray-700 hover:text-gray-900 font-medium"
            >
              Settings
            </Link>
          </nav>
        </div>
      </header>
      
      <main>
        {children}
      </main>
      
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              © {new Date().getFullYear()} {tenant.company_name}. All rights reserved.
            </p>
            <p className="text-sm text-gray-500">
              Powered by Mission Control
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
