import { listItems } from './subcollection'
import type { AdoCache } from '@/lib/types'

const path = (o: string, p: string) => `orgs/${o}/projects/${p}/adoCache`

function normalise(item: AdoCache): AdoCache {
  const ts = item.fetchedAt as unknown as { toDate?: () => Date }
  return {
    ...item,
    fetchedAt: ts?.toDate?.().toISOString() ?? String(item.fetchedAt),
  }
}

export async function getLatestCache(
  orgId: string,
  projectId: string,
  type: AdoCache['type'],
): Promise<AdoCache | null> {
  const all = await listItems<AdoCache>(path(orgId, projectId))
  const matches = all
    .filter((c) => c.type === type)
    .sort((a, b) => (a.fetchedAt > b.fetchedAt ? -1 : 1))
  return matches[0] ? normalise(matches[0]) : null
}

export async function getLatestBoardCache(
  orgId: string,
  projectId: string,
  boardId: string,
  type: AdoCache['type'],
): Promise<AdoCache | null> {
  const all = await listItems<AdoCache>(path(orgId, projectId))
  const matches = all
    .filter((c) => c.type === type && c.boardId === boardId)
    .sort((a, b) => (a.fetchedAt > b.fetchedAt ? -1 : 1))
  return matches[0] ? normalise(matches[0]) : null
}
