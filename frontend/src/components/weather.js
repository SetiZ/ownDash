export async function renderWeather(container) {
  try {
    const pos = await new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
    )
    const { latitude: lat, longitude: lon } = pos.coords
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto`
    const r = await fetch(url)
    const d = await r.json()

    const code = d.current.weather_code
    const temp = Math.round(d.current.temperature_2m)
    const high = Math.round(d.daily.temperature_2m_max[0])
    const low = Math.round(d.daily.temperature_2m_min[0])

    container.innerHTML = `
      <span class="weather-icon">${icon(code)}</span>
      <span class="temp">${temp}°</span>
      <span class="weather-desc">H:${high}° L:${low}° · ${desc(code)}</span>
    `
  } catch {
    container.innerHTML = `<span class="weather-desc">Location unavailable</span>`
  }
}

function icon(code) {
  if (code === 0) return '☀️'
  if (code <= 3) return '⛅'
  if (code <= 48) return '🌫️'
  if (code <= 57) return '🌧️'
  if (code <= 67) return '🌧️'
  if (code <= 77) return '❄️'
  if (code <= 82) return '🌧️'
  if (code <= 86) return '🌨️'
  return '⛈️'
}

function desc(code) {
  if (code === 0) return 'Clear'
  if (code <= 3) return 'Partly cloudy'
  if (code <= 48) return 'Foggy'
  if (code <= 57) return 'Drizzle'
  if (code <= 67) return 'Rain'
  if (code <= 77) return 'Snow'
  if (code <= 82) return 'Rain showers'
  if (code <= 86) return 'Snow showers'
  return 'Thunderstorm'
}
