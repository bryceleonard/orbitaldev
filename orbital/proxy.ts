import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase/admin'

const COOKIE = process.env.SESSION_COOKIE_NAME ?? '__session'

const PUBLIC_PATHS = ['/login', '/onboarding', '/api/auth']

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p))
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (isPublic(pathname)) return NextResponse.next()

  const sessionCookie = req.cookies.get(COOKIE)?.value

  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true)
    const res = NextResponse.next()
    res.headers.set('x-uid', decoded.uid)
    return res
  } catch {
    const res = NextResponse.redirect(new URL('/login', req.url))
    res.cookies.delete(COOKIE)
    return res
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
