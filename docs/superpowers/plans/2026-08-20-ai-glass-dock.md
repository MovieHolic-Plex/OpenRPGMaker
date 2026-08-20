# AI Glass Dock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a user-selectable `glass` AI dock (left translucent card on the map) without dropping `float` or `side`.

**Architecture:** Pure `parseChatDock` / `cycleChatDock` in `src/editor/chatDock.ts`. Overlay docks (`float`, `glass`) mount in `chat-float-host`; `side` stays in the right column. Glass shows the work log inside the card, never the full-width rising overlay.

**Tech Stack:** TypeScript, existing editor DOM (`aiChatPanel`, `editor.ts`), CSS in assistant panel sheets, Vitest + Playwright.

## Global Constraints

- `ChatDock` is `"float" | "side" | "glass"`.
- Cycle is glass → side → float → glass.
- Empty/unknown storage defaults to glass; stored float/side are kept.
- Do not bump `LAYOUT_CACHE_VERSION`.
- Glass plate label is `조수`; side/float keep `감독`.
- Glass must not steal map clicks outside the card box.
- Flyouts stay above the card (`--z-rail`).

---

### Task 1: Dock parse/cycle

**Files:**
- Create: `src/editor/chatDock.ts`
- Test: `test/chatDock.test.ts`
- Modify: `src/editor/editorState.ts` (type + default)

- [ ] Failing tests for parse/cycle
- [ ] Implement helpers
- [ ] Default `editorState.chatDock` is `"glass"`

### Task 2: Persist and toggle

**Files:**
- Modify: `src/editor/panels/editor.ts` (`loadEditorLayout`, `defaultEditorLayout`, `toggleChatDock`, `applyChatDockLayout`)
- Modify: `test/editorLayoutPersist.test.ts`, `test/aiAssistantUxP0P2.test.ts`

- [ ] Default layout `chatDock: "glass"`
- [ ] Parse accepts glass; preserves float/side
- [ ] Toggle uses `cycleChatDock`
- [ ] Overlay docks mount to float host; body classes include `ai-chat-dock-glass`

### Task 3: Glass chrome + CSS

**Files:**
- Modify: `src/editor/panels/aiChatPanel.ts` (`applyComposerViewPolicy` glass case, plate name, dock labels)
- Modify: `src/editor/panels/aiDirectorChrome.ts` (settable plate name)
- Modify: `src/styles/database/tabs-b-assistant-panel/02-chat-dock.css`, `assistant-command-bar.css`
- Modify: `openwiki/editor-ai-panel.md`, `openwiki/editor-pre-edit-routing.md`

- [ ] Glass keeps log in the card; idle collapses log
- [ ] Pointer-events only on card chrome
- [ ] Unit/e2e dock switch updated

### Task 4: e2e

**Files:**
- Modify: `test/e2e/chat-dock-switch.spec.ts`

- [ ] Empty storage boots glass
- [ ] Toggle visits side then float
- [ ] Stored float still boots float
