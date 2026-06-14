const ZONES = [
  { label: 'Local', tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
  { label: 'UTC', tz: 'UTC' },
  { label: 'Paris', tz: 'Europe/Paris' },
  { label: 'NY', tz: 'America/New_York' },
  { label: 'SF', tz: 'America/Los_Angeles' },
  { label: 'Tokyo', tz: 'Asia/Tokyo' },
]

export function renderTimezones(container) {
  container.innerHTML = `<div class="timezone-grid">${ZONES.map(z => `
    <div class="tz-item">
      <div class="tz-label">${z.label}</div>
      <div class="tz-time">${fmt(z.tz)}</div>
    </div>
  `).join('')}</div>`
}

function fmt(tz) {
  return new Intl.DateTimeFormat('en', {
    timeStyle: 'short',
    timeZone: tz,
    hour12: false,
  }).format(new Date())
}
