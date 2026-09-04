'use client'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useOrgId } from '@/hooks/use-org'
import type { AccessLevel } from '@/lib/types'

interface Props {
  projectId: string
  open: boolean
  onOpenChange: (v: boolean) => void
  onSuccess: () => void
}

export function ShareDialog({ projectId, open, onOpenChange, onSuccess }: Props) {
  const orgId = useOrgId()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AccessLevel>('editor')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd() {
    if (!orgId || !email.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/members/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), orgId, projectId, role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to add member')
      setEmail('')
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add member</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3">
          <div>
            <Label htmlFor="share-email">Email address</Label>
            <Input
              id="share-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="person@example.com"
            />
            <p className="text-xs text-muted-foreground mt-1">
              They must have signed in to Orbital at least once.
            </p>
          </div>
          <div>
            <Label htmlFor="share-role">Role</Label>
            <select
              id="share-role"
              value={role}
              onChange={(e) => setRole(e.target.value as AccessLevel)}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={handleAdd} disabled={loading || !email.trim()}>
            {loading ? 'Adding…' : 'Add member'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
