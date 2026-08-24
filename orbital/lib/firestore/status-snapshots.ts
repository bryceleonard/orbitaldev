import { listItems, addItem } from './subcollection'
import type { StatusSnapshot } from '@/lib/types'

const path = (o: string, p: string) => `orgs/${o}/projects/${p}/statusSnapshots`
export const listStatusSnapshots = (o: string, p: string) => listItems<StatusSnapshot>(path(o, p))
export const addStatusSnapshot = (o: string, p: string, data: Omit<StatusSnapshot, 'id'>) =>
  addItem<StatusSnapshot>(path(o, p), data)
