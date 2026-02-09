import { vi } from 'vitest'

export class MockMySQLConnection {
  private data: Map<string, any[]> = new Map()
  private queryHistory: any[] = []

  setTableData(tableName: string, rows: any[]) {
    this.data.set(tableName, rows)
  }

  clearAll() {
    this.data.clear()
    this.queryHistory = []
  }

  getQueryHistory() {
    return [...this.queryHistory]
  }

  async execute(query: string, params?: any[]) {
    this.queryHistory.push({ query, params, timestamp: new Date().toISOString() })

    const queryLower = query.toLowerCase().trim()

    if (queryLower.startsWith('select')) {
      return this.handleSelect(query, params)
    } else if (queryLower.startsWith('update')) {
      return this.handleUpdate(query, params)
    } else if (queryLower.startsWith('insert')) {
      return this.handleInsert(query, params)
    } else if (queryLower.startsWith('delete')) {
      return this.handleDelete(query, params)
    }

    return [[], []]
  }

  private handleSelect(query: string, params?: any[]) {
    const tableMatch = query.match(/from\s+(\w+)/i)
    if (!tableMatch) return [[], []]

    const tableName = tableMatch[1]
    const tableData = this.data.get(tableName) || []

    if (params && params.length > 0) {
      const filteredData = tableData.filter(row => {
        if (query.includes('product_id = ?')) {
          return row.product_id === params[0]
        }
        return true
      })
      return [filteredData, []]
    }

    return [tableData, []]
  }

  private handleUpdate(query: string, params?: any[]) {
    return [{ affectedRows: 1 }, []]
  }

  private handleInsert(query: string, params?: any[]) {
    return [{ insertId: Date.now(), affectedRows: 1 }, []]
  }

  private handleDelete(query: string, params?: any[]) {
    return [{ affectedRows: 1 }, []]
  }

  async end() {
    return Promise.resolve()
  }
}

export const createMockMySQLConnection = () => new MockMySQLConnection()

export const mockMySQL = {
  createConnection: vi.fn(async (config: any) => {
    return new MockMySQLConnection()
  })
}
