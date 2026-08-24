import { listItems, addItem, updateItem, deleteItem } from './subcollection'
import type { Resource } from '@/lib/types'

const path = (o: string, p: string) => `orgs/${o}/projects/${p}/resources`
export const listResources = (o: string, p: string) => listItems<Resource>(path(o, p))
export const addResource = (o: string, p: string, data: Omit<Resource, 'id'>) => addItem<Resource>(path(o, p), data)
export const updateResource = (o: string, p: string, id: string, data: Partial<Resource>) => updateItem(path(o, p), id, data)
export const deleteResource = (o: string, p: string, id: string) => deleteItem(path(o, p), id)
