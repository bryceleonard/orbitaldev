import { listItems, addItem, updateItem, deleteItem } from './subcollection'
import type { RoadmapItem } from '@/lib/types'

const path = (o: string, p: string) => `orgs/${o}/projects/${p}/roadmapItems`
export const listRoadmapItems = (o: string, p: string) => listItems<RoadmapItem>(path(o, p))
export const addRoadmapItem = (o: string, p: string, data: Omit<RoadmapItem, 'id'>) => addItem<RoadmapItem>(path(o, p), data)
export const updateRoadmapItem = (o: string, p: string, id: string, data: Partial<RoadmapItem>) => updateItem(path(o, p), id, data)
export const deleteRoadmapItem = (o: string, p: string, id: string) => deleteItem(path(o, p), id)
