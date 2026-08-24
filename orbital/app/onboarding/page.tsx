'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { createOrg, joinOrg, orgExists } from '@/lib/firestore/orgs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function OnboardingPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [mode, setMode] = useState<'create' | 'join' | null>(null)
  const [orgName, setOrgName] = useState('')
  const [orgId, setOrgId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    if (!user || !orgName.trim()) return
    setLoading(true)
    setError(null)
    try {
      await createOrg(orgName.trim(), user.uid, user.email!, user.displayName ?? user.email!)
      router.replace('/dashboard')
    } catch {
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to Orbital</CardTitle>
          <CardDescription>Set up your workspace to get started.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!mode && (
            <>
              <Button onClick={() => setMode('create')}>Create a new org</Button>
              <Button variant="outline" onClick={() => setMode('join')}>
                Join an existing org
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
              <Button variant="ghost" onClick={() => setMode(null)}>Back</Button>
            </>
          )}

          {mode === 'join' && (
            <>
              <Label htmlFor="orgId">Org invite code</Label>
              <Input
                id="orgId"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                placeholder="Paste the org ID from a team member"
              />
              <Button onClick={handleJoin} disabled={loading || !orgId.trim()}>
                {loading ? 'Joining…' : 'Join org'}
              </Button>
              <Button variant="ghost" onClick={() => setMode(null)}>Back</Button>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
