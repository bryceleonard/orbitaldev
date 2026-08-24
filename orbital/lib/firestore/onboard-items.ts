import { listItems, addItem, updateItem, deleteItem } from './subcollection'
import type { OnboardItem } from '@/lib/types'

const path = (o: string, p: string) => `orgs/${o}/projects/${p}/onboardItems`
export const listOnboardItems = (o: string, p: string) => listItems<OnboardItem>(path(o, p))
export const addOnboardItem = (o: string, p: string, data: Omit<OnboardItem, 'id'>) => addItem<OnboardItem>(path(o, p), data)
export const updateOnboardItem = (o: string, p: string, id: string, data: Partial<OnboardItem>) => updateItem(path(o, p), id, data)
export const deleteOnboardItem = (o: string, p: string, id: string) => deleteItem(path(o, p), id)
