export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { getStorage } from 'firebase-admin/storage'

const COOKIE = process.env.SESSION_COOKIE_NAME ?? '__session'
const BUCKET = process.env.FIREBASE_STORAGE_BUCKET!
const MAX_SIZE_BYTES = 100 * 1024 * 1024 // 100 MB

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/zip',
  'application/x-zip-compressed',
])

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

  const resolvedMime: string = mimeType ?? 'application/octet-stream'
  if (!ALLOWED_MIME_TYPES.has(resolvedMime)) {
    return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })
  }

  if (typeof sizeBytes === 'number' && sizeBytes > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'File exceeds 100 MB limit' }, { status: 400 })
  }

  // Strip path separators and control characters from the filename
  const safeName = String(fileName).replace(/[/\\?%*:|"<>\0]/g, '_').trim()
  if (!safeName) return NextResponse.json({ error: 'Invalid file name' }, { status: 400 })

  const projSnap = await adminDb.doc(`orgs/${orgId}/projects/${projectId}`).get()
  if (!projSnap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const members = projSnap.data()!.members as Record<string, string>
  const role = members[uid]
  if (role !== 'owner' && role !== 'editor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const fileRef = adminDb.collection(`orgs/${orgId}/projects/${projectId}/files`).doc()
  const storagePath = `${orgId}/${projectId}/${fileRef.id}-${safeName}`

  await fileRef.set({
    name: safeName,
    storagePath,
    mimeType: resolvedMime,
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
    contentType: resolvedMime,
  })

  return NextResponse.json({ uploadUrl, fileId: fileRef.id })
}
