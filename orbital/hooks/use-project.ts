'use client'
import { useQuery } from '@tanstack/react-query'
import { getProject } from '@/lib/firestore/projects'

export function useProject(orgId: string | undefined, projectId: string) {
  return useQuery({
    queryKey: ['project', orgId, projectId],
    queryFn: () => getProject(orgId!, projectId),
    enabled: !!orgId && !!projectId,
  })
}
