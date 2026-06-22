import { fetchJson } from '../api/client.js'
import { escapeHtml } from '../utils/escape.js'

export async function renderPlane(container, statusEl, { signal } = {}) {
  try {
    const data = await fetchJson('/plane', { signal })
    setStatus(statusEl, data.status)
    container.innerHTML = ''

    if (data.status === 'error') {
      const msg = data.message || 'Unknown error from backend'
      container.innerHTML = `<p class="error-state">${escapeHtml(msg)}</p>`
      console.warn('[plane] API error:', msg)
      return
    }

    if (!data.projects?.length) {
      container.innerHTML = `<p class="empty-state">No active cycles</p>`
      return
    }

    for (const project of data.projects) {
      const total = project.cycles.reduce((sum, c) => sum + c.issues.length, 0)
      container.innerHTML += `<div class="project-heading">${escapeHtml(project.name)} (${total})</div>`

      for (const cycle of project.cycles) {
        const range = formatRange(cycle.start_date, cycle.end_date)
        container.innerHTML += `
          <div class="ns collapsed">
            <div class="ns-header">${escapeHtml(cycle.name)} · ${range} (${cycle.issues.length})</div>
            <div class="ns-pods">
              ${cycle.issues.map(issue => renderIssue(issue)).join('')}
            </div>
          </div>
        `
      }
    }
  } catch (err) {
    container.innerHTML = `<p class="error-state">Failed to load: ${escapeHtml(err.message)}</p>`
    setStatus(statusEl, 'error')
  }
}

function renderIssue(issue) {
  const stateTag = `<span class="state-tag" style="--label-color:${issue.state_color}">${escapeHtml(issue.state)}</span>`
  const labelsHtml = (issue.labels || []).map(l =>
    `<span class="label-tag" style="--label-color:${l.color}">${escapeHtml(l.name)}</span>`
  ).join('')
  const estimateTag = issue.estimate != null
    ? `<span class="tag estimate-tag">${escapeHtml(String(issue.estimate))}pt</span>`
    : ''
  const assigneeHtml = issue.assignee
    ? `<span class="assignee">${escapeHtml(issue.assignee)}</span>`
    : ''

  return `
    <div class="issue-card">
      <div class="item-title"><span class="issue-id">#${issue.sequence_id}</span> ${escapeHtml(issue.title)}</div>
      <div class="item-meta">${stateTag} ${labelsHtml} ${estimateTag} ${assigneeHtml}</div>
    </div>
  `
}

function formatRange(start, end) {
  const s = start ? start.slice(0, 10) : null
  const e = end ? end.slice(0, 10) : null
  if (!s && !e) return ''
  if (!s) return `until ${e}`
  if (!e) return `from ${s}`
  return `${s} – ${e}`
}

function setStatus(el, s) {
  el.className = 'status-chip'
  if (s === 'ok') { el.classList.add('green'); el.textContent = 'Plane ✓' }
  else if (s === 'error') { el.classList.add('red'); el.textContent = 'Plane ✗' }
  else { el.classList.add('yellow'); el.textContent = 'Plane ...' }
}
