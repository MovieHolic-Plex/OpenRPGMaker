# r5 - authored start-state original context

- Task: st_01a078a5; branch: agent/ai-full-context-r5.
- Base: 398ef9708fbbcc50b0d237e1b1a8f99870c28ea8.
- Authority: ultrabrain-review-1.md, R5 P2 (authored starting state/presets absent
  with omitted=0). No sibling changes were imported.

## Cause and scoped fix

The shared extractor never created entries for ProjectStartState or TestPreset.
The session captures this extractor before tools and passes its immutable store
to buildGroundedRequest/get_original_context; missing entries therefore could
not reach either the first writer or the pager.

Add complete /session (startStateOf(project)) and /testPresets entries. Expand
their actual key/value references through DB records, characters and maps to a
fixed point before the existing general DB-relevance pass. Referenced maps reuse
the target map's complete metadata/events/tiles projection, including native read
receipts. Map/tileset deduplication terminates cycles without treating the global
summary or map tree as reasons to include unrelated maps.

Integration interfaces remain unchanged: extractOriginalContext options/result,
OriginalContextStore paging, request budgets, native schemas, read-credit delivery,
independent review/parser and all session/apply boundaries. Consumers receive two
additional stable entry paths and any newly relevant map/DB entries. No live
PlaySession/configuration access was added; the old exclusion test now mutates a
real separate startSession result. No approval, undo/save, wiki coordinator or
action-combat implementation was changed.

## Red evidence (before implementation)

All Vitest commands used --pool=threads --maxWorkers=1 --testTimeout=60000.

- `npm test -- test/originalContext.test.ts <flags>`: exit 1; 3 failed,
  26 passed. Missing /session in the million-token envelope; missing
  /database/items/item_seed_only in the non-broad closure; missing /session
  from the oversized paging index. Failures were assertions, not import/setup.
- `npm test -- test/assistantOriginalContext.test.ts -t 'delivers authored start gold' <flags>`:
  exit 1 at line 53, /session absent from the real first writer request.
  The filter selected one new regression; five existing tests were unselected,
  not disabled or edited to skip. Final validation ran the entire file.

## Green evidence

- `npm test -- test/originalContext.test.ts test/assistantOriginalContext.test.ts test/independentReview.test.ts test/aiToolDiscoveryEscalation.test.ts <flags>`:
  exit 0; 4 files, 65 tests passed, zero skipped (58.30 seconds).
- Regressions prove starting gold 472319, preset_r5_unique/gold 583421,
  exact inventory/party/flag values, actor->class and preset map->common event->
  map->item/cyclic map references, detached snapshots and unrelated-map exclusion.
  Oversized seed/preset entries reconstruct exactly from 24,000-code-unit pages;
  the omission count equals total entries minus delivered entries.
- Real AssistantSession first-request proof uses budgetChars=1, executes both
  native start-state/preset writes, preserves inventory and the original project,
  and stops at the existing round cap without claiming independent approval.
  Runtime gold 913579 and runtime/config credential sentinels remain absent.
- LSP diagnostics on all three changed TypeScript files: no diagnostics.
- `npm run typecheck:app`: exit 0 after diagnostics. `git diff --check`: exit 0.

## Existing adjacent failure and limits

`assistantReadContract.test.ts`: 4 passed, 1 failed at line 98 (`made.ok`, expected
true, received false). Its unnamed-art upsert_enemy fixture is rejected by the
existing strict monster-graphic identity guard. The same complete file produced
the identical failure with the production patch temporarily reversed to HEAD,
then the patch was restored. No test or graphic guard was weakened.

Only local Node fixtures and injected ChatFn transport were used. No external
model/DB, authored game content, full build/gates or browser run. The lead owns
whole-goal integration, wiki index refresh and the required next independent
ultrabrain review before merge; this receipt is not merge approval.
