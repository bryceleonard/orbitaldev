'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2 } from 'lucide-react'

export type ColumnDef<T> = {
  key: keyof T
  label: string
  type?: 'text' | 'select' | 'toggle' | 'textarea'
  options?: string[]
}

interface Props<T extends { id: string }> {
  columns: ColumnDef<T>[]
  rows: T[]
  canEdit: boolean
  onAdd: (data: Omit<T, 'id'>) => Promise<void>
  onUpdate: (id: string, data: Partial<T>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function emptyDraft<T>(columns: ColumnDef<T>[]): Record<string, unknown> {
  return Object.fromEntries(
    columns.map(({ key, type, options }) => [
      key,
      type === 'toggle' ? false : type === 'select' ? (options?.[0] ?? '') : '',
    ])
  )
}

export function CrudTable<T extends { id: string }>({ columns, rows, canEdit, onAdd, onUpdate, onDelete }: Props<T>) {
  const [draft, setDraft] = useState<Record<string, unknown>>(emptyDraft(columns))
  const [adding, setAdding] = useState(false)

  function setDraftField(key: string, value: unknown) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  async function handleAdd() {
    setAdding(true)
    await onAdd(draft as Omit<T, 'id'>)
    setDraft(emptyDraft(columns))
    setAdding(false)
  }

  function renderCell(row: T, col: ColumnDef<T>) {
    const val = row[col.key]
    if (col.type === 'toggle') {
      return (
        <input
          type="checkbox"
          checked={!!val}
          disabled={!canEdit}
          onChange={(e) => canEdit && onUpdate(row.id, { [col.key]: e.target.checked } as Partial<T>)}
        />
      )
    }
    return <span className="text-sm">{String(val ?? '')}</span>
  }

  function renderDraftCell(col: ColumnDef<T>) {
    const val = draft[col.key as string]
    if (col.type === 'toggle') {
      return (
        <input
          type="checkbox"
          checked={!!val}
          onChange={(e) => setDraftField(col.key as string, e.target.checked)}
        />
      )
    }
    if (col.type === 'select') {
      return (
        <select
          value={String(val ?? '')}
          onChange={(e) => setDraftField(col.key as string, e.target.value)}
          className="border rounded px-2 py-1 text-sm w-full"
        >
          {col.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )
    }
    return (
      <Input
        placeholder={col.label}
        value={String(val ?? '')}
        onChange={(e) => setDraftField(col.key as string, e.target.value)}
      />
    )
  }

  return (
    <div className="border rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            {columns.map((c) => <th key={String(c.key)} className="text-left p-2 font-medium">{c.label}</th>)}
            {canEdit && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t">
              {columns.map((col) => (
                <td key={String(col.key)} className="p-2">{renderCell(row, col)}</td>
              ))}
              {canEdit && (
                <td className="p-2">
                  <Button variant="ghost" size="sm" onClick={() => onDelete(row.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </td>
              )}
            </tr>
          ))}
          {canEdit && (
            <tr className="border-t bg-muted/40">
              {columns.map((col) => (
                <td key={String(col.key)} className="p-2">{renderDraftCell(col)}</td>
              ))}
              <td className="p-2">
                <Button size="sm" onClick={handleAdd} disabled={adding}>Add</Button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
