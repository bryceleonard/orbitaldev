export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import type { Project, Risk, Milestone, Resource, BeadsIssue, StatusLevel, MilestoneStatus } from '@/lib/types'

const COOKIE = process.env.SESSION_COOKIE_NAME ?? '__session'

async function getUid(req: NextRequest): Promise<string | null> {
  const cookie = req.cookies.get(COOKIE)?.value
  if (!cookie) return null
  try {
    const decoded = await adminAuth.verifySessionCookie(cookie, true)
    return decoded.uid
  } catch {
    return null
  }
}

async function findOrgAndProject(
  projectId: string,
): Promise<{ orgId: string; project: Project } | null> {
  const orgsSnap = await adminDb.collection('orgs').get()
  for (const orgDoc of orgsSnap.docs) {
    const projSnap = await adminDb.doc(`orgs/${orgDoc.id}/projects/${projectId}`).get()
    if (projSnap.exists) {
      return { orgId: orgDoc.id, project: { id: projSnap.id, ...projSnap.data() } as Project }
    }
  }
  return null
}

async function listCollection<T>(path: string): Promise<T[]> {
  const snap = await adminDb.collection(path).get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T)
}

function schedulePercent(sow: Project['sow']): number {
  if (!sow.startDate || !sow.endDate) return 0
  const start = new Date(sow.startDate).getTime()
  const end = new Date(sow.endDate).getTime()
  if (end - start <= 0) return 0
  return Math.min(100, Math.round(((Date.now() - start) / (end - start)) * 100))
}

function scheduleDays(sow: Project['sow']): { elapsed: number; total: number } {
  if (!sow.startDate || !sow.endDate) return { elapsed: 0, total: 0 }
  const start = new Date(sow.startDate).getTime()
  const end = new Date(sow.endDate).getTime()
  if (end - start <= 0) return { elapsed: 0, total: 0 }
  const total = Math.round((end - start) / 86_400_000)
  const elapsed = Math.min(total, Math.max(0, Math.round((Date.now() - start) / 86_400_000)))
  return { elapsed, total }
}

const STATUS_LABEL: Record<StatusLevel, string> = {
  on_track: 'On Track',
  at_risk: 'At Risk',
  off_track: 'Off Track',
}

const STATUS_COLOR: Record<StatusLevel, string> = {
  on_track: '#16a34a',
  at_risk: '#d97706',
  off_track: '#dc2626',
}

const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = {
  backlog: 'Backlog',
  not_started: 'Not Started',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  completed: 'Completed',
}

const MILESTONE_STATUS_COLOR: Record<MilestoneStatus, string> = {
  backlog: '#6b7280',
  not_started: '#6b7280',
  in_progress: '#1d4ed8',
  blocked: '#dc2626',
  completed: '#16a34a',
}

const SEVERITY_COLOR: Record<string, string> = {
  low: '#1d4ed8',
  medium: '#d97706',
  high: '#dc2626',
}

// --- Gantt helpers (mirrors milestones-gantt.tsx logic) ---

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function daysFrac(rangeStart: Date, date: Date, totalDays: number): number {
  return Math.max(0, Math.min(1, (date.getTime() - rangeStart.getTime()) / (86_400_000 * totalDays)))
}

function getMondaysInRange(start: Date, end: Date): Date[] {
  const mondays: Date[] = []
  const cur = new Date(start)
  const dow = cur.getDay()
  if (dow !== 1) cur.setDate(cur.getDate() + (dow === 0 ? 1 : 8 - dow))
  while (cur <= end) { mondays.push(new Date(cur)); cur.setDate(cur.getDate() + 7) }
  return mondays
}

const GANTT_BAR: Record<MilestoneStatus, { bg: string; border: string; color: string }> = {
  backlog:     { bg: '#f3f4f6', border: '#e5e7eb', color: '#6b7280' },
  not_started: { bg: '#f3f4f6', border: '#e5e7eb', color: '#6b7280' },
  in_progress: { bg: '#eff6ff', border: '#bfdbfe', color: '#2563eb' },
  blocked:     { bg: '#fef2f2', border: '#fecaca', color: '#dc2626' },
  completed:   { bg: '#dcfce7', border: '#86efac', color: '#15803d' },
}

function ganttHtml(milestones: Milestone[]): string {
  const withDates = milestones.filter(
    (m): m is Milestone & { startDate: string; endDate: string } =>
      m.status !== 'backlog' && !!m.startDate && !!m.endDate,
  )
  if (withDates.length === 0) return ''

  const sorted = [...withDates].sort((a, b) => a.startDate.localeCompare(b.startDate))
  const allDates = sorted.flatMap((m) => [new Date(m.startDate), new Date(m.endDate)])
  const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())))
  const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())))
  const rangeStart = addDays(minDate, -7)
  const rangeEnd = addDays(maxDate, 7)
  const totalDays = (rangeEnd.getTime() - rangeStart.getTime()) / 86_400_000
  const mondays = getMondaysInRange(rangeStart, rangeEnd)
  const weeks = mondays.length
  const minWidth = Math.max(700, weeks * 80 + 220)

  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const headerLabels = mondays.map((m) => {
    const left = (daysFrac(rangeStart, m, totalDays) * 100).toFixed(2)
    return `<span style="position:absolute;top:4px;font-size:11px;color:#9ca3af;user-select:none;left:${left}%;transform:translateX(-50%);">${fmt(m)}</span>`
  }).join('')

  const gridlines = (extra = '') => mondays.map((m) => {
    const left = (daysFrac(rangeStart, m, totalDays) * 100).toFixed(2)
    return `<div style="position:absolute;top:0;bottom:0;left:${left}%;border-left:1px solid #f3f4f6;${extra}"></div>`
  }).join('')

  const rows = sorted.map((m, i) => {
    const startFrac = daysFrac(rangeStart, new Date(m.startDate), totalDays)
    const endFrac = daysFrac(rangeStart, new Date(m.endDate), totalDays)
    const widthFrac = Math.max(0.01, endFrac - startFrac)
    const { bg, border, color } = GANTT_BAR[m.status]
    const left = (startFrac * 100).toFixed(2)
    const width = (widthFrac * 100).toFixed(2)
    const rowBg = i % 2 === 1 ? '#f9fafb' : '#fff'
    return `
      <div style="display:flex;border-bottom:1px solid #f3f4f6;height:48px;align-items:center;background:${rowBg};">
        <div style="flex-shrink:0;width:220px;padding:0 12px;font-size:13px;font-weight:500;color:#111827;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;position:sticky;left:0;z-index:1;background:${rowBg};border-right:1px solid #f3f4f6;">${esc(m.name)}</div>
        <div style="flex:1;position:relative;height:100%;">
          ${gridlines()}
          <div style="position:absolute;top:12px;height:24px;left:${left}%;width:${width}%;background:${bg};border:1px solid ${border};border-radius:4px;display:flex;align-items:center;padding:0 8px;overflow:hidden;">
            <span style="font-size:11px;color:${color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(m.name)}</span>
          </div>
        </div>
      </div>`
  }).join('')

  return `
    <div style="overflow-x:auto;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:32px;">
      <div style="min-width:${minWidth}px;">
        <div style="display:flex;border-bottom:1px solid #e5e7eb;background:#fff;">
          <div style="flex-shrink:0;width:220px;border-right:1px solid #f3f4f6;position:sticky;left:0;z-index:2;background:#fff;"></div>
          <div style="flex:1;position:relative;height:32px;">${headerLabels}</div>
        </div>
        ${rows}
      </div>
    </div>`
}

// -----------------------------------------------------------

function esc(s: string | undefined | null): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function badge(text: string, color: string): string {
  return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;border:1px solid ${color}33;background:${color}18;color:${color};font-size:11px;font-weight:600;">${esc(text)}</span>`
}

function metricBlock(label: string, percent: number, status: StatusLevel, detail: string): string {
  const color = STATUS_COLOR[status]
  return `
    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:20px;flex:1;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;">${esc(label)}</p>
      <p style="margin:0 0 10px;font-size:36px;font-weight:700;color:#111827;">${percent}%</p>
      <div style="height:8px;background:#f3f4f6;border-radius:4px;margin-bottom:8px;overflow:hidden;">
        <div style="height:100%;width:${percent}%;background:${color};border-radius:4px;"></div>
      </div>
      <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:${color};">${esc(STATUS_LABEL[status])}</p>
      <p style="margin:0;font-size:12px;color:#6b7280;">${esc(detail)}</p>
    </div>`
}

function generateHtml(
  project: Project,
  risks: Risk[],
  milestones: Milestone[],
  resources: Resource[],
): string {
  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const schedulePct = schedulePercent(project.sow)
  const { elapsed, total } = scheduleDays(project.sow)
  const hoursConsumed = project.hoursUsed ?? 0
  const budgetPct = project.sow.totalHours
    ? Math.min(100, Math.round((hoursConsumed / project.sow.totalHours) * 100))
    : 0

  const openRisks = risks.filter((r) => r.status === 'open')
  const sortedMilestones = [...milestones]
    .filter((m) => m.status !== 'backlog')
    .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''))
  const backlogItems = milestones.filter((m) => m.status === 'backlog')
  const totalHours = resources.reduce((s, r) => s + r.hours, 0)
  const totalCurrentHours = resources.reduce((s, r) => s + (r.currentHours ?? 0), 0)

  const techStackHtml = project.techStack.length
    ? project.techStack.map((t) => `<span style="display:inline-block;padding:2px 8px;border-radius:4px;background:#f3f4f6;font-size:12px;color:#374151;">${esc(t)}</span>`).join(' ')
    : ''

  const teamRows = resources.map((r, i) => `
    <tr style="${i % 2 === 1 ? 'background:#f9fafb;' : ''}">
      <td style="padding:8px 12px;color:#9ca3af;font-family:monospace;font-size:12px;">${i + 1}</td>
      <td style="padding:8px 12px;font-weight:500;color:#111827;">${esc(r.role)}</td>
      <td style="padding:8px 12px;color:#4b5563;">${esc(r.name)}</td>
      <td style="padding:8px 12px;text-align:right;font-family:monospace;color:#4b5563;">${r.hours}</td>
      <td style="padding:8px 12px;text-align:right;font-family:monospace;color:#4b5563;">${r.currentHours ?? 0}</td>
    </tr>`).join('')

  const riskRows = openRisks.map((r, i) => `
    <tr style="${i % 2 === 1 ? 'background:#f9fafb;' : ''}">
      <td style="padding:8px 12px;">${badge(r.severity.toUpperCase(), SEVERITY_COLOR[r.severity] ?? '#6b7280')}</td>
      <td style="padding:8px 12px;color:#4b5563;">${esc(r.owner)}</td>
      <td style="padding:8px 12px;font-weight:500;color:#111827;">${esc(r.title)}</td>
      <td style="padding:8px 12px;color:#4b5563;">${esc(r.description)}</td>
    </tr>`).join('')

  const milestoneRows = sortedMilestones.map((m, i) => `
    <tr style="${i % 2 === 1 ? 'background:#f9fafb;' : ''}">
      <td style="padding:8px 12px;font-weight:500;color:#111827;">${esc(m.name)}</td>
      <td style="padding:8px 12px;">${badge(MILESTONE_STATUS_LABEL[m.status], MILESTONE_STATUS_COLOR[m.status])}</td>
      <td style="padding:8px 12px;font-family:monospace;font-size:12px;color:#6b7280;">${esc(m.startDate)}</td>
      <td style="padding:8px 12px;font-family:monospace;font-size:12px;color:#6b7280;">${esc(m.endDate)}</td>
    </tr>`).join('')

  const backlogHtml = backlogItems.map((m) => `
    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:12px;">
      <p style="margin:0 0 8px;font-weight:500;color:#111827;">${esc(m.name)}</p>
      <p style="margin:0;font-size:13px;color:#6b7280;">${esc(m.description) || 'No description.'}</p>
    </div>`).join('')

  const sectionLabel = (text: string) =>
    `<h3 style="margin:0 0 16px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;">${esc(text)}</h3>`

  const tableStyle = 'width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;font-size:13px;'
  const thStyle = 'padding:8px 12px;text-align:left;font-weight:500;color:#6b7280;background:#f9fafb;border-bottom:1px solid #e5e7eb;'
  const thRightStyle = 'padding:8px 12px;text-align:right;font-weight:500;color:#6b7280;background:#f9fafb;border-bottom:1px solid #e5e7eb;'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(project.name)} — Status Report</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fff; color: #111827; }
    @media print {
      @page { size: A4; margin: 12mm; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div style="max-width:960px;margin:0 auto;padding:20px 16px;">

    <!-- Header -->
    <header style="display:flex;align-items:center;justify-content:space-between;padding-bottom:16px;margin-bottom:32px;border-bottom:1px solid #e5e7eb;">
      <span style="font-size:16px;font-weight:700;color:#111827;">HealthStream</span>
      <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;">Project Status Report</span>
      <span style="font-size:13px;color:#6b7280;">${esc(generatedDate)}</span>
    </header>

    <!-- Project info -->
    <section style="margin-bottom:32px;">
      <h1 style="margin:0 0 8px;font-size:28px;font-weight:700;color:#111827;">${esc(project.name)}</h1>
      ${project.description ? `<p style="margin:0 0 12px;color:#4b5563;">${esc(project.description)}</p>` : ''}
      ${techStackHtml ? `<div style="margin-bottom:12px;display:flex;flex-wrap:wrap;gap:6px;">${techStackHtml}</div>` : ''}
      <p style="margin:0 0 8px;font-family:monospace;font-size:12px;color:#6b7280;">
        ${esc(project.sow.startDate) || '—'} → ${esc(project.sow.endDate) || '—'}
      </p>
      ${project.sow.summary ? `<p style="margin:0;font-size:13px;color:#4b5563;">${esc(project.sow.summary)}</p>` : ''}
    </section>

    <!-- Schedule + Budget -->
    <section style="display:flex;gap:24px;margin-bottom:32px;">
      ${metricBlock('Schedule', schedulePct, project.statusHeader.scheduleStatus, total ? `${elapsed} of ${total} days` : 'No dates set')}
      ${metricBlock('Budget', budgetPct, project.statusHeader.budgetStatus, project.sow.totalHours ? `${hoursConsumed} of ${project.sow.totalHours} hrs` : 'No budget set')}
    </section>

    ${resources.length > 0 ? `
    <!-- Team -->
    <section style="margin-bottom:40px;">
      ${sectionLabel('Team')}
      <table style="${tableStyle}">
        <thead>
          <tr>
            <th style="${thStyle}width:40px;">#</th>
            <th style="${thStyle}">Role</th>
            <th style="${thStyle}">Name</th>
            <th style="${thRightStyle}">Total Hrs</th>
            <th style="${thRightStyle}">Current Hrs</th>
          </tr>
        </thead>
        <tbody>
          ${teamRows}
          <tr style="border-top:1px solid #e5e7eb;background:#f9fafb;">
            <td style="padding:8px 12px;" colspan="3"><span style="font-weight:600;color:#374151;">Total</span></td>
            <td style="padding:8px 12px;text-align:right;font-weight:700;font-family:monospace;color:#111827;">${totalHours}</td>
            <td style="padding:8px 12px;text-align:right;font-weight:700;font-family:monospace;color:#111827;">${totalCurrentHours}</td>
          </tr>
        </tbody>
      </table>
    </section>` : ''}

    <!-- Risks -->
    <section style="margin-bottom:40px;">
      ${sectionLabel('Risks')}
      ${openRisks.length === 0
        ? '<p style="font-size:13px;color:#6b7280;">No open risks.</p>'
        : `<table style="${tableStyle}">
          <thead>
            <tr>
              <th style="${thStyle}width:90px;">Severity</th>
              <th style="${thStyle}width:120px;">Owner</th>
              <th style="${thStyle}">Risk</th>
              <th style="${thStyle}">Description</th>
            </tr>
          </thead>
          <tbody>${riskRows}</tbody>
        </table>`}
    </section>

    ${sortedMilestones.length > 0 ? `
    <!-- Milestones -->
    <section style="margin-bottom:40px;">
      ${sectionLabel('Milestones')}
      ${ganttHtml(milestones)}
      <table style="${tableStyle}">
        <thead>
          <tr>
            <th style="${thStyle}">Milestone</th>
            <th style="${thStyle}width:120px;">Status</th>
            <th style="${thStyle}width:100px;">Start</th>
            <th style="${thStyle}width:100px;">End</th>
          </tr>
        </thead>
        <tbody>${milestoneRows}</tbody>
      </table>
    </section>` : ''}

    ${backlogItems.length > 0 ? `
    <!-- Backlog -->
    <section style="margin-bottom:40px;">
      ${sectionLabel('Backlog')}
      ${backlogHtml}
    </section>` : ''}

    <!-- Footer -->
    <footer style="margin-top:48px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">Confidential · Generated ${esc(generatedDate)} · Orbital</p>
    </footer>

  </div>
</body>
</html>`
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const uid = await getUid(req)
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { projectId } = await params
  const found = await findOrgAndProject(projectId)
  if (!found) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { orgId, project } = found

  if (!project.members?.[uid]) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [risks, milestones, resources] = await Promise.all([
    listCollection<Risk>(`orgs/${orgId}/projects/${projectId}/risks`),
    listCollection<Milestone>(`orgs/${orgId}/projects/${projectId}/milestones`),
    listCollection<Resource>(`orgs/${orgId}/projects/${projectId}/resources`),
  ])

  const html = generateHtml(project, risks, milestones, resources)
  const filename = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-status-report.html`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
