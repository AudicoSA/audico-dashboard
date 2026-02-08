import { checkSupabaseHealth, verifySupabaseTables } from '../lib/supabase-health'

const REQUIRED_TABLES = [
  'squad_messages',
  'email_logs',
  'email_classifications',
  'price_change_queue',
  'agent_logs',
]

async function main() {
  console.log('🔍 Checking Supabase connectivity...')

  const healthCheck = await checkSupabaseHealth()
  
  if (!healthCheck.healthy) {
    console.error('❌ Supabase health check failed:', healthCheck.message)
    if (healthCheck.details?.error) {
      console.error('   Error:', healthCheck.details.error)
    }
    process.exit(1)
  }

  console.log('✅ Supabase connection successful')
  console.log(`   Latency: ${healthCheck.details?.latency}ms`)

  console.log('\n🔍 Verifying required tables...')
  
  const tableCheck = await verifySupabaseTables(REQUIRED_TABLES)
  
  if (!tableCheck.healthy) {
    console.error('❌ Table verification failed:', tableCheck.message)
    if (tableCheck.details?.error) {
      console.error('   Error:', tableCheck.details.error)
    }
    process.exit(1)
  }

  console.log('✅ All required tables exist')
  console.log('\n✅ Pre-deployment checks passed!')
  process.exit(0)
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error)
  process.exit(1)
})
