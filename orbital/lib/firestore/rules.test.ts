import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'orbital-test',
    firestore: {
      rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })
})

afterEach(() => testEnv.clearFirestore())
afterAll(() => testEnv.cleanup())

const ORG = 'org1'
const PROJECT = 'proj1'
const OWNER_UID = 'user-owner'
const EDITOR_UID = 'user-editor'
const VIEWER_UID = 'user-viewer'
const OUTSIDER_UID = 'user-outsider'

async function seedProject() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, `orgs/${ORG}`), { name: 'Test Org' })
    await setDoc(doc(db, `orgs/${ORG}/users/${OWNER_UID}`), { email: 'owner@test.com' })
    await setDoc(doc(db, `orgs/${ORG}/users/${EDITOR_UID}`), { email: 'editor@test.com' })
    await setDoc(doc(db, `orgs/${ORG}/users/${VIEWER_UID}`), { email: 'viewer@test.com' })
    await setDoc(doc(db, `orgs/${ORG}/projects/${PROJECT}`), {
      orgId: ORG,
      name: 'Test Project',
      members: {
        [OWNER_UID]: 'owner',
        [EDITOR_UID]: 'editor',
        [VIEWER_UID]: 'viewer',
      },
    })
  })
}

test('unauthenticated user cannot read projects', async () => {
  await seedProject()
  const ctx = testEnv.unauthenticatedContext()
  await assertFails(getDoc(doc(ctx.firestore(), `orgs/${ORG}/projects/${PROJECT}`)))
})

test('owner can read their project', async () => {
  await seedProject()
  const ctx = testEnv.authenticatedContext(OWNER_UID)
  await assertSucceeds(getDoc(doc(ctx.firestore(), `orgs/${ORG}/projects/${PROJECT}`)))
})

test('editor can read project and write subcollections', async () => {
  await seedProject()
  const ctx = testEnv.authenticatedContext(EDITOR_UID)
  await assertSucceeds(getDoc(doc(ctx.firestore(), `orgs/${ORG}/projects/${PROJECT}`)))
  await assertSucceeds(
    setDoc(doc(ctx.firestore(), `orgs/${ORG}/projects/${PROJECT}/risks/r1`), {
      orgId: ORG, title: 'Risk', owner: 'Ed', severity: 'low',
      description: '', status: 'open', createdAt: '', updatedAt: '',
    })
  )
})

test('viewer cannot write to project subcollections', async () => {
  await seedProject()
  const ctx = testEnv.authenticatedContext(VIEWER_UID)
  await assertFails(
    setDoc(doc(ctx.firestore(), `orgs/${ORG}/projects/${PROJECT}/risks/r1`), {
      orgId: ORG, title: 'Risk',
    })
  )
})

test('outsider cannot read project', async () => {
  await seedProject()
  const ctx = testEnv.authenticatedContext(OUTSIDER_UID)
  await assertFails(getDoc(doc(ctx.firestore(), `orgs/${ORG}/projects/${PROJECT}`)))
})

test('editor cannot delete project — only owner can', async () => {
  await seedProject()
  const editorCtx = testEnv.authenticatedContext(EDITOR_UID)
  await assertFails(deleteDoc(doc(editorCtx.firestore(), `orgs/${ORG}/projects/${PROJECT}`)))
  const ownerCtx = testEnv.authenticatedContext(OWNER_UID)
  await assertSucceeds(deleteDoc(doc(ownerCtx.firestore(), `orgs/${ORG}/projects/${PROJECT}`)))
})

test('org member cannot read a different org', async () => {
  await seedProject()
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'orgs/other-org/projects/proj2'), {
      orgId: 'other-org', name: 'Other', members: {},
    })
  })
  const ctx = testEnv.authenticatedContext(OWNER_UID)
  await assertFails(getDoc(doc(ctx.firestore(), 'orgs/other-org/projects/proj2')))
})
