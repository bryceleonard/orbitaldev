'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { label: 'Overview',  segment: 'overview'  },
  { label: 'Documents', segment: 'documents' },
  { label: 'Links',     segment: 'links'     },
]

export function PortalProjectTabs({ projectId }: { projectId: string }) {
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
    <nav className="flex border-b overflow-x-auto">
      {TABS.map(({ label, segment }) => {
        const href = `/portal/${projectId}/${segment}`
        const active = pathname.endsWith(`/${segment}`)
        return (
          <Link key={segment} href={href} aria-current={active ? 'page' : undefined} className={tabClass(active)}>
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
