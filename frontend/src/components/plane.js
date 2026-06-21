import { fetchJson } from '../api/client.js'
import { escapeHtml } from '../utils/escape.js'

export async function renderPlane(container, statusEl, { signal } = {}) {
  try {
    const data = await fetchJson('/plane', { signal })
    setStatus(statusEl, data.status)
    container.innerHTML = ''

    if (data.issues?.length) {
      container.innerHTML += `<p><strong>Assigned issues:</strong></p>`
      data.issues.slice(0, 10).forEach(issue => {
        container.innerHTML += `
          <div class="issue-item">
            <div class="item-title">${escapeHtml(issue.title)}</div>
            <div class="item-meta">
              <span class="tag ${stateColor(issue.state)}">${escapeHtml(issue.state)}</span>
              ${escapeHtml(issue.project)} · ${escapeHtml(issue.priority || 'no priority')}
            </div>
          </div>`
      })
    }

    if (!data.issues?.length) {
      container.innerHTML = `<p class="empty-state">No open issues assigned to you</p>`
    }
  } catch (err) {
    container.innerHTML = `<p class="error-state">Failed to load: ${escapeHtml(err.message)}</p>`
    setStatus(statusEl, 'error')
  }
}

function setStatus(el, s) {
  el.className = 'status-chip'
  if (s === 'ok') { el.classList.add('green'); el.textContent = 'Plane ✓' }
  else if (s === 'error') { el.classList.add('red'); el.textContent = 'Plane ✗' }
  else { el.classList.add('yellow'); el.textContent = 'Plane ...' }
}

function stateColor(s) {
  if (s === 'backlog' || s === 'todo') return 'yellow'
  if (s === 'in_progress') return 'accent'
  if (s === 'done' || s === 'cancelled') return 'green'
  return 'yellow'
}
