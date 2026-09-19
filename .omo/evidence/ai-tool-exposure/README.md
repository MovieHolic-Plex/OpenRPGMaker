# Pi tool exposure verification — 2026-09-19

The previous hybrid change affected AssistantSession, while normal editor chat uses Pi.
This change connects the actual panel → command → HTTP request → Pi worker path.

## What was exercised

- Actual Pi Agent loop: initially hidden tool discovery, next-round native declarations,
  direct-call rescue, empty-search full-catalog recovery, more than 16 discovered tools,
  role allowlists and read-only boundaries. Existing publication/approval checks also run.
- Actual browser: normal input-box submissions (no `/pi` shortcut), intent parsing,
  candidate forwarding, real Pi loop, registry execution, result/review rendering.
- The browser uses a **scripted model**, not a live LLM. Detached blank-project fixtures
  verify editor code only; no game/demo was authored or published to a project database.
- Antigravity and Codex reported `connected:false`. Live model selection quality and
  billed-token savings remain unverified; no credentials are included here.

## Evidence

- `01-before.png`: editor before the first request.
- `02-result.png`: party change prepared for review.
- `03-result.png`: project-title change prepared for review.
- `04-result.png`: empty-search recovery and completed lookup.
- `05-complete.png`: end of the three-request browser run.
- `browser.json`: actual browser request hints; zero page errors.
- `browser-run-1.json` through `browser-run-3.json`: real worker round declarations,
  executed tool results, changed keys. All six tool calls succeeded.
  Round tool counts: party 15→20→20; title 14→20→20; empty search 16→237→237.
  These include `consult_writer`, hence full 237 versus 236 registry definitions.
- `catalog-metrics.json`: fixed-intent schema JSON character comparison, not token counts.
  RPG foundation: 236→34 registry schemas, 337,554→72,620 characters (78.5% reduction).
  Party: 14 schemas / 97.1%; portrait: 14 / 96.5%; opening: 14 / 97.0%.

## Reproduce

Start this worktree's Vite server with its own VITE_CACHE_DIR using `npm run dev:worktree`.
Then run `bun scripts/qa/ai-tool-exposure-worker.mts` and
`BASE=http://127.0.0.1:<worktree-port> node scripts/qa/ai-tool-exposure-browser.mjs`.
The QA worker listens only on loopback. Stop it after capture. `worker-port.txt` is transient.
