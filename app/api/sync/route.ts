import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const supabase = getServerSupabase()

  try {
    const body = await request.json()
    const { action, data } = body

    switch (action) {
      case 'sync_opencart_order': {
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

        const { data: order, error: orderError } = await supabase
          .from('opencart_orders_cache')
          .upsert(
            {
              order_id,
              customer_id,
              customer_name,
              customer_email,
              customer_phone,
              order_status,
              order_total,
              currency: currency || 'ZAR',
              payment_method,
              shipping_method,
              items: items || [],
              shipping_address: shipping_address || {},
              order_date,
              last_updated: new Date().toISOString(),
              metadata: {},
            },
            { onConflict: 'order_id' }
          )
          .select()
          .single()

        if (orderError) {
          console.error('Error syncing order:', orderError)
          return NextResponse.json(
            { error: 'Failed to sync order' },
            { status: 500 }
          )
        }

        const { error: interactionError } = await supabase
          .from('customer_interactions')
          .insert({
            customer_id: customer_email,
            customer_name,
            customer_email,
            customer_phone,
            interaction_type: 'order',
            interaction_source: 'opencart',
            interaction_date: order_date,
            subject: `Order #${order_id}`,
            summary: `${order_status} - ${currency} ${order_total}`,
            priority: 'medium',
            status: order_status === 'Complete' ? 'completed' : 'pending',
            reference_id: order_id.toString(),
            reference_type: 'opencart_order',
            details: {
              order_id,
              order_total,
              currency,
              items,
              payment_method,
            },
          })

        if (interactionError) {
          console.error('Error creating interaction:', interactionError)
        }

        const { error: profileError } = await supabase.rpc(
          'update_customer_profile_stats',
          { p_customer_id: customer_email }
        )

        if (profileError) {
          console.error('Error updating profile:', profileError)
        }

        return NextResponse.json({ success: true, order })
      }

      case 'sync_social_interaction': {
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

        const { data: interaction, error: socialError } = await supabase
          .from('social_interactions')
          .insert({
            platform,
            interaction_type,
            customer_name,
            customer_email,
            customer_handle,
            customer_id: customer_id || customer_email || customer_handle,
            content,
            sentiment,
            post_url,
            requires_response: requires_response || false,
            response_status: 'pending',
            interaction_date: interaction_date || new Date().toISOString(),
            metadata: metadata || {},
          })
          .select()
          .single()

        if (socialError) {
          console.error('Error syncing social interaction:', socialError)
          return NextResponse.json(
            { error: 'Failed to sync social interaction' },
            { status: 500 }
          )
        }

        const { error: interactionError } = await supabase
          .from('customer_interactions')
          .insert({
            customer_id: customer_id || customer_email || customer_handle,
            customer_name,
            customer_email,
            customer_phone: customer_handle,
            interaction_type: 'social',
            interaction_source: platform,
            interaction_date: interaction_date || new Date().toISOString(),
            subject: `${platform} ${interaction_type}`,
            summary: content,
            sentiment,
            priority: requires_response ? 'high' : 'low',
            status: requires_response ? 'follow_up_required' : 'completed',
            reference_id: interaction.id,
            reference_type: 'social_interaction',
            details: {
              platform,
              interaction_type,
              post_url,
              ...metadata,
            },
          })

        if (interactionError) {
          console.error('Error creating interaction:', interactionError)
        }

        if (customer_email) {
          const { error: profileError } = await supabase.rpc(
            'update_customer_profile_stats',
            { p_customer_id: customer_email }
          )

          if (profileError) {
            console.error('Error updating profile:', profileError)
          }
        }

        return NextResponse.json({ success: true, interaction })
      }

      case 'sync_call_to_timeline': {
        const { call_transcript_id } = data

        const { data: call, error: callError } = await supabase
          .from('call_transcripts')
          .select('*')
          .eq('id', call_transcript_id)
          .single()

        if (callError || !call) {
          return NextResponse.json(
            { error: 'Call transcript not found' },
            { status: 404 }
          )
        }

        const customerId = call.customer_email || call.customer_phone

        const { error: interactionError } = await supabase
          .from('customer_interactions')
          .upsert(
            {
              customer_id: customerId,
              customer_name: call.customer_name,
              customer_email: call.customer_email,
              customer_phone: call.customer_phone,
              interaction_type: 'call',
              interaction_source: 'audico-call-system',
              interaction_date: call.call_start_time,
              subject: call.customer_intent,
              summary: call.summary,
              sentiment: call.sentiment,
              outcome: call.call_outcome,
              priority: call.call_outcome === 'escalation' ? 'urgent' : 'medium',
              status:
                call.call_outcome === 'resolved'
                  ? 'completed'
                  : call.call_outcome === 'follow_up_needed'
                  ? 'follow_up_required'
                  : 'pending',
              reference_id: call.id,
              reference_type: 'call_transcript',
              details: {
                call_id: call.call_id,
                call_duration: call.call_duration,
                key_topics: call.key_topics,
                ...call.metadata,
              },
            },
            { onConflict: 'reference_id,reference_type' }
          )

        if (interactionError) {
          console.error('Error creating interaction:', interactionError)
          return NextResponse.json(
            { error: 'Failed to sync call to timeline' },
            { status: 500 }
          )
        }

        return NextResponse.json({ success: true })
      }

      case 'sync_quote_session': {
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

        const customerId = customer_email || customer_phone || session_id

        const { data: interaction, error: interactionError } = await supabase
          .from('customer_interactions')
          .upsert(
            {
              customer_id: customerId,
              customer_name: customer_name || null,
              customer_email: customer_email || null,
              customer_phone: customer_phone || null,
              interaction_type: 'chat',
              interaction_source: 'quote-chat',
              interaction_date: last_activity_at || created_at,
              subject: company_name ? `Quote request: ${company_name}` : 'Quote request',
              summary: `Quote session - ${status}`,
              priority: status === 'active' ? 'high' : 'medium',
              status: status === 'completed' || status === 'quote_sent' ? 'completed' : 'pending',
              reference_id: session_id,
              reference_type: 'quote_session',
              details: {
                session_id,
                company_name,
                total_amount,
                currency: currency || 'ZAR',
                quote_items: quote_items || [],
                session_status: status,
                ...metadata,
              },
            },
            { onConflict: 'reference_id,reference_type' }
          )
          .select()
          .single()

        if (interactionError) {
          console.error('Error syncing quote session:', interactionError)
          return NextResponse.json(
            { error: 'Failed to sync quote session' },
            { status: 500 }
          )
        }

        if (customer_email) {
          const { error: profileError } = await supabase.rpc(
            'update_customer_profile_stats',
            { p_customer_id: customer_email }
          )

          if (profileError) {
            console.error('Error updating profile:', profileError)
          }
        }

        return NextResponse.json({ success: true, interaction })
      }

      case 'sync_email_thread': {
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

        const { data: interaction, error: interactionError } = await supabase
          .from('customer_interactions')
          .upsert(
            {
              customer_id: from_email,
              customer_name: from_name || null,
              customer_email: from_email,
              customer_phone: null,
              interaction_type: 'email',
              interaction_source: 'gmail',
              interaction_date: created_at || new Date().toISOString(),
              subject: subject,
              summary: body?.substring(0, 500) || null,
              sentiment: sentiment || null,
              priority: category === 'complaint' || category === 'urgent' ? 'high' : 'medium',
              status: status === 'sent' ? 'completed' : 'pending',
              reference_id: email_id,
              reference_type: 'email_log',
              details: {
                email_id,
                category,
                status,
                ...metadata,
              },
            },
            { onConflict: 'reference_id,reference_type' }
          )
          .select()
          .single()

        if (interactionError) {
          console.error('Error syncing email:', interactionError)
          return NextResponse.json(
            { error: 'Failed to sync email' },
            { status: 500 }
          )
        }

        const { error: profileError } = await supabase.rpc(
          'update_customer_profile_stats',
          { p_customer_id: from_email }
        )

        if (profileError) {
          console.error('Error updating profile:', profileError)
        }

        return NextResponse.json({ success: true, interaction })
      }

      case 'bulk_update_profiles': {
        const { customer_ids } = data

        if (!Array.isArray(customer_ids) || customer_ids.length === 0) {
          return NextResponse.json(
            { error: 'customer_ids array is required' },
            { status: 400 }
          )
        }

        const results = []
        for (const customerId of customer_ids) {
          const { error } = await supabase.rpc('update_customer_profile_stats', {
            p_customer_id: customerId,
          })

          results.push({
            customer_id: customerId,
            success: !error,
            error: error?.message,
          })
        }

        return NextResponse.json({ success: true, results })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Sync API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
