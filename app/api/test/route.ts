import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'working',
    message: 'API routes are functioning',
    timestamp: new Date().toISOString()
  })
}
