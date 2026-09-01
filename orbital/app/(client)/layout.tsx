import { Bricolage_Grotesque, JetBrains_Mono, Instrument_Serif } from 'next/font/google'
import { PortalNav } from '@/components/portal/portal-nav'

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

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`orbital dark min-h-screen flex flex-col bg-background text-foreground ${bricolage.variable} ${jetbrains.variable} ${instrumentSerif.variable}`}>
      <PortalNav />
      <main className="flex-1">{children}</main>
    </div>
  )
}
