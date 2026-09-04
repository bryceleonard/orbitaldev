'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pencil, Trash2, Check, X } from 'lucide-react'

export type ColumnDef<T> = {
  key: keyof T
  label: string
  type?: 'text' | 'select' | 'toggle' | 'textarea' | 'date' | 'number'
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
      type === 'toggle' ? false : type === 'number' ? 0 : type === 'select' ? (options?.[0] ?? '') : '',
    ])
  )
}

function rowToDraft<T>(row: T, columns: ColumnDef<T>[]): Record<string, unknown> {
  return Object.fromEntries(columns.map(({ key }) => [key, row[key]]))
}

export function CrudTable<T extends { id: string }>({ columns, rows, canEdit, onAdd, onUpdate, onDelete }: Props<T>) {
  const [draft, setDraft] = useState<Record<string, unknown>>(emptyDraft(columns))
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)

  function setDraftField(key: string, value: unknown) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  function setEditField(key: string, value: unknown) {
    setEditDraft((d) => ({ ...d, [key]: value }))
  }

  function startEdit(row: T) {
    setEditingId(row.id)
    setEditDraft(rowToDraft(row, columns))
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft({})
  }

  async function saveEdit(id: string) {
    setSaving(true)
    await onUpdate(id, editDraft as Partial<T>)
    setEditingId(null)
    setEditDraft({})
    setSaving(false)
  }

  async function handleAdd() {
    setAdding(true)
    await onAdd(draft as Omit<T, 'id'>)
    setDraft(emptyDraft(columns))
    setAdding(false)
  }

  function renderEditCell(col: ColumnDef<T>) {
    const val = editDraft[col.key as string]
    if (col.type === 'toggle') {
      return (
        <input
          type="checkbox"
          checked={!!val}
          onChange={(e) => setEditField(col.key as string, e.target.checked)}
        />
      )
    }
    if (col.type === 'select') {
      return (
        <select
          value={String(val ?? '')}
          onChange={(e) => setEditField(col.key as string, e.target.value)}
          className="border rounded px-2 py-1 text-sm w-full"
        >
          {col.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )
    }
    if (col.type === 'textarea') {
      return (
        <textarea
          value={String(val ?? '')}
          onChange={(e) => setEditField(col.key as string, e.target.value)}
          rows={2}
          className="border rounded px-2 py-1 text-sm w-full resize-none focus:outline-none focus:ring-1 focus:ring-ring"
        />
      )
    }
    if (col.type === 'date') {
      return (
        <input
          type="date"
          value={String(val ?? '')}
          onChange={(e) => setEditField(col.key as string, e.target.value)}
          className="border rounded px-2 py-1 text-sm w-full"
        />
      )
    }
    if (col.type === 'number') {
      return (
        <input
          type="number"
          min={0}
          value={Number(val ?? 0)}
          onChange={(e) => setEditField(col.key as string, Number(e.target.value))}
          className="border rounded px-2 py-1 text-sm w-full"
        />
      )
    }
    return (
      <Input
        value={String(val ?? '')}
        onChange={(e) => setEditField(col.key as string, e.target.value)}
      />
    )
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
    if (col.type === 'textarea') {
      return (
        <textarea
          value={String(val ?? '')}
          onChange={(e) => setDraftField(col.key as string, e.target.value)}
          rows={2}
          placeholder={col.label}
          className="border rounded px-2 py-1 text-sm w-full resize-none focus:outline-none focus:ring-1 focus:ring-ring"
        />
      )
    }
    if (col.type === 'date') {
      return (
        <input
          type="date"
          value={String(val ?? '')}
          onChange={(e) => setDraftField(col.key as string, e.target.value)}
          className="border rounded px-2 py-1 text-sm w-full"
        />
      )
    }
    if (col.type === 'number') {
      return (
        <input
          type="number"
          min={0}
          value={Number(val ?? 0)}
          onChange={(e) => setDraftField(col.key as string, Number(e.target.value))}
          className="border rounded px-2 py-1 text-sm w-full"
        />
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
              {editingId === row.id
                ? columns.map((col) => (
                    <td key={String(col.key)} className="p-2">{renderEditCell(col)}</td>
                  ))
                : columns.map((col) => (
                    <td key={String(col.key)} className="p-2">{renderCell(row, col)}</td>
                  ))
              }
              {canEdit && (
                <td className="p-2">
                  {editingId === row.id ? (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => saveEdit(row.id)} disabled={saving}>
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={cancelEdit}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(row)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onDelete(row.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
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
