export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { fetchBacklog, fetchSprint, fetchDevPlan, fetchBeadsIssues } from '@/lib/ado/client'
import type { TrackerBoard, BeadsIssue } from '@/lib/types'

const COOKIE = process.env.SESSION_COOKIE_NAME ?? '__session'
const TTL_MS = 15 * 60 * 1000

type AdoCacheType = 'backlog' | 'sprint' | 'devplan' | 'beads-issues'

async function getUid(req: NextRequest): Promise<string | null> {
  const cookie = req.cookies.get(COOKIE)?.value
  if (!cookie) return null
  try {
    const decoded = await adminAuth.verifySessionCookie(cookie, true)
    return decoded.uid
  } catch {
    return null
  }
}

async function getOrgAndProject(
  projectId: string,
): Promise<{ orgId: string; project: Record<string, unknown> } | null> {
  const orgsSnap = await adminDb.collection('orgs').get()
  for (const orgDoc of orgsSnap.docs) {
    const projSnap = await adminDb.doc(`orgs/${orgDoc.id}/projects/${projectId}`).get()
    if (projSnap.exists) return { orgId: orgDoc.id, project: projSnap.data()! }
  }
  return null
}

async function getCached(
  orgId: string,
  projectId: string,
  boardId: string,
  type: AdoCacheType,
): Promise<Record<string, unknown> | null> {
  const snap = await adminDb
    .collection(`orgs/${orgId}/projects/${projectId}/adoCache`)
    .where('type', '==', type)
    .where('boardId', '==', boardId)
    .orderBy('fetchedAt', 'desc')
    .limit(1)
    .get()
  if (snap.empty) return null
  const data = snap.docs[0].data()
  const fetchedAt = data.fetchedAt?.toMillis?.() ?? 0
  if (Date.now() - fetchedAt < TTL_MS) return data
  return null
}

async function writeCache(
  orgId: string,
  projectId: string,
  boardId: string,
  type: AdoCacheType,
  payload: unknown,
): Promise<string> {
  const ref = adminDb.collection(`orgs/${orgId}/projects/${projectId}/adoCache`).doc()
  const fetchedAt = new Date()
  await ref.set({ boardId, type, payload, fetchedAt })
  return fetchedAt.toISOString()
}

function parseBeadsJsonl(text: string): BeadsIssue[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const raw = JSON.parse(line) as Record<string, unknown>
      return {
        ...raw,
        // Normalise parent field — Beads CLI uses snake_case; verify against real repo
        parentId: (raw['parent_id'] ?? raw['parentId'] ?? undefined) as string | undefined,
        labels: Array.isArray(raw['labels']) ? raw['labels'] as string[] : [],
        dependencies: Array.isArray(raw['dependencies']) ? raw['dependencies'] as string[] : [],
      } as BeadsIssue
    })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; boardId: string }> },
) {
  const uid = await getUid(req)
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, boardId } = await params
  const type = (req.nextUrl.searchParams.get('type') ?? 'sprint') as AdoCacheType
  const force = req.nextUrl.searchParams.get('force') === '1'

  const found = await getOrgAndProject(projectId)
  if (!found) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const { orgId, project } = found
  const members = project['members'] as Record<string, string>
  if (!members[uid]) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const boards = (project['trackerBoards'] ?? []) as TrackerBoard[]
  const board = boards.find((b) => b.id === boardId)
  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 })

  const cacheType: AdoCacheType = board.type === 'beads' ? 'beads-issues' : type

  if (!force) {
    const cached = await getCached(orgId, projectId, boardId, cacheType)
    if (cached) {
      return NextResponse.json({
        type: cacheType,
        payload: cached['payload'],
        fetchedAt: cached['fetchedAt'],
        fromCache: true,
      })
    }
  }

  const pat = process.env.ADO_PAT
  if (!pat) return NextResponse.json({ error: 'ADO_PAT environment variable is not configured' }, { status: 500 })

  try {
    if (board.type === 'beads') {
      const text = await fetchBeadsIssues(
        board.adoOrgUrl, board.adoProject, board.beadsRepo, board.beadsBranch || 'main', pat,
      )
      const issues = parseBeadsJsonl(text)
      const fetchedAt = await writeCache(orgId, projectId, boardId, 'beads-issues', issues)
      return NextResponse.json({ type: 'beads-issues', payload: issues, fetchedAt, fromCache: false })
    }

    let payload: unknown
    if (type === 'backlog') payload = await fetchBacklog(board.adoOrgUrl, board.adoProject, pat)
    else if (type === 'sprint') payload = await fetchSprint(board.adoOrgUrl, board.adoProject, board.adoTeam, pat)
    else payload = await fetchDevPlan(board.adoOrgUrl, board.adoProject, pat)

    const fetchedAt = await writeCache(orgId, projectId, boardId, type, payload)
    return NextResponse.json({ type, payload, fetchedAt, fromCache: false })
  } catch (e) {
    return NextResponse.json({ error: `Fetch failed: ${(e as Error).message}` }, { status: 502 })
  }
}
