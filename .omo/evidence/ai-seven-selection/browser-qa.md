# Current selection/composer browser QA pointers

## Ownership and evidence

Full product browser QA belongs to the lead. The lead reported C4 PASS on this task:

- `.omo/evidence/ai-seven/selection-visible.png`
- `.omo/evidence/ai-seven/hint-layout.png`

Both files exist in the parent worktree
`/home/main/.herdr/worktrees/rpg-zzu/worktree-clear-field-e552`.
Their PNG signatures and 1440 x 900 dimensions were checked by this child.
The image-reading tool could not display pixels to this model, so the visual verdict
and browser measurements below are attributed to the lead, not an independent child visual pass.
No UI production changes are included in this task.

## Exact states and checks

Use the actual editor in a local-only QA fixture with remote persistence disabled.
Do not send either instruction to a real model. Start with the assistant expanded,
a fresh/empty conversation, the normal deck visible and no selection.
Use the normal Vite editor URL, not the standalone runtime/player harness.
At 1440 x 900, inspect these states; the supported 1024 x 768 and 1280 x 800
viewports are useful lead-owned clipping checks, not claimed here as measured.

1. **Idle, no selection**
   - `.ai-chat-panel` has `is-assistant-idle`.
   - `[data-testid=ai-context-chips]` is `display:flex`, without `has-selection-scope`.
   - Its `.ai-context-chip:not(.ai-selection-chip)` contains the current map name,
     is `display:inline-flex`, and has a positive visible bounding box.
2. **Idle, selected**
   - In the browser's existing dev-module context, use
     `editorState.set({ selection: { mapId: store.getCurrent().startMapId, x: 1, y: 1, width: 3, height: 3 } })`.
     Modules are `/src/editor/editorState.ts` and `/src/project/store.ts`.
   - The context host has `has-selection-scope`, `display:flex`, and `order:-1`.
   - The map sibling is `display:none`; `[data-testid=ai-selection-chip]` and
     `[data-testid=ai-selection-chip-clear]` remain visible and interactive.
   - Check positive chip/clear-button rectangles, that the clear button is inside
     the visible action-row/scroll viewport, and that a hit test at its center reaches
     the button or its SVG descendant (no invisible overlay or clipping).
   - Lead measurement: host **185.375 x 32**, scoped true, clear button visible.
     This width is an observation, not a pixel constant pinned in the unit test.
3. **Clear AI scope, not the editor selection**
   - Click `[data-testid=ai-selection-chip-clear]` through the real UI.
   - The host stays `display:flex`, its scope class disappears, the selection chip is
     absent, and the current-map pin is again visible. Input focus returns to `ai-input`.
   - The map selection itself remains in `editorState`; only the AI task scope is dismissed.
   - Lead C4 confirmed host flex/scoped false, selection chip absent and map pin retained.
4. **Keyboard help: blur -> focus -> blur**
   - Fill `[data-testid=ai-input]` with `나무 세 그루 심어줘` **without sending**.
     Keeping the input nonempty excludes the separate suggestion-deck expansion behavior.
   - Focus `[data-testid=menu-project]`, then `ai-input`, then `menu-project` again.
   - `.ai-composer-hint` count is **zero in every state**; the input retains its nonempty
     title. Do not compare the title to fixed prose.
   - `[data-testid=ai-composer-actions]` stays `display:flex`, computed `min-height:36px`,
     browser `flex-wrap:nowrap`, and actual bounding-box height **36px** before/after focus.
     `.ai-composer-actions-lead` has computed `white-space:nowrap`.
   - `is-input-focused` follows focus true -> false. Send remains in the action row.
     There must be no reserved hint rectangle, horizontal hint-sized gap, or displaced send control.
   - Lead C4 confirmed no hint nodes, retained title, row height 36 in both states,
     and focus class true -> false.

## Routing inputs (only under a stubbed model/region runner)

The committed happy-dom tests render the real panel and click its real send control.
They substitute only the backend session send/region runner and deny network fetches.

- Select `(2,2) 4 x 4`, clear the chip, send `나무 세 그루 심어줘`:
  ordinary session send exactly once, options.scope exactly null, region runner zero calls.
  Sending the same instruction with the editor selection removed must produce an identical
  full payload, proving there is no stale selection footer without pinning prompt prose.
- Select `(2,2) 4 x 4`, leave the chip active, send `여기 물 채워줘`:
  region runner exactly once with the current map id, the exact rectangle, instruction,
  and `gate:immediate`; ordinary session send zero calls.
- Each UI send subscribes before clicking to the panel's `is-turn-running` transition,
  and resolves only after running -> terminal. The 2000ms timeout is a rejection deadline,
  not a sleep, polling delay, or success condition.

Happy-dom supplies computed CSS and native focus/event behavior but no browser layout.
The test checks the shipped min-height; the lead's actual 36px bounding boxes supply
geometry evidence. Vite preprocesses the shipped assistant cascade: `tokens.css`,
`database/tabs-b-assistant-panel.css` (all ordered imports, including the late deck
and card layers), then `shell/editor-ui-modes.css`, in their `src/styles/index.css`
order. Unrelated runtime/database sheets are excluded to avoid happy-dom's costly
whole-application selector scans. Full-application integration remains lead-owned.
