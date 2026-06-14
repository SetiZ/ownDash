import { Hono } from 'hono'

const app = new Hono()

app.get('/', async (c) => {
  const apiKey = process.env.PLANE_API_KEY
  const workspace = process.env.PLANE_WORKSPACE
  const email = process.env.PLANE_EMAIL

  if (!apiKey || !workspace) {
    return c.json({ status: 'error', issues: [], message: 'Plane.so not configured' })
  }

  try {
    const headers: Record<string, string> = {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    }
    if (email) headers['X-Email'] = email

    const res = await fetch(
      `https://api.plane.so/api/v1/workspaces/${workspace}/issues/`, { headers }
    )

    if (!res.ok) {
      return c.json({ status: 'error', issues: [], message: `Plane API: ${res.status}` })
    }

    const data = await res.json()
    const issues = (data.results || data.issues || data)
      .filter((i: any) => i.state !== 'done' && i.state !== 'cancelled')
      .slice(0, 10)
      .map((i: any) => ({
        title: i.name || 'untitled',
        state: i.state?.name || 'unknown',
        priority: i.priority || 'none',
        project: i.project_name || i.project_id || 'unknown',
      }))

    return c.json({ status: 'ok', issues })
  } catch (err: any) {
    return c.json({ status: 'error', issues: [], message: err.message })
  }
})

export default app
