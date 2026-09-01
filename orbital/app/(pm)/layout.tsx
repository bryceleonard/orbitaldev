import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Bricolage_Grotesque, JetBrains_Mono, Instrument_Serif } from 'next/font/google'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { PmSidebar } from '@/components/layout/pm-sidebar'

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  weight: ['200', '400', '600', '700', '800'],
})
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  weight: ['400', '500', '700'],
})
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  variable: '--font-instrument',
  style: ['normal', 'italic'],
  weight: '400',
})

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
    <div className={`orbital flex h-screen ${bricolage.variable} ${jetbrains.variable} ${instrumentSerif.variable}`}>
      <PmSidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
