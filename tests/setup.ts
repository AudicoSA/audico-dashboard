import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  process.env.ANTHROPIC_API_KEY = 'test-anthropic-key'
  process.env.GOOGLE_ADS_CLIENT_ID = 'test-client-id'
  process.env.GOOGLE_ADS_CLIENT_SECRET = 'test-client-secret'
  process.env.GOOGLE_ADS_DEVELOPER_TOKEN = 'test-developer-token'
  process.env.GOOGLE_ADS_CUSTOMER_ID = 'test-customer-id'
  process.env.GOOGLE_ADS_REFRESH_TOKEN = 'test-refresh-token'
  process.env.GOOGLE_PLACES_API_KEY = 'test-places-key'
  process.env.GOOGLE_CLOUD_PROJECT_ID = 'test-project'
  process.env.OPENCART_DB_HOST = 'localhost'
  process.env.OPENCART_DB_PORT = '3306'
  process.env.OPENCART_DB_USER = 'test'
  process.env.OPENCART_DB_PASSWORD = 'test'
  process.env.OPENCART_DB_NAME = 'test_db'
})

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

afterAll(() => {
  vi.clearAllTimers()
})
