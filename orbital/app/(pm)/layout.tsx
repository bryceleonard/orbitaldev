import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { PmSidebar } from '@/components/layout/pm-sidebar'

const COOKIE = process.env.SESSION_COOKIE_NAME ?? '__session'

export default async function PmLayout({ children }: { children: React.ReactNode }) {
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
    <div className="flex h-screen">
      <PmSidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
