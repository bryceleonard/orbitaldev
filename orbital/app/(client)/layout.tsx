import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { PortalNav } from '@/components/portal/portal-nav'

const COOKIE = process.env.SESSION_COOKIE_NAME ?? '__session'

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(COOKIE)?.value

  if (!sessionCookie) redirect('/login')

  let uid: string
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true)
    uid = decoded.uid
  } catch {
    redirect('/login')
  }

  try {
    const userSnap = await adminDb.doc(`users/${uid}`).get()
    if (!userSnap.exists || !userSnap.data()?.orgId) redirect('/onboarding')
  } catch {
    redirect('/onboarding')
  }

  return (
    <div className="min-h-screen flex flex-col">
      <PortalNav />
      <main className="flex-1">{children}</main>
    </div>
  )
}
