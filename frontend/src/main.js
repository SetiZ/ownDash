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

renderWeather(document.getElementById('weather-content'))
renderTimezones(document.getElementById('timezone-content'))
updateTimestamp()

let controller = null

function loadTab(name) {
  if (controller) controller.abort()
  controller = new AbortController()

  const statusEl = document.getElementById('status-' + name)
  const contentEl = document.getElementById('tab-' + name)
  const fns = { github: renderGitHub, k8s: renderK8s, plane: renderPlane }
  fns[name](contentEl, statusEl, { signal: controller.signal })
}

function activateTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    const active = b.dataset.tab === name
    b.classList.toggle('active', active)
    b.setAttribute('aria-selected', active)
  })
  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.toggle('active', c.id === 'tab-' + name)
  })
  localStorage.setItem('owndash-tab', name)
  loadTab(name)
}

const savedTab = localStorage.getItem('owndash-tab') || 'github'
activateTab(savedTab)

document.getElementById('data-tabs').addEventListener('click', e => {
  const btn = e.target.closest('.tab-btn')
  if (!btn) return
  activateTab(btn.dataset.tab)
})

document.querySelector('main').addEventListener('click', e => {
  const ns = e.target.closest('.ns-header')
  if (ns) ns.closest('.ns').classList.toggle('collapsed')
})
