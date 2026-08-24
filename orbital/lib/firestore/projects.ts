import {
  collection, doc, addDoc, getDoc, getDocs,
  updateDoc, deleteDoc, query, where,
  deleteField, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import type { Project, AccessLevel } from '@/lib/types'

type CreateData = Pick<Project, 'name' | 'description' | 'techStack' | 'pmTools'>

function projectPath(orgId: string) {
  return collection(db, `orgs/${orgId}/projects`)
}

export async function createProject(
  orgId: string,
  uid: string,
  data: CreateData,
): Promise<string> {
  const ref = await addDoc(projectPath(orgId), {
    ...data,
    orgId,
    status: 'active',
    adoOrgUrl: '',
    adoProject: '',
    adoTeam: '',
    adoPat: '',
    members: { [uid]: 'owner' },
    sow: { startDate: '', endDate: '', totalHours: 0, budgetHours: 0, summary: '' },
    statusHeader: {
      scheduleStatus: 'on_track',
      budgetStatus: 'on_track',
      scopeStatus: 'on_track',
    },
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function getProject(orgId: string, projectId: string): Promise<Project | null> {
  const snap = await getDoc(doc(db, `orgs/${orgId}/projects/${projectId}`))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Project
}

export async function listProjects(orgId: string, uid: string): Promise<Project[]> {
  const q = query(projectPath(orgId), where(`members.${uid}`, '!=', null))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Project)
}

export async function updateProject(
  orgId: string,
  projectId: string,
  data: Partial<Project>,
): Promise<void> {
  await updateDoc(doc(db, `orgs/${orgId}/projects/${projectId}`), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function archiveProject(orgId: string, projectId: string): Promise<void> {
  await updateDoc(doc(db, `orgs/${orgId}/projects/${projectId}`), {
    status: 'archived',
    updatedAt: serverTimestamp(),
  })
}

export async function deleteProject(orgId: string, projectId: string): Promise<void> {
  await deleteDoc(doc(db, `orgs/${orgId}/projects/${projectId}`))
}

export async function addMember(
  orgId: string,
  projectId: string,
  uid: string,
  role: AccessLevel,
): Promise<void> {
  await updateDoc(doc(db, `orgs/${orgId}/projects/${projectId}`), {
    [`members.${uid}`]: role,
    updatedAt: serverTimestamp(),
  })
}

export async function removeMember(
  orgId: string,
  projectId: string,
  uid: string,
): Promise<void> {
  await updateDoc(doc(db, `orgs/${orgId}/projects/${projectId}`), {
    [`members.${uid}`]: deleteField(),
    updatedAt: serverTimestamp(),
  })
}
