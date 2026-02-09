import { NextRequest, NextResponse } from 'next/server'
import {
  getCustomerTimeline,
  getCustomerProfile,
  searchCustomers,
  getRecentCustomers,
  getTopCustomersByLTV,
  getCustomersNeedingAttention,
  updateCustomerProfile,
} from '@/lib/customer-timeline'
import { getServerSupabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const action = searchParams.get('action') || 'timeline'
  const customerId = searchParams.get('customerId')
  const query = searchParams.get('query')

  try {
    switch (action) {
      case 'timeline': {
        if (!customerId) {
          return NextResponse.json(
            { error: 'customerId is required' },
            { status: 400 }
          )
        }

        const sources = searchParams.get('sources')?.split(',') as any
        const dateFrom = searchParams.get('dateFrom') || undefined
        const dateTo = searchParams.get('dateTo') || undefined
        const limit = searchParams.get('limit')
          ? parseInt(searchParams.get('limit')!)
          : undefined

        const timeline = await getCustomerTimeline(customerId, {
          sources,
          dateFrom,
          dateTo,
          limit,
        })

        return NextResponse.json({ timeline })
      }

      case 'profile': {
        if (!customerId) {
          return NextResponse.json(
            { error: 'customerId is required' },
            { status: 400 }
          )
        }

        const profile = await getCustomerProfile(customerId)

        if (!profile) {
          return NextResponse.json(
            { error: 'Customer profile not found' },
            { status: 404 }
          )
        }

        return NextResponse.json({ profile })
      }

      case 'search': {
        if (!query) {
          return NextResponse.json(
            { error: 'query is required' },
            { status: 400 }
          )
        }

        const customers = await searchCustomers(query)
        return NextResponse.json({ customers })
      }

      case 'recent': {
        const limit = searchParams.get('limit')
          ? parseInt(searchParams.get('limit')!)
          : 20

        const customers = await getRecentCustomers(limit)
        return NextResponse.json({ customers })
      }

      case 'top': {
        const limit = searchParams.get('limit')
          ? parseInt(searchParams.get('limit')!)
          : 10

        const customers = await getTopCustomersByLTV(limit)
        return NextResponse.json({ customers })
      }

      case 'attention': {
        const customers = await getCustomersNeedingAttention()
        return NextResponse.json({ customers })
      }

      case 'customer_details': {
        if (!customerId) {
          return NextResponse.json(
            { error: 'customerId is required' },
            { status: 400 }
          )
        }

        const supabase = getServerSupabase()
        const profile = await getCustomerProfile(customerId)

        const [callsResult, emailsResult, socialResult, ordersResult] = await Promise.all([
          supabase
            .from('call_transcripts')
            .select('*')
            .or(`customer_email.eq.${customerId},customer_phone.eq.${customerId}`)
            .order('call_start_time', { ascending: false })
            .limit(10),
          supabase
            .from('email_logs')
            .select('*')
            .eq('from_email', customerId)
            .order('created_at', { ascending: false })
            .limit(10),
          supabase
            .from('social_interactions')
            .select('*')
            .or(`customer_email.eq.${customerId},customer_handle.eq.${customerId}`)
            .order('interaction_date', { ascending: false })
            .limit(10),
          supabase
            .from('opencart_orders_cache')
            .select('*')
            .or(`customer_email.eq.${customerId},customer_phone.eq.${customerId}`)
            .order('order_date', { ascending: false })
            .limit(10),
        ])

        return NextResponse.json({
          profile: profile || null,
          calls: callsResult.data || [],
          emails: emailsResult.data || [],
          social: socialResult.data || [],
          orders: ordersResult.data || [],
        })
      }

      case 'email_threads': {
        if (!customerId) {
          return NextResponse.json(
            { error: 'customerId is required' },
            { status: 400 }
          )
        }

        const supabase = getServerSupabase()
        const { data, error } = await supabase
          .from('email_logs')
          .select('*')
          .eq('from_email', customerId)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Error fetching email threads:', error)
          return NextResponse.json(
            { error: 'Failed to fetch email threads' },
            { status: 500 }
          )
        }

        return NextResponse.json({ emails: data || [] })
      }

      case 'quote_sessions': {
        if (!customerId) {
          return NextResponse.json(
            { error: 'customerId is required' },
            { status: 400 }
          )
        }

        const supabase = getServerSupabase()
        const { data, error } = await supabase
          .from('customer_interactions')
          .select('*')
          .eq('interaction_type', 'chat')
          .or(`customer_email.eq.${customerId},customer_phone.eq.${customerId}`)
          .order('interaction_date', { ascending: false })

        if (error) {
          console.error('Error fetching quote sessions:', error)
          return NextResponse.json(
            { error: 'Failed to fetch quote sessions' },
            { status: 500 }
          )
        }

        return NextResponse.json({ sessions: data || [] })
      }

      case 'order_history': {
        if (!customerId) {
          return NextResponse.json(
            { error: 'customerId is required' },
            { status: 400 }
          )
        }

        const supabase = getServerSupabase()
        const { data, error } = await supabase
          .from('opencart_orders_cache')
          .select('*')
          .or(`customer_email.eq.${customerId},customer_phone.eq.${customerId}`)
          .order('order_date', { ascending: false })

        if (error) {
          console.error('Error fetching order history:', error)
          return NextResponse.json(
            { error: 'Failed to fetch order history' },
            { status: 500 }
          )
        }

        const totalSpent = data?.reduce((sum, order) => sum + Number(order.order_total), 0) || 0
        const orderCount = data?.length || 0
        const avgOrderValue = orderCount > 0 ? totalSpent / orderCount : 0

        return NextResponse.json({
          orders: data || [],
          stats: {
            total_orders: orderCount,
            total_spent: totalSpent,
            average_order_value: avgOrderValue,
          },
        })
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Timeline API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, customerId } = body

    switch (action) {
      case 'update_profile': {
        if (!customerId) {
          return NextResponse.json(
            { error: 'customerId is required' },
            { status: 400 }
          )
        }

        await updateCustomerProfile(customerId)

        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Timeline API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
