import { listItems, addItem, updateItem, deleteItem } from './subcollection'
import type { Decision } from '@/lib/types'

const path = (o: string, p: string) => `orgs/${o}/projects/${p}/decisions`
export const listDecisions = (o: string, p: string) => listItems<Decision>(path(o, p))
export const addDecision = (o: string, p: string, data: Omit<Decision, 'id'>) => addItem<Decision>(path(o, p), data)
export const updateDecision = (o: string, p: string, id: string, data: Partial<Decision>) => updateItem(path(o, p), id, data)
export const deleteDecision = (o: string, p: string, id: string) => deleteItem(path(o, p), id)
