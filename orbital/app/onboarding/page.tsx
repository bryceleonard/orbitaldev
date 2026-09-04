'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase/client'
import { useAuth } from '@/hooks/use-auth'
import { createOrg, joinOrg, orgExists } from '@/lib/firestore/orgs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

type Mode = 'choose' | 'create' | 'join' | 'waiting'

export default function OnboardingPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('choose')
  const [orgName, setOrgName] = useState('')
  const [orgId, setOrgId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleSignOut() {
    await fetch('/api/auth/signout', { method: 'POST' })
    await signOut(auth).catch(() => {})
    router.replace('/')
  }

  async function handleCreate() {
    if (!user || !orgName.trim()) return
    setLoading(true)
    setError(null)
    try {
      await createOrg(orgName.trim(), user.uid, user.email!, user.displayName ?? user.email!)
      router.replace('/dashboard')
    } catch (err) {
      console.error('[createOrg] error:', err)
      setError('Failed to create org. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin() {
    if (!user || !orgId.trim()) return
    setLoading(true)
    setError(null)
    try {
      const exists = await orgExists(orgId.trim())
      if (!exists) { setError('Org not found.'); setLoading(false); return }
      await joinOrg(orgId.trim(), user.uid, user.email!, user.displayName ?? user.email!)
      router.replace('/dashboard')
    } catch {
      setError('Failed to join org. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!user) return
    await navigator.clipboard.writeText(user.uid)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleCheckAccess() {
    router.refresh()
    router.replace('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Welcome to Orbital</CardTitle>
              <CardDescription>
                {mode === 'waiting'
                  ? 'Your account is ready.'
                  : 'Set up your workspace to get started.'}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground">
              Sign out
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">

          {mode === 'choose' && (
            <>
              <Button onClick={() => setMode('create')}>Create a new org</Button>
              <Button variant="outline" onClick={() => setMode('waiting')}>
                I was invited to a project
              </Button>
            </>
          )}

          {mode === 'create' && (
            <>
              <Label htmlFor="orgName">Org name</Label>
              <Input
                id="orgName"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. FortyAU"
              />
              <Button onClick={handleCreate} disabled={loading || !orgName.trim()}>
                {loading ? 'Creating…' : 'Create org'}
              </Button>
              <Button variant="ghost" onClick={() => setMode('choose')}>Back</Button>
            </>
          )}

          {mode === 'join' && (
            <>
              <Label htmlFor="orgId">Org invite code</Label>
              <Input
                id="orgId"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                placeholder="Paste the org ID"
              />
              <Button onClick={handleJoin} disabled={loading || !orgId.trim()}>
                {loading ? 'Joining…' : 'Join org'}
              </Button>
              <Button variant="ghost" onClick={() => setMode('choose')}>Back</Button>
            </>
          )}

          {mode === 'waiting' && (
            <>
              <p className="text-sm text-muted-foreground">
                Share your user ID with the person who invited you so they can add you to their project.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted rounded px-3 py-2 font-mono break-all">
                  {user?.uid ?? '…'}
                </code>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              <Button onClick={handleCheckAccess}>
                I've been added — continue
              </Button>
              <Button variant="ghost" onClick={() => setMode('choose')}>Back</Button>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
