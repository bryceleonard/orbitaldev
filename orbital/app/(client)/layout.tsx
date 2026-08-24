import { PortalNav } from '@/components/portal/portal-nav'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <PortalNav />
      <main className="flex-1">{children}</main>
    </div>
  )
}
