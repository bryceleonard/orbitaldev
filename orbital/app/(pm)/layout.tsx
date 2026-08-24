import { PmSidebar } from '@/components/layout/pm-sidebar'

export default function PmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <PmSidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
