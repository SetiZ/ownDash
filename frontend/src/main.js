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
      document.getElementById('github-content'),
      document.getElementById('status-github')
    ),
    renderK8s(
      document.getElementById('k8s-content'),
      document.getElementById('status-k8s')
    ),
    renderPlane(
      document.getElementById('plane-content'),
      document.getElementById('status-plane')
    ),
    renderWeather(document.getElementById('weather-content')),
  ])
  renderTimezones(document.getElementById('timezone-content'))
  updateTimestamp()
}

refreshAll()
setInterval(refreshAll, 60_000)
