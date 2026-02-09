'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Package, Search } from 'lucide-react'

export default function TenantProductsPage() {
  const searchParams = useSearchParams()
  const tenantSlug = searchParams.get('tenant')
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (tenantSlug) {
      fetchProducts()
    }
  }, [tenantSlug])

  const fetchProducts = async () => {
    try {
      const response = await fetch(`/api/tenant/products?tenant=${tenantSlug}`)
      const data = await response.json()
      setProducts(data.products || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Product Catalog</h1>
          <p className="text-gray-600">Browse and manage available products</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading products...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center">
              <Package size={64} className="mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 text-lg">No products found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
              {filteredProducts.map((product) => (
                <div key={product.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
                  <div className="flex flex-col h-full">
                    <div className="mb-4">
                      <h3 className="font-bold text-lg text-gray-900 mb-1">{product.name}</h3>
                      <p className="text-sm text-gray-600 mb-2">{product.category}</p>
                      <p className="text-sm text-gray-700 line-clamp-3">{product.description}</p>
                    </div>
                    <div className="mt-auto">
                      <div className="flex items-baseline gap-2 mb-2">
                        {product.base_price !== product.final_price && (
                          <span className="text-sm text-gray-500 line-through">R{product.base_price}</span>
                        )}
                        <span className="text-2xl font-bold text-lime-600">R{product.final_price}</span>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium inline-block ${
                        product.is_available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {product.is_available ? 'Available' : 'Out of Stock'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
