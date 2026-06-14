import { fetchJson } from '../api/client.js'

export async function renderGitHub(container, statusEl) {
  try {
    const data = await fetchJson('/github')
    setStatus(statusEl, data.status)
    container.innerHTML = ''

    if (data.prs?.length) {
      container.innerHTML += `<p><strong>PRs awaiting review:</strong></p>`
      data.prs.slice(0, 8).forEach(pr => {
        container.innerHTML += `
          <div class="pr-item">
            <div class="item-title">${pr.title}</div>
            <div class="item-meta">
              <span class="tag ${stateTag(pr.state)}">${pr.state}</span>
              ${pr.repo} · ${pr.author}
            </div>
          </div>`
      })
    }

    if (data.workflows?.length) {
      container.innerHTML += `<p style="margin-top:8px"><strong>Recent workflows:</strong></p>`
      data.workflows.slice(0, 5).forEach(wf => {
        const cls = wf.conclusion === 'success' ? 'green' : wf.conclusion === 'failure' ? 'red' : 'yellow'
        container.innerHTML += `
          <div class="pr-item">
            <div class="item-title">${wf.name}</div>
            <div class="item-meta">
              <span class="tag ${cls}">${wf.conclusion || 'running'}</span>
              ${wf.branch} · ${wf.actor}
            </div>
          </div>`
      })
    }

    if (!data.prs?.length && !data.workflows?.length) {
      container.innerHTML = `<p class="empty-state">No activity</p>`
    }
  } catch (err) {
    container.innerHTML = `<p class="error-state">Failed to load: ${err.message}</p>`
    setStatus(statusEl, 'error')
  }
}

function setStatus(el, s) {
  el.className = 'status-chip'
  if (s === 'ok') { el.classList.add('green'); el.textContent = 'GitHub ✓' }
  else if (s === 'error') { el.classList.add('red'); el.textContent = 'GitHub ✗' }
  else { el.classList.add('yellow'); el.textContent = 'GitHub ...' }
}

function stateTag(s) {
  return s === 'open' ? 'accent' : s === 'merged' ? 'green' : 'yellow'
}
