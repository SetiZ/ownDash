import { Hono } from 'hono'
import { execSync } from 'child_process'

const app = new Hono()

app.get('/', async (c) => {
  try {
    const contexts = parseContexts(process.env.K8S_CONTEXTS)
    const clusters = contexts.map(ctx => queryCluster(ctx))
    const errors = clusters.filter(c => c.status === 'error')
    const unhealthy = clusters.some(c => c.unhealthyCount > 0)
    const overallStatus = errors.length === clusters.length ? 'error'
      : errors.length > 0 || unhealthy ? 'warning'
      : 'ok'

    return c.json({ status: overallStatus, clusters })
  } catch (err: any) {
    return c.json({ status: 'error', clusters: [], message: err.message })
  }
})

function parseContexts(raw: string | undefined): string[] {
  if (!raw) return ['']
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

function queryCluster(context: string) {
  const prefix = context ? `kubectl --context ${context}` : 'kubectl'

  const podJson = run(`${prefix} get pods --all-namespaces -o json`)
  if (!podJson) {
    return { name: context || 'default', status: 'error', podCount: 0, unhealthyCount: 0, pods: [], events: [], nodeCount: 0 }
  }

  const eventsRaw = run(`${prefix} get events --all-namespaces -o json --field-selector type=Warning`)
  const nodesRaw = run(`${prefix} get nodes -o json`)

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

  return {
    name: context || 'default',
    podCount: nonTerminal.length,
    unhealthyCount: unhealthy,
    pods: pods.slice(0, 15),
    events: warnings,
    nodeCount: nodeList.items?.length || 0,
  }
}

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
