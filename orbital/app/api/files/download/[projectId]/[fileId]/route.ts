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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; fileId: string }> },
) {
  const uid = await getUid(req)
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, fileId } = await params

  const orgsSnap = await adminDb.collection('orgs').get()
  let storagePath: string | null = null

  for (const orgDoc of orgsSnap.docs) {
    const fileSnap = await adminDb
      .doc(`orgs/${orgDoc.id}/projects/${projectId}/files/${fileId}`)
      .get()
    if (fileSnap.exists) {
      const projSnap = await adminDb.doc(`orgs/${orgDoc.id}/projects/${projectId}`).get()
      const members = projSnap.data()?.members as Record<string, string> | undefined
      if (!members?.[uid]) break
      storagePath = fileSnap.data()!.storagePath as string
      break
    }
  }

  if (!storagePath) {
    return NextResponse.json({ error: 'Not found or access denied' }, { status: 404 })
  }

  const bucket = getStorage().bucket(BUCKET)
  const [downloadUrl] = await bucket.file(storagePath).getSignedUrl({
    action: 'read',
    expires: Date.now() + 5 * 60 * 1000,
  })

  return NextResponse.redirect(downloadUrl)
}
