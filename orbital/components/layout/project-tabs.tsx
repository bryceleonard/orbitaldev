'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { TrackerBoard } from '@/lib/types'

const STATIC_BEFORE = [
  { label: 'Overview',     segment: 'overview' },
  { label: 'SOW',          segment: 'sow' },
  { label: 'Status',       segment: 'status' },
  { label: 'Files',        segment: 'files' },
]

const STATIC_AFTER = [
  { label: 'Stakeholders', segment: 'stakeholders' },
  { label: 'Links',        segment: 'helpful-links' },
  { label: 'Roadmap',      segment: 'roadmap' },
]

interface Props {
  projectId: string
  trackerBoards: TrackerBoard[]
}

export function ProjectTabs({ projectId, trackerBoards }: Props) {
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
    <nav className="flex border-b overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
      {STATIC_BEFORE.map(({ label, segment }) => {
        const href = `/projects/${projectId}/${segment}`
        return (
          <Link key={segment} href={href} aria-current={pathname.endsWith(`/${segment}`) ? 'page' : undefined} className={tabClass(pathname.endsWith(`/${segment}`))}>
            {label}
          </Link>
        )
      })}
      {trackerBoards.map((board) => {
        const href = `/projects/${projectId}/boards/${board.id}`
        const active = pathname.includes(`/boards/${board.id}`)
        return (
          <Link key={board.id} href={href} aria-current={active ? 'page' : undefined} className={tabClass(active)}>
            {board.label}
          </Link>
        )
      })}
      {STATIC_AFTER.map(({ label, segment }) => {
        const href = `/projects/${projectId}/${segment}`
        return (
          <Link key={segment} href={href} aria-current={pathname.endsWith(`/${segment}`) ? 'page' : undefined} className={tabClass(pathname.endsWith(`/${segment}`))}>
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
