import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import promptRouter from './routes/prompt'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 4000

// Middleware
app.use(cors({ origin: 'http://localhost:3000' }))
app.use(express.json({ limit: '2mb' }))

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'a-vi-api', timestamp: new Date().toISOString() })
})

// Routes
app.use('/api/prompt',   promptRouter)
app.get('/api/projects', (_req, res) => {
  res.json({ projects: [], message: 'Projects endpoint — coming soon' })
})

app.listen(PORT, () => {
  console.log(`[api] Server running on http://localhost:${PORT}`)
})

export default app
