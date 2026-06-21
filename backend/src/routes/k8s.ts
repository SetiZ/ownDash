import { Hono } from 'hono'
import { execFileSync } from 'child_process'

const app = new Hono()

app.get('/', async (c) => {
  try {
    const contexts = parseContexts(process.env.K8S_CONTEXTS)
    const nsFilter = parseNamespaces(process.env.K8S_NAMESPACES)
    const clusters = contexts.map(ctx => queryCluster(ctx, nsFilter))
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

function parseNamespaces(raw: string | undefined): string[] {
  if (!raw) return []
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

function buildRolloutMap(rsList: any): Map<string, string> {
  const map = new Map<string, string>()
  for (const rs of rsList.items || []) {
    const owner = (rs.metadata?.ownerReferences || []).find(
      (ref: any) => ref.kind === 'Deployment'
    )
    if (!owner) continue
    const ts = rs.metadata?.creationTimestamp
    if (!ts) continue
    const existing = map.get(owner.uid)
    if (!existing || new Date(ts) > new Date(existing)) {
      map.set(owner.uid, ts)
    }
  }
  return map
}

function queryCluster(context: string, nsFilter: string[]) {
  const filterNs = nsFilter.length > 0
    ? (ns: string) => nsFilter.includes(ns)
    : () => true
  const ctx = context ? ['--context', context] : ([] as string[])

  const podJson = run('kubectl', [...ctx, 'get', 'pods', '--all-namespaces', '-o', 'json'])
  if (!podJson) {
    return { name: context || 'default', status: 'error', podCount: 0, unhealthyCount: 0, pods: [], events: [], nodeCount: 0 }
  }

  const depRaw = run('kubectl', [...ctx, 'get', 'deployments', '--all-namespaces', '-o', 'json'])
  const rsRaw = run('kubectl', [...ctx, 'get', 'replicasets', '--all-namespaces', '-o', 'json'])
  const eventsRaw = run('kubectl', [...ctx, 'get', 'events', '--all-namespaces', '-o', 'json', '--field-selector', 'type=Warning'])
  const nodesRaw = run('kubectl', [...ctx, 'get', 'nodes', '-o', 'json'])

  const podList = parseJson(podJson, { items: [] })
  const depList = parseJson(depRaw, { items: [] })
  const rsList = parseJson(rsRaw, { items: [] })
  const eventList = parseJson(eventsRaw, { items: [] })
  const nodeList = parseJson(nodesRaw, { items: [] })

  const nonTerminal = (podList.items || []).filter(
    (p: any) => p.status?.phase !== 'Succeeded' && p.status?.phase !== 'Failed'
  )

  const pods = nonTerminal
    .map((p: any) => ({
      name: p.metadata?.name || 'unknown',
      namespace: p.metadata?.namespace || 'default',
      status: p.status?.phase || 'Unknown',
      restarts: p.status?.containerStatuses?.[0]?.restartCount || 0,
    }))
    .filter((p: any) => filterNs(p.namespace))

  const warnings = (eventList.items || [])
    .map((e: any) => ({
      message: e.message || e.reason || 'unknown',
      namespace: e.metadata?.namespace || 'default',
      count: e.count || 1,
    }))
    .filter((e: any) => filterNs(e.namespace))
    .slice(0, 5)

  const lastRollout = buildRolloutMap(rsList)

  const deployments = (depList.items || [])
    .map((d: any) => {
      const containers = d.spec?.template?.spec?.containers || []
      return {
        name: d.metadata?.name || 'unknown',
        namespace: d.metadata?.namespace || 'default',
        desired: d.spec?.replicas || 0,
        ready: d.status?.readyReplicas || 0,
        available: d.status?.availableReplicas || 0,
        upToDate: d.status?.updatedReplicas || 0,
        image: containers.map((c: any) => c.image).join(', '),
        lastUpdated: lastRollout.get(d.metadata?.uid) || null,
      }
    })
    .filter((d: any) => filterNs(d.namespace))

  const unhealthy = pods.filter((p: any) => p.status !== 'Running').length

  return {
    name: context || 'default',
    podCount: pods.length,
    unhealthyCount: unhealthy,
    pods: pods.slice(0, 100),
    deployments,
    events: warnings,
    nodeCount: nodeList.items?.length || 0,
  }
}

function run(cmd: string, args: string[]): string | null {
  try {
    return execFileSync(cmd, args, { timeout: 10000, encoding: 'utf-8' })
  } catch {
    return null
  }
}

function parseJson(raw: string | null, fallback: any) {
  if (!raw) return fallback
  try { return JSON.parse(raw) } catch { return fallback }
}

export default app
