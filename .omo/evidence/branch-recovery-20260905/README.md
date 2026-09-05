# Missing branch recovery and integration — 2026-09-05

Audited base: `7167ae65c79887b238c5e4137d1a44a1e61efd82` (main, PR #576).

The original audit covered 157 history-unmerged tips and 414 branch-only commits. History divergence alone did not mean missing functionality: equivalent changes and superseded alternatives were distinguished from genuine omissions. Source refs were SHA-pinned and backed up before deletion.

## Recovered behavior

- Image import normalization/error handling and generated image data URLs (`a9af0218`, `eee770a9`, `5c542e18`).
- Runtime text-entry keyboard isolation (`284d8602`), padded extra enemy asset names (`5737725c`).
- Tree/sprite erasure restores ground (`c170b4a0`, `e53404ae`); large-village curved boulevard reservation (`7b1acce1`).
- Concept seed copying, facility layouts/zones/membership, hallway eligibility, catalog-aware deletion feedback and house door-event control (`ef8afc07`).
- Item state effects, field application with session RNG, animation and animal care authoring (`54ee39d6`).
- Sparse world-generation storage validation, per-field/discrete undo, accessible rule toggles and missing-tileset preview (`22426297`).
- Structure growth metadata precedence/repeat feedback (`394c71e7`) and atomic interior furniture rollback with doorway reservation (`e09402ec`).
- Applied AI milestone accounting (`ef9dc9cc`) adapted to current recap/composer/map contracts. Synthetic continuations retain the ledger; it is never replayed. Ask mode does not resume pending work, and retries retain composer options.
- Lighting number/slider percentages and presets; actual 50% input saves ambient 0.5. All thirteen current condition rows and existing flow coverage are exercised; historical twelve-row fixture was adapted to the added relationship row.
- Native NPC/player emotes with editor, serialization, reference repair, shipping-player lifecycle and standalone asset inclusion (`c5fbbb5f`). No authored demo project was imported.
- Village design authoring/contracts (`831aab0a`, `20340577`, `5c5d6801`) recovered without the branch's unrelated dirty snapshot base.
- PR #577 monster studio, #578 assistant camera motion, #579 map settings, #580 sidebar navigation integrated with their original commits. PR #581 monster authoring and battle-event fixes, opened during the audit, were merged while retaining the #577 studio. Their combined focused run passed 70 tests. Supervisor production-modal browser QA passed all twelve field hit-tests across 1024/1280/1680px and live HP preview updates (`scripts/qa/recovery-enemies.mjs`, `verify-shots/recovery-enemies/`).

## Preservation boundaries

Current concept ownership, retired AI structure-stamp tools, on-demand context, modern camera/editor shells and current forest algorithms are retained. Superseded alternatives are archived, not resurrected. Engine/editor work used minimal test fixtures; no user project DB row was authored or changed.

The user's active main worktree (new-project dialog and coast/world tile work) was preserved. Integration ran in an isolated worktree. Branch cleanup protects every checked-out branch and current open PR, rechecks exact head SHAs, and archives refs before leased atomic remote deletions.

## Validation

Supervisor integrated focused run: 189 passed, one existing fence assertion failed (243 vs 303). The same fence failure was reproduced independently on pristine base; all 33 villageBuilder tests and all 12 village-design contracts passed. AI continuation/composer focused run: 13 passed. Lighting actual modal QA passed, including number 50, slider 75, dusk 35 and applied value 0.5; screenshot inspected.

Final application typecheck and CSS gates pass with zero regressions. Item/worldgen actual-modal browser tests both pass, concept/structure production-renderer QA passes, and supervisor shipping-player emote QA passes two beats without errors. Full pristine and integrated gates and final surface comparisons are recorded in the final validation report. Existing baseline failures are not silently accepted as new regressions.

## Branch recovery

External verified backup: `/home/main/z-project/rpg-zzu-branch-backups/20260905/`.
`deleted-refs.json` records each name/SHA/reason/archive ref. Recreate a local branch with `git branch <name> <archive-ref>` using that manifest; push if the original remote branch is needed. The initial incremental bundle requires main history through the audited base. Original audit and disposition documents are retained in the same backup directory.

## Full supervisor comparison and follow-up

The full supervisor gate completed with exit 1: 13,059 tests, 12,837 passed, 207 failed, 15 pending. The pristine audited commit had 12,886 tests, 12,620 passed, 251 failed, 15 pending. Exact file/test-name comparison found 48 previously failing assertions absent from the failure set and four newly failing assertions (`full-comparison.json`). These are measurements, not a claim that every baseline failure was fixed; host load can affect results.

The four follow-ups are explicit: preserve straight boulevard reservation/painting for an authored `street-grid` (the 100×100 snow city must retain 20 houses and 50 NPCs); place native emotes in the existing tab-3 staging group; align the troop movie test with the unsupported executor contract; assert an empty CSSOM width rather than fakeDom's undefined field. Synthetic autonomous continuation also now overrides the original explicit instruction with 「계속」 while preserving scope/composer mode and the applied-call ledger. Focused final verification is recorded separately.

Raw pristine and integrated Vitest reports and gate output are retained in the external branch backup directory, not the tracked source tree. The full run preceded these follow-up fixes; their final results must be read together with the focused verification rather than presented as a second full run.
