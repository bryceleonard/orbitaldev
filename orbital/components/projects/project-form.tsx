'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { useOrgIdWithStatus } from '@/hooks/use-org'
import { createProject } from '@/lib/firestore/projects'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ProjectForm() {
  const { user } = useAuth()
  const { orgId, isLoading: orgLoading } = useOrgIdWithStatus()
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !name.trim()) return
    if (!orgId) {
      setError('No workspace found. Please complete onboarding first.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const projectId = await createProject(orgId, user.uid, {
        name: name.trim(),
        description: description.trim(),
        techStack: [],
        pmTools: [],
      })
      router.push(`/projects/${projectId}/overview`)
    } catch (err) {
      console.error('[createProject] orgId:', orgId, 'uid:', user.uid, 'error:', err)
      setError('Failed to create project.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-lg">
      <div>
        <Label htmlFor="name">Project name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <Label htmlFor="desc">Description</Label>
        <Input id="desc" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={loading || orgLoading || !name.trim()}>
        {loading ? 'Creating…' : 'Create project'}
      </Button>
    </form>
  )
}
