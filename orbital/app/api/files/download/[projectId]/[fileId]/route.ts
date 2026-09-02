export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { getStorage } from 'firebase-admin/storage'

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; fileId: string }> },
) {
  const uid = await getUid(req)
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, fileId } = await params

  const orgsSnap = await adminDb.collection('orgs').get()
  let storagePath: string | null = null
  let fileName = 'download'
  let mimeType = 'application/octet-stream'

  for (const orgDoc of orgsSnap.docs) {
    const fileSnap = await adminDb
      .doc(`orgs/${orgDoc.id}/projects/${projectId}/files/${fileId}`)
      .get()
    if (!fileSnap.exists) continue

    const fileData = fileSnap.data()!
    const projSnap = await adminDb.doc(`orgs/${orgDoc.id}/projects/${projectId}`).get()
    const members = projSnap.data()?.members as Record<string, string> | undefined

    const isMember = !!members?.[uid]
    const isSharedWithClient = fileData.sharedWithClient === true

    if (!isMember && !isSharedWithClient) break

    storagePath = fileData.storagePath as string
    fileName = (fileData.name as string) ?? 'download'
    mimeType = (fileData.mimeType as string) ?? 'application/octet-stream'
    break
  }

  if (!storagePath) {
    return NextResponse.json({ error: 'Not found or access denied' }, { status: 404 })
  }

  const gcsFile = getStorage().bucket().file(storagePath)
  const [downloadUrl] = await gcsFile.getSignedUrl({
    action: 'read',
    expires: Date.now() + 5 * 60 * 1000,
  })

  const gcsRes = await fetch(downloadUrl)
  if (!gcsRes.ok) return NextResponse.json({ error: 'File not found in storage' }, { status: 404 })

  return new NextResponse(gcsRes.body, {
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
