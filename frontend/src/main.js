import { renderGitHub } from './components/github.js'
import { renderK8s } from './components/k8s.js'
import { renderPlane } from './components/plane.js'
import { renderWeather } from './components/weather.js'
import { renderTimezones } from './components/timezone.js'

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
}

function updateTimestamp() {
  document.getElementById('last-updated').textContent =
    new Date().toLocaleTimeString('en', { hour12: false })
}

async function refreshAll() {
  await Promise.allSettled([
    renderGitHub(
      document.getElementById('tab-github'),
      document.getElementById('status-github')
    ),
    renderK8s(
      document.getElementById('tab-k8s'),
      document.getElementById('status-k8s')
    ),
    renderPlane(
      document.getElementById('tab-plane'),
      document.getElementById('status-plane')
    ),
    renderWeather(document.getElementById('weather-content')),
  ])
  renderTimezones(document.getElementById('timezone-content'))
  updateTimestamp()
}

refreshAll()
setInterval(refreshAll, 60_000)

document.getElementById('data-tabs').addEventListener('click', e => {
  const btn = e.target.closest('.tab-btn')
  if (!btn) return
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'))
  btn.classList.add('active')
  document.getElementById('tab-' + btn.dataset.tab).classList.add('active')
})

document.querySelector('main').addEventListener('click', e => {
  const ns = e.target.closest('.ns-header')
  if (ns) ns.closest('.ns').classList.toggle('collapsed')
})
