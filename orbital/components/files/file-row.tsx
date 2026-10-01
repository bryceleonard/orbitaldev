'use client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ProjectFile } from '@/lib/types'

interface Props {
  file: ProjectFile
  canEdit: boolean
  onProcess: (fileId: string) => void
  onSelect: (file: ProjectFile) => void
  onDelete: (fileId: string) => void
}

const PROCESSABLE = new Set([
  'text/plain', 'text/markdown', 'application/pdf',
])

function draftCount(file: ProjectFile): number {
  if (!file.aiDrafts) return 0
  return (
    file.aiDrafts.decisions.length +
    file.aiDrafts.milestones.length +
    file.aiDrafts.risks.length +
    file.aiDrafts.issues.length
  )
}

export function FileRow({ file, canEdit, onProcess, onSelect, onDelete }: Props) {
  const isProcessable = PROCESSABLE.has(file.mimeType)
  const status = file.aiStatus

  return (
    <div
      className={cn(
        'flex items-center justify-between border rounded-md px-4 py-3 transition-all',
        status === 'processing' && 'border-l-4 border-l-primary animate-pulse',
        status === 'ready' && 'cursor-pointer hover:bg-muted/50',
      )}
      onClick={status === 'ready' ? () => onSelect(file) : undefined}
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <p className="text-sm font-medium truncate">{file.name}</p>
        {status === 'ready' && file.aiSummary && (
          <p className="text-xs text-muted-foreground truncate max-w-lg">{file.aiSummary}</p>
        )}
        {status === 'processing' && (
          <p className="text-xs text-muted-foreground">Orbital is reading…</p>
        )}
        {status === 'error' && (
          <p className="text-xs text-destructive">Processing failed</p>
        )}
        {(!status || status === 'unprocessed') && (
          <p className="text-xs text-muted-foreground">
            {(file.sizeBytes / 1024).toFixed(0)} KB · {file.uploadedAt?.slice(0, 10) ?? '—'}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-4">
        {status === 'ready' && (
          <div className="flex gap-1">
            {(file.aiDrafts?.decisions.length ?? 0) > 0 && (
              <Badge variant="secondary">{file.aiDrafts!.decisions.length} decisions</Badge>
            )}
            {(file.aiDrafts?.milestones.length ?? 0) > 0 && (
              <Badge variant="secondary">{file.aiDrafts!.milestones.length} milestones</Badge>
            )}
            {(file.aiDrafts?.risks.length ?? 0) > 0 && (
              <Badge variant="secondary">{file.aiDrafts!.risks.length} risks</Badge>
            )}
            {(file.aiDrafts?.issues.length ?? 0) > 0 && (
              <Badge variant="secondary">{file.aiDrafts!.issues.length} issues</Badge>
            )}
            {draftCount(file) === 0 && (
              <Badge variant="outline" className="text-muted-foreground">No drafts</Badge>
            )}
          </div>
        )}
        {status === 'error' && canEdit && (
          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onProcess(file.id) }}>
            Retry
          </Button>
        )}
        {(!status || status === 'unprocessed') && canEdit && isProcessable && (
          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onProcess(file.id) }}>
            Let Orbital read this
          </Button>
        )}
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={(e) => { e.stopPropagation(); onDelete(file.id) }}
          >
            Delete
          </Button>
        )}
      </div>
    </div>
  )
}
