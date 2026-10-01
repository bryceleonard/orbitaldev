export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { getApp } from 'firebase-admin/app'
import { PDFParse } from 'pdf-parse'
import { extractIntelligence } from '@/lib/ai/extract'

const COOKIE = process.env.SESSION_COOKIE_NAME ?? '__session'
const BUCKET = process.env.FIREBASE_STORAGE_BUCKET!

// PPTX excluded: binary format requires dedicated parser (future task)
const PROCESSABLE = new Set([
  'text/plain',
  'text/markdown',
  'application/pdf',
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

async function fileToText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === 'application/pdf') {
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()
    return result.text
  }
  return buffer.toString('utf-8')
}

export async function POST(req: NextRequest) {
  const uid = await getUid(req)
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orgId, projectId, fileId } = await req.json()
  if (!orgId || !projectId || !fileId) {
    return NextResponse.json({ error: 'orgId, projectId, fileId required' }, { status: 400 })
  }

  const projSnap = await adminDb.doc(`orgs/${orgId}/projects/${projectId}`).get()
  if (!projSnap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const role = (projSnap.data()!.members as Record<string, string>)[uid]
  if (role !== 'owner' && role !== 'editor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const fileRef = adminDb.doc(`orgs/${orgId}/projects/${projectId}/files/${fileId}`)
  const fileSnap = await fileRef.get()
  if (!fileSnap.exists) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  const fileData = fileSnap.data()!
  const { aiStatus, storagePath, mimeType } = fileData as {
    aiStatus?: string
    storagePath: string
    mimeType: string
  }

  if (aiStatus === 'processing' || aiStatus === 'ready') {
    return NextResponse.json({ fileId, aiStatus }, { status: 200 })
  }

  if (!PROCESSABLE.has(mimeType)) {
    return NextResponse.json({ error: 'File type not supported for AI processing' }, { status: 422 })
  }

  await fileRef.update({ aiStatus: 'processing' })

  try {
    const { access_token } = await getApp().options.credential!.getAccessToken()
    const dlRes = await fetch(
      `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(storagePath)}?alt=media`,
      { headers: { Authorization: `Bearer ${access_token}` } },
    )
    if (!dlRes.ok) throw new Error(`Storage fetch failed: ${dlRes.status}`)

    const buffer = Buffer.from(await dlRes.arrayBuffer())
    const text = await fileToText(buffer, mimeType)
    const result = await extractIntelligence(text)

    await fileRef.update({
      aiStatus: 'ready',
      aiSummary: result.summary,
      aiProcessedAt: new Date().toISOString(),
      aiDrafts: {
        decisions: result.decisions,
        milestones: result.milestones,
        risks: result.risks,
        issues: result.issues,
      },
    })

    return NextResponse.json({ fileId, aiStatus: 'ready' })
  } catch (err) {
    console.error('[process] error', err)
    await fileRef.update({ aiStatus: 'error' })
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}
