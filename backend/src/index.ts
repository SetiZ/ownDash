import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import github from './routes/github.js'
import k8s from './routes/k8s.js'
import plane from './routes/plane.js'

const app = new Hono()

app.route('/api/github', github)
app.route('/api/k8s', k8s)
app.route('/api/plane', plane)
app.get('/api/health', (c) => c.json({ status: 'ok' }))

const port = parseInt(process.env.PORT || '3001')
serve({ fetch: app.fetch, port })
