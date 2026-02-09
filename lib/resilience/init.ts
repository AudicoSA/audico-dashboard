import { initializeResilience } from './index'

let initialized = false

export function ensureResilienceInitialized(): void {
  if (!initialized) {
    initializeResilience()
    initialized = true
    console.log('✓ Resilience layer initialized for all services')
  }
}

if (typeof window === 'undefined') {
  ensureResilienceInitialized()
}
