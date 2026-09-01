'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { TrackerBoard } from '@/lib/types'

const TABS_BEFORE_BOARDS = [
  { label: 'Overview',   segment: 'overview' },
  { label: 'Milestones', segment: 'milestones' },
]
const TABS_AFTER_BOARDS = [
  { label: 'Documents', segment: 'documents' },
  { label: 'Links',     segment: 'links' },
]

interface Props {
  projectId: string
  trackerBoards: TrackerBoard[]
}

export function PortalProjectTabs({ projectId, trackerBoards }: Props) {
  const pathname = usePathname()

  function tabClass(active: boolean) {
    return cn(
      'whitespace-nowrap px-4 py-3 font-mono text-[11px] uppercase tracking-[0.12em] border-b-2 -mb-px transition-colors',
      active
        ? 'border-[#fad542] text-foreground'
        : 'border-transparent text-muted-foreground hover:text-foreground',
    )
  }

  function renderTab({ label, segment }: { label: string; segment: string }) {
    const href = `/portal/${projectId}/${segment}`
    const active = pathname.endsWith(`/${segment}`)
    return (
      <Link key={segment} href={href} aria-current={active ? 'page' : undefined} className={tabClass(active)}>
        {label}
      </Link>
    )
  }

  return (
    <nav className="flex border-b overflow-x-auto">
      {TABS_BEFORE_BOARDS.map(renderTab)}
      {trackerBoards.map((board) => {
        const href = `/portal/${projectId}/boards/${board.id}`
        const active = pathname.includes(`/boards/${board.id}`)
        return (
          <Link key={board.id} href={href} aria-current={active ? 'page' : undefined} className={tabClass(active)}>
            {board.label}
          </Link>
        )
      })}
      {TABS_AFTER_BOARDS.map(renderTab)}
    </nav>
  )
}
