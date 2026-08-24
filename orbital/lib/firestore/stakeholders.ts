import { listItems, addItem, updateItem, deleteItem } from './subcollection'
import type { Stakeholder } from '@/lib/types'

const path = (o: string, p: string) => `orgs/${o}/projects/${p}/stakeholders`
export const listStakeholders = (o: string, p: string) => listItems<Stakeholder>(path(o, p))
export const addStakeholder = (o: string, p: string, data: Omit<Stakeholder, 'id'>) => addItem<Stakeholder>(path(o, p), data)
export const updateStakeholder = (o: string, p: string, id: string, data: Partial<Stakeholder>) => updateItem(path(o, p), id, data)
export const deleteStakeholder = (o: string, p: string, id: string) => deleteItem(path(o, p), id)
