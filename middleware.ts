import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || ''
  const url = request.nextUrl.clone()

  if (host.includes('.audico-platform.com') && !host.startsWith('www.')) {
    const subdomain = host.split('.')[0]
    
    if (subdomain && subdomain !== 'audico-platform') {
      url.searchParams.set('tenant', subdomain)
      
      if (!url.pathname.startsWith('/tenant')) {
        url.pathname = `/tenant${url.pathname}`
        return NextResponse.rewrite(url)
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api).*)',
  ],
}
