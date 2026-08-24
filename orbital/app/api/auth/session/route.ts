import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase/admin'

const COOKIE = process.env.SESSION_COOKIE_NAME ?? '__session'
const FIVE_DAYS_MS = 60 * 60 * 24 * 5 * 1000

export async function POST(req: NextRequest) {
  const { idToken } = await req.json()
  if (!idToken) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  try {
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: FIVE_DAYS_MS,
    })
    const res = NextResponse.json({ status: 'ok' })
    res.cookies.set(COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: FIVE_DAYS_MS / 1000,
      path: '/',
    })
    return res
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }
}
