import { startServer } from './server.js'

// Validate required environment variables
const requiredVars = ['HOSTAWAY_ACCOUNT_ID', 'HOSTAWAY_CLIENT_SECRET']
const missing = requiredVars.filter((v) => !process.env[v])

if (missing.length > 0) {
  process.stderr.write(
    `\nError: Missing required environment variables: ${missing.join(', ')}\n` +
      'Set HOSTAWAY_ACCOUNT_ID and HOSTAWAY_CLIENT_SECRET before starting the server.\n' +
      'See: https://github.com/mattlong-plux/hostaway-mcp#prerequisites\n\n'
  )
  process.exit(1)
}

// Startup banner (stderr — MCP uses stdout for protocol)
process.stderr.write(`
╔══════════════════════════════════════════════════════╗
║           hostaway-mcp  v1.0.0                       ║
║  Hostaway MCP Server by Matt Long                    ║
║  matt@plux.com                                       ║
║                                                      ║
║  Feedback, bugs & feature requests welcome:          ║
║ https://github.com/mattlong-plux/hostaway-mcp/issues ║
╚══════════════════════════════════════════════════════╝

`)

const readOnly = process.env.HOSTAWAY_READ_ONLY === 'true'
if (readOnly) {
  process.stderr.write('  Mode: READ-ONLY (write tools disabled)\n\n')
}

startServer().catch((error) => {
  process.stderr.write(`Fatal error starting server: ${error}\n`)
  process.exit(1)
})
