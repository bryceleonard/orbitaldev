import { redirect } from 'next/navigation'

export default async function PortalProjectIndexPage({
  params,
}: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  redirect(`/portal/${projectId}/overview`)
}
