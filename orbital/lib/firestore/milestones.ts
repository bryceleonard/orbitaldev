import { collection, doc, addDoc, getDocs, updateDoc, deleteDoc, serverTimestamp, arrayUnion } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import type { Milestone, MilestoneStatus, MilestoneHistoryEntry } from '@/lib/types'

const path = (o: string, p: string) => `orgs/${o}/projects/${p}/milestones`

export async function listMilestones(orgId: string, projectId: string): Promise<Milestone[]> {
  const snap = await getDocs(collection(db, path(orgId, projectId)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Milestone)
}

export async function addMilestone(
  orgId: string,
  projectId: string,
  data: { name: string; startDate: string; endDate: string; createdBy: string },
): Promise<string> {
  const ref = await addDoc(collection(db, path(orgId, projectId)), {
    ...data,
    status: 'not_started' as MilestoneStatus,
    history: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateMilestone(
  orgId: string,
  projectId: string,
  id: string,
  data: { name?: string; startDate?: string; endDate?: string },
): Promise<void> {
  await updateDoc(doc(db, path(orgId, projectId), id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function updateMilestoneStatus(
  orgId: string,
  projectId: string,
  id: string,
  fromStatus: MilestoneStatus,
  toStatus: MilestoneStatus,
): Promise<void> {
  const entry: MilestoneHistoryEntry = {
    timestamp: new Date().toISOString(),
    fromStatus,
    toStatus,
  }
  await updateDoc(doc(db, path(orgId, projectId), id), {
    status: toStatus,
    updatedAt: serverTimestamp(),
    history: arrayUnion(entry),
  })
}

export async function deleteMilestone(orgId: string, projectId: string, id: string): Promise<void> {
  await deleteDoc(doc(db, path(orgId, projectId), id))
}
