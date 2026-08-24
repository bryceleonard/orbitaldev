import { listItems, updateItem, deleteItem } from './subcollection'
import type { ProjectFile } from '@/lib/types'

const path = (o: string, p: string) => `orgs/${o}/projects/${p}/files`
export const listFiles = (o: string, p: string) => listItems<ProjectFile>(path(o, p))
export const updateFileShared = (o: string, p: string, id: string, sharedWithClient: boolean) =>
  updateItem(path(o, p), id, { sharedWithClient })
export const deleteFile = (o: string, p: string, id: string) => deleteItem(path(o, p), id)
