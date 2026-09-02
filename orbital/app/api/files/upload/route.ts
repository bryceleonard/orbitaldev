export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { getStorage } from 'firebase-admin/storage'

const COOKIE = process.env.SESSION_COOKIE_NAME ?? '__session'
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

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const orgId = formData.get('orgId') as string | null
  const projectId = formData.get('projectId') as string | null

  if (!file || !orgId || !projectId) {
    return NextResponse.json({ error: 'file, orgId, projectId required' }, { status: 400 })
  }

  const resolvedMime = file.type || 'application/octet-stream'
  if (!ALLOWED_MIME_TYPES.has(resolvedMime)) {
    return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'File exceeds 100 MB limit' }, { status: 400 })
  }

  const safeName = String(file.name).replace(/[/\\?%*:|"<>\0]/g, '_').trim()
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

  let uploadUrl: string
  try {
    const bucket = getStorage().bucket()
    console.log('[upload] bucket name:', bucket.name)
    const gcsFile = bucket.file(storagePath)
    const [url] = await gcsFile.getSignedUrl({
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000,
      contentType: resolvedMime,
    })
    uploadUrl = url
    console.log('[upload] signed URL obtained')
  } catch (err) {
    console.error('[upload] getSignedUrl failed:', err)
    return NextResponse.json({ error: 'Could not generate upload URL' }, { status: 500 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': resolvedMime },
    body: buffer,
  })
  if (!putRes.ok) {
    const body = await putRes.text()
    console.error('[upload] PUT failed', putRes.status, body)
    await fileRef.delete()
    return NextResponse.json({ error: 'Storage upload failed' }, { status: 500 })
  }

  await fileRef.set({
    name: safeName,
    storagePath,
    mimeType: resolvedMime,
    sizeBytes: file.size,
    uploadedBy: uid,
    uploadedAt: new Date().toISOString(),
    sharedWithClient: false,
  })

  return NextResponse.json({ fileId: fileRef.id })
}
