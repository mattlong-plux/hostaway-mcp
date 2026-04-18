# Security Audit Report
**Project:** hostaway-mcp  
**Date:** 2026-04-19  
**Auditor:** Claude Code (security-audit skill)  
**Stack:** Node.js 18+ / TypeScript / MCP SDK / Axios

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 2 |
| MEDIUM | 3 |
| LOW / INFO | 3 |

---

## Findings

### HIGH — No Input Validation on Numeric Path Parameters
**Phase:** 5 (A03 Injection)  
**Files:** `src/tools/reservations.ts:62`, `src/tools/listings.ts:55`, `src/tools/calendar.ts:166`, `src/tools/conversations.ts:49`, `src/tools/financials.ts:17`  
**Description:** Numeric IDs from tool arguments (e.g. `reservationId`, `listingId`, `conversationId`, `calendarBlockId`) are interpolated directly into URL paths without type or range validation. While the MCP JSON Schema declares these as `type: 'number'`, a malicious or buggy MCP client could send a string like `"../admin"` or `"1/../../other-endpoint"`. The value flows directly into `\`/reservations/${args.reservationId}\`` and then into the Axios URL.  
**Remediation:** Validate all ID parameters before use in URL paths. Add a shared validator:
```typescript
function validateId(value: unknown, name: string): number {
  const num = Number(value)
  if (!Number.isInteger(num) || num <= 0) {
    throw new Error(`Invalid ${name}: must be a positive integer`)
  }
  return num
}
```
Apply to every tool handler that builds a URL path from user input.

---

### HIGH — No Rate Limit or Pagination Bound on Aggregation Tools
**Phase:** 5 (A04 Insecure Design)  
**Files:** `src/tools/reservations.ts:115`, `src/tools/financials.ts:63-79`, `src/tools/financials.ts:152-168`  
**Description:** The `list_reservations_by_property`, `get_revenue_summary`, and `get_payout_report` tools paginate through ALL matching results with an unbounded `while (true)` loop. A Hostaway account with thousands of reservations and a wide date range could cause the server to make hundreds of sequential API calls, exhausting memory and potentially triggering Hostaway's rate limiter. There is no upper bound on iterations or total results fetched.  
**Remediation:** Add a maximum page count (e.g. 20 iterations = 2,000 results) and return a truncation warning if the limit is hit:
```typescript
const MAX_PAGES = 20
let page = 0
while (page < MAX_PAGES) {
  // ... fetch batch ...
  page++
}
if (page >= MAX_PAGES) {
  // append warning about truncated results
}
```

---

### MEDIUM — `HOSTAWAY_CACHE_TTL` Parsed Without Validation
**Phase:** 1 (Environment)  
**File:** `src/hostaway/auth.ts:11-13`  
**Description:** `parseInt(envTtl, 10)` is used without checking that the result is a valid positive number. A misconfigured value like `HOSTAWAY_CACHE_TTL=abc` produces `NaN`, which then flows into token expiry math (`now + NaN = NaN`), causing every subsequent request to re-authenticate (performance issue) or produce undefined caching behavior.  
**Remediation:**
```typescript
function getCacheTtl(): number {
  const envTtl = process.env.HOSTAWAY_CACHE_TTL
  if (!envTtl) return 240
  const parsed = parseInt(envTtl, 10)
  if (isNaN(parsed) || parsed < 1) return 240
  return parsed
}
```

---

### MEDIUM — `send_message` Tool Lacks Length Limit
**Phase:** 4 (AI / Prompt Injection adjacent)  
**File:** `src/tools/conversations.ts:71-80`  
**Description:** The `send_message` tool accepts an unbounded `message` string and forwards it to the Hostaway API. Since this tool is invoked by an AI assistant, a prompt injection attack could cause the AI to send an extremely long or malicious message to a guest. There is no length validation or content sanitisation.  
**Remediation:** Add a reasonable length limit (e.g. 5,000 characters) and consider logging outbound messages:
```typescript
if (!args.message || (args.message as string).length > 5000) {
  return { content: [{ type: 'text', text: 'Message must be between 1 and 5000 characters.' }], isError: true }
}
```

---

### MEDIUM — Claude Code Global Settings Lack Deny Rules
**Phase:** 6 (Claude Code Environment)  
**File:** `~/.claude/settings.json`  
**Description:** The global Claude Code settings contain only a plugin enablement and no `permissions.deny` rules. This means Claude Code in any project on this machine can read `.env` files, SSH keys, and make outbound network requests via `curl`/`wget` without prompting.  
**Remediation:** Add deny rules to `~/.claude/settings.json`:
```json
{
  "permissions": {
    "deny": [
      "Read(**/.env)",
      "Read(**/.env.local)",
      "Read(**/.env.production)",
      "Read(**/id_rsa)",
      "Read(**/id_ed25519)"
    ]
  }
}
```

---

### LOW — `.npmignore` Does Not Exclude `CLAUDE.md`, `server.json`, or `SECURITY-AUDIT-*.md`
**Phase:** 1 (Environment)  
**File:** `.npmignore`  
**Description:** The published npm package includes `CLAUDE.md` (which contains implementation details, auth flow specifics, and internal architecture notes) and `server.json`. While not secrets, `CLAUDE.md` gives potential attackers a detailed blueprint of the server's internals, error handling, and API patterns.  
**Remediation:** Add to `.npmignore`:
```
CLAUDE.md
SECURITY-AUDIT-*.md
server.json
*.tgz
```

---

### LOW — Auth Token Stored in Module-Level Variable
**Phase:** 1 (Environment)  
**File:** `src/hostaway/auth.ts:8`  
**Description:** The OAuth access token is cached in a module-level `let cachedToken` variable. While this is standard for a single-process server and not directly exploitable, the token could be exposed via a heap dump or core dump if the Node.js process crashes. This is a low risk given the server's stdio transport (local-only).  
**Remediation:** No immediate action required. Acceptable for a local stdio MCP server. If HTTP/SSE transport is added later, consider encrypting the token in memory or using a more secure token store.

---

### LOW — `HOSTAWAY_READ_ONLY` Default Is Permissive
**Phase:** 5 (A01 Broken Access Control)  
**File:** `src/hostaway/client.ts:51-53`  
**Description:** `HOSTAWAY_READ_ONLY` defaults to `false`, meaning write operations (send messages to guests, block calendar dates, update reservations) are enabled unless explicitly disabled. The README mentions this flag but new users may not set it, inadvertently allowing the AI to perform mutations.  
**Remediation:** Consider defaulting to read-only mode and requiring `HOSTAWAY_READ_ONLY=false` to enable writes. At minimum, add a startup warning when write mode is active:
```typescript
if (!readOnly) {
  process.stderr.write('  WARNING: Write tools are ENABLED. Set HOSTAWAY_READ_ONLY=true to disable.\n\n')
}
```

---

## Passed Checks

- **No hardcoded secrets** — No API keys, tokens, or credentials found in any tracked source file
- **`.gitignore` is comprehensive** — Covers `.env*`, `node_modules/`, `dist/`, `.npmrc`, registry tokens
- **Git history clean** — No secrets found in any of the 3 commits
- **`.env.example` uses placeholder values** — No real credentials
- **HTTPS only** — All API calls use `https://api.hostaway.com`, no HTTP endpoints
- **No weak cryptography** — No MD5, SHA1, or `Math.random()` usage
- **No SQL injection surface** — No database queries; all data comes from REST API
- **No `eval()`/`exec()` usage** — No dynamic code execution
- **No `console.log` in source** — All output uses `process.stderr.write`; no accidental data leakage to stdout (which would corrupt MCP protocol)
- **Error handling is comprehensive** — All tool handlers wrap in try/catch; errors return structured responses, never throw
- **Read-only enforcement is consistent** — All 4 write tools check `isReadOnly()` before any API call
- **server.json marks `HOSTAWAY_CLIENT_SECRET` as `isSecret: true`** — MCP clients will mask this value
- **Token refresh has buffer** — 60-second pre-expiry refresh prevents auth failures
- **No Supabase / no database** — Phases 2 (RLS) and portions of Phase 3 (server/client boundary) are not applicable
- **No AI API calls in codebase** — Phase 4 (prompt injection) is not applicable to the server's own code
- **Date validation present** — Calendar tools validate `YYYY-MM-DD` format before API calls

---

## Recommended Next Steps

1. **Add ID parameter validation** to all tool handlers that interpolate values into URL paths (HIGH)
2. **Add pagination bounds** to aggregation tools to prevent runaway API calls (HIGH)
3. **Add length validation** to `send_message` tool's message parameter (MEDIUM)
4. **Harden `getCacheTtl()`** with NaN check (MEDIUM)
5. **Update `.npmignore`** to exclude `CLAUDE.md`, `server.json`, and audit reports (LOW)
6. **Add a startup warning** when write mode is enabled (LOW)
7. **Harden Claude Code settings** with deny rules for `.env` and SSH key reads (MEDIUM)
