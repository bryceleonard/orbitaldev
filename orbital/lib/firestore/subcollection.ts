import {
  collection, doc, addDoc, getDocs,
  updateDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'

export async function listItems<T>(collectionPath: string): Promise<T[]> {
  const snap = await getDocs(collection(db, collectionPath))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T)
}

export async function addItem<T>(
  collectionPath: string,
  data: Omit<T, 'id'>,
): Promise<string> {
  const ref = await addDoc(collection(db, collectionPath), {
    ...data,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateItem(
  collectionPath: string,
  id: string,
  data: object,
): Promise<void> {
  await updateDoc(doc(db, collectionPath, id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteItem(collectionPath: string, id: string): Promise<void> {
  await deleteDoc(doc(db, collectionPath, id))
}
