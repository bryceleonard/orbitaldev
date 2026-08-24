import { listItems, addItem, updateItem, deleteItem } from './subcollection'
import type { ClientAction } from '@/lib/types'

const path = (o: string, p: string) => `orgs/${o}/projects/${p}/clientActions`
export const listClientActions = (o: string, p: string) => listItems<ClientAction>(path(o, p))
export const addClientAction = (o: string, p: string, data: Omit<ClientAction, 'id'>) => addItem<ClientAction>(path(o, p), data)
export const updateClientAction = (o: string, p: string, id: string, data: Partial<ClientAction>) => updateItem(path(o, p), id, data)
export const deleteClientAction = (o: string, p: string, id: string) => deleteItem(path(o, p), id)
