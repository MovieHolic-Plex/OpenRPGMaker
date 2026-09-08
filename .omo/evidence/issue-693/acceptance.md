# Issue 693 acceptance ledger

Source: https://github.com/MovieHolic-Plex/rpg-zzu/issues/693

Base: `1959dec2eb0a268b0cf3bab9eee63be57d5a6ab6`

The repository owner authorized an isolated worktree, a pull request, deep-agent
fixes, repeated ultrabrain review until approval, and merge after approval.
Reports below are claims to reproduce, not established defects.

| ID | Scope | Acceptance evidence required | Status |
| --- | --- | --- | --- |
| OUT-001 | Accepted media persistence | Within-limit audio survives reload; Test Play launches; durable success and actionable quota failures; failed-write coverage | Pending reproduction |
| OUT-002 | Audio inventory and playback | Visible entries resolve; missing media returns 404; pickers agree; autoplay versus load/decode errors; range and service-worker coverage | Pending reproduction |
| OUT-003 | Private DELTA persistence adaptation | Explicitly excluded from the upstream package | Excluded |
| OUT-004 | Private DELTA implementation plan | Explicitly excluded from the upstream package | Excluded |
| OUT-005 | Assistant-aware viewport | Reachable map edges, useful centering, preserved focus/zoom, aligned editing coordinates | Pending reproduction |
| OUT-006 | Ctrl+wheel zoom | Both directions, existing limits, pointer anchor, unchanged plain wheel and keyboard controls | Pending reproduction |
| OUT-007 | Character asset no-match | Recoverable result, explicit recovery/cancel, preserved data, no dangling references, empty/incompatible catalog coverage | Pending reproduction |
| OUT-008 | Canvas navigation | Synchronized X/Y scrollbars, accurate thumbs, neutral empty-space pan, correct coordinates after zoom/resize | Pending reproduction |
| OUT-009 | Consented diagnostic export | Explicit local opt-in, preview/section selection, provenance, confirmation, sanitized Markdown/JSON, cancellation without artifacts, no network send | Pending reproduction |
| OUT-010 | Opt-in authoring/Test Play diagnostics | Off by default, bounded session, visible stop/clear, allowlisted receipts, retention/redaction/injection/performance tests | Pending reproduction |
| OUT-011 | Event validation handoff | Stable code/path/field/cause/hint, nested command focus, unsent assistant draft, sanitized Markdown/JSON copy | Pending reproduction |

## Boundaries

- Preserve the canonical Supabase project-storage contract. Do not introduce a
  local canonical project database or weaken its regression guard.
- Do not capture actual private session data during investigation. Diagnostic
  features require an explicit user action and remain local and off by default.
- Do not absorb unrelated work from pull requests 687 or 694.
- Reuse the existing editor component system and ownership boundaries.
- A passing unit test or agent report alone is not final acceptance. The lead
  runs the relevant real surfaces, repository gates, and production build.
- Final ultrabrain approval must identify the reviewed commit. Subsequent fixes
  require renewed review before merge.

## Review and verification

Initial independent ultrabrain review is running. No implementation, validation,
approval, or merge is claimed by this initial ledger.
