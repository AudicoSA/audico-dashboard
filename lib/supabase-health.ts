import { createClient } from '@supabase/supabase-js'

export interface HealthCheckResult {
  healthy: boolean
  message: string
  details?: {
    latency?: number
    error?: string
    timestamp: string
  }
}

export async function checkSupabaseHealth(): Promise<HealthCheckResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return {
      healthy: false,
      message: 'Missing Supabase configuration',
      details: {
        error: 'NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set',
        timestamp: new Date().toISOString(),
      },
    }
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey)
    const startTime = Date.now()

    const { data, error } = await supabase
      .from('squad_messages')
      .select('id')
      .limit(1)

    const latency = Date.now() - startTime

    if (error) {
      return {
        healthy: false,
        message: 'Supabase query failed',
        details: {
          error: error.message,
          latency,
          timestamp: new Date().toISOString(),
        },
      }
    }

    return {
      healthy: true,
      message: 'Supabase connection successful',
      details: {
        latency,
        timestamp: new Date().toISOString(),
      },
    }
  } catch (error: any) {
    return {
      healthy: false,
      message: 'Supabase connection error',
      details: {
        error: error.message || 'Unknown error',
        timestamp: new Date().toISOString(),
      },
    }
  }
}

export async function verifySupabaseTables(
  requiredTables: string[]
): Promise<HealthCheckResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return {
      healthy: false,
      message: 'Missing Supabase configuration',
      details: {
        error: 'Environment variables not set',
        timestamp: new Date().toISOString(),
      },
    }
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey)
    const missingTables: string[] = []

    for (const table of requiredTables) {
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(1)

      if (error) {
        missingTables.push(table)
      }
    }

    if (missingTables.length > 0) {
      return {
        healthy: false,
        message: 'Required tables not found',
        details: {
          error: `Missing tables: ${missingTables.join(', ')}`,
          timestamp: new Date().toISOString(),
        },
      }
    }

    return {
      healthy: true,
      message: 'All required tables exist',
      details: {
        timestamp: new Date().toISOString(),
      },
    }
  } catch (error: any) {
    return {
      healthy: false,
      message: 'Table verification failed',
      details: {
        error: error.message || 'Unknown error',
        timestamp: new Date().toISOString(),
      },
    }
  }
}
