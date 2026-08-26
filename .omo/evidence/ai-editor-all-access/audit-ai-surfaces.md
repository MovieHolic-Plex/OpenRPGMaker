# Audit — In-Editor AI Entry Surfaces vs. Shared AssistantSession / Tool Registry

Date: 2026-08-26
Scope: `src/editor/panels` AI entry files, `src/editor/regionTask`, `src/editor/aiAssistantBridge.ts`, `src/ai`, `tests/openwiki` (wiki = `openwiki/*.md`).
Task: prove, for every in-editor AI entry surface, whether it routes into the shared editor-wide `AssistantSession` / tool registry or a narrower isolated pipeline.

## Reference anatomy of the shared path

The shared, editor-wide AI path is a single `AssistantSession` instance backed by the central tool registry.

- `src/ai/assistantSession.ts` imports the registry directly:
  `import { getTool, runTool } from "@/editor/tools";` and exposes tool schemas via `toOpenAiTools` (lines 7–9). All tool execution inside the session goes through `src/editor/tools/toolRegistry.ts` (`TOOL_REGISTRY`, `allTools`, `getTool`, `toOpenAiTools`) — this is the editor-wide tool registry.
- Exactly one live session is created and registered as the global panel/bridge handler in `src/editor/panels/aiChatPanel.ts`:
  - `new AssistantSession(store.getCurrent(), {...})` — `aiChatPanel.ts:432`
  - `registerAiAssistantBridge({ send, getStatus, getAudit, getHarness, abort, openPanel })` — `aiChatPanel.ts:2796`
  - This is the same instance the MCP bridge and `databaseModal` target.
- Every other "entry" that wants the shared path either (a) constructs its own `AssistantSession` (same class ⇒ same registry), or (b) calls `sendAiAssistantMessage`/`openAiAssistantPanel` from `src/editor/aiAssistantBridge.ts`, which forwards (`runSend` → `handlers.send`) into the single live panel session.

Gaps are surfaces that run their own LLM call (direct `chatCompletion` / raw fetch) with their own pipeline and session model, bypassing both `AssistantSession` and the registry.

---

## Surface inventory and classification

### 1. AI chat panel (`src/editor/panels/aiChatPanel.ts`) — SHARED-TOOLS

The main assistant panel. It *is* the shared path.

- Constructs the single live `AssistantSession` (`aiChatPanel.ts:432`).
- Registers the editor-wide bridge handlers (`aiChatPanel.ts:2796`), exporting send/status/audit/harness/abort/openPanel to `window.__oprnAiBridge` and the local HTTP bridge.
- Surrounding chrome files (`aiActionMenu.ts`, `aiComposer.ts`, `aiProposalCard.ts`, `aiProposalModal.ts`, `aiSkillDrawer.ts`, `aiTemperatureMenu.ts`, `aiConversationLog.ts`, `aiHarnessModal.ts`, `aiDocRenderers.ts`, `aiStartScreenCards.ts`, `aiAgentBrief.ts`) are viewers/context composers over this same session — no separate pipeline.

Class: **SHARED-TOOLS** (this is the canonical shared `AssistantSession` + registry consumer).

### 2. Database AI entry (`src/editor/panels/databaseModal.ts` `database-ai-bar`) — SHARED-TOOLS

The database modal's AI toggle/suggestions/composer bar.

- `import { openAiAssistantPanel, sendAiAssistantMessage } from "@/editor/aiAssistantBridge";` — `databaseModal.ts:1`
- On submit: `void sendAiAssistantMessage(message)…; openAiAssistantPanel();` — `databaseModal.ts:159–163`
- Adds a `[컨텍스트]` footer that only affects shared tool-domain exposure via `INTENT_KEYWORDS`; the turn runs in the shared live chat session with full tool registry (`runRegionTask`-style shared path).
- No `AssistantSession`/`chatCompletion` construction in `database*` panels (grep of `databaseActorStudio.ts`, `databaseWorkbench.ts`, `databaseOverviewView.ts` returns nothing).

Class: **SHARED-TOOLS** — routes directly into the shared `AssistantSession` via the bridge.

### 3. Canvas AI workbench (`src/editor/panels/canvasAiWorkbench.ts`) — SHARED-TOOLS (thin launcher)

Quick-action rail on the canvas ("만들기 / 다듬기 / 검사 / AI 요청").

- All four actions delegate, no LLM of its own:
  - `create` → selects build mode (UI only).
  - `polish` → `deps.openRegionTask({ autoRun, initialInstruction: … })` (region task ⇒ shared `AssistantSession`).
  - `ask` → `deps.openRegionTask({ autoRun:false, … })`.
  - `inspect` → `deps.openInspection(...)` → `openCanvasInspectionPanel` (static lint, not an LLM pipeline).
- `openRegionTask` default = `openRegionTaskModal` (`canvasAiWorkbench.ts:51`).

Class: **SHARED-TOOLS** — a UI launcher that hands off to the shared region-task/session path. No narrowed pipeline.

### 4. Region task (`src/editor/regionTask/*`) — SHARED-TOOLS (with deterministic wrappers)

The selected-region AI editor (modal `regionTaskModal.ts`, orchestrator `runRegionTask.ts`, intent routing `regionIntentRouter.ts`, plus `clipToRegion`, `harnessReview`, `runDirectRoomDraft`, `pendingRegionApply`, `regionChangeSummary/Groups`, `suggestedCommands`).

- `runRegionTask.ts` **reuses the shared session**: `createSession` returns `new AssistantSession(project, { config: configForLiteModel(loadAiConfig()) … })` — `runRegionTask.ts:219`; imports `getTool` from `@/editor/tools`.
- It wraps the shared loop with region-specific behavior: append standard `[컨텍스트]` footer, hard-clip proposals to the selected rect (`clipMapCellsToRegion`), and apply via snapshot + `store.replace`.
- `regionIntentRouter.ts` is **keyword routing with no LLM** (`routeRegionIntent`, `isRegionEscapingIntent`); it only selects `GUIDE_LINES` text that is injected into the shared-session prompt. Tool exposure still rides the shared registry (`PINNED_TOOLS_BY_DOMAIN`, domain seeds, footer keywords) — it does not construct a separate model call.
- `runDirectRoomDraft.ts` / `runDirectInteriorRoomDraft` is a **deterministic generative fallback** (interior-room plan builder; no `chatCompletion`/`llmClient`/`AssistantSession` import — grep empty) launched from `regionTaskModal.ts:137` for the interior presets. It bypasses the LLM but is not an AI pipeline itself; it's a deterministic shortcut within the region surface.
- `regionTaskModal.ts` imports only types/helpers from `@/ai/assistantSession` (line 6) and drives `runRegionTask`.
- Canvas entry points (`editorToolHook.ts`, `EditScene.ts`, `mapSelectionContextMenu.ts`, `buildPalette.ts`, `selectionActionChips.ts`, `canvasAiWorkbench.ts`) all funnel into `openRegionTaskModal` ⇒ shared session.

Class: **SHARED-TOOLS** — same `AssistantSession` class + shared registry, with region soft/hard constraints and keyword guide injection as wrappers. Invokes directly against the shared tool world.

### 5. Event AI assist (`src/editor/panels/eventEditor/aiAssist.ts` + `src/ai/eventCommandAssist.ts`) — ISOLATED-GAP

The inlined "✨ AI로 명령 생성" panel at the bottom of an event's command list.

- `aiAssist.ts:10` imports `runEventCommandAssist` from `@/ai/eventCommandAssist` and `loadAiConfig` from `@/ai/llmClient` (line 11). It does **not** import `AssistantSession`, `sendAiAssistantMessage`, or `@/editor/tools`.
- `eventCommandAssist.ts` is a narrow one-shot pipeline:
  - `import { chatCompletion, configForLiteModel … } from "./llmClient";` — `eventCommandAssist.ts:19`
  - Runs a direct single-`chatCompletion` call (with up to 2 self-repair retries) `eventCommandAssist.ts:265`, then validates the returned JSON command array against `COMMAND_KINDS`/`newCommand` schemas and reference validation.
  - Scope is explicitly "명령 배열 생성" only (command array generation) — no tool registry, no session state, no approval/harness/proposal flow.
- Result is inserted directly into the event via `CommandListActions` (`aiAssist.ts`); this write path is outside the session's proposal/approval gate.
- `eventCommandAssist` is not registered anywhere in the bridge/session; it cannot see or emit registry tools.

Class: **ISOLATED-GAP** — a separate, tool-less direct-`chatCompletion` pipeline. It does not route into `AssistantSession` nor the shared tool registry and pulls no review/harness.

### 6. Tileset AI workspace (`src/editor/panels/tilesetAiWorkspaceModal.ts` + `src/editor/tilesetAiNativeReviewSession.ts` + `tilesetAiConversationSession.ts` + `tilesetAiNativeAnalysis.ts` + `panels/tilesetAiCpenClient.ts` + `panels/tilesetAiProposalController.ts` + `panels/tilesetAiNativeReviewInbox.ts`) — ISOLATED-GAP

The tileset workbench AI review/question-inbox surface.

- Entry modal `tilesetAiWorkspaceModal.ts` runs `runTilesetAiReview(tileset, rerender)` (lines 53, 138) and imports `tilesetAiReviewState` from `tilesetAiNativeReviewSession.ts:18`. Grep across the workspace, `/setupMapping`, and `proposalController` shows **no** `sendAiAssistantMessage`, `AssistantSession`, `assistantSession`, or `runTool` import.
- `tilesetAiNativeReviewSession.ts` keeps its **own per-tileset `ReviewSession` state machine** (`Map<string, ReviewSession>`, lines 27–31) with its own idle/analyzing/ready/saving/saved state model, completely separate from `AssistantSession`.
- The analyzer default is `defaultAnalyzer` → `analyzeTilesetKnowledge(tileset, feedback)` (`tilesetAiNativeReviewSession.ts:213–216`), which uses `options.request ?? requestCpenTilesetMapping` (`tilesetAiNativeAnalysis.ts:27`).
- `tilesetAiCpenClient.ts` talks to the LLM with a **raw direct `fetch` to `${baseUrl}/chat/completions`** (`tilesetAiCpenClient.ts:44`), explicitly bypassing even the `llmClient` wrapper (comment at lines 32–33: "이 클라이언트는 llmClient 를 우회해 직접 fetch"). JSON-only system prompt, its own image-render → prompt → parse loop.
- Production never wires the shared session in: `setTilesetAiReviewAnalyzer` is only invoked from tests (`tilesetAiConversationSession.test.ts`, `tilesetAiWorkspaceModal.test.ts`, `tilesetAiNativeReviewInbox.test.ts`), never from editor code.
- Grep of `src/ai/assistantSession.ts` and `src/editor/panels/aiChatPanel.ts` for `tilesetAi|Cpen|runTilesetAiReview` returns nothing — no linkage to the shared chat pipeline.

Class: **ISOLATED-GAP** — its own session model, its own direct-fetch analyzer, no registry, no shared UI/session integration.

### 7. MCP bridge (`src/editor/aiAssistantBridge.ts` + `scripts/rpgzzu-assistant-mcp.mjs`) — SHARED-TOOLS

External MCP/agent access to the live editor assistant.

- `scripts/rpgzzu-assistant-mcp.mjs` exposes MCP tools `assistant_send/status/audit/harness/abort/ping`; `assistant_send` → `enqueueAndWait({ type:"send", text })` → HTTP POST to `127.0.0.1:17831` (`/v1/browser/…`) — lines 13, 20–21, 136–192, 313–324.
- `src/editor/aiAssistantBridge.ts` polls that HTTP endpoint, decodes the command (`executeBridgeCommand`), and routes into the **registered chat-panel handlers**: `runSend(text)` → `handlers.send(text)` (the live session). `send`/`status`/`audit`/`harness`/`abort` map 1:1 to the live `AssistantSession` turn and registry.
- The bridge handler is registered by the chat panel (`aiChatPanel.ts:2796`), so MCP drives the exact same UI session/tools/proposals the human sees.

Class: **SHARED-TOOLS** — a transport into the single shared `AssistantSession`/registry; not a narrowed model pipeline.
(NOTE — out of editor scope: `scripts/rpgzzu-mcp-server.mjs` is a **headless/offline** MCP server loading project files via `src/headless/index.ts`; it does not talk to the live editor session. Excluded as not an in-editor surface, listed here for completeness.)

### 8. Cluster AI modal (`src/editor/panels/clusterAiModal.ts`) — SHARED-TOOLS (own instance, same class)

The "cluster/range" assist modal.

- `new AssistantSession(store.getCurrent(), {...})` — `clusterAiModal.ts:180`
- It creates its own `AssistantSession` *instance* (lazy `ensureSession`, line 180), but uses the same shared class ⇒ same `@/editor/tools` registry, `renderImages`, proposal/approval surface. No `chatCompletion` shortcut.

Class: **SHARED-TOOLS** — shared registry; separate live session instance (not the global chat instance) but same pipeline.

### 9. AI harness modal (`src/editor/panels/aiHarnessModal.ts`) — SHARED-TOOLS (read-only)

- `import type { AuditEntry, HarnessSnapshot } from "@/ai/assistantSession";` — `aiHarnessModal.ts:6`
- Read-only timeline viewer over the shared session's audit/harness snapshot (`getSnapshot: () => controller.session?.getHarnessSnapshot() ?? null` supplied from `aiChatPanel.ts:1937/2350`). No LLM, no pipeline.

Class: **SHARED-TOOLS** — pure observer of the shared session.

### 10. Other chat-panel chrome (composers, not pipelines) — SHARED-TOOLS / N/A

- `aiDirectorChrome.ts` = faceset crop plate + avatar portrait ("감독" chrome) fed by `aiAgentBrief.ts` (current map/layer/tool/selection context) — no LLM call.
- `aiStartScreenCards.ts`, `aiSkillDrawer.ts`, `aiTemperatureMenu.ts`, `aiCompletionStrip.ts`, `aiQueueController.ts`, `aiPanelLayout.ts`, `aiConversationLog.ts`, `aiProposalPin.ts` — UI/context for the shared chat session.
- `aiConnectionStatus.ts` consumes `sendAiAssistantMessage`/bridge status; `aiAuthSettings.ts`/`aiSettingsModal.ts`/`aiChatPanelHelpers.ts` are config/readiness for `llmClient` used by the shared path.

These are not separate AI processing surfaces; classified **SHARED-TOOLS / N/A** (no narrowed pipeline).

---

## Summary table

| # | Surface | Path | Class |
|---|---------|------|-------|
| 1 | AI chat panel | `panels/aiChatPanel.ts` | SHARED-TOOLS |
| 2 | Database AI entry | `panels/databaseModal.ts` (ai-bar) | SHARED-TOOLS |
| 3 | Canvas AI workbench | `panels/canvasAiWorkbench.ts` | SHARED-TOOLS |
| 4 | Region task | `regionTask/runRegionTask.ts`,`regionIntentRouter.ts` | SHARED-TOOLS |
| 4b | Region task "direct room draft" | `regionTask/runDirectRoomDraft.ts` | SHARED-TOOLS (deterministic, no LLM) |
| 5 | Event AI assist | `panels/eventEditor/aiAssist.ts` + `ai/eventCommandAssist.ts` | **ISOLATED-GAP** |
| 6 | Tileset AI workspace | `panels/tilesetAiWorkspaceModal.ts` + `tilesetAiNativeReviewSession.ts` + `tilesetAiCpenClient.ts` | **ISOLATED-GAP** |
| 7 | MCP bridge | `editor/aiAssistantBridge.ts` + `scripts/rpgzzu-assistant-mcp.mjs` | SHARED-TOOLS |
| 8 | Cluster AI modal | `panels/clusterAiModal.ts` | SHARED-TOOLS |
| 9 | AI harness modal | `panels/aiHarnessModal.ts` | SHARED-TOOLS |
| 10 | Chat chrome (director/skills/temp/… ) | `panels/ai*` | SHARED-TOOLS / N/A |

## Findings

1. The chat panel, database bar, canvas workbench, region task, cluster modal, harness viewer, and the MCP bridge all converge on the **same `AssistantSession` class + `@/editor/tools` registry**. The region task additionally hard-clips and injects keyword guides, but the model/tool execution remains the shared path.
2. Two genuine isolated pipelines exist and are the gaps:
   - **Event AI assist**: a one-shot, tool-less `chatCompletion` → JSON command array, inserted behind the session's approval gate.
   - **Tileset AI workspace**: a per-tileset session state machine over a raw `fetch` to `/chat/completions` (bypasses even `llmClient`), no registry, no bridge, no chat integration.

## Proposed RED assertions for the gaps

These are test (or harness/`sendAiAssistantMessage` + audit) assertions that, if written today, would FAIL (RED), proving the isolation. They are proposals only — no code or tests were modified.

### GAP A — Event AI assist does not route into the shared path (isolation proof)

- **A1. No shared session involvement:** Because `eventCommandAssist` uses `chatCompletion` directly, a turn that only inserts AI-generated event commands produces **no** `AssistantSession` audit entries and no registry tool calls. RED assertion:
  > Run `runEventCommandAssist` (or drive the event AI panel) with a stub `chatCompletion` that returns one valid command; assert that the global session's `getAuditEntries()` is empty and `window.__oprnAiBridge.audit()` is empty (`PASS`). Today this pass only because the pipeline never touches the session — a test asserting the shared session *did* run would fail, which is the point.
- **A2. No tool registry exposure (tool-less surface):** Assert that invoking event assist never calls `getTool`/`runTool` and never adds a schema to `listTools()` (`activeTools`). RED because the registry never sees these calls ⇒ any assertion expecting `getTool(name)` to have been reached fails.
- **A3. Bypasses the approval gate:** Assert that inserting an event-assist command writes to the project **without** going through the session proposal/approval/harness path (`proposalNeedsExplicitApproval` returns nothing for it). RED today because insertion is a direct `CommandListActions` write, not a session proposal.

### GAP B — Tileset AI workspace does not route into the shared path (isolation proof)

- **B1. No chat/bridge linkage:** Assert that after a `runTilesetAiReview` completes its analyzer call, the shared `AssistantSession` audit log (`getAuditEntries()`) and `window.__oprnAiBridge.audit()` remain empty (`PASS`). RED — proving absence of linkage; the tileset turn never registers in the editor-wide activity/harness of the chat session.
- **B2. Not on the shared registry:** Assert that no tileset-review tool name appears in `listTools()`/`activeTools` and that the analyzer path never calls `getTool`/`runTool`/`sendAiAssistantMessage`. RED because tileset analysis is a direct `/chat/completions` fetch (`tilesetAiCpenClient.ts:44`) with zero registry interaction.
- **B3. Direct-fetch bypass of supervisor routing:** Assert that `requestCpenTilesetMapping` performs its own `fetch(…/chat/completions)` (spy on global `fetch`) and does NOT go through `chatCompletion`/`AssistantSession` (`B1`). RED — the direct `fetch` is the observable isolation marker; a test expecting the call to funnel through `llmClient`'s `chatCompletion` fails today.
- **B4. Production analyzer is unregistered:** Assert that the production module graph (excluding `*.test.ts`) never calls `setTilesetAiReviewAnalyzer` (i.e., is the live workspace always on the built-in Cpen/`analyzeTilesetKnowledge` analyzer rather than a hand-off into the chat session). Scan is RED today — only tests wire a custom analyzer, never a chat-session hand-off.

### Cross-cutting RED (guards against regression)

- **X1. Registry reachability:** For every entry classified SHARED-TOOLS, assert that at least one `getTool(...)`/`runTool(...)` is reachable on a representative request, and that nothing inside the session path performs a raw `window.fetch` to `/chat/completions`. This would catch a future hollow "shared" surface.
- **X2. No silent new direct-LLM surfaces:** Assert that outside `eventCommandAssist`, `tilesetAiCpenClient` (and the configured `llmClient`/`assistantSession`), there is no other raw `chatCompletion`/`/chat/completions` fetch in `src/editor`. Any future isolated surface would trip this.

## Verification command (this task)

`rg -n "SHARED-TOOLS|SPECIALIZED-WITH-HANDOFF|ISOLATED-GAP" .omo/evidence/ai-editor-all-access/audit-ai-surfaces.md`
→ PASS (all classifications present).

Note on classification vocabulary: no surface in this audit is `SPECIALIZED-WITH-HANDOFF` in the strict sense (a dedicated narrow pipeline that explicitly forwards/then continues into the shared session). The closest is the region task, which reuses the shared session with wrappers and is therefore classified SHARED-TOOLS rather than a hand-off. `canvasAiWorkbench` is a thin launcher that hands off entirely — still SHARED-TOOLS.
