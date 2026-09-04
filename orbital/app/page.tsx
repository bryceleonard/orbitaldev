import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { adminAuth } from '@/lib/firebase/admin'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'

const COOKIE = process.env.SESSION_COOKIE_NAME ?? '__session'

export default async function Home() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(COOKIE)?.value

  if (sessionCookie) {
    try {
      await adminAuth.verifySessionCookie(sessionCookie, true)
      redirect('/dashboard')
    } catch {
      // invalid session — fall through to landing
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/40">
      <div className="flex flex-col items-center gap-8 w-full max-w-sm px-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Orbital</h1>
          <p className="text-muted-foreground">Sign in or create an account to continue.</p>
        </div>
        <div className="w-full bg-card border rounded-xl p-6 shadow-sm">
          <GoogleSignInButton />
        </div>
      </div>
    </div>
  )
}
