import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateResellerOnboardingKit } from '@/services/workflows/visual-content-automation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    const { type, record } = payload

    if (type === 'INSERT' && record.status === 'active') {
      console.log('[Reseller Webhook] Generating onboarding kit for:', record.id)

      const result = await generateResellerOnboardingKit(record.id)

      if (result.success) {
        console.log('[Reseller Webhook] Onboarding kit generated:', result)

        const { error: updateError } = await supabase
          .from('approved_resellers')
          .update({
            metadata: {
              ...record.metadata,
              onboarding_kit_url: result.slide_deck_url,
              onboarding_kit_generated_at: new Date().toISOString(),
            },
          })
          .eq('id', record.id)

        if (updateError) {
          console.error('[Reseller Webhook] Error updating reseller metadata:', updateError)
        }

        return NextResponse.json({
          success: true,
          message: 'Onboarding kit generated successfully',
          result,
        })
      } else {
        console.error('[Reseller Webhook] Failed to generate onboarding kit:', result.error)
        return NextResponse.json(
          {
            success: false,
            error: result.error,
          },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      message: 'No action required',
    })
  } catch (error: any) {
    console.error('[Reseller Webhook] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    )
  }
}
