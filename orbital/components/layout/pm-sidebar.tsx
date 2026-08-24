'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { LayoutDashboard, LogOut } from 'lucide-react'

export function PmSidebar() {
  const { user } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    await fetch('/api/auth/signout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <aside className="flex h-screen w-56 flex-col border-r bg-background">
      <div className="px-4 py-5 font-semibold text-lg">Orbital</div>
      <nav className="flex-1 px-2">
        <Link
          href="/dashboard"
          className={cn(
            'flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted',
            pathname === '/dashboard' && 'bg-muted font-medium',
          )}
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </Link>
      </nav>
      <div className="border-t p-4">
        <p className="text-xs text-muted-foreground truncate mb-2">{user?.displayName ?? (user as { email?: string })?.email}</p>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  )
}
