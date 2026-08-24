'use client'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { addMember } from '@/lib/firestore/projects'
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
  const [uid, setUid] = useState('')
  const [role, setRole] = useState<AccessLevel>('editor')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd() {
    if (!orgId || !uid.trim()) return
    setLoading(true)
    setError(null)
    try {
      await addMember(orgId, projectId, uid.trim(), role)
      setUid('')
      onSuccess()
      onOpenChange(false)
    } catch {
      setError('Failed to add member.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Share project</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3">
          <div>
            <Label htmlFor="share-uid">User ID</Label>
            <Input id="share-uid" value={uid} onChange={(e) => setUid(e.target.value)} placeholder="Firebase UID" />
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
          <Button onClick={handleAdd} disabled={loading || !uid.trim()}>
            {loading ? 'Adding…' : 'Add member'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
