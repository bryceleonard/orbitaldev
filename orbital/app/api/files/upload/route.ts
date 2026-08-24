export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { getStorage } from 'firebase-admin/storage'

const COOKIE = process.env.SESSION_COOKIE_NAME ?? '__session'
const BUCKET = process.env.FIREBASE_STORAGE_BUCKET!

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
  const uid = await getUid(req)
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orgId, projectId, fileName, mimeType, sizeBytes } = await req.json()
  if (!orgId || !projectId || !fileName) {
    return NextResponse.json({ error: 'orgId, projectId, fileName required' }, { status: 400 })
  }

  const projSnap = await adminDb.doc(`orgs/${orgId}/projects/${projectId}`).get()
  if (!projSnap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const members = projSnap.data()!.members as Record<string, string>
  const role = members[uid]
  if (role !== 'owner' && role !== 'editor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const fileRef = adminDb.collection(`orgs/${orgId}/projects/${projectId}/files`).doc()
  const storagePath = `${orgId}/${projectId}/${fileRef.id}-${fileName}`

  await fileRef.set({
    name: fileName,
    storagePath,
    mimeType: mimeType ?? 'application/octet-stream',
    sizeBytes: sizeBytes ?? 0,
    uploadedBy: uid,
    uploadedAt: new Date().toISOString(),
    sharedWithClient: false,
  })

  const bucket = getStorage().bucket(BUCKET)
  const file = bucket.file(storagePath)
  const [uploadUrl] = await file.getSignedUrl({
    action: 'write',
    expires: Date.now() + 15 * 60 * 1000,
    contentType: mimeType ?? 'application/octet-stream',
  })

  return NextResponse.json({ uploadUrl, fileId: fileRef.id })
}
