'use client'
import { useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase/client'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Logo40AU } from '@/components/ui/logo'
import { LogOut } from 'lucide-react'

interface Props { projectName?: string }

export function PortalNav({ projectName }: Props) {
  const { user } = useAuth()
  const router = useRouter()

  async function handleSignOut() {
    await fetch('/api/auth/signout', { method: 'POST' })
    await signOut(auth).catch(() => {})
    router.push('/login')
  }

  return (
    <header className="flex items-center justify-between border-b bg-card px-8 py-4 print:hidden">
      <div className="flex items-center gap-3">
        <Logo40AU className="h-5 w-auto" />
        {projectName && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm font-medium">{projectName}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{user?.displayName ?? user?.email}</span>
        <Button variant="ghost" size="sm" className="gap-2" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </header>
  )
}
