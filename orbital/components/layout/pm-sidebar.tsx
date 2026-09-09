'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase/client'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { LayoutDashboard, LogOut } from 'lucide-react'
import { Logo40AU } from '@/components/ui/logo'

export function PmSidebar() {
  const { user } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    await fetch('/api/auth/signout', { method: 'POST' })
    await signOut(auth).catch(() => {})
    router.push('/login')
  }

  return (
    <aside className="flex h-screen w-56 flex-col border-r bg-background">
      <div className="px-4 py-5">
        <Logo40AU className="h-5 w-auto" />
      </div>
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
