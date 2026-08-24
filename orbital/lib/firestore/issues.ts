import { listItems, addItem, updateItem, deleteItem } from './subcollection'
import type { Issue } from '@/lib/types'

const path = (o: string, p: string) => `orgs/${o}/projects/${p}/issues`
export const listIssues = (o: string, p: string) => listItems<Issue>(path(o, p))
export const addIssue = (o: string, p: string, data: Omit<Issue, 'id'>) => addItem<Issue>(path(o, p), data)
export const updateIssue = (o: string, p: string, id: string, data: Partial<Issue>) => updateItem(path(o, p), id, data)
export const deleteIssue = (o: string, p: string, id: string) => deleteItem(path(o, p), id)
