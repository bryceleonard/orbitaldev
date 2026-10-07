const API_VERSION = '7.1'

function authHeader(pat: string): string {
  return `Basic ${Buffer.from(`:${pat}`).toString('base64')}`
}

async function adoGet(url: string, pat: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      Authorization: authHeader(pat),
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ADO request failed: ${res.status} ${text}`)
  }
  return res.json()
}

async function adoPost(url: string, pat: string, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: authHeader(pat),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ADO request failed: ${res.status} ${text}`)
  }
  return res.json()
}

export interface AdoWorkItem {
  id: number
  title: string
  state: string
  workItemType: string
  priority: number | null
}

export async function fetchBacklog(
  adoOrgUrl: string,
  adoProject: string,
  adoTeam: string,
  pat: string,
): Promise<{ value: AdoWorkItem[] }> {
  // Resolve the team's configured area paths so we can scope the WIQL query
  const teamFieldUrl =
    `${adoOrgUrl}/${adoProject}/${adoTeam}/_apis/work/teamsettings/teamfieldvalues` +
    `?api-version=${API_VERSION}`
  const teamField = await adoGet(teamFieldUrl, pat) as {
    values: { value: string; includeChildren: boolean }[]
  }
  const areaClause = teamField.values
    .map((v) => v.includeChildren
      ? `[System.AreaPath] UNDER '${v.value}'`
      : `[System.AreaPath] = '${v.value}'`)
    .join(' OR ')

  const wiqlUrl = `${adoOrgUrl}/${adoProject}/_apis/wit/wiql?api-version=${API_VERSION}`
  const wiqlResult = await adoPost(wiqlUrl, pat, {
    query:
      `SELECT [System.Id] FROM WorkItems ` +
      `WHERE [System.TeamProject] = @project ` +
      `AND (${areaClause}) ` +
      `AND [System.WorkItemType] IN ('Epic','User Story') ` +
      `ORDER BY [Microsoft.VSTS.Common.Priority] ASC, [System.Id] ASC`,
  }) as { workItems?: { id: number }[] }

  const ids = (wiqlResult.workItems ?? []).map((w) => w.id).slice(0, 200)
  if (ids.length === 0) return { value: [] }

  const fields = [
    'System.Id',
    'System.Title',
    'System.State',
    'System.WorkItemType',
    'Microsoft.VSTS.Common.Priority',
  ].join(',')
  const detailUrl =
    `${adoOrgUrl}/${adoProject}/_apis/wit/workitems` +
    `?ids=${ids.join(',')}&fields=${fields}&api-version=${API_VERSION}`
  const detail = await adoGet(detailUrl, pat) as {
    value: { id: number; fields: Record<string, unknown> }[]
  }

  return {
    value: detail.value.map((item) => ({
      id: item.id,
      title: String(item.fields['System.Title'] ?? ''),
      state: String(item.fields['System.State'] ?? ''),
      workItemType: String(item.fields['System.WorkItemType'] ?? ''),
      priority: item.fields['Microsoft.VSTS.Common.Priority'] != null
        ? Number(item.fields['Microsoft.VSTS.Common.Priority'])
        : null,
    })),
  }
}

export async function fetchSprint(
  adoOrgUrl: string,
  adoProject: string,
  adoTeam: string,
  pat: string,
): Promise<unknown> {
  const url =
    `${adoOrgUrl}/${adoProject}/${adoTeam}/_apis/work/teamsettings/iterations` +
    `?$timeframe=current&api-version=${API_VERSION}`
  return adoGet(url, pat)
}

export async function fetchDevPlan(
  adoOrgUrl: string,
  adoProject: string,
  pat: string,
): Promise<unknown> {
  const url =
    `${adoOrgUrl}/${adoProject}/_apis/work/teamsettings/iterations` +
    `?api-version=${API_VERSION}`
  return adoGet(url, pat)
}

async function adoGetText(url: string, pat: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      Authorization: authHeader(pat),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ADO request failed: ${res.status} ${text}`)
  }
  return res.text()
}

export async function fetchBeadsIssues(
  adoOrgUrl: string,
  adoProject: string,
  repo: string,
  branch: string,
  pat: string,
): Promise<string> {
  const path = encodeURIComponent('.beads/issues.jsonl')
  const url =
    `${adoOrgUrl}/${adoProject}/_apis/git/repositories/${repo}/items` +
    `?path=${path}&versionDescriptor.version=${branch}&download=true&api-version=${API_VERSION}`
  return adoGetText(url, pat)
}
