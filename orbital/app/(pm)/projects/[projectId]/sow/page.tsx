'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { updateProject } from '@/lib/firestore/projects'
import { listResources, addResource, deleteResource } from '@/lib/firestore/resources'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Resource } from '@/lib/types'

export default function SowPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { user } = useAuth()
  const orgId = useOrgId()
  const qc = useQueryClient()
  const { data: project } = useProject(orgId, projectId)

  const { data: resources = [] } = useQuery({
    queryKey: ['resources', orgId, projectId],
    queryFn: () => listResources(orgId!, projectId),
    enabled: !!orgId,
  })

  const [sow, setSow] = useState(project?.sow ?? { startDate: '', endDate: '', totalHours: 0, budgetHours: 0, summary: '' })
  const [saving, setSaving] = useState(false)
  const [newResource, setNewResource] = useState<Omit<Resource, 'id'>>({ name: '', role: '', hours: 0 })

  const canEdit = user && project
    ? project.members[user.uid] === 'owner' || project.members[user.uid] === 'editor'
    : false

  async function handleSaveSow() {
    if (!orgId) return
    setSaving(true)
    await updateProject(orgId, projectId, { sow })
    qc.invalidateQueries({ queryKey: ['project', orgId, projectId] })
    setSaving(false)
  }

  async function handleAddResource() {
    if (!orgId || !newResource.name.trim()) return
    await addResource(orgId, projectId, newResource)
    qc.invalidateQueries({ queryKey: ['resources', orgId, projectId] })
    setNewResource({ name: '', role: '', hours: 0 })
  }

  async function handleDeleteResource(id: string) {
    if (!orgId) return
    await deleteResource(orgId, projectId, id)
    qc.invalidateQueries({ queryKey: ['resources', orgId, projectId] })
  }

  if (!project) return <p className="text-muted-foreground">Loading…</p>

  return (
    <div className="max-w-2xl flex flex-col gap-8">
      <section>
        <h2 className="font-semibold mb-4">Statement of Work</h2>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Start date</Label><Input type="date" value={sow.startDate} onChange={(e) => setSow({ ...sow, startDate: e.target.value })} disabled={!canEdit} /></div>
          <div><Label>End date</Label><Input type="date" value={sow.endDate} onChange={(e) => setSow({ ...sow, endDate: e.target.value })} disabled={!canEdit} /></div>
          <div><Label>Total hours</Label><Input type="number" value={sow.totalHours} onChange={(e) => setSow({ ...sow, totalHours: +e.target.value })} disabled={!canEdit} /></div>
          <div><Label>Budget hours</Label><Input type="number" value={sow.budgetHours} onChange={(e) => setSow({ ...sow, budgetHours: +e.target.value })} disabled={!canEdit} /></div>
        </div>
        <div className="mt-4"><Label>Summary</Label><Input value={sow.summary} onChange={(e) => setSow({ ...sow, summary: e.target.value })} disabled={!canEdit} /></div>
        {canEdit && <Button onClick={handleSaveSow} disabled={saving} className="mt-4">{saving ? 'Saving…' : 'Save SOW'}</Button>}
      </section>

      <section>
        <h2 className="font-semibold mb-4">Resource Schedule</h2>
        <table className="w-full text-sm border rounded-md overflow-hidden">
          <thead className="bg-muted"><tr><th className="text-left p-2">Name</th><th className="text-left p-2">Role</th><th className="text-left p-2">Hours</th>{canEdit && <th />}</tr></thead>
          <tbody>
            {resources.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{r.name}</td>
                <td className="p-2">{r.role}</td>
                <td className="p-2">{r.hours}</td>
                {canEdit && <td className="p-2"><Button variant="ghost" size="sm" onClick={() => handleDeleteResource(r.id)}>Remove</Button></td>}
              </tr>
            ))}
            {canEdit && (
              <tr className="border-t bg-muted/40">
                <td className="p-2"><Input placeholder="Name" value={newResource.name} onChange={(e) => setNewResource({ ...newResource, name: e.target.value })} /></td>
                <td className="p-2"><Input placeholder="Role" value={newResource.role} onChange={(e) => setNewResource({ ...newResource, role: e.target.value })} /></td>
                <td className="p-2"><Input type="number" placeholder="0" value={newResource.hours} onChange={(e) => setNewResource({ ...newResource, hours: +e.target.value })} /></td>
                <td className="p-2"><Button size="sm" onClick={handleAddResource}>Add</Button></td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
