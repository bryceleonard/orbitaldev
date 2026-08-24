'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { updateProject } from '@/lib/firestore/projects'
import { ShareDialog } from '@/components/projects/share-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

export default function OverviewPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { user } = useAuth()
  const orgId = useOrgId()
  const qc = useQueryClient()
  const { data: project } = useProject(orgId, projectId)

  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [shareOpen, setShareOpen] = useState(false)
  const [saving, setSaving] = useState(false)

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

  if (!project) return <p className="text-muted-foreground">Loading…</p>

  return (
    <div className="max-w-2xl flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="proj-name">Project name</Label>
        <Input
          id="proj-name"
          value={name || project.name}
          onChange={(e) => setName(e.target.value)}
          disabled={!canEdit}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="proj-desc">Description</Label>
        <Input
          id="proj-desc"
          value={description || project.description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={!canEdit}
        />
      </div>
      {canEdit && (
        <Button onClick={handleSave} disabled={saving} className="self-start">
          {saving ? 'Saving…' : 'Save'}
        </Button>
      )}

      <div>
        <h2 className="font-medium mb-2">Members</h2>
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

      <ShareDialog
        projectId={projectId}
        open={shareOpen}
        onOpenChange={setShareOpen}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['project', orgId, projectId] })}
      />

      {isOwner && orgId && (
        <AdoConfigSection orgId={orgId} projectId={projectId} project={project} />
      )}
    </div>
  )
}

function AdoConfigSection({
  orgId, projectId, project,
}: {
  orgId: string
  projectId: string
  project: import('@/lib/types').Project
}) {
  const [adoOrgUrl, setAdoOrgUrl] = useState(project.adoOrgUrl)
  const [adoProject, setAdoProject] = useState(project.adoProject)
  const [adoTeam, setAdoTeam] = useState(project.adoTeam)
  const [pat, setPat] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch(`/api/ado/configure/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adoOrgUrl, adoProject, adoTeam, pat, orgId }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setSaved(true)
      setPat('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border rounded-md p-4 flex flex-col gap-3">
      <h2 className="font-medium">ADO Connection</h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>ADO Org URL</Label>
          <Input value={adoOrgUrl} onChange={(e) => setAdoOrgUrl(e.target.value)} placeholder="https://dev.azure.com/myorg" />
        </div>
        <div>
          <Label>ADO Project</Label>
          <Input value={adoProject} onChange={(e) => setAdoProject(e.target.value)} placeholder="MyProject" />
        </div>
        <div>
          <Label>ADO Team</Label>
          <Input value={adoTeam} onChange={(e) => setAdoTeam(e.target.value)} placeholder="MyTeam" />
        </div>
        <div>
          <Label>Personal Access Token</Label>
          <Input
            type="password"
            value={pat}
            onChange={(e) => setPat(e.target.value)}
            placeholder={project.adoPat ? '••••••• (set — enter new to replace)' : 'Enter PAT'}
          />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-green-600">ADO settings saved.</p>}
      <Button onClick={handleSave} disabled={saving} className="self-start">
        {saving ? 'Saving…' : 'Save ADO settings'}
      </Button>
    </div>
  )
}
