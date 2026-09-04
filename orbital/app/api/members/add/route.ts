export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

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

export async function POST(req: NextRequest) {
  const callerUid = await getUid(req)
  if (!callerUid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { email, orgId, projectId, role } = await req.json()
  if (!email || !orgId || !projectId || !role) {
    return NextResponse.json({ error: 'email, orgId, projectId, role required' }, { status: 400 })
  }

  // Verify caller is owner of the project
  const projSnap = await adminDb.doc(`orgs/${orgId}/projects/${projectId}`).get()
  if (!projSnap.exists) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  const members = projSnap.data()!.members as Record<string, string>
  if (members[callerUid] !== 'owner') {
    return NextResponse.json({ error: 'Only owners can add members' }, { status: 403 })
  }

  // Look up the user by email
  let targetUid: string
  try {
    const userRecord = await adminAuth.getUserByEmail(email.trim())
    targetUid = userRecord.uid
  } catch {
    return NextResponse.json({ error: `No account found for ${email}` }, { status: 404 })
  }

  // Add to project members
  await adminDb.doc(`orgs/${orgId}/projects/${projectId}`).update({
    [`members.${targetUid}`]: role,
    updatedAt: FieldValue.serverTimestamp(),
  })

  // Ensure the user is associated with this org
  await adminDb.doc(`orgs/${orgId}/users/${targetUid}`).set({
    uid: targetUid,
    email: email.trim(),
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true })
  await adminDb.doc(`users/${targetUid}`).set({
    orgId,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })

  return NextResponse.json({ uid: targetUid })
}
