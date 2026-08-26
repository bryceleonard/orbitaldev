export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { encryptPat } from '@/lib/ado/encryption'
import type { TrackerBoard } from '@/lib/types'

const COOKIE = process.env.SESSION_COOKIE_NAME ?? '__session'

async function getUid(req: NextRequest): Promise<string | null> {
  const cookie = req.cookies.get(COOKIE)?.value
  if (!cookie) return null
  try {
    const { uid } = await adminAuth.verifySessionCookie(cookie, true)
    return uid
  } catch {
    return null
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const uid = await getUid(req)
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId } = await params
  const body = await req.json() as {
    action: 'add' | 'edit' | 'remove'
    board?: Omit<TrackerBoard, 'adoPat'>
    boardId?: string
    orgId: string
    pat?: string
  }

  const { action, board, boardId, orgId, pat } = body
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 })

  const projRef = adminDb.doc(`orgs/${orgId}/projects/${projectId}`)
  const projSnap = await projRef.get()
  if (!projSnap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const data = projSnap.data()!
  const members = data['members'] as Record<string, string>
  if (members[uid] !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 })

  const boards: TrackerBoard[] = (data['trackerBoards'] ?? []) as TrackerBoard[]

  if (action === 'add' || action === 'edit') {
    if (!board) return NextResponse.json({ error: 'board required' }, { status: 400 })

    const encryptedPat = pat && pat.trim()
      ? encryptPat(pat.trim())
      : boards.find((b) => b.id === board.id)?.adoPat ?? ''

    const fullBoard: TrackerBoard = { ...board, adoPat: encryptedPat }

    const updated =
      action === 'add'
        ? [...boards, fullBoard]
        : boards.map((b) => (b.id === fullBoard.id ? fullBoard : b))

    await projRef.update({ trackerBoards: updated, updatedAt: new Date() })
    return NextResponse.json({ status: 'ok' })
  }

  if (action === 'remove') {
    if (!boardId) return NextResponse.json({ error: 'boardId required' }, { status: 400 })
    const updated = boards.filter((b) => b.id !== boardId)
    await projRef.update({ trackerBoards: updated, updatedAt: new Date() })

    // Delete cached data for the removed board
    const cacheSnap = await adminDb
      .collection(`orgs/${orgId}/projects/${projectId}/adoCache`)
      .where('boardId', '==', boardId)
      .get()
    const deletes = cacheSnap.docs.map((d) => d.ref.delete())
    await Promise.all(deletes)

    return NextResponse.json({ status: 'ok' })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
