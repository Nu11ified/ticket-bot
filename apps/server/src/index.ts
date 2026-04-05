import { Elysia } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import { cors } from '@elysiajs/cors'

const app = new Elysia()
  .use(
    swagger({
      documentation: {
        info: {
          title: 'TicketBot API',
          version: '0.0.1',
          description: 'API for the TicketBot Discord ticket management platform',
        },
      },
    }),
  )
  .use(cors())
  .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))
  .listen(3001)

console.log(`Server running at http://localhost:${app.server?.port}`)

export type App = typeof app
