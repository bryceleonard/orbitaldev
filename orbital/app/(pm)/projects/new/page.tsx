import { ProjectForm } from '@/components/projects/project-form'

export default function NewProjectPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-6">New project</h1>
      <ProjectForm />
    </div>
  )
}
