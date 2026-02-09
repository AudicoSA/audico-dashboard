import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'test-poll-works',
    message: 'Minimal email test route functioning',
    timestamp: new Date().toISOString()
  })
}

export async function POST() {
  return NextResponse.json({
    status: 'test-poll-post-works',
    message: 'POST method working',
    timestamp: new Date().toISOString()
  })
}
