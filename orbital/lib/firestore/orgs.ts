import {
  collection, doc, addDoc, setDoc, getDocs,
  query, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'

export async function createOrg(
  name: string,
  uid: string,
  email: string,
  displayName: string,
): Promise<string> {
  const orgRef = await addDoc(collection(db, 'orgs'), {
    name,
    plan: 'free',
    createdAt: serverTimestamp(),
  })
  await setDoc(doc(db, `orgs/${orgRef.id}/users/${uid}`), {
    uid,
    email,
    displayName,
    createdAt: serverTimestamp(),
  })
  return orgRef.id
}

export async function joinOrg(
  orgId: string,
  uid: string,
  email: string,
  displayName: string,
): Promise<void> {
  await setDoc(doc(db, `orgs/${orgId}/users/${uid}`), {
    uid,
    email,
    displayName,
    createdAt: serverTimestamp(),
  })
}

export async function orgExists(orgId: string): Promise<boolean> {
  const snap = await getDocs(query(collection(db, `orgs/${orgId}/users`)))
  return !snap.empty
}
