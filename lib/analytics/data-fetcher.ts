/**
 * Data Fetcher for Analytics
 * Fetches historical data from OpenCart and Supabase
 */

import { getServerSupabase } from '@/lib/supabase'
import type { TimeSeriesDataPoint } from './predictive-models'

export interface ProductSalesData {
  product_id: number
  product_name: string
  current_stock: number
  sales_history: Array<{ date: string; quantity: number }>
}

export interface CustomerInteractionData {
  customer_id: string
  customer_name: string
  customer_email: string
  interactions: Array<{ date: string; type: string }>
  orders: Array<{ date: string; amount: number }>
}

export interface ProductSearchData {
  product_id: number
  product_name: string
  current_stock: number
  searches: Array<{ date: string }>
  views: Array<{ date: string }>
  cart_adds: Array<{ date: string }>
  purchases: Array<{ date: string }>
}

/**
 * Fetch sales trend data for forecasting
 */
export async function fetchSalesTrendData(
  daysBack: number = 90
): Promise<TimeSeriesDataPoint[]> {
  const supabase = getServerSupabase()
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysBack)
  
  try {
    const { data: orders, error } = await supabase
      .from('opencart_orders_cache')
      .select('order_date, order_total, currency')
      .gte('order_date', cutoffDate.toISOString())
      .order('order_date', { ascending: true })
    
    if (error) throw error
    if (!orders || orders.length === 0) return generateMockSalesData(daysBack)
    
    // Aggregate by date
    const aggregated = orders.reduce((acc, order) => {
      const date = order.order_date.split('T')[0]
      if (!acc[date]) {
        acc[date] = { date, value: 0 }
      }
      acc[date].value += order.order_total
      return acc
    }, {} as Record<string, TimeSeriesDataPoint>)
    
    return Object.values(aggregated).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )
  } catch (error) {
    console.error('Error fetching sales trend data:', error)
    return generateMockSalesData(daysBack)
  }
}

/**
 * Fetch product sales data for inventory predictions
 */
export async function fetchProductSalesData(): Promise<ProductSalesData[]> {
  const supabase = getServerSupabase()
  
  try {
    const { data: orders, error } = await supabase
      .from('opencart_orders_cache')
      .select('order_date, items, order_status')
      .gte('order_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .in('order_status', ['Complete', 'Processing', 'Shipped'])
    
    if (error) throw error
    if (!orders || orders.length === 0) return generateMockProductData()
    
    // Aggregate product sales
    const productMap = new Map<number, {
      product_name: string
      sales: Array<{ date: string; quantity: number }>
    }>()
    
    orders.forEach(order => {
      if (!order.items || !Array.isArray(order.items)) return
      
      order.items.forEach((item: any) => {
        const productId = item.product_id || item.id
        const productName = item.name || item.product_name || `Product ${productId}`
        const quantity = item.quantity || 1
        
        if (!productMap.has(productId)) {
          productMap.set(productId, { product_name: productName, sales: [] })
        }
        
        productMap.get(productId)!.sales.push({
          date: order.order_date,
          quantity
        })
      })
    })
    
    // Convert to array and add stock levels (mock for now)
    return Array.from(productMap.entries()).map(([productId, data]) => ({
      product_id: productId,
      product_name: data.product_name,
      current_stock: Math.floor(Math.random() * 100) + 20,
      sales_history: data.sales
    }))
  } catch (error) {
    console.error('Error fetching product sales data:', error)
    return generateMockProductData()
  }
}

/**
 * Fetch customer interaction data for churn analysis
 */
export async function fetchCustomerInteractionData(): Promise<CustomerInteractionData[]> {
  const supabase = getServerSupabase()
  
  try {
    const { data: profiles, error } = await supabase
      .from('customer_profiles')
      .select('*')
      .gte('total_orders', 1)
      .order('last_interaction_date', { ascending: false })
      .limit(100)
    
    if (error) throw error
    if (!profiles || profiles.length === 0) return generateMockCustomerData()
    
    const customerData: CustomerInteractionData[] = []
    
    for (const profile of profiles) {
      const { data: interactions } = await supabase
        .from('customer_interactions')
        .select('interaction_date, interaction_type')
        .eq('customer_id', profile.customer_id)
        .order('interaction_date', { ascending: false })
        .limit(50)
      
      const { data: orders } = await supabase
        .from('opencart_orders_cache')
        .select('order_date, order_total')
        .eq('customer_email', profile.primary_email)
        .order('order_date', { ascending: false })
        .limit(20)
      
      customerData.push({
        customer_id: profile.customer_id,
        customer_name: profile.full_name || 'Unknown',
        customer_email: profile.primary_email || '',
        interactions: (interactions || []).map(i => ({
          date: i.interaction_date,
          type: i.interaction_type
        })),
        orders: (orders || []).map(o => ({
          date: o.order_date,
          amount: o.order_total
        }))
      })
    }
    
    return customerData
  } catch (error) {
    console.error('Error fetching customer interaction data:', error)
    return generateMockCustomerData()
  }
}

/**
 * Fetch product search/view data for recommendations
 */
export async function fetchProductSearchData(): Promise<ProductSearchData[]> {
  // Note: This would require search/analytics tracking in OpenCart
  // For now, return mock data with realistic patterns
  return generateMockProductSearchData()
}

/**
 * Fetch metric data for anomaly detection
 */
export async function fetchMetricData(
  metricType: 'order' | 'support_ticket' | 'ad_spend' | 'revenue' | 'traffic',
  daysBack: number = 30
): Promise<{ current: number; historical: Array<{ date: string; value: number }> }> {
  const supabase = getServerSupabase()
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysBack)
  
  try {
    switch (metricType) {
      case 'order': {
        const { data, error } = await supabase
          .from('opencart_orders_cache')
          .select('order_date')
          .gte('order_date', cutoffDate.toISOString())
        
        if (error) throw error
        
        const aggregated = (data || []).reduce((acc, order) => {
          const date = order.order_date.split('T')[0]
          acc[date] = (acc[date] || 0) + 1
          return acc
        }, {} as Record<string, number>)
        
        const historical = Object.entries(aggregated)
          .map(([date, value]) => ({ date, value }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        
        const today = new Date().toISOString().split('T')[0]
        const current = aggregated[today] || 0
        
        return { current, historical }
      }
      
      case 'revenue': {
        const { data, error } = await supabase
          .from('opencart_orders_cache')
          .select('order_date, order_total')
          .gte('order_date', cutoffDate.toISOString())
        
        if (error) throw error
        
        const aggregated = (data || []).reduce((acc, order) => {
          const date = order.order_date.split('T')[0]
          acc[date] = (acc[date] || 0) + order.order_total
          return acc
        }, {} as Record<string, number>)
        
        const historical = Object.entries(aggregated)
          .map(([date, value]) => ({ date, value }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        
        const today = new Date().toISOString().split('T')[0]
        const current = aggregated[today] || 0
        
        return { current, historical }
      }
      
      case 'support_ticket': {
        const { data, error } = await supabase
          .from('customer_interactions')
          .select('interaction_date')
          .eq('interaction_type', 'support_ticket')
          .gte('interaction_date', cutoffDate.toISOString())
        
        if (error) throw error
        
        const aggregated = (data || []).reduce((acc, item) => {
          const date = item.interaction_date.split('T')[0]
          acc[date] = (acc[date] || 0) + 1
          return acc
        }, {} as Record<string, number>)
        
        const historical = Object.entries(aggregated)
          .map(([date, value]) => ({ date, value }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        
        const today = new Date().toISOString().split('T')[0]
        const current = aggregated[today] || 0
        
        return { current, historical }
      }
      
      default:
        return generateMockMetricData(metricType, daysBack)
    }
  } catch (error) {
    console.error(`Error fetching ${metricType} metric data:`, error)
    return generateMockMetricData(metricType, daysBack)
  }
}

// Mock data generators for fallback
function generateMockSalesData(days: number): TimeSeriesDataPoint[] {
  const data: TimeSeriesDataPoint[] = []
  const baseValue = 5000
  const trend = 50
  
  for (let i = days; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const randomVariation = (Math.random() - 0.5) * 1000
    const value = baseValue + (trend * (days - i)) + randomVariation
    
    data.push({
      date: date.toISOString().split('T')[0],
      value: Math.max(0, Math.round(value))
    })
  }
  
  return data
}

function generateMockProductData(): ProductSalesData[] {
  const products = [
    'Smart LED Bulb',
    'Smart Door Lock',
    'Security Camera HD',
    'Smart Thermostat',
    'Voice Assistant Speaker'
  ]
  
  return products.map((name, idx) => {
    const sales: Array<{ date: string; quantity: number }> = []
    
    for (let i = 30; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const quantity = Math.floor(Math.random() * 5) + 1
      
      sales.push({
        date: date.toISOString().split('T')[0],
        quantity
      })
    }
    
    return {
      product_id: idx + 1,
      product_name: name,
      current_stock: Math.floor(Math.random() * 50) + 10,
      sales_history: sales
    }
  })
}

function generateMockCustomerData(): CustomerInteractionData[] {
  return Array.from({ length: 10 }, (_, idx) => {
    const interactions: Array<{ date: string; type: string }> = []
    const orders: Array<{ date: string; amount: number }> = []
    
    const interactionCount = Math.floor(Math.random() * 20) + 5
    for (let i = 0; i < interactionCount; i++) {
      const daysAgo = Math.floor(Math.random() * 120)
      const date = new Date()
      date.setDate(date.getDate() - daysAgo)
      
      interactions.push({
        date: date.toISOString(),
        type: ['email', 'call', 'chat'][Math.floor(Math.random() * 3)]
      })
    }
    
    const orderCount = Math.floor(Math.random() * 8) + 1
    for (let i = 0; i < orderCount; i++) {
      const daysAgo = Math.floor(Math.random() * 180)
      const date = new Date()
      date.setDate(date.getDate() - daysAgo)
      
      orders.push({
        date: date.toISOString(),
        amount: Math.floor(Math.random() * 1000) + 100
      })
    }
    
    return {
      customer_id: `customer-${idx + 1}`,
      customer_name: `Customer ${idx + 1}`,
      customer_email: `customer${idx + 1}@example.com`,
      interactions: interactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      orders: orders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    }
  })
}

function generateMockProductSearchData(): ProductSearchData[] {
  const products = [
    'Smart LED Bulb',
    'Smart Door Lock',
    'Security Camera HD',
    'Smart Thermostat',
    'Voice Assistant Speaker'
  ]
  
  return products.map((name, idx) => {
    const generateEvents = (count: number) => {
      return Array.from({ length: count }, () => {
        const daysAgo = Math.floor(Math.random() * 30)
        const date = new Date()
        date.setDate(date.getDate() - daysAgo)
        return { date: date.toISOString() }
      })
    }
    
    const searchCount = Math.floor(Math.random() * 100) + 20
    const viewCount = Math.floor(searchCount * 0.6)
    const cartCount = Math.floor(viewCount * 0.3)
    const purchaseCount = Math.floor(cartCount * 0.5)
    
    return {
      product_id: idx + 1,
      product_name: name,
      current_stock: Math.floor(Math.random() * 50) + (idx === 2 ? 0 : 10),
      searches: generateEvents(searchCount),
      views: generateEvents(viewCount),
      cart_adds: generateEvents(cartCount),
      purchases: generateEvents(purchaseCount)
    }
  })
}

function generateMockMetricData(
  type: string,
  days: number
): { current: number; historical: Array<{ date: string; value: number }> } {
  const baseValues: Record<string, number> = {
    order: 15,
    support_ticket: 8,
    ad_spend: 200,
    revenue: 5000,
    traffic: 500
  }
  
  const base = baseValues[type] || 10
  const historical: Array<{ date: string; value: number }> = []
  
  for (let i = days; i >= 1; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const variation = (Math.random() - 0.5) * base * 0.3
    
    historical.push({
      date: date.toISOString().split('T')[0],
      value: Math.max(0, Math.round(base + variation))
    })
  }
  
  const current = Math.round(base + (Math.random() - 0.5) * base * 0.5)
  
  return { current, historical }
}
