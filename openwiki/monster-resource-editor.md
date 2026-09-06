# Monster resource metadata editor

## Entry and ownership

Database > 전투 몬스터 > 몬스터 소재 opens a nested metadata worksheet. The
entry belongs to the enemy list toolbar, so an empty gameplay-enemy collection
still exposes the entire artwork catalog. This is not a new top-level database
route or a generic Resource Manager redesign.

- `databaseMonsterResourceEditor.ts`: dialog-local draft, catalog search/selection,
  Apply/reset, dirty navigation, modal ownership and store subscription.
- `monsterResourcePresentation.ts`: text-only effective metadata and existing
  resource-resolver/chroma-key preview. Enemy appearance and monster graphics
  picker consume the same summary.
- `styles/database/enemies.part-3.css`: nested worksheet layout, existing Studio tokens.
- `monsterResourceCatalog` and `monsterMetadata`: model-lane authorities. Do not
  enumerate resources or implement normalization/persistence in the editor.

## State and mutation contract

Name, newline-separated tags and description are local inputs until Apply.
Only fields changed relative to the displayed baseline enter the patch. This
preserves unrelated concurrent field changes. Empty tags/description explicitly
clear those fields; unchanged fields remain inherited. The model validates and
normalizes the patch before history or mutation. A successful changed patch
records one `recordProjectSnapshot` and one labelled human `store.update` with
`scope: assets`; no-op Apply creates no history. Reset removes this resource's
overrides using the same boundary. Gameplay names, stats, sprites and species
are not edited.

Search uses effective ID/name/tags/description and never navigates. Native row
buttons use the shared roving-tabindex helper: arrows/Home/End move focus, Enter
selects. Search and draft inputs remain mounted. Clean store refreshes adopt
current metadata, including undo/redo; dirty drafts survive external updates.

Selection, reset and close protect dirty drafts with the shared discard/cancel
confirmation. Escape re-registers the metadata layer before showing that prompt
because modalStack consumes its layer before invoking its close callback. This
keeps repeated Escape cancellation safe. Before-unload warns while dirty.

Project replacement permanently revokes this dialog's write authority. Inputs
remain available for copying; Apply/reset, search and row navigation are disabled
and a visible alert explains the state. Captured stale callbacks check authority
again before writing. A pending selection confirmation cannot select from or
write into the replacement. Monster graphic pickers close on projectSwitch.
Closing removes the store/unload subscriptions and restores an attached opener
or the current catalog-entry button.

## Verification

`test/databaseMonsterMetadata.test.ts` drives the actual database renderer and
real store/history, not mocked UI or source-text checks. Initial RED was the
missing catalog entry with zero enemies. `scripts/qa/monster-metadata.mjs` starts
and tears down its own Vite server on **11942**, uses only a local disposable
project with remote persistence disabled, records unexpected remote writes, and
captures desktop and narrow containment screenshots plus action/geometry JSON.
No sleeps are used for test readiness. Parent owns separate remote persistence
proof and image-sensitive visual review; screenshots and DOM geometry alone are
not a visual PASS.
