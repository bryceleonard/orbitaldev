export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { decryptPat } from '@/lib/ado/encryption'
import { fetchBacklog, fetchSprint, fetchDevPlan } from '@/lib/ado/client'

const COOKIE = process.env.SESSION_COOKIE_NAME ?? '__session'
const TTL_MS = 15 * 60 * 1000

type CacheType = 'backlog' | 'sprint' | 'devplan'

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

async function getOrgIdForProject(
  projectId: string,
): Promise<{ orgId: string; project: Record<string, unknown> } | null> {
  const orgsSnap = await adminDb.collection('orgs').get()
  for (const orgDoc of orgsSnap.docs) {
    const projSnap = await adminDb.doc(`orgs/${orgDoc.id}/projects/${projectId}`).get()
    if (projSnap.exists) return { orgId: orgDoc.id, project: projSnap.data()! }
  }
  return null
}

async function getCachedEntry(orgId: string, projectId: string, type: CacheType) {
  const snap = await adminDb
    .collection(`orgs/${orgId}/projects/${projectId}/adoCache`)
    .where('type', '==', type)
    .orderBy('fetchedAt', 'desc')
    .limit(1)
    .get()
  if (snap.empty) return null
  const docData = snap.docs[0].data()
  const fetchedAt = docData.fetchedAt?.toMillis?.() ?? 0
  if (Date.now() - fetchedAt < TTL_MS) return docData
  return null
}

async function writeCache(
  orgId: string,
  projectId: string,
  type: CacheType,
  payload: unknown,
): Promise<void> {
  const ref = adminDb.collection(`orgs/${orgId}/projects/${projectId}/adoCache`).doc()
  await ref.set({ type, payload, fetchedAt: new Date() })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const uid = await getUid(req)
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId } = await params
  const type = (req.nextUrl.searchParams.get('type') ?? 'sprint') as CacheType
  const force = req.nextUrl.searchParams.get('force') === '1'

  const found = await getOrgIdForProject(projectId)
  if (!found) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const { orgId, project } = found
  const members = project.members as Record<string, string>
  if (!members[uid]) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!force) {
    const cached = await getCachedEntry(orgId, projectId, type)
    if (cached) {
      return NextResponse.json({ type, payload: cached.payload, fetchedAt: cached.fetchedAt, fromCache: true })
    }
  }

  let pat: string
  try {
    pat = decryptPat(project.adoPat as string)
  } catch {
    return NextResponse.json({ error: 'PAT decryption failed — reconfigure ADO settings' }, { status: 500 })
  }

  const adoOrgUrl = project.adoOrgUrl as string
  const adoProject = project.adoProject as string
  const adoTeam = project.adoTeam as string

  let payload: unknown
  try {
    if (type === 'backlog') payload = await fetchBacklog(adoOrgUrl, adoProject, pat)
    else if (type === 'sprint') payload = await fetchSprint(adoOrgUrl, adoProject, adoTeam, pat)
    else payload = await fetchDevPlan(adoOrgUrl, adoProject, pat)
  } catch (e) {
    return NextResponse.json({ error: `ADO fetch failed: ${(e as Error).message}` }, { status: 502 })
  }

  const fetchedAt = new Date().toISOString()
  await writeCache(orgId, projectId, type, payload)

  return NextResponse.json({ type, payload, fetchedAt, fromCache: false })
}
