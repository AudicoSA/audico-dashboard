import { vi } from 'vitest'

export function createMockSupabaseClient() {
  const mockData: any = {}
  const mockStorage: any = {}

  return {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: mockData[table]?.[0] || null, error: null })),
          limit: vi.fn(() => Promise.resolve({ data: mockData[table] || [], error: null }))
        })),
        limit: vi.fn(() => Promise.resolve({ data: mockData[table] || [], error: null })),
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ data: mockData[table] || [], error: null }))
        })),
        gte: vi.fn(() => ({
          lte: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: mockData[table] || [], error: null }))
          }))
        })),
        or: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ data: mockData[table] || [], error: null }))
        })),
        in: vi.fn(() => Promise.resolve({ data: mockData[table] || [], error: null })),
        not: vi.fn(() => ({
          is: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: mockData[table] || [], error: null }))
            }))
          }))
        })),
        is: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: mockData[table] || [], error: null }))
          }))
        }))
      })),
      insert: vi.fn((data: any) => ({
        select: vi.fn(() => ({
          single: vi.fn(() => {
            const insertedData = Array.isArray(data) ? data[0] : data
            const id = insertedData.id || `test-id-${Date.now()}`
            const result = { ...insertedData, id, created_at: new Date().toISOString() }
            
            if (!mockData[table]) {
              mockData[table] = []
            }
            mockData[table].push(result)
            
            return Promise.resolve({ data: result, error: null })
          })
        }))
      })),
      update: vi.fn((data: any) => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: { ...mockData[table]?.[0], ...data }, error: null }))
          }))
        }))
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
        neq: vi.fn(() => Promise.resolve({ data: null, error: null }))
      }))
    })),
    storage: {
      from: vi.fn((bucket: string) => ({
        upload: vi.fn((path: string, file: any) => {
          if (!mockStorage[bucket]) {
            mockStorage[bucket] = {}
          }
          mockStorage[bucket][path] = file
          return Promise.resolve({ data: { path }, error: null })
        }),
        getPublicUrl: vi.fn((path: string) => ({
          data: { publicUrl: `https://test.supabase.co/storage/v1/object/public/${bucket}/${path}` }
        }))
      }))
    },
    _setMockData: (table: string, data: any[]) => {
      mockData[table] = data
    },
    _getMockData: (table: string) => mockData[table] || [],
    _clearMockData: () => {
      Object.keys(mockData).forEach(key => delete mockData[key])
      Object.keys(mockStorage).forEach(key => delete mockStorage[key])
    }
  }
}

export const mockSupabase = createMockSupabaseClient()
