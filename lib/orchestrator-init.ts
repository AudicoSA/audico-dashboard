import orchestrator from '@/services/orchestrator'

let isInitialized = false

export async function initializeOrchestrator() {
  if (isInitialized) {
    console.log('Orchestrator already initialized')
    return
  }

  try {
    await orchestrator.initialize()
    isInitialized = true
    console.log('Orchestrator initialized successfully')
  } catch (error) {
    console.error('Failed to initialize orchestrator:', error)
    throw error
  }
}

export async function shutdownOrchestrator() {
  if (!isInitialized) {
    console.log('Orchestrator not initialized')
    return
  }

  try {
    await orchestrator.shutdown()
    isInitialized = false
    console.log('Orchestrator shutdown successfully')
  } catch (error) {
    console.error('Failed to shutdown orchestrator:', error)
    throw error
  }
}

export function getOrchestratorInstance() {
  return orchestrator
}

export function isOrchestratorInitialized() {
  return isInitialized
}
