import { Hono } from 'hono'
import { execFileSync } from 'child_process'

const app = new Hono()

// ── K8s API types ──────────────────────────────────────────────────────────

interface K8sMeta {
  name?: string
  namespace?: string
  uid?: string
  creationTimestamp?: string
  ownerReferences?: { kind: string; uid: string }[]
}

interface K8sContainer {
  image: string
  resources?: {
    requests?: { cpu?: string; memory?: string }
    limits?: { cpu?: string; memory?: string }
  }
}

interface K8sPodSpec {
  containers?: K8sContainer[]
}

interface K8sPodStatus {
  phase?: string
  containerStatuses?: { restartCount: number }[]
}

interface K8sPod {
  metadata?: K8sMeta
  spec?: K8sPodSpec
  status?: K8sPodStatus
}

interface K8sDeploymentSpec {
  replicas?: number
  template?: { spec?: { containers?: K8sContainer[] } }
}

interface K8sDeploymentStatus {
  readyReplicas?: number
  availableReplicas?: number
  updatedReplicas?: number
  conditions?: { type: string; status: string; reason: string }[]
}

interface K8sDeployment {
  metadata?: K8sMeta
  spec?: K8sDeploymentSpec
  status?: K8sDeploymentStatus
}

interface K8sReplicaSet {
  metadata?: K8sMeta
}

interface K8sServiceSpec {
  type?: string
  clusterIP?: string
  ports?: { port: number; protocol: string }[]
}

interface K8sService {
  metadata?: K8sMeta
  spec?: K8sServiceSpec
}

interface K8sNodeStatus {
  capacity?: { cpu?: string; memory?: string }
  conditions?: { type: string; status: string }[]
}

interface K8sNode {
  metadata?: K8sMeta
  status?: K8sNodeStatus
}

interface K8sEvent {
  metadata?: K8sMeta
  message?: string
  reason?: string
  count?: number
}

interface K8sList<T> {
  items?: T[]
}

interface ClusterData {
  name: string
  podCount: number
  unhealthyCount: number
  pods: { name: string; namespace: string; status: string; restarts: number; requests: { cpu: string; memory: string }; limits: { cpu: string; memory: string } }[]
  deployments: {
    name: string
    namespace: string
    desired: number
    ready: number
    available: number
    upToDate: number
    image: string
    lastUpdated: string | null
    stalled: boolean
  }[]
  services: {
    name: string
    namespace: string
    type: string
    clusterIP: string
    ports: string
  }[]
  events: { message: string; namespace: string; count: number }[]
  nodes: { name: string; cpu: string; memory: string; pressure: string[]; cpuUsage: string; memUsage: string }[]
}

// ── Route ──────────────────────────────────────────────────────────────────

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

// ── Helpers ────────────────────────────────────────────────────────────────

function parseContexts(raw: string | undefined): string[] {
  if (!raw) return ['']
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

function parseNamespaces(raw: string | undefined): string[] {
  if (!raw) return []
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

function buildRolloutMap(rsList: K8sList<K8sReplicaSet>): Map<string, string> {
  const map = new Map<string, string>()
  for (const rs of rsList.items || []) {
    const owner = (rs.metadata?.ownerReferences || []).find(
      ref => ref.kind === 'Deployment'
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

function sumRestarts(statuses: { restartCount: number }[] | undefined): number {
  if (!statuses) return 0
  return statuses.reduce((sum, s) => sum + (s.restartCount || 0), 0)
}

function parseCpu(s: string | undefined): number {
  if (!s) return 0
  if (s.endsWith('m')) return parseInt(s.slice(0, -1), 10)
  return Math.round(parseFloat(s) * 1000)
}

function parseMemory(s: string | undefined): number {
  if (!s) return 0
  const num = parseFloat(s)
  if (s.endsWith('Ki')) return num * 1024
  if (s.endsWith('Mi')) return num * 1024 * 1024
  if (s.endsWith('Gi')) return num * 1024 * 1024 * 1024
  if (s.endsWith('Ti')) return num * 1024 * 1024 * 1024 * 1024
  if (s.endsWith('k') || s.endsWith('K')) return num * 1000
  if (s.endsWith('M')) return num * 1000 * 1000
  if (s.endsWith('G')) return num * 1000 * 1000 * 1000
  return num
}

function sumResources(containers: { resources?: { requests?: { cpu?: string; memory?: string }; limits?: { cpu?: string; memory?: string } } }[] | undefined, field: 'requests' | 'limits'): { cpu: string; memory: string } {
  let cpu = 0
  let mem = 0
  for (const c of containers || []) {
    const r = c.resources?.[field]
    if (r?.cpu) cpu += parseCpu(r.cpu)
    if (r?.memory) mem += parseMemory(r.memory)
  }
  return { cpu: cpu + 'm', memory: mem + '' }
}

function queryCluster(context: string, nsFilter: string[]): ClusterData & { status: string } {
  const filterNs = nsFilter.length > 0
    ? (ns: string) => nsFilter.includes(ns)
    : () => true
  const ctx = context ? ['--context', context] : [] as string[]

  const podJson = run('kubectl', [...ctx, 'get', 'pods', '--all-namespaces', '-o', 'json'])
  if (!podJson) {
    return { name: context || 'default', status: 'error', podCount: 0, unhealthyCount: 0, pods: [], deployments: [], services: [], events: [], nodes: [] }
  }

  const depRaw = run('kubectl', [...ctx, 'get', 'deployments', '--all-namespaces', '-o', 'json'])
  const rsRaw = run('kubectl', [...ctx, 'get', 'replicasets', '--all-namespaces', '-o', 'json'])
  const svcRaw = run('kubectl', [...ctx, 'get', 'services', '--all-namespaces', '-o', 'json'])
  const eventsRaw = run('kubectl', [...ctx, 'get', 'events', '--all-namespaces', '-o', 'json', '--field-selector', 'type=Warning'])
  const nodesRaw = run('kubectl', [...ctx, 'get', 'nodes', '-o', 'json'])
  let topRaw: string | null = '{"items":[]}'
  try { topRaw = run('kubectl', [...ctx, 'top', 'nodes', '-o', 'json']) } catch {}

  const podList = parseJson<K8sList<K8sPod>>(podJson, { items: [] })
  const depList = parseJson<K8sList<K8sDeployment>>(depRaw, { items: [] })
  const rsList = parseJson<K8sList<K8sReplicaSet>>(rsRaw, { items: [] })
  const svcList = parseJson<K8sList<K8sService>>(svcRaw, { items: [] })
  const eventList = parseJson<K8sList<K8sEvent>>(eventsRaw, { items: [] })
  const nodeList = parseJson<K8sList<K8sNode>>(nodesRaw, { items: [] })
  const topList = parseJson<{ items: { metadata: { name: string }; usage: { cpu: string; memory: string } }[] }>(topRaw, { items: [] })

  const nonTerminal = (podList.items || []).filter(
    p => p.status?.phase !== 'Succeeded' && p.status?.phase !== 'Failed'
  )

  const pods = nonTerminal
    .map(p => {
      const containers = p.spec?.containers
      const req = sumResources(containers, 'requests')
      const lim = sumResources(containers, 'limits')
      return {
        name: p.metadata?.name || 'unknown',
        namespace: p.metadata?.namespace || 'default',
        status: p.status?.phase || 'Unknown',
        restarts: sumRestarts(p.status?.containerStatuses),
        requests: req,
        limits: lim,
      }
    })
    .filter(p => filterNs(p.namespace))

  const warnings = (eventList.items || [])
    .map(e => ({
      message: e.message || e.reason || 'unknown',
      namespace: e.metadata?.namespace || 'default',
      count: e.count || 1,
    }))
    .filter(e => filterNs(e.namespace))
    .slice(0, 5)

  const lastRollout = buildRolloutMap(rsList)

  const deployments = (depList.items || [])
    .map(d => {
      const containers = d.spec?.template?.spec?.containers || []
      const stalled = (d.status?.conditions || []).some(
        c => c.type === 'Progressing' && c.status === 'False' && c.reason === 'ProgressDeadlineExceeded'
      )
      return {
        name: d.metadata?.name || 'unknown',
        namespace: d.metadata?.namespace || 'default',
        desired: d.spec?.replicas ?? 1,
        ready: d.status?.readyReplicas || 0,
        available: d.status?.availableReplicas || 0,
        upToDate: d.status?.updatedReplicas || 0,
        image: containers.slice(0, 3).map(c => c.image).join(', ') + (containers.length > 3 ? ', ...' : ''),
        lastUpdated: lastRollout.get(d.metadata?.uid || '') || null,
        stalled,
      }
    })
    .filter(d => filterNs(d.namespace))

  const services = (svcList.items || [])
    .map(s => ({
      name: s.metadata?.name || 'unknown',
      namespace: s.metadata?.namespace || 'default',
      type: s.spec?.type || 'ClusterIP',
      clusterIP: s.spec?.clusterIP || 'None',
      ports: (s.spec?.ports || []).map(p => `${p.port}/${p.protocol}`).join(', '),
    }))
    .filter(s => filterNs(s.namespace))

  const usageMap = new Map<string, { cpu: string; memory: string }>()
  for (const item of topList.items || []) {
    usageMap.set(item.metadata?.name || '', {
      cpu: item.usage?.cpu || '0',
      memory: item.usage?.memory || '0',
    })
  }

  const nodes = (nodeList.items || []).map(n => {
    const pressure = (n.status?.conditions || [])
      .filter(c => c.status === 'True' && ['DiskPressure', 'MemoryPressure', 'PIDPressure'].includes(c.type))
      .map(c => c.type)
    const usage = usageMap.get(n.metadata?.name || '')
    return {
      name: n.metadata?.name || 'unknown',
      cpu: n.status?.capacity?.cpu || 'unknown',
      memory: n.status?.capacity?.memory || 'unknown',
      pressure,
      cpuUsage: usage?.cpu || '',
      memUsage: usage?.memory || '',
    }
  })

  const unhealthy = pods.filter(p => p.status !== 'Running').length

  return {
    name: context || 'default',
    status: unhealthy > 0 ? 'warning' : 'ok',
    podCount: pods.length,
    unhealthyCount: unhealthy,
    pods: pods.slice(0, 100),
    deployments,
    services,
    events: warnings,
    nodes,
  }
}

function run(cmd: string, args: string[]): string | null {
  try {
    return execFileSync(cmd, args, { timeout: 10000, encoding: 'utf-8' })
  } catch {
    return null
  }
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try { return JSON.parse(raw) as T } catch { return fallback }
}

export default app
