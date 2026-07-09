# AI Workflow

This page describes how an agent should operate on this project using the local wiki.

## Before changing files

- Read `AGENTS.md`.
- Read `openwiki/PROJECT_WIKI.md`.
- Read one or more focused pages based on the requested change.
- Inspect the source files named by those pages.
- Decide which validation command or browser scenario will prove the change.

## While changing files

- Keep edits inside the owning boundary when possible.
- Do not change project schema without checking migrations, serialization, fixtures, and save/load tests.
- Do not change runtime behavior only in UI glue if the rule belongs in `src/battle`, `src/player/interpreter`, or project data logic.
- AI assistant conversation history persistence lives in `src/ai/conversationStore.ts`; it uses browser `localStorage` only, is separate from project JSON/runtime session state, and is covered by `test/conversationStore.test.ts`.
- AI model routing is layered in `src/ai/llmClient.ts`: `model` is the supervisor model for planning, spatial reasoning, build specs, and final review; `liteModel` is the executor model for write-tool loops and repetitive batch helpers. `AssistantSession.sendUserMessage` uses a three-phase state machine when `liteModel` differs from `model`: plan on `model`, switch subsequent write-tool loop calls to `configForLiteModel`, then review on `model`. If review reports `재실행:`, the executor gets one repair pass before a final supervisor review. Region tasks, cluster/range/sample assist, and event-command natural-language conversion still pass an already-lite config and therefore stay on the lite path.
- Do not treat generated evidence, screenshots, or exported projects as source unless the task explicitly asks for evidence updates.
- Update the matching wiki page when the code change alters future navigation or risk.

## After changing files

- Run the lightest relevant validation first.
- Run broader checks when the change crosses module boundaries.
- For UI/editor work, drive the editor through a browser or Playwright scenario and save evidence.
- Report what was verified and what remains unverified.

## Headless Tool and MCP Access

- Use `node scripts/rpgzzu-tools.mjs --project test/fixtures/projects/battle-v3.json get_project_summary '{}'` to run editor tools outside the browser.
- Use `node scripts/rpgzzu-tools.mjs --list` to inspect the headless tool catalog and each tool's read/write mode.
- Use `node scripts/rpgzzu-mcp-server.mjs --project <project.json|project.rpgzzu> [--audit-log output/tool-audit.jsonl]` for MCP over stdio.
- The MCP server uses JSON-RPC 2.0 with `Content-Length` stdio framing and exposes `initialize`, `tools/list`, and `tools/call`.
- Headless/MCP execution is read-only for project storage: read tools run normally, write tools only produce dry-run summaries/diffs/issues.
- Do not add store save, project commit, or remote transport imports to `src/headless/` or the headless scripts; audit logs may record tool name, args, summary, and ok status, but never project JSON.

## Live editor AI assistant MCP (same UI session)

Use this when an external agent should drive the **in-editor AI chat panel** so a human can watch the stream/proposals on screen.

1. Start bridge MCP: `npm run mcp:assistant` (HTTP `http://127.0.0.1:17831` + MCP stdio).
2. Start the editor: `npm run dev` (DEV auto-connects the bridge; force with `?aiBridge=1`, disable with `?aiBridge=0`, port with `?aiBridgePort=17831`).
3. Ensure AI settings have an API key in the editor.
4. Point the MCP client at `scripts/rpgzzu-assistant-mcp.mjs` (stdio).

MCP tools:

- `assistant_ping` — browser hello recently?
- `assistant_send` `{ text, timeoutMs? }` — send through live panel; returns audit + harness when the turn ends
- `assistant_status` / `assistant_audit` / `assistant_harness` / `assistant_abort`

Browser also exposes `window.__rpgzzuAiBridge` for console debugging. Implementation: `src/editor/aiAssistantBridge.ts` + registration in `aiChatPanel.ts`. Bridge binds **localhost only**.

## Refreshing the wiki

Use `npm run openwiki:cpen` only for CPEN-backed refresh work. Keep runs page-sized to stay under CPEN content limits. Never put credentials in wiki files.

Use `npm run openwiki:verify` to check that required pages and AI entry points are present.
