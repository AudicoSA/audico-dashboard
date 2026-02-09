import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const supabase = getServerSupabase()

  try {
    const authHeader = request.headers.get('authorization')
    const webhookSecret = process.env.TIMELINE_WEBHOOK_SECRET

    if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await request.json()
    const { type, data } = payload

    switch (type) {
      case 'quote_session_update': {
        const {
          session_id,
          customer_name,
          customer_email,
          customer_phone,
          company_name,
          status,
          total_amount,
          currency,
          quote_items,
          created_at,
          last_activity_at,
          metadata,
        } = data

        const res = await fetch(`${request.nextUrl.origin}/api/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sync_quote_session',
            data: {
              session_id,
              customer_name,
              customer_email,
              customer_phone,
              company_name,
              status,
              total_amount,
              currency,
              quote_items,
              created_at,
              last_activity_at,
              metadata,
            },
          }),
        })

        const result = await res.json()

        return NextResponse.json({
          success: true,
          message: 'Quote session synced to timeline',
          ...result,
        })
      }

      case 'social_interaction': {
        const {
          platform,
          interaction_type,
          customer_name,
          customer_email,
          customer_handle,
          customer_id,
          content,
          sentiment,
          post_url,
          requires_response,
          interaction_date,
          metadata,
        } = data

        const res = await fetch(`${request.nextUrl.origin}/api/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sync_social_interaction',
            data: {
              platform,
              interaction_type,
              customer_name,
              customer_email,
              customer_handle,
              customer_id,
              content,
              sentiment,
              post_url,
              requires_response,
              interaction_date,
              metadata,
            },
          }),
        })

        const result = await res.json()

        return NextResponse.json({
          success: true,
          message: 'Social interaction synced to timeline',
          ...result,
        })
      }

      case 'opencart_order': {
        const {
          order_id,
          customer_id,
          customer_name,
          customer_email,
          customer_phone,
          order_status,
          order_total,
          currency,
          payment_method,
          shipping_method,
          items,
          shipping_address,
          order_date,
        } = data

        const res = await fetch(`${request.nextUrl.origin}/api/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sync_opencart_order',
            data: {
              order_id,
              customer_id,
              customer_name,
              customer_email,
              customer_phone,
              order_status,
              order_total,
              currency,
              payment_method,
              shipping_method,
              items,
              shipping_address,
              order_date,
            },
          }),
        })

        const result = await res.json()

        return NextResponse.json({
          success: true,
          message: 'Order synced to timeline',
          ...result,
        })
      }

      case 'email_thread': {
        const {
          email_id,
          from_email,
          from_name,
          subject,
          body,
          category,
          status,
          sentiment,
          created_at,
          metadata,
        } = data

        const res = await fetch(`${request.nextUrl.origin}/api/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sync_email_thread',
            data: {
              email_id,
              from_email,
              from_name,
              subject,
              body,
              category,
              status,
              sentiment,
              created_at,
              metadata,
            },
          }),
        })

        const result = await res.json()

        return NextResponse.json({
          success: true,
          message: 'Email thread synced to timeline',
          ...result,
        })
      }

      default:
        return NextResponse.json(
          { error: 'Unknown webhook type' },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error('Timeline webhook error:', error)
    return NextResponse.json(
      { error: 'Failed to process webhook', details: error.message },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Timeline webhook endpoint',
    supported_types: [
      'quote_session_update',
      'social_interaction',
      'opencart_order',
      'email_thread',
    ],
  })
}
