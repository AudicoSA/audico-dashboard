#!/usr/bin/env ts-node

import '../lib/resilience/init'
import { resilienceMonitoring, sendSlackAlert, sendEmailAlert } from '../lib/resilience/monitoring'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function runHealthCheck() {
  console.log('🏥 Running resilience health check...')

  resilienceMonitoring.configure({
    onCircuitOpen: async (serviceName) => {
      console.error(`🔴 Circuit breaker OPENED for ${serviceName}`)
      await sendSlackAlert(serviceName, `Circuit breaker has opened due to repeated failures`)
      await sendEmailAlert(serviceName, `Circuit breaker has opened. Service is currently unavailable.`)
    },
    onCircuitClosed: (serviceName) => {
      console.info(`🟢 Circuit breaker CLOSED for ${serviceName}`)
    },
    onHighErrorRate: async (serviceName, errorRate) => {
      console.warn(`⚠️  High error rate detected for ${serviceName}: ${errorRate.toFixed(1)}%`)
      if (errorRate > 75) {
        await sendSlackAlert(serviceName, `Critical error rate: ${errorRate.toFixed(1)}%`)
      }
    },
    onDegradation: (serviceName) => {
      console.info(`🔄 Degradation strategy active for ${serviceName}`)
    }
  })

  const summary = resilienceMonitoring.getHealthSummary()
  
  console.log('\n📊 Health Summary:')
  console.log(`Overall Status: ${summary.overall}`)
  console.log('\nServices:')
  summary.services.forEach(service => {
    const icon = service.status === 'Healthy' ? '✓' : '✕'
    console.log(`  ${icon} ${service.name}: ${service.status} (${service.state})`)
  })

  if (summary.alerts.length > 0) {
    console.log('\n⚠️  Alerts:')
    summary.alerts.forEach(alert => {
      console.log(`  - ${alert}`)
    })
  }

  await resilienceMonitoring.logToSupabase(supabase)
  console.log('\n✓ Metrics logged to Supabase')

  if (summary.overall === 'Critical') {
    console.error('\n🚨 CRITICAL: Multiple services are unhealthy!')
    process.exit(1)
  }

  console.log('\n✓ Health check completed successfully')
}

runHealthCheck()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('Health check failed:', error)
    process.exit(1)
  })
