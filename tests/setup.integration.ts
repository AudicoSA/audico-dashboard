import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { setupTestDatabase, teardownTestDatabase } from './helpers/database'

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.TEST_SUPABASE_URL || 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.TEST_SUPABASE_SERVICE_KEY || 'test-service-role-key'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY || 'test-anon-key'
  
  await setupTestDatabase()
})

beforeEach(async () => {
})

afterEach(async () => {
})

afterAll(async () => {
  await teardownTestDatabase()
})
