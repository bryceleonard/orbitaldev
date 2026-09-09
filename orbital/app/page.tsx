import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { adminAuth } from '@/lib/firebase/admin'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
import { Logo40AU } from '@/components/ui/logo'

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
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-10 w-full max-w-sm px-4">
        <Logo40AU className="h-8 w-auto" />
        <div className="w-full bg-card border rounded-lg p-6">
          <p className="text-sm text-muted-foreground text-center mb-6">Sign in to continue</p>
          <GoogleSignInButton />
        </div>
      </div>
    </div>
  )
}
