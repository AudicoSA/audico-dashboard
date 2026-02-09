import { vi } from 'vitest'

export interface MockAnthropicMessage {
  model: string
  prompt?: string
  messages?: Array<{ role: string; content: string }>
  response: string
}

export class MockAnthropicAPI {
  private responses: Map<string, string> = new Map()
  private callHistory: any[] = []

  setResponse(prompt: string, response: string) {
    this.responses.set(prompt, response)
  }

  setDefaultResponse(response: string) {
    this.responses.set('__default__', response)
  }

  getCallHistory() {
    return [...this.callHistory]
  }

  clearHistory() {
    this.callHistory = []
  }

  clearAll() {
    this.responses.clear()
    this.callHistory = []
  }

  createMockClient() {
    return {
      messages: {
        create: vi.fn(async (params: any) => {
          this.callHistory.push({
            timestamp: new Date().toISOString(),
            params
          })

          const userMessage = params.messages?.find((m: any) => m.role === 'user')
          const prompt = userMessage?.content || ''

          let responseText = this.responses.get(prompt)
          
          if (!responseText) {
            responseText = this.responses.get('__default__')
          }

          if (!responseText) {
            responseText = 'This is a mock response from Claude API.'
          }

          return {
            id: `msg-${Date.now()}`,
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: responseText
              }
            ],
            model: params.model,
            stop_reason: 'end_turn',
            usage: {
              input_tokens: 100,
              output_tokens: 200
            }
          }
        })
      }
    }
  }
}

export const mockAnthropicAPI = new MockAnthropicAPI()
