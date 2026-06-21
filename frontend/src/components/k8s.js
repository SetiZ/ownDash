import { fetchJson } from '../api/client.js'
import { escapeHtml } from '../utils/escape.js'

function parseImage(full) {
  const parts = full.split('/')
  const last = parts[parts.length - 1]
  const at = last.lastIndexOf('@')
  if (at !== -1) return { name: last.slice(0, at), tag: last.slice(at + 1) }
  const colon = last.lastIndexOf(':')
  if (colon === -1) return { name: last, tag: null }
  return { name: last.slice(0, colon), tag: last.slice(colon + 1) }
}

function imageHtml(imageStr) {
  if (!imageStr) return ''
  return imageStr.split(', ').map(part => {
    const { name, tag } = parseImage(part.trim())
    if (!tag) return escapeHtml(name)
    return `${escapeHtml(name)} · <span class="tag">${escapeHtml(tag)}</span>`
  }).join(', ')
}

function formatCpu(cpu) {
  if (cpu.endsWith('m')) return (parseInt(cpu) / 1000).toFixed(1) + ' CPU'
  return parseInt(cpu) + ' CPU'
}

function formatMemory(mem) {
  const num = parseInt(mem, 10)
  if (isNaN(num)) return mem
  if (mem.endsWith('Ki')) return (num / 1024 / 1024).toFixed(1) + ' Gi'
  if (mem.endsWith('Mi')) return (num / 1024).toFixed(1) + ' Gi'
  if (mem.endsWith('Gi')) return num.toFixed(1) + ' Gi'
  return (num / 1024 / 1024 / 1024).toFixed(1) + ' Gi'
}

export async function renderK8s(container, statusEl) {
  try {
    const data = await fetchJson('/k8s')
    container.innerHTML = ''

    if (data.clusters?.length) {
      data.clusters.forEach((cluster, i) => {
        if (i > 0) container.innerHTML += `<hr style="margin:12px 0;border:none;border-top:1px solid var(--surface-2)">`
        renderCluster(container, cluster)
      })
      setStatus(statusEl, data.status)
    } else {
      container.innerHTML = `<p class="empty-state">No pods found or cluster unavailable</p>`
      setStatus(statusEl, data.status || 'error')
    }
  } catch (err) {
    container.innerHTML = `<p class="error-state">Failed to load: ${escapeHtml(err.message)}</p>`
    setStatus(statusEl, 'error')
  }
}

function renderCluster(container, cluster) {
  if (cluster.name !== 'default') {
    container.innerHTML += `<p><strong>${escapeHtml(cluster.name)}</strong></p>`
  }

  if (cluster.pods?.length) {
    container.innerHTML += `<p style="margin-top:8px"><strong>Pods (${cluster.podCount} total):</strong></p>`
    const grouped = {}
    cluster.pods.forEach(pod => {
      (grouped[pod.namespace] ??= []).push(pod)
    })
    Object.entries(grouped).forEach(([ns, pods]) => {
      let html = `<div class="ns collapsed">
        <div class="ns-header">${escapeHtml(ns)} (${pods.length})</div>
        <div class="ns-pods">`
      pods.forEach(pod => {
        const cls = pod.status === 'Running' ? 'green' : pod.status === 'Pending' ? 'yellow' : 'red'
        const restartTag = pod.restarts > 0
          ? `<span class="tag ${pod.restarts > 5 ? 'red' : 'yellow'}">${pod.restarts} restarts</span>`
          : ''
        html += `
          <div class="pod-item">
            <div class="item-title">${escapeHtml(pod.name)}</div>
            <div class="item-meta">
              <span class="tag ${cls}">${escapeHtml(pod.status)}</span>
              ${restartTag}
            </div>
          </div>`
      })
      html += `</div></div>`
      container.innerHTML += html
    })
  }

  if (cluster.deployments?.length) {
    container.innerHTML += `<p style="margin-top:8px"><strong>Deployments (${cluster.deployments.length}):</strong></p>`
    const grouped = {}
    cluster.deployments.forEach(d => {
      (grouped[d.namespace] ??= []).push(d)
    })
    Object.entries(grouped).forEach(([ns, deps]) => {
      let html = `<div class="ns collapsed">
        <div class="ns-header">${escapeHtml(ns)} (${deps.length})</div>
        <div class="ns-pods">`
      deps.forEach(d => {
        const updated = d.lastUpdated ? new Date(d.lastUpdated).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : ''
        const parts = [
          `<span class="tag ${d.ready < d.desired ? 'yellow' : 'green'}">${d.ready}/${d.desired} ready</span>`,
        ]
        if (d.stalled) parts.push(`<span class="tag red">Stalled</span>`)
        if (d.image) parts.push(imageHtml(d.image))
        if (updated) parts.push(`<span class="muted">${escapeHtml(updated)}</span>`)
        html += `
          <div class="pod-item">
            <div class="item-title">${escapeHtml(d.name)}</div>
            <div class="item-meta">${parts.join(' · ')}</div>
          </div>`
      })
      html += `</div></div>`
      container.innerHTML += html
    })
  }

  if (cluster.services?.length) {
    container.innerHTML += `<p style="margin-top:8px"><strong>Services (${cluster.services.length}):</strong></p>`
    const grouped = {}
    cluster.services.forEach(s => {
      (grouped[s.namespace] ??= []).push(s)
    })
    Object.entries(grouped).forEach(([ns, svcs]) => {
      let html = `<div class="ns collapsed">
        <div class="ns-header">${escapeHtml(ns)} (${svcs.length})</div>
        <div class="ns-pods">`
      svcs.forEach(s => {
        html += `
          <div class="pod-item">
            <div class="item-title">${escapeHtml(s.name)}</div>
            <div class="item-meta">${escapeHtml(s.type)} · ${escapeHtml(s.clusterIP)} · ${escapeHtml(s.ports)}</div>
          </div>`
      })
      html += `</div></div>`
      container.innerHTML += html
    })
  }

  if (cluster.nodes?.length) {
    container.innerHTML += `<p style="margin-top:8px"><strong>Nodes (${cluster.nodes.length}):</strong></p>`
    cluster.nodes.forEach(n => {
      const parts = [escapeHtml(n.name), formatCpu(n.cpu), formatMemory(n.memory)]
      n.pressure.forEach(p => parts.push(`<span class="tag red">${escapeHtml(p)}</span>`))
      container.innerHTML += `
        <div class="pod-item">
          <div class="item-meta">${parts.join(' · ')}</div>
        </div>`
    })
  }

  if (cluster.events?.length) {
    container.innerHTML += `<p style="margin-top:8px"><strong>Recent warnings:</strong></p>`
    cluster.events.slice(0, 5).forEach(ev => {
      container.innerHTML += `
        <div class="pr-item">
          <div class="item-title">${escapeHtml(ev.message)}</div>
          <div class="item-meta">${escapeHtml(ev.namespace)} · ${ev.count}x</div>
        </div>`
    })
  }

  if (!cluster.pods?.length && !cluster.deployments?.length && !cluster.services?.length && !cluster.nodes?.length) {
    container.innerHTML += `<p class="empty-state" style="margin-top:4px">No resources found</p>`
  }
}

function setStatus(el, s) {
  el.className = 'status-chip'
  if (s === 'ok') { el.classList.add('green'); el.textContent = 'Cluster ✓' }
  else if (s === 'error') { el.classList.add('red'); el.textContent = 'Cluster ✗' }
  else { el.classList.add('yellow'); el.textContent = 'Cluster ...' }
}
