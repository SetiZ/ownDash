import { Hono } from 'hono'
import { execSync } from 'child_process'

const app = new Hono()

app.get('/', async (c) => {
  try {
    const podJson = await run('kubectl get pods --all-namespaces -o json')
    if (!podJson) {
      return c.json({ status: 'error', pods: [], events: [], message: 'kubectl not available' })
    }

    const eventsRaw = await run(
      'kubectl get events --all-namespaces -o json --field-selector type=Warning'
    )
    const nodesRaw = await run('kubectl get nodes -o json')

    const podList = parseJson(podJson, { items: [] })
    const eventList = parseJson(eventsRaw, { items: [] })
    const nodeList = parseJson(nodesRaw, { items: [] })

    const nonTerminal = (podList.items || []).filter(
      (p: any) => p.status?.phase !== 'Succeeded' && p.status?.phase !== 'Failed'
    )

    const pods = nonTerminal.map((p: any) => ({
      name: p.metadata?.name || 'unknown',
      namespace: p.metadata?.namespace || 'default',
      status: p.status?.phase || 'Unknown',
      restarts: p.status?.containerStatuses?.[0]?.restartCount || 0,
    }))

    const warnings = (eventList.items || []).slice(0, 5).map((e: any) => ({
      message: e.message || e.reason || 'unknown',
      namespace: e.metadata?.namespace || 'default',
      count: e.count || 1,
    }))

    const unhealthy = pods.filter((p: any) => p.status !== 'Running').length
    const status = unhealthy === 0 ? 'ok' : unhealthy > 2 ? 'error' : 'warning'

    return c.json({
      status,
      podCount: nonTerminal.length,
      unhealthyCount: unhealthy,
      pods: pods.slice(0, 15),
      events: warnings,
      nodeCount: nodeList.items?.length || 0,
    })
  } catch (err: any) {
    return c.json({ status: 'error', pods: [], events: [], message: err.message })
  }
})

function run(cmd: string): string | null {
  try {
    return execSync(cmd, { timeout: 10000, encoding: 'utf-8' })
  } catch {
    return null
  }
}

function parseJson(raw: string | null, fallback: any) {
  if (!raw) return fallback
  try { return JSON.parse(raw) } catch { return fallback }
}

export default app
