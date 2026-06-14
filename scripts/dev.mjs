import { spawn } from 'child_process'

const backend = spawn('npm', ['run', 'dev'], {
  cwd: new URL('../backend', import.meta.url).pathname,
  stdio: 'inherit',
  env: { ...process.env },
})

const frontend = spawn('npm', ['run', 'dev'], {
  cwd: new URL('../frontend', import.meta.url).pathname,
  stdio: 'inherit',
  env: { ...process.env },
})

process.on('SIGINT', () => {
  backend.kill()
  frontend.kill()
  process.exit()
})
