import { listItems, addItem, updateItem, deleteItem } from './subcollection'
import type { HelpfulLink } from '@/lib/types'

const path = (o: string, p: string) => `orgs/${o}/projects/${p}/helpfulLinks`
export const listHelpfulLinks = (o: string, p: string) => listItems<HelpfulLink>(path(o, p))
export const addHelpfulLink = (o: string, p: string, data: Omit<HelpfulLink, 'id'>) => addItem<HelpfulLink>(path(o, p), data)
export const updateHelpfulLink = (o: string, p: string, id: string, data: Partial<HelpfulLink>) => updateItem(path(o, p), id, data)
export const deleteHelpfulLink = (o: string, p: string, id: string) => deleteItem(path(o, p), id)
