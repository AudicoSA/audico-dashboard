import { vi } from 'vitest'

export interface MockGmailMessage {
  id: string
  threadId: string
  labelIds: string[]
  snippet: string
  payload: {
    headers: Array<{ name: string; value: string }>
    body: {
      data: string
    }
  }
  internalDate: string
}

export class MockGmailAPI {
  private messages: MockGmailMessage[] = []
  private labels: any[] = [
    { id: 'INBOX', name: 'INBOX', type: 'system' },
    { id: 'SENT', name: 'SENT', type: 'system' },
    { id: 'SPAM', name: 'SPAM', type: 'system' }
  ]

  setMessages(messages: MockGmailMessage[]) {
    this.messages = messages
  }

  addMessage(message: MockGmailMessage) {
    this.messages.push(message)
  }

  clearMessages() {
    this.messages = []
  }

  createMockClient() {
    return {
      users: {
        messages: {
          list: vi.fn(async (params: any) => {
            let filteredMessages = this.messages
            
            if (params.labelIds) {
              const labelIds = Array.isArray(params.labelIds) ? params.labelIds : [params.labelIds]
              filteredMessages = filteredMessages.filter(m => 
                m.labelIds.some(l => labelIds.includes(l))
              )
            }

            if (params.q) {
              const query = params.q.toLowerCase()
              filteredMessages = filteredMessages.filter(m => 
                m.snippet.toLowerCase().includes(query)
              )
            }

            const maxResults = params.maxResults || 10
            const messages = filteredMessages.slice(0, maxResults).map(m => ({
              id: m.id,
              threadId: m.threadId
            }))

            return {
              data: {
                messages,
                resultSizeEstimate: filteredMessages.length
              }
            }
          }),

          get: vi.fn(async (params: any) => {
            const message = this.messages.find(m => m.id === params.id)
            if (!message) {
              throw new Error('Message not found')
            }
            return { data: message }
          }),

          modify: vi.fn(async (params: any) => {
            const message = this.messages.find(m => m.id === params.id)
            if (!message) {
              throw new Error('Message not found')
            }
            
            if (params.resource.addLabelIds) {
              message.labelIds.push(...params.resource.addLabelIds)
            }
            
            if (params.resource.removeLabelIds) {
              message.labelIds = message.labelIds.filter(
                l => !params.resource.removeLabelIds.includes(l)
              )
            }

            return { data: message }
          }),

          send: vi.fn(async (params: any) => {
            const newMessage: MockGmailMessage = {
              id: `msg-${Date.now()}`,
              threadId: `thread-${Date.now()}`,
              labelIds: ['SENT'],
              snippet: 'Sent message',
              payload: {
                headers: [
                  { name: 'From', value: 'test@example.com' },
                  { name: 'To', value: 'recipient@example.com' },
                  { name: 'Subject', value: 'Test Email' }
                ],
                body: {
                  data: params.resource.raw
                }
              },
              internalDate: Date.now().toString()
            }
            this.messages.push(newMessage)
            return { data: newMessage }
          })
        },

        labels: {
          list: vi.fn(async () => ({
            data: { labels: this.labels }
          })),

          create: vi.fn(async (params: any) => {
            const newLabel = {
              id: `label-${Date.now()}`,
              name: params.resource.name,
              type: 'user'
            }
            this.labels.push(newLabel)
            return { data: newLabel }
          })
        }
      }
    }
  }
}

export const mockGmailAPI = new MockGmailAPI()
