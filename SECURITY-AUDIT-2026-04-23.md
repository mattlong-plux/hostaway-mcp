# Security Audit Report
**Project:** hostaway-mcp  
**Date:** 2026-04-23  
**Auditor:** Claude Code (security-audit skill)  
**Stack:** Node.js 18+ / TypeScript / MCP SDK / Axios  
**Prior audit:** 2026-04-19 (8 findings; 7 resolved, 1 remaining)

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW / INFO | 2 |

---

## Findings

### MEDIUM — Claude Code Global Settings Lack Deny Rules
**Phase:** 6 (Claude Code Environment)  
**File:** `~/.claude/settings.json`  
**Description:** The global Claude Code settings contain only a plugin enablement and no `permissions.deny` rules. This means Claude Code in any project on this machine can read `.env` files, SSH keys, and make outbound network requests via `curl`/`wget` without prompting. This is a local development environment concern, not a code defect.  
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

### LOW — `HOSTAWAY_READ_ONLY` Default Is Permissive
**Phase:** 5 (A01 Broken Access Control)  
**File:** `src/hostaway/client.ts:51-53`  
**Description:** `HOSTAWAY_READ_ONLY` defaults to `false`, meaning write operations (send messages to guests, block calendar dates, update reservations) are enabled unless explicitly disabled. A startup warning is now displayed when write mode is active (`src/index.ts:33`), which mitigates the surprise factor. Consider whether defaulting to read-only would better serve new users.  
**Status:** Partially mitigated (startup warning added since last audit). Acceptable as-is with the warning.

---

### LOW — Auth Token Stored in Module-Level Variable
**Phase:** 1 (Environment)  
**File:** `src/hostaway/auth.ts:8`  
**Description:** The OAuth access token is cached in a module-level `let cachedToken` variable. While standard for a single-process server, the token could be exposed via a heap dump if the Node.js process crashes. This is a low risk given the server's stdio transport (local-only, no network exposure).  
**Status:** Acceptable for current architecture. Revisit if HTTP/SSE transport is added.

---

## Resolved Since Last Audit (2026-04-19)

| Finding | Severity | Resolution |
|---------|----------|------------|
| No input validation on numeric path parameters | HIGH | `validateId()` added in `client.ts:75-80`, applied to all tool handlers |
| No pagination bound on aggregation tools | HIGH | `MAX_PAGES = 20` enforced in `reservations.ts`, `financials.ts` |
| `HOSTAWAY_CACHE_TTL` parsed without validation | MEDIUM | `getCacheTtl()` now checks for `NaN` and `< 1` (`auth.ts:13-14`) |
| `send_message` lacks length limit | MEDIUM | Empty check + 5000-char max added (`conversations.ts:77-81`) |
| `.npmignore` missing exclusions | LOW | `CLAUDE.md`, `SECURITY-AUDIT-*.md`, `server.json`, `*.tgz` now excluded |
| No startup warning for write mode | LOW | Warning added in `index.ts:33` |

---

## Passed Checks

### Phase 1 — Environment & Secrets
- No hardcoded secrets in any tracked source file
- `.gitignore` covers `.env*`, `node_modules/`, `dist/`, `.npmrc`, `.mcpregistry_*_token`
- Git history clean across all 5 commits — no secrets ever committed
- `.env.example` uses placeholder values only
- `package.json` `files` field restricts npm package to `dist/` and `README.md` only
- `.npmignore` excludes `CLAUDE.md`, `server.json`, audit reports, source, and config files

### Phase 2 — Supabase RLS
- Not applicable — no database; server is a REST API proxy

### Phase 3 — Server/Client Boundary
- Not applicable — no browser bundle; pure Node.js CLI server
- All output correctly routed to stderr; stdout reserved for MCP protocol

### Phase 4 — AI / Prompt Injection
- No AI API calls in codebase — server is an MCP tool provider, not an AI consumer
- `send_message` has length limit (5000 chars) preventing abuse via LLM-generated messages
- All write tools gated behind `HOSTAWAY_READ_ONLY` check

### Phase 5 — OWASP Top 10:2025
- **A01 Broken Access Control:** Read-only mode enforced consistently across all 4 write tools; `validateId()` prevents path traversal
- **A02 Cryptographic Failures:** HTTPS only (`https://api.hostaway.com`); no weak crypto (MD5/SHA1/Math.random)
- **A03 Injection:** No SQL, no `eval()`/`exec()`, no template literals in queries; IDs validated as positive integers before URL interpolation
- **A04 Insecure Design:** Pagination bounded at 2000 results; date format validated; message length capped
- **A05 Security Misconfiguration:** No `console.log` in source; no debug endpoints; no verbose error messages to clients
- **A06 Vulnerable Components:** 2 production dependencies (MCP SDK, Axios) — minimal attack surface
- **A07 Auth Failures:** OAuth tokens cached with expiry; 60-second pre-expiry refresh; credentials validated at startup
- **A08 Data Integrity:** No deserialization of untrusted data beyond JSON API responses
- **A09 Logging Failures:** No sensitive data logged; all errors return structured MCP responses
- **A10 SSRF:** No user-controlled URLs; all API calls go to fixed `api.hostaway.com` base URL

### Phase 6 — Claude Code Environment
- `server.json` marks `HOSTAWAY_CLIENT_SECRET` as `isSecret: true`

---

## Recommended Next Steps

1. **Harden Claude Code global settings** with deny rules for `.env` and SSH key reads (MEDIUM — local dev concern)
2. **Consider defaulting to read-only mode** and requiring explicit opt-in for writes (LOW — UX decision)
3. **Pin dependency versions** in `package.json` before next npm publish for reproducible builds (LOW)
4. **Monitor for HTTP/SSE transport** — if added, revisit token storage and add rate limiting
