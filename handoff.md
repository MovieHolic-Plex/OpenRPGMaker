# Canonical Construction Facades Handoff

Updated: 2026-07-18 (Asia/Seoul)

## Resume objective

Continue the active implementation plan:

- `.omo/plans/canonical-construction-facades.md`
- Active work id: `canonical-construction-facades`
- Boulder state: `.omo/boulder.json`
- Durable ledger: `.omo/start-work/ledger.jsonl`

The user’s core problem is construction-path fragmentation. The target architecture has exactly two official public outdoor construction write facades:

- `author_house`
- `author_village`

Legacy write tools remain directly executable compatibility routes but must not remain the recommended/public maze. Read-only diagnostics remain public. Independent interior editing, expert/manual stamps, the large river-market generator, and persistence/force-save paths remain separate.

## Stop state

The user explicitly requested that implementation stop here and that this file be overwritten for the next AI.

- All active Wave 3 agents were interrupted.
- Todo 9 child explorers were also interrupted.
- Do not assume an interrupted agent completed or cleaned its partial edits.
- No commit was created.
- No Supabase, network, `.env`, authored game content, or project DB work was performed for this plan.

## Mandatory first reads

Before editing, read these end to end:

1. `AGENTS.md`
2. `openwiki/PROJECT_WIKI.md`
3. `openwiki/editor-workflows.md`
4. `openwiki/large-village-generation.md`
5. `openwiki/architecture.md`
6. `openwiki/testing.md`
7. `.omo/plans/canonical-construction-facades.md`
8. `.omo/start-work/ledger.jsonl`
9. `.omo/boulder.json`

Use the `start-work`, TypeScript programming, frontend (for UI surfaces), LSP, debugging, and later visual-QA/review skills as applicable. The current plan was executed under `start-work`: implementation and verification must be delegated, and each DoneClaim requires a separate adversarial verifier before checking its plan box.

On Windows, use the absolute Git Bash path `C:\Program Files\Git\bin\bash.exe`; never invoke bare `bash`.

## Verified completed work

Plan Todos 1–6 are checked and independently verified. Do not redo them unless a later task changes their inputs.

### Todo 1 — contracts and migration manifest

Status: verified after one rejection/remediation cycle.

Key result:

- Construction contracts, strict request parsers, outcome parser, route manifest, and registry-derived completeness test exist under `src/editor/construction/`.
- The initial false-green omission of registered `build_house` and `preview_house` was fixed.
- Live registry metadata is explicitly separated from the `canonical-migration-target` policy.
- Production contracts do not import registry/UI state; only the completeness test reads the live registry.

Evidence:

- `.omo/evidence/task-1-canonical-construction-facades.txt`
- `.omo/evidence/task-1-canonical-construction-facades-verification.md`
- `.omo/evidence/task-1-route-omission-audit.md`

Last verified focused result: 15/15; touched diagnostics 0.

### Todo 2 — HouseKit and lot domain seams

Status: verified after one rejection/remediation cycle.

Key result:

- Typed HouseKit domain seam and direct lot composition exist.
- Lot code no longer searches tool arrays or calls `ToolDefinition.run`/nested `runTool`.
- Registered `place_props` and house-lot yard placement share one `placePropsOnDraft` implementation.
- HouseKit implementation was split to 174 and 90 pure LOC after the first verifier caught a 251-LOC file and duplicate algorithm.

Evidence:

- `.omo/evidence/task-2-canonical-construction-facades.json`
- `.omo/evidence/task-2-canonical-construction-facades-verification.md`
- `.omo/evidence/task-2-remediation-red.log`

Last verified result: 34/34 twice with seed `20260718`; touched diagnostics 0.

### Todo 3 — village builder seam

Status: verified.

Key result:

- Typed natural-village builder seam and authoritative inspection helper exist.
- Legacy compatibility behavior remains characterized: `2→4`, `33→32`, partial warning, and zero-house rollback.
- Seed-7 semantic output and serialized-project parity were verified.
- Large river-market generator and force-save files matched protected hashes at verification.

Evidence:

- `.omo/evidence/task-3-canonical-construction-facades.json`
- `.omo/evidence/task-3-canonical-construction-facades-verification.md`

Last verified result: 35/35; touched diagnostics 0.

### Todo 4 — `author_house`

Status: verified after two rejection/remediation cycles.

Key result:

- Unregistered `AUTHOR_HOUSE_TOOL` and product `runAuthorHouse` exist.
- Single and lots modes call typed domains directly through one outer `runToolDefinition` boundary.
- Linked interiors, counts, transfers, target/mapTree/start/mutation scope, overlap, zero-change, and rollback are enforced.
- Verifier caught and fixed a real false-success: lot yard `material-not-found` and placement shortfall previously committed as success.
- Yard result is typed (`placed | shortfall | failed`), failures roll back, and inner/diff warnings reach `ConstructionOutcome`.
- A later full test-inclusive TypeScript check caught and removed an unused test import.

Evidence:

- `.omo/evidence/task-4-canonical-construction-facades.json`
- `.omo/evidence/task-4-canonical-construction-facades-verification.md`

Last verified result: 39/39 with seed `20260718`; 11/11 hashes matched; test-inclusive touched diagnostics 0.

Registration/exposure, proposal undo integration, and literal `runTool(ctx, "author_house", ...)` remain Todo 7.

### Todo 5 — `author_village`

Status: verified after two rejection/remediation cycles.

Key result:

- Strict unregistered `AUTHOR_VILLAGE_TOOL` and product `runAuthorVillage` exist.
- Product wrapper calls `runToolDefinition` exactly once.
- Exact and explicit best-effort semantics, 4–32 validation, exact plan length, exact new-map identity, collision failure, structural QA, 85% threshold, and structured blocked/failed outcomes are implemented.
- Verifier caught and fixed unauthorized other-map deletion/mapTree mutation plus the missing product wrapper.
- Scope checks cover unrelated map add/remove/mutate, target descriptor, mapTree, start, out-of-bounds events, project core, and undeclared tileset changes with byte-identical rollback.
- A later full test-inclusive TypeScript check caught five unused imports and two invalid `TILE.DIRT` references; all were fixed.

Evidence:

- `.omo/evidence/task-5-canonical-construction-facades.json`
- `.omo/evidence/task-5-canonical-construction-facades-verification.md`
- `.omo/evidence/task-5-author-village-remediation-red.json`
- `.omo/evidence/task-5-author-village-remediation-green.json`

Last verified result: 49/49; six hashes matched; test-inclusive touched diagnostics 0.

Registration/exposure remains Todo 7.

### Todo 6 — construction outcome/audit vocabulary

Status: verified.

Key result:

- `src/editor/construction/constructionAudit.ts` recognizes facade data shaped as `{ construction: ConstructionOutcome, ...details }`.
- Exact whitelist/secret stripping and distinct `exact | partial | failed | blocked | no-change | pending` audit semantics exist.
- Activity persistence and project persistence remain separate.
- Failed tool calls survive activity export.
- The previously failing region fixture was repaired by replacing a lone canopy tile `260` with valid `TILE.TREE`; production region validation was not weakened.

Evidence:

- `.omo/evidence/task-6-canonical-construction-facades.json`
- `.omo/evidence/task-6-canonical-construction-facades-verification.md`

Last verified result: 17/17 twice plus construction contracts 15/15; touched diagnostics 0.

## Wave 3 interrupted state — not complete, not verified

Todos 7–11 remain unchecked. Treat every partial edit below as untrusted until inspected and rerun.

### Todo 7 — registration, exposure, BuildSpec, preview/undo

Agent: `/root/todo7_register_gate_impl` (interrupted).

Last report before interruption:

- Discovery and shared-file coordination completed.
- Canonical tools were still unregistered at discovery time.
- Existing BuildSpec only handled existing maps and could not unwrap nested targets.
- The agent had planned RED assertions for canonical domain/pinning, legacy/read exposure, synthetic planned-map spec, ghost preview, proposal completeness, and undo/accept.
- It had not reported a completed RED run or source implementation.

Current diff search shows canonical-related edits in these Todo 7 tests, so inspect them carefully; they may be partially authored:

- `test/agentGhostPreview.test.ts`
- `test/aiSpecGate.test.ts`
- `test/proposalCompleteness.test.ts`
- `test/toolDomainScoping.test.ts`
- `test/toolExposureQuota.test.ts`

No Todo 7 DoneClaim or verification evidence exists. Resume Todo 7 before trusting registry-dependent work.

### Todo 8 — AI policy, skills, work plans, region intent

Agent: `/root/todo8_ai_routing_impl` (interrupted).

Verified RED before interruption:

- Exact six-file command: 153 tests, 143 passed / 10 intended failures.
- Fragmentation was confirmed: house instructions recommended wall→door/window→roof; village instructions mixed session/pipeline/direct; context/region/work-plan text still recommended legacy names.

The agent then began GREEN edits. Current unverified partial paths include:

- `src/ai/contextBuilder.ts`
- `src/ai/workPlan.ts`
- `src/editor/regionTask/regionIntentRouter.ts`
- `src/editor/regionTask/runRegionTask.ts`
- `test/agentUxPolicyPrompt.test.ts`
- `test/aiSkills.test.ts`
- `test/proposalCompleteness.test.ts`
- `test/regionIntentRouter.test.ts`
- `test/regionTaskRun.test.ts`
- `test/workPlan.test.ts`

At the stop point, the selected diff stat across these files was roughly 262 insertions / 86 deletions. It was not rerun, typechecked, reviewed, or independently verified. Inspect for partial/inconsistent edits before continuing.

Todo 8 owns region-selection hunks in `runRegionTask`; Todo 10 owns construction status/logging hunks. Preserve this boundary.

### Todo 9 — BuildPalette, lot callers, expert/manual brushes

Agent: `/root/todo9_build_palette_impl` plus read-only child explorers (all interrupted).

Last state:

- Discovery only; no RED or product implementation was reported.
- BuildPalette currently routes house to `build_house_kit` and village to `build_village`, with an implicit default of 8 houses.
- Correct migration is `author_house(kind:"single")` and `author_village`.
- No external direct TypeScript lot caller was found; the deprecated `build_house_lots` adapter should continue calling the lot domain directly, and canonical lots already flow through `author_house(kind:"lots")`.
- Manual structure stamps are a separate live-store paint path and must not be forced through ToolRunner.
- `buildPaletteCore.ts` already contains unrelated dirty edits; do not replace the file wholesale.

Critical unresolved contract gap:

- BuildPalette legacy input carries door/window/interior behavior.
- The current `AuthorVillageRequest` does not carry all of those options, so silently mapping to canonical village would lose `windows:false` behavior.
- The previous root explicitly authorized a narrow typed request/parser/facade/domain extension needed to preserve existing BuildPalette behavior. Do not document away or silently drop the option.
- Prefer an explicit canonical `houseOptions`-style field with backward-compatible defaults; translate legacy booleans only at the BuildPalette boundary.
- Coordinate any contract/manifest edit with Todo 7, then rerun Todo 1, Todo 5, and Todo 9 focused suites plus full test-inclusive TypeScript diagnostics.

Useful exploration findings:

- Keep `applyBuildPalettePrimitive` in `buildPaletteCore.ts`; it owns snapshot/clone/store replacement/undo.
- Safest extraction is a small house/village primitive helper module while keeping compatibility re-exports.
- Do not route manual `STRUCTURE_STAMPS` through the canonical facade.

### Todo 10 — chat and region status integration

Agent: `/root/todo10_status_integration_impl` (interrupted).

Last report:

- Discovery completed; no Todo 10 RED or product edit was reported.
- Root cause found: generic AssistantSession `runTool` handling can bypass canonical wrappers and lose structured failed construction data.
- Chat/region top-level tool calls can be derived from proposed calls or audit mappings without construction outcome, causing failed calls to appear completed/no-change.
- Shared hunk coordination: Todo 7 owns AssistantSession spec-gate/accept; Todo 10 owns construction status/logging. Todo 8 owns `runRegionTask` selection; Todo 10 owns its logging/status.

Do not attribute the existing Todo 6 activity-log changes to Todo 10. Start with a clean Todo 10 RED against the current combined tree.

### Todo 11 — deterministic `construction:harness`

Agent: `/root/todo11_harness_impl` (interrupted).

Verified RED before interruption:

- Verifier failed because `package.json` had no `construction:harness` command.

Partial unverified scaffold now exists:

- `package.json` contains `"construction:harness": "node scripts/run-construction-harness.mjs"`.
- `scripts/run-construction-harness.mjs` (untracked)
- `test/constructionHarness.test.ts` (untracked)
- `test/support/constructionHarnessHouseCases.ts` (untracked)
- `test/support/constructionHarnessRecord.ts` (untracked)
- `test/support/constructionHarnessTypes.ts` (untracked)
- `test/support/constructionHarnessVillageSupport.ts` (untracked)

The package file also contains concurrent unrelated user work such as `browser-verify:genre`; preserve it.

The harness was not completed, executed, typechecked, or independently verified. It depends on Todo 7 landing real canonical registry/spec-gate behavior. Resume implementation without reading `.env.local`, network, Supabase, project IDs, or authoring demo content.

## Worktree and baseline cautions

The worktree is extremely dirty with many user-owned/concurrent changes across docs, assets, editor/runtime code, tests, and untracked files.

Hard rules:

- Never run `git reset --hard`, `git checkout --`, destructive clean, or broad formatting.
- Never revert or overwrite unrelated hunks.
- Inspect per-file diffs before every shared-file edit.
- Preserve `package.json` concurrent scripts and existing `buildPaletteCore.ts`, `assistantSession.ts`, `runRegionTask.ts`, registry, OpenWiki, and UI hunks.
- No commit was requested.

Entry-gate baseline evidence:

- `.omo/evidence/baseline-canonical-construction-facades.json`
- `.omo/evidence/baseline-canonical-construction-facades-verification.md`
- Raw logs: `.omo/evidence/baseline-canonical-construction-facades/`

Entry baseline at the start of this plan:

- 76 planned path records
- 27 already-dirty planned paths
- `typecheck:app` exit 2 with 63 diagnostics across 28 files
- Focused tests: 147 passed / 2 failed
- Known baseline failures:
  - `test/toolDomainScoping.test.ts`: headless default expected map but got event
  - `test/regionTaskLogExport.test.ts`: invalid tree fixture; this one was repaired in Todo 6

Repository-wide TypeScript diagnostic counts later varied as concurrent dirty work changed. Completed Todos were accepted only with zero diagnostics on their touched paths. For all remaining work, run both app typecheck and full test-inclusive `npx tsc --noEmit`, then filter exact touched paths. Do not claim repository-wide green.

LSP fresh diagnostics repeatedly timed out at 3 seconds in this environment. Record timeout honestly and use bounded full/scoped TypeScript diagnostics; never claim LSP-clean without a real response.

## Supabase rule

This plan is pure editor/engine/UI code and has authored no map/event/demo content, so the AGENTS.md pure-code exception applies.

If the resumed work authors any game, map, village, event, or demo content, stop first and verify Supabase URL, anon key, and project id. Completion then requires real remote save plus reload proof. Do not use blank/fresh/dev-showcase or a local fixture as a substitute.

## Recommended resume order

1. Re-read the mandatory files and inspect `.omo/boulder.json` plus the ledger.
2. Re-baseline current hashes/status for every Wave 3 path after the interrupted edits.
3. Finish Todo 7 first, because Todo 11 and later compatibility/docs/browser work depend on canonical registry and BuildSpec behavior.
4. Reconcile and finish Todo 8 partial GREEN; rerun its exact six-file suite and both TypeScript surfaces.
5. Implement Todo 9 with the village-option preservation gap resolved, not silently dropped.
6. Implement Todo 10 on top of Todo 6’s serializer while preserving Todo 7/8 shared hunks.
7. Complete Todo 11 against the real registry, run `npm run construction:harness`, inspect the generated evidence files, run its negative control, and independently verify it.
8. For each Todo 7–11: producer DoneClaim → separate adversarial verifier → ledger entry → only then check the plan box.
9. Continue Wave 4 Todos 12–14.
10. Run final F1–F4, `review-work`, debugging runtime audit, build, harness, isolated Playwright/browser evidence, and visual QA before declaring the plan complete.

## Final target not yet reached

The editor does not yet have the complete public experience. In particular, canonical registration/exposure, BuildPalette rewiring, AI routing cleanup, status integration, deterministic harness, OpenWiki/catalog updates, real-browser proof, and legacy-public-maze closure remain unfinished.

Do not report the overall task complete until Todos 7–14 and F1–F4 are independently verified.
