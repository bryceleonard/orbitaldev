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

export async function fetchBacklog(
  adoOrgUrl: string,
  adoProject: string,
  pat: string,
): Promise<unknown> {
  const url = `${adoOrgUrl}/${adoProject}/_apis/wit/wiql?api-version=${API_VERSION}`
  return adoPost(url, pat, {
    query:
      "SELECT [System.Id],[System.Title],[System.State],[System.WorkItemType] " +
      "FROM WorkItems WHERE [System.TeamProject] = @project " +
      "AND [System.WorkItemType] IN ('Epic','User Story') " +
      "ORDER BY [Microsoft.VSTS.Common.Priority] ASC",
  })
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
