# Ultrabrain review 2: REQUEST_CHANGES

- Reviewer: st_01a075cc, category ultrabrain.
- Checkpoint: e80eb710 plus stable uncommitted follow-up in this worktree.
- Scope remains initial-review.md R1-R8; this is the bounded repair list.
- No approval or merge authorization has been issued.

## B1. Restore card-action intrinsic width

The removed `.db-ws-card-body > .db-ws-btn { justify-self: start; }`
is a composition constraint, not duplicate chrome. The body remains grid.
`databaseUtilityRecordViews.ts` has a real direct-child `db-open-classes-tab`
consumer. Isolated Chromium with the real import cascade measured current
button width 472px/parent472px, versus 143.765625px after restoring only that
declaration. Restore it in workspace composition and assert the real Battle
Commands button does not stretch. Assess the flex `.db-ws-range` branch
separately; do not remove layout merely to lower counts.

## B2. Finish named ownership collisions and truthful inventory

Resolve these actual remaining competitors, preserving domain variants:

- Modal body: studio-theme overflow auto important versus sidebar hidden important.
- Cards/legends: studio-theme forced legend and enemy/state fieldsets versus
  studio-v2 shared cards/legend owner.
- Ordinary thumbnails: record-thumbs32px, record-list-modern24px, studio-theme
  forced24px. Preserve non-DB defaults; give DB row dimensions one owner.
- Actor portrait: retain36px but stop duplicating dimensions in studio-theme
  and desktop-record-shell/13-actor-studio.
- List numbers: studio-theme forced11px defeats studio-v2 intended11.5px.

Current parsed decrease21345->21144 and important205->200 is real, but does not
close these named conflicts. Zero-important or arbitrary deletion ratio is NOT
required. Semantic hidden, external assistant/runtime and actual variants may remain.

Inventory script defects:

- Missing explicit row and thumbnail owners; db-ws-row maps to cards even though
  studio-v2 `.db-ws-row` owns its radius.
- `ownerFor` only checks a selector substring exists. It accepts row radius
  after every candidate radius declaration is removed, and accepts the lost
  justify-self without any replacement property.
- Blanket matching `.database-modal-window` calls151/200 important declarations
  "pending separate shell migration", including fields/thumbs/domain rules.

Map to exact surviving file/selector/context/property declarations, with valid
shorthand coverage, or an explicit intrinsic/default replacement and reason.
Add negative proof that a missing designated owner/property fails. Use specific
retained-role explanations, include external DB consumers such as world-panel.css,
and regenerate inventory. No broad unsupported future-deferral justification.

## B3. Make font shorthand guard fail closed

Current extractor accepts valid unsupported literals because it returns no
consumer for `500 calc(12px + 1px) Arial`, `500 min(12px, 1rem) Arial`, and
`xx-small Arial`; reviewer confirmed CSS.supports true for these.
It also incorrectly rejects a complete shorthand alias starting with weight
var, e.g. `var(--db-weight) 13px/1.35 var(--font-ui)` when weight resolves to500.

Parse relevant size functions/keywords or explicitly reject unsupported DB
shorthand; never silently return empty coverage. Distinguish complete-shorthand
aliases from family aliases. Add demonstrated positive/negative cases, preserving
literal/hidden-alias, role-token, mono and font-definition coverage. No dependency.

## B4. Close browser and required-execution contract blind spots

- Matrix: meaningful destination-specific rendered sentinels, not any nonempty
  db-body wrapper. Keep actual32 registry enumeration and64 unique cases.
- Classes/Troops: assert main-form overflow/range and real wheel reachability
  of a lower control at both widths, not only absence of outer scroll range.
- Caption: move focus away first, click the visible caption locator, assert
  the native target is focused without callback. Already-focused synthetic
  label.click does not prove the behavior.
- Labels: retain primitive fixture but add real narrow domain-caption bounds
  and text visibility at both widths, not just fixed420px card wrapping CSS.
- States/fonts: targeted shared disabled/hover/destructive states, computed
  mono and runtime/pixel roles. UI font switching plus preview height is not
  runtime font coverage. Preserve36px document and32-36px System variants.
- Required DB axis: surface-gate file existence and aggregate Vitest exit are
  insufficient. Consume per-file machine results and require nonzero executed,
  successful DB assertions with no skips. Negative tests: missing, skipped or
  zero-executed DB axis must fail even while other axes pass.
- Evidence: use one browser/project-scoped directory throughout, including
  all targeted screenshots; record implementation and harness fingerprints.
  Current browser-independent paths overwrite one project with another.
- If long combined test still times out, split Equipment, virtualized reveal,
  System/fonts and child routes into independent test lifetimes. No blanket
  timeout growth, sleeps, retries or weaker assertions.
- Playback proof must establish an actual frame change, not just asynchronous
  background-image/style loading.

## Final closure

The previous five browser failures are not five established product bugs.
Current harness display, replaced-node observation and search-event fixes need
actual reruns. Parent fresh10333 run and whole gates are in progress; do not edit
executable source until the lead releases the freeze.

R1 remains open (B2), R2/R3/R4/R5 partial (B1/B4 and final fresh execution),
R6 open (B3/B4), R7 open (B4), R8 requires final-source evidence and baseline
comparison. After repairs, freeze source, run meaningful related tests and the
complete browser contracts once with zero retries, prove both deliberate CSS
regressions are rejected, and provide final build/typecheck/CSS/surface results.
Supervisor runs full gates and independent final checks.

Image interpretation is unavailable on two provider paths. Do not fabricate
pixel PASS. Reviewer explicitly permits approval based on adequate objective
browser/DOM evidence with screenshots retained and this limitation disclosed.
