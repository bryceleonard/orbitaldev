'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { listFiles } from '@/lib/firestore/files'
import { updateProject } from '@/lib/firestore/projects'
import { ShareDialog } from '@/components/projects/share-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ProjectFile, TrackerBoard, TrackerType } from '@/lib/types'

function StatusBadge({ label, status }: { label: string; status: string }) {
  const color =
    status === 'on_track' ? 'text-green-700 border-green-300'
    : status === 'at_risk' ? 'text-yellow-700 border-yellow-300'
    : 'text-red-700 border-red-300'
  return (
    <Badge variant="outline" className={color}>
      {label}: {status.replace('_', ' ')}
    </Badge>
  )
}

function IntelligenceFeed({ files }: { files: ProjectFile[] }) {
  const ready = files
    .filter((f) => f.aiStatus === 'ready')
    .sort((a, b) => (b.aiProcessedAt ?? '').localeCompare(a.aiProcessedAt ?? ''))
    .slice(0, 5)

  if (ready.length === 0) {
    return (
      <div className="border border-dashed rounded-md px-6 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          Drop your first meeting transcript into Context and Orbital will read it.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {ready.map((f) => {
        const counts = [
          f.aiDrafts?.decisions.length && `${f.aiDrafts.decisions.length} decisions`,
          f.aiDrafts?.milestones.length && `${f.aiDrafts.milestones.length} milestones`,
          f.aiDrafts?.risks.length && `${f.aiDrafts.risks.length} risks`,
          f.aiDrafts?.issues.length && `${f.aiDrafts.issues.length} issues`,
        ].filter(Boolean)

        return (
          <div key={f.id} className="border rounded-md px-4 py-3 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{f.name}</p>
              <p className="text-xs text-muted-foreground">{f.aiProcessedAt?.slice(0, 10) ?? ''}</p>
            </div>
            {f.aiSummary && <p className="text-xs text-muted-foreground">{f.aiSummary}</p>}
            {counts.length > 0 && (
              <p className="text-xs text-primary font-medium">{counts.join(' · ')}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function AskOrbital({ orgId, projectId }: { orgId: string; projectId: string }) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!question.trim() || loading) return
    setLoading(true)
    setAnswer('')
    try {
      const res = await fetch('/api/files/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, projectId, question }),
      })
      if (!res.ok || !res.body) {
        setAnswer('Something went wrong. Try again.')
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        const errorIdx = full.lastIndexOf('\nERROR:')
        if (errorIdx >= 0) {
          setAnswer('Something went wrong. Try again.')
          return
        }
        const citationIdx = full.lastIndexOf('\nCITATIONS:')
        setAnswer(citationIdx >= 0 ? full.slice(0, citationIdx) : full)
      }
    } catch {
      setAnswer('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask anything about this project…"
          disabled={loading}
          className="flex-1"
        />
        <Button type="submit" disabled={loading || !question.trim()}>
          {loading ? 'Asking…' : 'Ask'}
        </Button>
      </form>
      {answer && (
        <div className="border rounded-md px-4 py-3 text-sm whitespace-pre-wrap">{answer}</div>
      )}
    </div>
  )
}

export default function OverviewPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { user } = useAuth()
  const orgId = useOrgId()
  const qc = useQueryClient()
  const router = useRouter()
  const { data: project } = useProject(orgId, projectId)
  const [shareOpen, setShareOpen] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (project) {
      setName(project.name)
      setDescription(project.description)
    }
  }, [project])

  const { data: files = [] } = useQuery({
    queryKey: ['files', orgId, projectId],
    queryFn: () => listFiles(orgId!, projectId),
    enabled: !!orgId,
  })

  const isOwner = user && project ? project.members[user.uid] === 'owner' : false
  const canEdit = user && project
    ? project.members[user.uid] === 'owner' || project.members[user.uid] === 'editor'
    : false

  async function handleSave() {
    if (!orgId) return
    setSaving(true)
    await updateProject(orgId, projectId, { name, description })
    qc.invalidateQueries({ queryKey: ['project', orgId, projectId] })
    setSaving(false)
  }

  async function handleArchiveToggle() {
    if (!orgId || !project) return
    setArchiving(true)
    const newStatus = project.status === 'archived' ? 'active' : 'archived'
    await updateProject(orgId, projectId, { status: newStatus })
    qc.invalidateQueries({ queryKey: ['project', orgId, projectId] })
    qc.invalidateQueries({ queryKey: ['projects', orgId] })
    if (newStatus === 'archived') router.push('/dashboard')
    setArchiving(false)
  }

  if (!project) return <p className="text-muted-foreground text-sm">Loading…</p>

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      {/* Zone 1 — Pulse strip */}
      {project.statusHeader && (
        <div className="flex gap-2 flex-wrap">
          <StatusBadge label="Schedule" status={project.statusHeader.scheduleStatus} />
          <StatusBadge label="Budget" status={project.statusHeader.budgetStatus} />
          <StatusBadge label="Scope" status={project.statusHeader.scopeStatus} />
        </div>
      )}

      {/* Zone 2 — Intelligence feed */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Recent Intelligence</h2>
        <IntelligenceFeed files={files} />
      </div>

      {/* Zone 3 — Ask Orbital (hidden) */}

      {/* Project settings — below the fold */}
      <div className="border-t pt-6 flex flex-col gap-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Project Settings</h2>

        {/* Name / description editing */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="proj-name">Project name</Label>
            <Input
              id="proj-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="proj-desc">Description</Label>
            <Input
              id="proj-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canEdit}
            />
          </div>
          {canEdit && (
            <Button onClick={handleSave} disabled={saving} className="self-start">
              {saving ? 'Saving…' : 'Save'}
            </Button>
          )}
        </div>

        {/* Members */}
        <div>
          <h3 className="font-medium mb-2 text-sm">Members</h3>
          <ul className="flex flex-col gap-1 mb-3">
            {Object.entries(project.members).map(([uid, role]) => (
              <li key={uid} className="flex items-center gap-2 text-sm">
                <span className="font-mono text-xs text-muted-foreground">{uid}</span>
                <Badge variant="outline">{role}</Badge>
              </li>
            ))}
          </ul>
          {isOwner && (
            <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
              Add member
            </Button>
          )}
        </div>

        {/* Archive */}
        {isOwner && (
          <Button
            variant="outline"
            onClick={handleArchiveToggle}
            disabled={archiving}
            className="self-start text-muted-foreground"
          >
            {archiving ? 'Saving…' : project.status === 'archived' ? 'Unarchive' : 'Archive project'}
          </Button>
        )}
      </div>

      {/* Boards — owners only */}
      {isOwner && orgId && (
        <BoardsCard
          orgId={orgId}
          projectId={projectId}
          boards={project.trackerBoards}
          onSaved={() => qc.invalidateQueries({ queryKey: ['project', orgId, projectId] })}
        />
      )}

      <ShareDialog
        projectId={projectId}
        open={shareOpen}
        onOpenChange={setShareOpen}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['project', orgId, projectId] })}
      />
    </div>
  )
}

function emptyBoard(type: TrackerType): Omit<TrackerBoard, 'id'> {
  return {
    label: '',
    type,
    adoOrgUrl: '',
    adoProject: '',
    adoTeam: '',
    beadsRepo: '',
    beadsBranch: 'main',
  }
}

function BoardsCard({
  orgId, projectId, boards, onSaved,
}: {
  orgId: string
  projectId: string
  boards: TrackerBoard[]
  onSaved: () => void
}) {
  const [editingBoard, setEditingBoard] = useState<TrackerBoard | null>(null)
  const [adding, setAdding] = useState(false)
  const [newType, setNewType] = useState<TrackerType>('ado')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const draftBoard: TrackerBoard = editingBoard ?? {
    id: crypto.randomUUID(),
    ...emptyBoard(newType),
  }

  function updateDraft(patch: Partial<TrackerBoard>) {
    setEditingBoard((prev) => prev ? { ...prev, ...patch } : { ...draftBoard, ...patch })
  }

  async function handleSave() {
    const board = editingBoard ?? { id: crypto.randomUUID(), ...emptyBoard(newType) }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/boards/configure/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: boards.find((b) => b.id === board.id) ? 'edit' : 'add',
          board,
          orgId,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setAdding(false)
      setEditingBoard(null)
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(boardId: string) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/boards/configure/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', boardId, orgId }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const activeBoard = editingBoard ?? (adding ? { id: crypto.randomUUID(), ...emptyBoard(newType) } : null)

  return (
    <div className="border rounded-md p-4 flex flex-col gap-4">
      <h2 className="font-medium">Boards</h2>
      {boards.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">No boards configured.</p>
      )}
      {boards.map((b) => (
        <div key={b.id} className="flex items-center justify-between text-sm border rounded px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="font-medium">{b.label}</span>
            <Badge variant="outline">{b.type === 'ado' ? 'ADO Work Items' : 'Beads'}</Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setEditingBoard(b); setAdding(false) }}>Edit</Button>
            <Button variant="ghost" size="sm" onClick={() => handleRemove(b.id)} disabled={saving}>Remove</Button>
          </div>
        </div>
      ))}

      {activeBoard && (
        <BoardForm
          board={activeBoard}
          onChange={updateDraft}
          onNewTypeChange={setNewType}
          newType={newType}
          isNew={!editingBoard}
        />
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        {!adding && !editingBoard && (
          <Button variant="outline" size="sm" onClick={() => { setAdding(true); setEditingBoard(null) }}>
            Add board
          </Button>
        )}
        {(adding || editingBoard) && (
          <>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save board'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setAdding(false); setEditingBoard(null) }}>
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

function BoardForm({
  board, onChange, onNewTypeChange, newType, isNew,
}: {
  board: TrackerBoard
  onChange: (patch: Partial<TrackerBoard>) => void
  onNewTypeChange: (t: TrackerType) => void
  newType: TrackerType
  isNew: boolean
}) {
  return (
    <div className="border rounded-md p-3 flex flex-col gap-3 bg-muted/20">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Label</Label>
          <Input value={board.label} onChange={(e) => onChange({ label: e.target.value })} placeholder="e.g. Alpha, Backend" />
        </div>
        <div>
          <Label>Type</Label>
          {isNew ? (
            <select
              className="w-full border rounded px-2 py-1.5 text-sm"
              value={newType}
              onChange={(e) => {
                const t = e.target.value as TrackerType
                onNewTypeChange(t)
                onChange({ type: t })
              }}
            >
              <option value="ado">ADO Work Items</option>
              <option value="beads">Beads</option>
            </select>
          ) : (
            <Input value={board.type === 'ado' ? 'ADO Work Items' : 'Beads'} disabled />
          )}
        </div>
        <div>
          <Label>ADO Org URL</Label>
          <Input value={board.adoOrgUrl} onChange={(e) => onChange({ adoOrgUrl: e.target.value })} placeholder="https://dev.azure.com/myorg" />
        </div>
        <div>
          <Label>ADO Project</Label>
          <Input value={board.adoProject} onChange={(e) => onChange({ adoProject: e.target.value })} placeholder="MyProject" />
        </div>
        {board.type === 'ado' && (
          <div>
            <Label>ADO Team</Label>
            <Input value={board.adoTeam} onChange={(e) => onChange({ adoTeam: e.target.value })} placeholder="MyTeam" />
          </div>
        )}
        {board.type === 'beads' && (
          <>
            <div>
              <Label>Repo name</Label>
              <Input value={board.beadsRepo} onChange={(e) => onChange({ beadsRepo: e.target.value })} placeholder="MyRepo" />
            </div>
            <div>
              <Label>Branch</Label>
              <Input value={board.beadsBranch} onChange={(e) => onChange({ beadsBranch: e.target.value })} placeholder="main" />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
