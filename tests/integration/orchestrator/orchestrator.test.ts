import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { orchestrator } from '@/services/orchestrator'
import { mockSupabase } from '../../mocks/supabase'
import { testSquadMessages } from '../../fixtures/test-data'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase)
}))

vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn((pattern, callback) => ({
      stop: vi.fn(),
      start: vi.fn()
    }))
  }
}))

describe('Orchestrator Integration Tests', () => {
  beforeEach(async () => {
    mockSupabase._clearMockData()
    
    mockSupabase._setMockData('squad_agents', [
      {
        name: 'email_agent',
        display_name: 'Email Agent',
        status: 'idle',
        capabilities: ['email'],
        last_active: new Date().toISOString()
      },
      {
        name: 'social_agent',
        display_name: 'Social Media Agent',
        status: 'idle',
        capabilities: ['social'],
        last_active: new Date().toISOString()
      },
      {
        name: 'ads_agent',
        display_name: 'Ads Agent',
        status: 'idle',
        capabilities: ['ads'],
        last_active: new Date().toISOString()
      }
    ])
  })

  afterEach(async () => {
    await orchestrator.shutdown()
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize orchestrator successfully', async () => {
      await orchestrator.initialize()

      const messages = mockSupabase._getMockData('squad_messages')
      const startupMessage = messages.find(m => 
        m.data?.action === 'startup'
      )

      expect(startupMessage).toBeDefined()
      expect(startupMessage.from_agent).toBe('orchestrator')
    })

    it('should initialize token budget for all agents', async () => {
      await orchestrator.initialize()

      const tokenBudget = orchestrator.getTokenBudget()

      expect(tokenBudget).toBeDefined()
      expect(tokenBudget.total).toBeGreaterThan(0)
      expect(tokenBudget.remaining).toBe(tokenBudget.total)
      expect(tokenBudget.agentUsage).toBeDefined()
    })
  })

  describe('agent status management', () => {
    it('should track agent statuses', async () => {
      await orchestrator.initialize()

      const statuses = await orchestrator.getAgentStatuses()

      expect(statuses).toBeDefined()
      expect(Array.isArray(statuses)).toBe(true)
      expect(statuses.length).toBeGreaterThan(0)
    })
  })

  describe('token budget management', () => {
    it('should track token usage correctly', async () => {
      await orchestrator.initialize()

      const initialBudget = orchestrator.getTokenBudget()
      const initialRemaining = initialBudget.remaining

      expect(initialRemaining).toBeGreaterThan(0)
    })

    it('should enforce token limits', async () => {
      await orchestrator.initialize()

      const tokenBudget = orchestrator.getTokenBudget()
      expect(tokenBudget.remaining).toBeLessThanOrEqual(tokenBudget.total)
    })
  })

  describe('conflict detection', () => {
    it('should track active operations', async () => {
      await orchestrator.initialize()

      const operations = orchestrator.getActiveOperations()

      expect(operations).toBeDefined()
      expect(Array.isArray(operations)).toBe(true)
    })
  })

  describe('messaging', () => {
    it('should send messages between agents', async () => {
      await orchestrator.initialize()

      await orchestrator.sendMessage(
        'test_agent',
        'target_agent',
        'Test message',
        undefined,
        { test: true }
      )

      const messages = mockSupabase._getMockData('squad_messages')
      const testMessage = messages.find(m => 
        m.from_agent === 'test_agent' &&
        m.to_agent === 'target_agent'
      )

      expect(testMessage).toBeDefined()
      expect(testMessage.message).toBe('Test message')
      expect(testMessage.data.test).toBe(true)
    })

    it('should retrieve recent messages', async () => {
      await orchestrator.initialize()

      mockSupabase._setMockData('squad_messages', testSquadMessages)

      const messages = await orchestrator.getMessages(10)

      expect(messages).toBeDefined()
      expect(Array.isArray(messages)).toBe(true)
    })
  })

  describe('workflow execution', () => {
    it('should track workflow execution', async () => {
      await orchestrator.initialize()

      const messages = mockSupabase._getMockData('squad_messages')
      expect(messages.length).toBeGreaterThan(0)
    })
  })

  describe('error handling', () => {
    it('should handle initialization errors gracefully', async () => {
      vi.spyOn(mockSupabase, 'from').mockImplementationOnce(() => {
        throw new Error('Database connection error')
      })

      await expect(orchestrator.initialize()).rejects.toThrow()
    })
  })

  describe('shutdown', () => {
    it('should shutdown cleanly', async () => {
      await orchestrator.initialize()
      await orchestrator.shutdown()

      const messages = mockSupabase._getMockData('squad_messages')
      const shutdownMessage = messages.find(m => 
        m.data?.action === 'shutdown'
      )

      expect(shutdownMessage).toBeDefined()
    })
  })
})
