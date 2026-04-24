# Hostaway MCP Server — Project Brief

**Project:** `hostaway-mcp`
**Purpose:** A public, open-source Model Context Protocol (MCP) server that connects AI assistants (Claude Desktop, Claude Code, Cursor, etc.) to the Hostaway property management API.
**Author:** Matt Long — matt@plux.com
**Repository:** https://github.com/mattlong/hostaway-mcp

---

## Goal

Build and publish a production-quality MCP server for Hostaway so that:
1. Any property manager can connect Claude (or any MCP client) to their Hostaway account using just their credentials
2. They can query reservations, listings, calendars, financials, and conversations using natural language
3. The package is installable via `npx hostaway-mcp` with zero local setup beyond credentials

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Language | TypeScript | Best ecosystem for MCP, aligns with npm distribution |
| Runtime | Node.js 18+ | Required by MCP SDK |
| MCP SDK | `@modelcontextprotocol/sdk` | Official Anthropic SDK |
| HTTP client | `axios` | Simple, reliable, good error handling |
| Build | `tsup` | Fast TS bundler, produces clean CJS output |
| Distribution | npm public package (`hostaway-mcp`) | `npx`-compatible, zero install friction |

---

## Project Structure

```
hostaway-mcp/
├── src/
│   ├── index.ts                  # Entry point — env validation, banner, starts server
│   ├── server.ts                 # MCP server definition, tool registration
│   ├── hostaway/
│   │   ├── client.ts             # Axios instance, request helper, error formatting
│   │   ├── auth.ts               # OAuth token fetch + refresh logic
│   │   └── types.ts              # TypeScript interfaces, channel map, tool definition type
│   └── tools/
│       ├── reservations.ts       # Reservation tools (4)
│       ├── listings.ts           # Listing/property tools (3)
│       ├── calendar.ts           # Calendar and availability tools (4)
│       ├── financials.ts         # Revenue, payouts, financial breakdowns (3)
│       ├── conversations.ts      # Guest messaging tools (3)
│       └── index.ts              # Barrel export of all tool definitions
├── examples/
│   ├── claude-desktop-config.json
│   └── claude-code-config.json
├── .env.example
├── .gitignore
├── .npmignore
├── tsconfig.json
├── tsup.config.ts
├── package.json
├── CLAUDE.md
└── README.md
```

---

## Authentication

Hostaway uses OAuth2 client credentials flow.

**Environment variables (required):**
```
HOSTAWAY_ACCOUNT_ID=<integer account ID>
HOSTAWAY_CLIENT_SECRET=<client secret string>
```

**Optional:**
```
HOSTAWAY_READ_ONLY=true       # Disables all write/mutation tools
HOSTAWAY_CACHE_TTL=240        # Fallback token cache TTL in seconds when API doesn't provide expires_in
```

**Token flow (`src/hostaway/auth.ts`):**
- `POST https://api.hostaway.com/v1/accessTokens` with `grant_type=client_credentials`, `scope=general`
- Cache the token in memory using the server's `expires_in` value (falls back to `HOSTAWAY_CACHE_TTL` if not provided)
- Auto-refresh when within 60 seconds of expiry

---

## API Base

```
https://api.hostaway.com/v1
```

All requests include `Authorization: Bearer {token}` and `Cache-control: no-cache`.

---

## Tools (18 total)

### Reservations (`src/tools/reservations.ts`)

| Tool | Description | Key Params | Write? |
|---|---|---|---|
| `list_reservations` | List with filters (listing, dates, status, channel) | `listingMapId`, `dateFrom`, `dateTo`, `status`, `channelId`, `limit`, `offset` | No |
| `get_reservation` | Full details for one reservation | `reservationId` (required) | No |
| `update_reservation_host_note` | Update internal host note | `reservationId`, `hostNote` (required) | Yes |
| `list_reservations_by_property` | Current + upcoming grouped by listing | None | No |

### Listings (`src/tools/listings.ts`)

| Tool | Description | Key Params | Write? |
|---|---|---|---|
| `list_listings` | All active listings with metadata | `includeArchived` | No |
| `get_listing` | Full listing details (includes images) | `listingId` (required) | No |
| `get_listing_images` | All photos/images for a listing | `listingId` (required) | No |
| `get_listing_custom_fields` | Custom field values as name-value map | `listingId` (required) | No |

### Calendar (`src/tools/calendar.ts`)

| Tool | Description | Key Params | Write? |
|---|---|---|---|
| `get_calendar` | Availability + pricing calendar | `listingId`, `startDate`, `endDate` (all required) | No |
| `get_gap_nights` | Find short unbooked gaps between reservations | `listingId` (required), `startDate`, `endDate`, `maxGapLength` | No |
| `create_calendar_block` | Block dates on calendar | `listingId`, `startDate`, `endDate` (required), `note` | Yes |
| `delete_calendar_block` | Remove a calendar block | `listingId`, `calendarBlockId` (required) | Yes |

### Financials (`src/tools/financials.ts`)

| Tool | Description | Key Params | Write? |
|---|---|---|---|
| `get_reservation_financials` | Financial breakdown for a reservation | `reservationId` (required) | No |
| `get_revenue_summary` | Aggregated revenue across listings | `dateFrom`, `dateTo` (required), `listingId` | No |
| `get_payout_report` | Payout report for reconciliation | `dateFrom`, `dateTo` (required), `channelId` | No |

### Conversations (`src/tools/conversations.ts`)

| Tool | Description | Key Params | Write? |
|---|---|---|---|
| `list_conversations` | Recent guest conversations | `listingId`, `limit`, `unreadOnly` | No |
| `get_conversation` | Full message thread | `conversationId` (required) | No |
| `send_message` | Send message to guest | `conversationId`, `message` (required) | Yes |

---

## Error Handling

All tools handle errors gracefully — never throw unhandled exceptions:

| Scenario | Behaviour |
|---|---|
| Missing env vars | Exit on startup with clear message listing which vars are missing |
| Auth failure (401) | "Invalid Hostaway credentials. Check HOSTAWAY_ACCOUNT_ID and HOSTAWAY_CLIENT_SECRET." |
| Not found (404) | "Resource not found in your Hostaway account." |
| Rate limit (429) | "Hostaway API rate limit reached. Please wait a moment and retry." |
| Write blocked | "This tool is disabled because HOSTAWAY_READ_ONLY is set to true." |
| API down (5xx) | "Hostaway API returned an error ({status}). Try again shortly." |

---

## Key Implementation Notes

- **Listing IDs vs listingMapId:** `id` is used in `/listings/{id}` endpoints; `listingMapId` is used in reservation objects. Use the correct one per context.
- **Date formats:** Hostaway expects `YYYY-MM-DD`. Validate dates in all tools that accept them.
- **Pagination:** List endpoints support `limit` + `offset`. Aggregation tools (revenue summary, payout report, list_reservations_by_property) paginate internally to fetch all results.
- **Channel IDs:** `2000`=Airbnb, `2003`=Booking.com, `2009`=VRBO, `2014`=Direct, `2018`=Expedia, `2024`=Google Vacation Rentals, `2027`=TripAdvisor. Mapped via `CHANNEL_NAMES` in `types.ts`.
- **Custom fields:** Returned as `{ fieldId, value }` arrays — `get_listing_custom_fields` transforms to `{ fieldName: value }` map.
- **Read-only enforcement:** Check `process.env.HOSTAWAY_READ_ONLY === 'true'` at the top of each write tool handler before making any API call.
- **All console output to stderr** — MCP uses stdout for protocol communication.

---

## Publishing Checklist

Before `npm publish`:

- [ ] All tools tested against a real Hostaway account
- [ ] `HOSTAWAY_READ_ONLY=true` tested — confirms all write tools are blocked
- [ ] Missing env vars produce a clear error on startup
- [ ] `npx hostaway-mcp` works from a fresh directory with no local install
- [ ] README is complete with copy-paste Claude Desktop config
- [ ] `.npmignore` excludes `src/`, `*.env`, `examples/`, config files
- [ ] Version set to `1.0.0`
- [ ] License: MIT
- [ ] `package.json` has `repository`, `homepage`, `bugs` fields
- [ ] Keywords include: `mcp`, `hostaway`, `vacation-rental`, `airbnb`, `property-management`, `model-context-protocol`, `claude`, `ai-assistant`, `pms`
- [ ] README has npm version badge, license badge, and MCP badge

After publishing:

- [ ] Set GitHub repo topics: `mcp`, `hostaway`, `vacation-rental`, `airbnb`, `property-management`, `claude`
- [ ] Submit PR to `github.com/modelcontextprotocol/servers` to list in official registry
- [ ] Submit to `smithery.ai`

---

## Stretch Goals (v1.1+)

- `search_reservations` — full-text search across guest names
- `get_owner_statement` — formatted owner report for a listing + date range
- `list_tasks` — housekeeping/maintenance tasks
- `create_task` — create a housekeeping task
- `get_reviews` — fetch guest reviews per listing
- HTTP/SSE transport mode — for remote/hosted MCP use cases beyond stdio
- Rate limit handling with automatic retry + backoff
