export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { encryptPat } from '@/lib/ado/encryption'

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
  const { adoOrgUrl, adoProject, adoTeam, pat, orgId } = await req.json()

  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 })

  const projSnap = await adminDb.doc(`orgs/${orgId}/projects/${projectId}`).get()
  if (!projSnap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const members = projSnap.data()!.members as Record<string, string>
  if (members[uid] !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 })

  const update: Record<string, string> = { adoOrgUrl, adoProject, adoTeam }
  if (pat && pat.trim()) {
    update.adoPat = encryptPat(pat.trim())
  }

  await adminDb.doc(`orgs/${orgId}/projects/${projectId}`).update({
    ...update,
    updatedAt: new Date(),
  })

  return NextResponse.json({ status: 'ok' })
}
