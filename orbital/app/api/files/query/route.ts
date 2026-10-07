export const runtime = 'nodejs'

import { NextRequest } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import Anthropic from '@anthropic-ai/sdk'

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
  const uid = await getUid(req)
  if (!uid) return new Response('Unauthorized', { status: 401 })

  const { orgId, projectId, question } = await req.json()
  if (!orgId || !projectId || !question) {
    return new Response('orgId, projectId, question required', { status: 400 })
  }

  const projSnap = await adminDb.doc(`orgs/${orgId}/projects/${projectId}`).get()
  if (!projSnap.exists) return new Response('Not found', { status: 404 })
  const members = projSnap.data()!.members as Record<string, string>
  if (!members[uid]) return new Response('Forbidden', { status: 403 })

  const filesSnap = await adminDb
    .collection(`orgs/${orgId}/projects/${projectId}/files`)
    .where('aiStatus', '==', 'ready')
    .get()

  const sources = filesSnap.docs.map((d) => ({
    fileId: d.id,
    fileName: d.data().name as string,
    summary: d.data().aiSummary as string,
  }))

  if (sources.length === 0) {
    return new Response(
      'No processed files found in this project. Upload and process some files first.',
      { headers: { 'Content-Type': 'text/plain' } },
    )
  }

  const context = sources
    .map((s) => `[${s.fileName}]: ${s.summary}`)
    .join('\n\n')

  const system = `You are Orbital, an AI project intelligence assistant. Answer questions about the project using only the provided document summaries. Be concise and specific. If the answer is not in the summaries, say so.`

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system,
    messages: [
      {
        role: 'user',
        content: `Document summaries:\n${context}\n\nQuestion: ${question}`,
      },
    ],
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
        const citations = sources.map((s) => ({ fileId: s.fileId, fileName: s.fileName }))
        controller.enqueue(encoder.encode(`\nCITATIONS:${JSON.stringify({ citations })}`))
      } catch (err) {
        console.error('[/api/files/query] stream error:', err)
        const msg = err instanceof Error ? err.message : String(err)
        controller.enqueue(encoder.encode(`\nERROR:${msg}`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
