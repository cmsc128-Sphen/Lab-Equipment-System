const app = require('./app')

const port = Number(process.env.PORT) || 3000
const server = app.listen(port, () => {
  console.log(`Lab Equipment API listening on port ${port}`)
})

function shutdown() {
  server.close((error) => {
    if (error) {
      console.error('Failed to close the API server cleanly:', error)
      process.exitCode = 1
      return
    }

    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
