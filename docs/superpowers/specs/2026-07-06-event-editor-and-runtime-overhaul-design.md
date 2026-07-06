# Event Editor + Runtime Overhaul — Design Spec

Date: 2026-07-06
Scope: 7 owner-reported items across the event editor UI and the play-runtime.

## Locked decisions (from owner)

- **Command list/edit UI direction:** RM2003 classic reproduction (◆ prefix, dense rows, no row numbers, indent guide lines, unified label forms).
- **Shop/Inn scope:** Inn → full RM2003 flow; Shop → polish (not full rebuild).
- **Mobile controls:** No editor-side config UI exists; disable the runtime touch pad behind a flag (keep code/CSS for later).

## Recon summary (ground truth)

- #2 NPC facing on talk is **already coded** (`playSceneMovement.ts:140 turnActionEventTowardPlayer`), gated by `animationType`/`directionFix`. Owner reports it missing → must be reproduced in-browser before any change.
- #4 Event-layer drag is a **no-op today** and conflicts with nothing; mutator `eventActions.ts:65 moveEvent(mapId,id,x,y)` exists but is UI-unwired and lacks bounds/snapshot/collision guards.
- #5 Player force-move is **impossible today**: `moveEvent` targets events only; player is a separate entity from the event mover system.
- #1 There is **no** editor mobile-config UI; only `player/touchPad.ts` mounted at `player.ts:102`, already gated to touch devices.

---

## Group A — RM2003 classic event command UI (#6, #7)

**Goal:** One consistent, dense, RM2003-authentic command list + uniform edit forms; retire the competing "modern" list styling.

**Approach**
1. **Resolve the two-stylesheet conflict.** The command *list* is styled by both `event-editor.part-2.css` (classic, has depth padding + indent guides + dense rows) and `event-editor.modern.css` (card rows, row-number counter, circle bullet, +/^ toggle, fixed padding) — modern wins by load order. Make **classic authoritative**: strip the command-list rules from `modern.css` (keep its modal chrome + edit-form shell), and finalize the classic look in `part-2.css`.
   - Prefix `@>` → `◆` (RM2003 diamond) in `commandList.ts` (`renderCommandItem`, marker prefix stays `：`).
   - Remove modern's `command-row` counter (no row numbers) and the `+`/`^` `::after` toggle (replace with subtle chevron or row-click).
   - Restore vertical indent-guide lines; keep the depth×18px indentation already landed.
   - Dense rows (~20–22px line-height) instead of 46px.
2. **Unify edit forms.** Introduce a shared `fieldRow(label, control)` + a single `event-command-form` container, and refactor every command body (`commandBodyCore/Advanced/M2/Commerce/Choices/Route/…`) to use it — consistent container element, consistent labels (no more bare unlabeled `<span>` stacks), consistent spacing.
3. **Fix the enumerated UX issues (#7):** choices summary duplication (command line shows the prompt only; choices render as branch markers), clearer marker vs command distinction, dense marker rows aligned to indent, and either implement or hide the disabled toolbar buttons (undo/redo/copy).

**Key files:** `styles/editor/event-editor.modern.css`, `styles/editor/event-editor.part-2.css`, `panels/eventEditor/commandList.ts`, `commandBody*.ts`, `commandSummary.ts`, `content.ts`.

**Acceptance:** Browser QA — open a nested-command event; rows are dense, ◆-prefixed, no row numbers, indentation + guide lines visible; edit forms look uniform across ≥6 command kinds; choices prompt not duplicated. Existing event-editor tests still pass.

---

## Group B — Shop/Inn RM2003 (#3)

**Inn (full RM2003 flow).**
- Type: keep `inn` minimal but sufficient — `{ kind:"inn"; price:number; greeting?:string }`.
- Runtime flow (`playSceneCommerce.ts`): greeting (or default) → `"N G입니다. 묵으시겠습니까?"` yes/no → on yes & gold≥price: `changeGold -= price` → screen fade-out → `recoverPartyVitals` → fade-in → wake message (`"좋은 아침입니다!"`) → close; on no/insufficient: cancel message. Build proper inn window CSS in `commerce.css` (currently 5 lines).
- Editor (`commandBodyCommerce.ts innBody`): keep price field, add optional greeting text.

**Shop (polish).**
- Quantity `select` mode → RM2003 stepper (`−  n  +`) instead of raw number input.
- Party preview: render real party charset sprites (not empty spans); owned/equipped counts show real values.
- Keep shop open after a successful buy (RM2003 behavior; today it force-closes).
- Sell price display alongside items in sell mode.

**Key files:** `player/playSceneCommerce.ts`, `player/playSceneShop.ts`, `player/playSceneShopDom.ts`, `styles/runtime/commerce.css`, `panels/eventEditor/commandBodyCommerce.ts`, `project/types/events.ts` (inn type).

**Acceptance:** Browser QA — inn shows greeting→yes/no→fade→heal→wake and deducts gold; shop quantity stepper works, party sprites show, buy keeps window open.

---

## Group C — Runtime behaviors (#2, #4, #5)

**#2 NPC facing (verify-first).** Reproduce in-browser: talk to a default-project NPC and observe. If it does not visibly turn, root-cause (likely candidate: idle-frame repaint reverting to persisted direction) and fix so the NPC turns to face the player before its message. If already correct, document and move on. No speculative change before reproduction.

**#4 Event drag-to-move.** In `EditScene.ts`, add an `eventMove` `DragOperation` kind: begin on `pointerdown` when `tool==="event"` and pointer is over an existing event, past a small movement threshold (so a plain click still selects and dblclick still opens). Show a ghost/highlight at the target tile on move; on `pointerup` commit via `moveEvent(...)` **plus** `recordProjectSnapshot()` + bounds check + occupied-tile guard (mirror `pasteEventAt`), else revert. Pixel→tile conversion reuses the existing canvas helper.

**#5 Player force-move (natural walk).** Extend the `moveEvent` command with a target selector: 주인공(player) / 이 이벤트(this) / 특정 이벤트(id) — type gains `target?: "player" | "this" | "event"` (default preserves current "this/blank" semantics for back-compat). Runtime: when `target==="player"`, drive the **player entity** along the `MoveRoute` using the player's natural step/tween movement (collision-respecting, not a teleport). Editor (`commandBodyRoute.ts`): replace the free-text event-ID input with a target dropdown + conditional event-ID field. Canonical use: east-gate event, `playerTouch` trigger, `moveEvent(player, [move-left ×1])`.

**Key files:** `player/playSceneMovement.ts` (#2), `editor/EditScene.ts` + `editor/eventActions.ts` (#4), `project/types/events.ts` + `panels/eventEditor/commandBodyRoute.ts` + `player/playSceneInterpreter.ts`/`playSceneSchedulers.ts` + player movement path (#5).

**Acceptance:** Browser QA — (#2) NPC turns to face player on talk; (#4) dragging an NPC on the event layer relocates it (undoable); (#5) an event forces the player to walk 1 tile on contact without teleporting.

---

## Group D — Hide mobile touch pad (#1)

Guard the single mount site `player.ts:102 createTouchPad(...)` behind a flag (`ENABLE_TOUCH_CONTROLS`, default off; overridable via env). Keep `touchPad.ts`, `styles/runtime/touchpad.css`, and its testids intact for later re-enable. No editor change (nothing to hide there).

**Acceptance:** Touch pad no longer mounts in play-runtime; no test breaks (none reference its testids).

---

## Execution order & QA

1. **Group D** (#1) — trivial quick win.
2. **Group C #2** — verify facing (cheap, informs whether it's a bug).
3. **Group A** (#6, #7) — the main UI rebuild; browser QA (owner-required).
4. **Group B** (#3) — shop/inn; browser QA.
5. **Group C #4, #5** — drag-move, player force-move; browser QA.

Each UI-visible group ends with a Playwright browser QA pass (screenshots + assertions) before moving on. `tsc --noEmit` + relevant `vitest`/e2e run per group.

## Out of scope / deferred

- Mobile controls **editing** UI (does not exist; deferred by decision #1).
- Full shop layout rebuild (polish only per decision #3).
- New per-page "방향 고정 on talk" field beyond the existing `animationType`/`directionFix` (only if #2 reproduction shows it's needed).
