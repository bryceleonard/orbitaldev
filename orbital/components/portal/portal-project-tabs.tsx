'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Printer } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TrackerBoard } from '@/lib/types'

const STATIC_TABS = [
  { label: 'Overview',  segment: 'overview'  },
  { label: 'Documents', segment: 'documents' },
  { label: 'Links',     segment: 'links'     },
]

export function PortalProjectTabs({
  projectId,
  trackerBoards = [],
}: {
  projectId: string
  trackerBoards?: TrackerBoard[]
}) {
  const pathname = usePathname()

  function tabClass(active: boolean) {
    return cn(
      'whitespace-nowrap px-4 py-3 text-sm border-b-2 -mb-px transition-colors',
      active
        ? 'border-primary font-medium text-primary'
        : 'border-transparent text-muted-foreground hover:text-foreground',
    )
  }

  return (
    <nav className="flex items-center justify-between border-b">
      <div className="flex">
        {STATIC_TABS.map(({ label, segment }) => {
          const href = `/portal/${projectId}/${segment}`
          const active = pathname.endsWith(`/${segment}`)
          return (
            <Link key={segment} href={href} aria-current={active ? 'page' : undefined} className={tabClass(active)}>
              {label}
            </Link>
          )
        })}
        {trackerBoards.map((board) => {
          const href = `/portal/${projectId}/boards/${board.id}`
          const active = pathname.includes(`/boards/${board.id}`)
          return (
            <Link key={board.id} href={href} aria-current={active ? 'page' : undefined} className={tabClass(active)}>
              {board.label}
            </Link>
          )
        })}
      </div>
      <Link
        href={`/portal/${projectId}/report`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 px-3 py-2 mb-px text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <Printer className="h-3.5 w-3.5" />
        Export PDF
      </Link>
    </nav>
  )
}
