import { listItems, addItem, updateItem, deleteItem } from './subcollection'
import type { Risk } from '@/lib/types'

const path = (o: string, p: string) => `orgs/${o}/projects/${p}/risks`
export const listRisks = (o: string, p: string) => listItems<Risk>(path(o, p))
export const addRisk = (o: string, p: string, data: Omit<Risk, 'id'>) => addItem<Risk>(path(o, p), data)
export const updateRisk = (o: string, p: string, id: string, data: Partial<Risk>) => updateItem(path(o, p), id, data)
export const deleteRisk = (o: string, p: string, id: string) => deleteItem(path(o, p), id)
