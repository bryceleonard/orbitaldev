import { NextResponse } from 'next/server'

const COOKIE = process.env.SESSION_COOKIE_NAME ?? '__session'

export async function POST() {
  const res = NextResponse.json({ status: 'ok' })
  res.cookies.delete(COOKIE)
  return res
}
