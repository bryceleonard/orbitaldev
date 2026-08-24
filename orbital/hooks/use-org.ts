'use client'
import { useQuery } from '@tanstack/react-query'
import { getUserOrgId } from '@/lib/firestore/users'
import { useAuth } from './use-auth'

export function useOrgId(): string | undefined {
  const { user } = useAuth()
  const { data } = useQuery({
    queryKey: ['orgId', user?.uid],
    queryFn: () => getUserOrgId(user!.uid),
    enabled: !!user,
    staleTime: Infinity,
  })
  return data ?? undefined
}
