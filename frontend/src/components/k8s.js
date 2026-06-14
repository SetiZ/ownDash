import { fetchJson } from '../api/client.js'
import { escapeHtml } from '../utils/escape.js'

export async function renderK8s(container, statusEl) {
  try {
    const data = await fetchJson('/k8s')
    container.innerHTML = ''

    if (data.clusters?.length) {
      data.clusters.forEach((cluster, i) => {
        if (i > 0) container.innerHTML += `<hr style="margin:12px 0;border:none;border-top:1px solid var(--surface-2)">`
        renderCluster(container, cluster)
      })
      const allOk = data.clusters.every(c => c.status === 'ok')
      const anyErr = data.clusters.some(c => c.status === 'error')
      setStatus(statusEl, anyErr ? 'error' : allOk ? 'ok' : 'warning')
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
    cluster.pods.slice(0, 10).forEach(pod => {
      const cls = pod.status === 'Running' ? 'green' : pod.status === 'Pending' ? 'yellow' : 'red'
      container.innerHTML += `
        <div class="pod-item">
          <div class="item-title">${escapeHtml(pod.name)}</div>
          <div class="item-meta">
            <span class="tag ${cls}">${escapeHtml(pod.status)}</span>
            ${escapeHtml(pod.namespace)} · ${pod.restarts || 0} restarts
          </div>
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

  if (!cluster.pods?.length) {
    container.innerHTML += `<p class="empty-state" style="margin-top:4px">No pods found</p>`
  }
}

function setStatus(el, s) {
  el.className = 'status-chip'
  if (s === 'ok') { el.classList.add('green'); el.textContent = 'Cluster ✓' }
  else if (s === 'error') { el.classList.add('red'); el.textContent = 'Cluster ✗' }
  else { el.classList.add('yellow'); el.textContent = 'Cluster ...' }
}
