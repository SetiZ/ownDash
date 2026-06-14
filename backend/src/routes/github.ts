import { Hono } from 'hono'

const app = new Hono()

app.get('/', async (c) => {
  const token = process.env.GITHUB_TOKEN
  if (!token) {
    return c.json({ status: 'error', prs: [], workflows: [] })
  }

  try {
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'owndash',
    }

    const repos = (process.env.GITHUB_REPOS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    if (!repos.length) {
      return c.json({ status: 'ok', prs: [], workflows: [], message: 'No repos configured' })
    }

    const [prRes, wfRes] = await Promise.all([
      fetch(`https://api.github.com/search/issues?q=${encodeURIComponent(repos.map(r => `repo:${r}`).join(' ') + ' type:pr state:open')}&sort=updated&order=desc`, { headers }),
      fetch(`https://api.github.com/search/commits?q=${encodeURIComponent(repos.map(r => `repo:${r}`).join(' '))}&sort=committer-date&per_page=10`, { headers }),
    ])

    const prData = prRes.ok ? await prRes.json() : { items: [] }
    const wfRuns = await Promise.all(
      repos.map(async (repo) => {
        const r = await fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=5&status=completed`, { headers })
        if (!r.ok) return []
        const d = await r.json()
        return (d.workflow_runs || []).map((run: any) => ({
          name: run.name,
          branch: run.head_branch,
          conclusion: run.conclusion,
          actor: run.actor?.login || 'unknown',
        }))
      })
    )

    return c.json({
      status: 'ok',
      prs: (prData.items || []).slice(0, 10).map((pr: any) => ({
        title: pr.title,
        state: pr.state,
        repo: pr.repository_url?.split('/').slice(-2).join('/') || 'unknown',
        author: pr.user?.login || 'unknown',
        url: pr.html_url,
      })),
      workflows: wfRuns.flat().slice(0, 8),
    })
  } catch (err: any) {
    return c.json({ status: 'error', prs: [], workflows: [], message: err.message })
  }
})

export default app
