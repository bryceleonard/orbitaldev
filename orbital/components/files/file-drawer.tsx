'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import type { ProjectFile } from '@/lib/types'
import { updateFileAiDrafts } from '@/lib/firestore/files'
import { addDecision, listDecisions } from '@/lib/firestore/decisions'
import { addMilestone } from '@/lib/firestore/milestones'
import { addRisk } from '@/lib/firestore/risks'
import { addIssue } from '@/lib/firestore/issues'

interface Props {
  file: ProjectFile
  orgId: string
  projectId: string
  uid: string
  onClose: () => void
  onDraftsChanged: () => void
}

type AiDrafts = NonNullable<ProjectFile['aiDrafts']>

export function FileDrawer({ file, orgId, projectId, uid, onClose, onDraftsChanged }: Props) {
  const [drafts, setDrafts] = useState<AiDrafts>(
    file.aiDrafts ?? { decisions: [], milestones: [], risks: [], issues: [] },
  )

  async function persistDrafts(next: AiDrafts) {
    setDrafts(next)
    await updateFileAiDrafts(orgId, projectId, file.id, next)
    onDraftsChanged()
  }

  async function acceptDecision(idx: number) {
    const draft = drafts.decisions[idx]
    const existing = await listDecisions(orgId, projectId)
    const seqId = String(existing.length + 1).padStart(3, '0')
    await addDecision(orgId, projectId, {
      seqId,
      question: draft.question ?? '',
      background: draft.background ?? '',
      responsible: '', accountable: '', consulted: '', informed: '',
      priority: draft.priority ?? 'medium',
      status: draft.status ?? 'open',
      dateIdentified: new Date().toISOString().slice(0, 10),
      dueDate: '', dateDecided: '',
      outcome: draft.outcome ?? '',
      timesRevisited: 0, notes: '',
      createdBy: uid, createdAt: '', updatedAt: '',
    })
    const next = { ...drafts, decisions: drafts.decisions.filter((_, i) => i !== idx) }
    await persistDrafts(next)
  }

  async function acceptMilestone(idx: number) {
    const draft = drafts.milestones[idx]
    await addMilestone(orgId, projectId, {
      name: draft.name ?? 'New Milestone',
      status: draft.status ?? 'not_started',
      description: draft.description,
      endDate: draft.endDate,
      createdBy: uid,
    })
    const next = { ...drafts, milestones: drafts.milestones.filter((_, i) => i !== idx) }
    await persistDrafts(next)
  }

  async function acceptRisk(idx: number) {
    const draft = drafts.risks[idx]
    await addRisk(orgId, projectId, {
      title: draft.title ?? 'New Risk',
      owner: '', severity: draft.severity ?? 'medium',
      description: draft.description ?? '',
      status: 'open', createdAt: '', updatedAt: '',
    })
    const next = { ...drafts, risks: drafts.risks.filter((_, i) => i !== idx) }
    await persistDrafts(next)
  }

  async function acceptIssue(idx: number) {
    const draft = drafts.issues[idx]
    await addIssue(orgId, projectId, {
      title: draft.title ?? 'New Issue',
      owner: '', severity: draft.severity ?? 'medium',
      description: draft.description ?? '',
      status: 'open', createdAt: '', updatedAt: '',
    })
    const next = { ...drafts, issues: drafts.issues.filter((_, i) => i !== idx) }
    await persistDrafts(next)
  }

  async function dismiss<K extends keyof AiDrafts>(section: K, idx: number) {
    const next = { ...drafts, [section]: (drafts[section] as unknown[]).filter((_, i) => i !== idx) }
    try {
      await persistDrafts(next as AiDrafts)
    } catch {
      // revert local state on failure
      setDrafts(drafts)
    }
  }

  const totalDrafts =
    drafts.decisions.length + drafts.milestones.length + drafts.risks.length + drafts.issues.length

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-full w-full max-w-xl bg-background border-l shadow-xl z-50 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <p className="font-semibold text-sm truncate max-w-xs">{file.name}</p>
            <p className="text-xs text-muted-foreground">{totalDrafts} draft{totalDrafts !== 1 ? 's' : ''} remaining</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-6">
          {file.aiSummary && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Summary</p>
              <p className="text-sm text-foreground">{file.aiSummary}</p>
            </div>
          )}

          <DraftSection
            title="Decisions"
            items={drafts.decisions}
            renderItem={(d, idx) => (
              <DraftCard
                key={idx}
                label={d.question ?? '(no question)'}
                sub={d.background}
                onAccept={() => acceptDecision(idx)}
                onDismiss={() => dismiss('decisions', idx)}
              />
            )}
          />

          <DraftSection
            title="Milestones"
            items={drafts.milestones}
            renderItem={(m, idx) => (
              <DraftCard
                key={idx}
                label={m.name ?? '(no name)'}
                sub={m.description}
                badge={m.status}
                onAccept={() => acceptMilestone(idx)}
                onDismiss={() => dismiss('milestones', idx)}
              />
            )}
          />

          <DraftSection
            title="Risks"
            items={drafts.risks}
            renderItem={(r, idx) => (
              <DraftCard
                key={idx}
                label={r.title ?? '(no title)'}
                sub={r.description}
                badge={r.severity}
                onAccept={() => acceptRisk(idx)}
                onDismiss={() => dismiss('risks', idx)}
              />
            )}
          />

          <DraftSection
            title="Issues"
            items={drafts.issues}
            renderItem={(iss, idx) => (
              <DraftCard
                key={idx}
                label={iss.title ?? '(no title)'}
                sub={iss.description}
                badge={iss.severity}
                onAccept={() => acceptIssue(idx)}
                onDismiss={() => dismiss('issues', idx)}
              />
            )}
          />

          {totalDrafts === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">All drafts reviewed.</p>
          )}
        </div>
      </aside>
    </>
  )
}

function DraftSection<T>({
  title,
  items,
  renderItem,
}: {
  title: string
  items: T[]
  renderItem: (item: T, idx: number) => React.ReactNode
}) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{title}</p>
      <div className="flex flex-col gap-2">{items.map((item, idx) => renderItem(item, idx))}</div>
    </div>
  )
}

function DraftCard({
  label, sub, badge, onAccept, onDismiss,
}: {
  label: string
  sub?: string
  badge?: string
  onAccept: () => void
  onDismiss: () => void
}) {
  return (
    <div className="border rounded-md px-4 py-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug">{label}</p>
        {badge && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">{badge}</span>
        )}
      </div>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      <div className="flex gap-2 mt-1">
        <Button size="sm" onClick={onAccept}>Accept</Button>
        <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={onDismiss}>Dismiss</Button>
      </div>
    </div>
  )
}
