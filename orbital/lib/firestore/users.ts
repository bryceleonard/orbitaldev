import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'

export async function setUserOrg(uid: string, orgId: string): Promise<void> {
  await setDoc(doc(db, `users/${uid}`), { orgId, updatedAt: serverTimestamp() })
}

export async function getUserOrgId(uid: string): Promise<string | null> {
  const snap = await getDoc(doc(db, `users/${uid}`))
  if (!snap.exists()) return null
  return snap.data().orgId ?? null
}
