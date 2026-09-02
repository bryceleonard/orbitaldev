import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { adminAuth } from '@/lib/firebase/admin'

const COOKIE = process.env.SESSION_COOKIE_NAME ?? '__session'

export default async function Home() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(COOKIE)?.value

  if (sessionCookie) {
    try {
      await adminAuth.verifySessionCookie(sessionCookie, true)
      redirect('/dashboard')
    } catch {
      // invalid session — fall through to login
    }
  }

  redirect('/login')
}
