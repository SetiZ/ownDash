import { fetchJson } from '../api/client.js'

export async function renderK8s(container, statusEl) {
  try {
    const data = await fetchJson('/k8s')
    setStatus(statusEl, data.status)
    container.innerHTML = ''

    if (data.pods?.length) {
      container.innerHTML += `<p><strong>Pods (${data.podCount} total):</strong></p>`
      data.pods.slice(0, 10).forEach(pod => {
        const cls = pod.status === 'Running' ? 'green' : pod.status === 'Pending' ? 'yellow' : 'red'
        container.innerHTML += `
          <div class="pod-item">
            <div class="item-title">${pod.name}</div>
            <div class="item-meta">
              <span class="tag ${cls}">${pod.status}</span>
              ${pod.namespace} · ${pod.restarts || 0} restarts
            </div>
          </div>`
      })
    }

    if (data.events?.length) {
      container.innerHTML += `<p style="margin-top:8px"><strong>Recent warnings:</strong></p>`
      data.events.slice(0, 5).forEach(ev => {
        container.innerHTML += `
          <div class="pr-item">
            <div class="item-title">${ev.message}</div>
            <div class="item-meta">${ev.namespace} · ${ev.count}x</div>
          </div>`
      })
    }

    if (!data.pods?.length) {
      container.innerHTML = `<p class="empty-state">No pods found or cluster unavailable</p>`
    }
  } catch (err) {
    container.innerHTML = `<p class="error-state">Failed to load: ${err.message}</p>`
    setStatus(statusEl, 'error')
  }
}

function setStatus(el, s) {
  el.className = 'status-chip'
  if (s === 'ok') { el.classList.add('green'); el.textContent = 'Cluster ✓' }
  else if (s === 'error') { el.classList.add('red'); el.textContent = 'Cluster ✗' }
  else { el.classList.add('yellow'); el.textContent = 'Cluster ...' }
}
