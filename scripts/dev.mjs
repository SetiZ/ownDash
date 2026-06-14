import { spawn } from 'child_process'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnv() {
  try {
    const raw = readFileSync(resolve(import.meta.dirname, '../.env'), 'utf-8')
    const env = {}
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
    }
    return env
  } catch {
    return {}
  }
}

const env = { ...process.env, ...loadEnv() }

const backend = spawn('npm', ['run', 'dev'], {
  cwd: resolve(import.meta.dirname, '../backend'),
  stdio: 'inherit',
  env,
})

const frontend = spawn('npm', ['run', 'dev'], {
  cwd: resolve(import.meta.dirname, '../frontend'),
  stdio: 'inherit',
  env,
})

process.on('SIGINT', () => {
  backend.kill()
  frontend.kill()
  process.exit()
})
