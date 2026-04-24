# hostaway-mcp

[![npm version](https://img.shields.io/npm/v/@matt-long-plux/hostaway-mcp.svg)](https://www.npmjs.com/package/@matt-long-plux/hostaway-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP](https://img.shields.io/badge/MCP-Compatible-blue)](https://modelcontextprotocol.io)

An open-source [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that connects AI assistants like Claude Desktop, Claude Code, and Cursor to the [Hostaway](https://www.hostaway.com) property management API. Query reservations, listings, calendars, financials, and guest conversations using natural language.

## Quick Start

1. Get your **Account ID** and **Client Secret** from your Hostaway dashboard under **Settings > API**
2. Make sure you have **Node.js 18+** installed
3. Pick your AI client below and add the config — no cloning or building required

## Setup

### Claude Desktop (Mac & Windows)

Open your Claude Desktop config file:

- **Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Add the following (merge with existing `mcpServers` if you have other servers configured):

```json
{
  "mcpServers": {
    "hostaway": {
      "command": "npx",
      "args": ["-y", "@matt-long-plux/hostaway-mcp"],
      "env": {
        "HOSTAWAY_ACCOUNT_ID": "YOUR_ACCOUNT_ID",
        "HOSTAWAY_CLIENT_SECRET": "YOUR_CLIENT_SECRET"
      }
    }
  }
}
```

Restart Claude Desktop and you're ready to go.

### Claude Code

**Option 1 — CLI command (quickest):**

```bash
claude mcp add hostaway \
  -e HOSTAWAY_ACCOUNT_ID=YOUR_ACCOUNT_ID \
  -e HOSTAWAY_CLIENT_SECRET=YOUR_CLIENT_SECRET \
  -- npx -y @matt-long-plux/hostaway-mcp
```

**Option 2 — `.mcp.json` in your project root** (good for sharing with teammates):

```json
{
  "mcpServers": {
    "hostaway": {
      "command": "npx",
      "args": ["-y", "@matt-long-plux/hostaway-mcp"],
      "env": {
        "HOSTAWAY_ACCOUNT_ID": "YOUR_ACCOUNT_ID",
        "HOSTAWAY_CLIENT_SECRET": "YOUR_CLIENT_SECRET"
      }
    }
  }
}
```

### Cursor

Add the same config to your project's `.cursor/mcp.json`, or go to **Cursor Settings > MCP Servers > Add Server** and paste:

```json
{
  "mcpServers": {
    "hostaway": {
      "command": "npx",
      "args": ["-y", "@matt-long-plux/hostaway-mcp"],
      "env": {
        "HOSTAWAY_ACCOUNT_ID": "YOUR_ACCOUNT_ID",
        "HOSTAWAY_CLIENT_SECRET": "YOUR_CLIENT_SECRET"
      }
    }
  }
}
```

## Updating

If you installed a previous version via `npx`, your system may have a cached copy. To update to the latest release:

```bash
npx clear-npx-cache
```

Then restart your AI client (Claude Desktop, Cursor, etc.). The next launch will automatically pull the latest version.

Alternatively, you can pin `@latest` in your config to always fetch the newest version on each restart:

```json
"args": ["-y", "@matt-long-plux/hostaway-mcp@latest"]
```

## Tools Reference

### Reservations

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_reservations` | List reservations with filters | `listingMapId`, `dateFrom`, `dateTo`, `status`, `channelId`, `limit` |
| `get_reservation` | Get full reservation details | `reservationId` (required) |
| `update_reservation_host_note` | Update internal host note | `reservationId`, `hostNote` (required) |
| `list_reservations_by_property` | Current + upcoming reservations grouped by property | None |

### Listings

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_listings` | All active listings with metadata | `includeArchived` |
| `get_listing` | Full listing details | `listingId` (required) |
| `get_listing_custom_fields` | Custom field values as name-value map | `listingId` (required) |

### Calendar

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `get_calendar` | Availability and pricing calendar | `listingId`, `startDate`, `endDate` (all required) |
| `get_gap_nights` | Find short unbooked gaps between reservations | `listingId` (required), `startDate`, `endDate`, `maxGapLength` |
| `create_calendar_block` | Block dates on calendar | `listingId`, `startDate`, `endDate` (required), `note` |
| `delete_calendar_block` | Remove a calendar block | `listingId`, `calendarBlockId` (required) |

### Financials

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `get_reservation_financials` | Financial breakdown for a reservation | `reservationId` (required) |
| `get_revenue_summary` | Aggregated revenue across listings | `dateFrom`, `dateTo` (required), `listingId` |
| `get_payout_report` | Payout report for reconciliation | `dateFrom`, `dateTo` (required), `channelId` |

### Conversations

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_conversations` | Recent guest conversations | `listingId`, `limit`, `unreadOnly` |
| `get_conversation` | Full message thread | `conversationId` (required) |
| `send_message` | Send message to guest | `conversationId`, `message` (required) |

## Read-Only Mode

Set `HOSTAWAY_READ_ONLY=true` to disable all write/mutation tools. When enabled, the following tools will return an error instead of executing:

- `update_reservation_host_note`
- `create_calendar_block`
- `delete_calendar_block`
- `send_message`

This is useful for shared accounts or when you want to prevent accidental modifications.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `HOSTAWAY_ACCOUNT_ID` | Yes | Your Hostaway account ID (integer) |
| `HOSTAWAY_CLIENT_SECRET` | Yes | Your Hostaway API client secret |
| `HOSTAWAY_READ_ONLY` | No | Set to `true` to disable write operations |
| `HOSTAWAY_CACHE_TTL` | No | Token cache TTL in seconds (default: 240) |

## Example Queries

Once connected, try asking Claude:

- "Show me all upcoming reservations"
- "What's the occupancy looking like for my properties next month?"
- "Find gap nights across all listings for the next 90 days"
- "How much revenue did I make last month?"
- "Show me unread guest messages"
- "What are the financials for reservation 12345?"
- "Generate a payout report for Airbnb bookings in March"

## Contributing

Feedback and pull requests are welcome! Please open an issue on [GitHub](https://github.com/mattlong-plux/hostaway-mcp/issues) or email [matt@plux.com](mailto:matt@plux.com).

## License

MIT
