import { Hono } from 'hono'

interface IssueJson {
  title: string
  sequence_id: number
  priority: string
  state: string
  state_color: string
  assignee: string
  labels: { name: string; color: string }[]
  estimate: number | null
}

interface CycleJson {
  id: string
  name: string
  start_date: string
  end_date: string
  issues: IssueJson[]
}

interface ProjectJson {
  id: string
  name: string
  identifier: string
  cycles: CycleJson[]
}

const app = new Hono()

app.get('/', async (c) => {
  const apiKey = process.env.PLANE_API_KEY
  const workspace = process.env.PLANE_WORKSPACE
  const email = process.env.PLANE_EMAIL
  const rawIds = process.env.PLANE_PROJECT_ID

  if (!apiKey || !workspace) {
    return c.json({ status: 'error', projects: [], message: 'Plane.so not configured' })
  }
  if (!rawIds) {
    return c.json({ status: 'error', projects: [], message: 'PLANE_PROJECT_ID not set' })
  }

  const projectIds = rawIds.split(',').map(s => s.trim()).filter(Boolean)

  const headers: Record<string, string> = {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
  }
  if (email) headers['X-Email'] = email

  const base = (slug: string) => `https://api.plane.so/api/v1/workspaces/${slug}`

  try {
    const userMap = await fetchLookupMap(
      `${base(workspace)}/members/`, headers,
      (m: any) => m.id, (m: any) => m.display_name || 'Unknown'
    )

    const projects: ProjectJson[] = []
    for (const projectId of projectIds) {
      const p = await processProject(base(workspace), projectId, headers, userMap)
      if (p) projects.push(p)
    }

    return c.json({ status: 'ok', projects })
  } catch (err: any) {
    return c.json({ status: 'error', projects: [], message: err.message })
  }
})

app.get('/debug', async (c) => {
  const apiKey = process.env.PLANE_API_KEY
  const workspace = process.env.PLANE_WORKSPACE
  const email = process.env.PLANE_EMAIL
  const rawIds = process.env.PLANE_PROJECT_ID

  const headers: Record<string, string> = {
    'X-API-Key': apiKey || '',
    'Content-Type': 'application/json',
  }
  if (email) headers['X-Email'] = email

  const result: any = {
    env: {
      hasApiKey: !!apiKey,
      apiKeyPrefix: apiKey ? apiKey.slice(0, 12) + '...' : null,
      workspace,
      hasEmail: !!email,
      projectIds: rawIds ? rawIds.split(',').map(s => s.trim()).filter(Boolean) : [],
    },
  }

  try {
    const meRes = await fetch('https://api.plane.so/api/v1/users/me/', { headers })
    const meBody = await meRes.text()
    result.auth = { status: meRes.status, body: meBody.slice(0, 500) }
  } catch (err: any) {
    result.auth = { error: err.message }
  }

  if (workspace) {
    result.projects = []
    for (const pid of (result.env.projectIds || [])) {
      try {
        const projRes = await fetch(
          `https://api.plane.so/api/v1/workspaces/${workspace}/projects/${pid}/`,
          { headers }
        )
        const projBody = await projRes.text()
        result.projects.push({ projectId: pid, status: projRes.status, body: projBody.slice(0, 500) })
      } catch (err: any) {
        result.projects.push({ projectId: pid, error: err.message })
      }
    }
  }

  return c.json(result)
})

async function processProject(baseUrl: string, projectId: string, headers: any, userMap: Map<string, string>): Promise<ProjectJson | null> {
  const pBase = `${baseUrl}/projects/${projectId}`

  const [projectData, stateMap, labelMap, rawCycles] = await Promise.all([
    fetchJson(`${pBase}/`, headers),
    fetchLookupMap(`${pBase}/states/`, headers, (s: any) => s.id, (s: any) => ({ name: s.name, color: s.color })),
    fetchLookupMap(`${pBase}/labels/`, headers, (l: any) => l.id, (l: any) => ({ name: l.name, color: l.color })),
    fetchJson(`${pBase}/cycles/?cycle_view=current`, headers),
  ])

  if (!projectData) return null

  const cyclesArr: any[] = Array.isArray(rawCycles) ? rawCycles : (rawCycles.results || [])

  const cycles: CycleJson[] = []
  for (const cycle of cyclesArr) {
    const issuesData = await fetchJson(`${pBase}/cycles/${cycle.id}/cycle-issues/`, headers)
    const rawIssues: any[] = Array.isArray(issuesData) ? issuesData : (issuesData.results || [])
    const issues = rawIssues.map((i: any) => formatIssue(i, stateMap, userMap, labelMap))
    cycles.push({ id: cycle.id, name: cycle.name, start_date: cycle.start_date, end_date: cycle.end_date, issues })
  }

  return {
    id: projectId,
    name: projectData.name || projectId,
    identifier: projectData.identifier || '',
    cycles,
  }
}

function formatIssue(issue: any, stateMap: Map<string, any>, userMap: Map<string, string>, labelMap: Map<string, any>): IssueJson {
  const state = stateMap.get(issue?.state) || { name: 'unknown', color: '#888' }
  const assignee = (issue?.assignees || []).map((id: string) => userMap.get(id)).filter(Boolean)[0] || ''
  const labels = (issue?.labels || []).map((id: string) => labelMap.get(id)).filter(Boolean).map((l: any) => ({ name: l.name, color: l.color }))

  return {
    title: issue?.name || 'untitled',
    sequence_id: issue?.sequence_id || 0,
    priority: issue?.priority || 'none',
    state: state.name,
    state_color: state.color,
    assignee,
    labels,
    estimate: null,
  }
}

async function fetchJson(url: string, headers: Record<string, string>): Promise<any> {
  const res = await fetch(url, { headers })
  if (!res.ok) {
    console.error(`[plane] fetch failed ${url}: ${res.status}`)
    return { results: [] }
  }
  return res.json()
}

async function fetchLookupMap<T>(url: string, headers: Record<string, string>, keyFn: (item: any) => string, valueFn: (item: any) => T): Promise<Map<string, T>> {
  const data = await fetchJson(url, headers)
  const items: any[] = Array.isArray(data) ? data : (data.results || [])
  return new Map(items.map((item: any) => [keyFn(item), valueFn(item)]))
}

export default app
