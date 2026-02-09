import { createClient } from '@supabase/supabase-js'

let testSupabase: ReturnType<typeof createClient> | null = null

export async function setupTestDatabase() {
  const supabaseUrl = process.env.TEST_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.TEST_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.warn('Test database credentials not configured. Using mock data only.')
    return
  }

  try {
    testSupabase = createClient(supabaseUrl, supabaseKey)

    await cleanupTestData()
    await seedTestData()

    console.log('Test database setup completed')
  } catch (error) {
    console.error('Failed to setup test database:', error)
    throw error
  }
}

export async function teardownTestDatabase() {
  if (!testSupabase) return

  try {
    await cleanupTestData()
    console.log('Test database teardown completed')
  } catch (error) {
    console.error('Failed to teardown test database:', error)
  }
}

export async function cleanupTestData() {
  if (!testSupabase) return

  const tables = [
    'squad_messages',
    'squad_tasks',
    'social_posts',
    'email_logs',
    'ad_campaigns',
    'seo_audits',
    'notebooklm_notebooks',
    'notebooklm_artifacts',
    'reseller_applications',
    'approved_resellers',
    'newsletter_drafts'
  ]

  for (const table of tables) {
    try {
      await testSupabase
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')
    } catch (error) {
      console.warn(`Failed to cleanup table ${table}:`, error)
    }
  }
}

export async function seedTestData() {
  if (!testSupabase) return

  try {
    await testSupabase.from('products').upsert([
      {
        id: 'test-prod-1',
        name: 'Test Smart LED Bulb',
        description: 'Test product for integration testing',
        price: 29.99,
        cost: 15.00,
        category: 'Lighting',
        brand: 'TestBrand',
        sku: 'TEST-LED-001'
      },
      {
        id: 'test-prod-2',
        name: 'Test Smart Lock',
        description: 'Test smart lock product',
        price: 149.99,
        cost: 80.00,
        category: 'Security',
        brand: 'TestBrand',
        sku: 'TEST-LOCK-001'
      }
    ] as any, { onConflict: 'id' })
  } catch (error) {
    console.warn('Failed to seed products:', error)
  }

  try {
    await testSupabase.from('squad_agents').upsert([
      {
        name: 'test_agent',
        display_name: 'Test Agent',
        description: 'Test agent for integration tests',
        status: 'idle',
        capabilities: ['testing'],
        last_active: new Date().toISOString()
      }
    ] as any, { onConflict: 'name' })
  } catch (error) {
    console.warn('Failed to seed squad_agents:', error)
  }
}

export function getTestSupabase() {
  return testSupabase
}
