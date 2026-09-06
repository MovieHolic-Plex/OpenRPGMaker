# Phase 2 owned-road membership correction

Task `st_01a07465`; parent/root `01a072aa-d666-7ef3-a123-c923fcda0392`.
Date: 2026-09-06. Worktree: `/home/main/z-project/rpg-zzu-house-protection-p2-road-audit`.
Base: `1cd07f925cc6c1325037b7984ce2a8371a43487a`.
Branch: `agent/house-protection-p2-road-audit` (no upstream configured).

## Delivered behavior and boundaries

`environmentalRoadAt` in the existing village shared constants/helpers module
uses `protectedHouseCells` metadata geometry once per classifier invocation:
layout house bbox + north ridge + recorded deck ladder, and human stamp rects.
It reads current tile values without mutating them. External sand/dirt/cobble
and water/plank bridges remain network members; owned values do not.

`ensureSingleRoadComponent` and audit component discovery now share this
membership. Door-road proximity uses the same classifier, so a nearby human
stamp cannot satisfy a door's external-road requirement. The raw
`roadInsideHouses` / `ridgeInvaded` intrusion diagnostics are intentionally
unchanged: those check tile damage on this build's houses, not external network
membership. The exact-count, door integrity, reachability and one-component
acceptance gate are unchanged. Nature/outcrop/beach filtering is unchanged.
Orphan cleanup already preserves owned fragments and is untouched. No road
removal, protected write, decor/sign edit, schema or general classifier refactor.

## RED / GREEN

Before any production edit:

```sh
npm test -- test/villageOwnedRoadClassification.test.ts --maxWorkers=2
```

Exit **1**: **5 failed / 2 passed**, seven tests (`red-excerpt.log`).
- Exact human lower `(5,4)=424`, upper `199` roof-deck facade: `village-qa-failed`.
- Repair constructed an unwanted external spur from a human stamp edge.
- Two external segments joined only by owned values counted as 1, expected 2.
- A nearby stamp counted as a door connection (1, expected 0).
- Real external-island negative counted 3 components (owned deck included),
  expected 2. The acceptance gate itself was already closed.
- Unedited real-house control and human-stamp facade succeeded on baseline.
  The separate repair test exposes why stamp success alone was insufficient.

After the minimal production edit, the same seven tests passed, exit **0**
(`initial-green.log`). Added two focused classifier boundary controls for
bbox/ridge/ladder versus yard, and owned versus external water/planks.
Final focused command, after the test adapter's TypeScript narrowing fix:
**9 passed / 9**, exit **0**, single run (`focused-final.log`). No sleeps,
polling, test retries, deleted/skipped tests or altered timeouts.

The final negative uses the real village builder, adds a genuine disconnected
external sand cell at `(0,0)`, recomputes the component metric with real audit,
and passes it to the unchanged real facade inspector/gate. It proves
`roadComponents=2`, `village-qa-failed`, and whole-project atomic rejection.
Positive public registered-tool tests preserve old snapshot cells, both layer
stacks, linked interior maps and all four new doors' structural/reachability QA.

## Real surface exercise

```sh
node_modules/.bin/vite-node --config vitest.config.ts \
  .omo/evidence/house-protection/p2-road-audit/exercise.mts
```

Exit **0** (`exercise.log`): the exact reviewer fixture runs through
`create_map -> author_house(linked blue-stone roof-deck, 3,3,7,8) -> human lower
edit -> serialize/deserialize -> buildVillageDomain / public author_village`.
Both control and edited cases preserve all **64** accepted exterior cells,
build four new houses, connect/retain all four doors, pass reachability, and
report **one identical 233-cell external road component**. Edited lower `424`
and upper `199` remain exact. Tests additionally cover accepted human stamps
and linked interior bytes. These are ephemeral code-QA fixtures, not authored
shared content; no DB writes.

## Verification and honest limits

- LSP `all`: no diagnostics on all three production files and the final new
  test. A new test adapter initially spread `ToolExecResult.data: unknown`;
  explicit object narrowing fixed that error without changing assertions.
- `npm run typecheck:app`: exit **0** (`app-typecheck.log`).
- TypeScript `createProgram` with repository tsconfig options, `src/vite-env.d.ts`,
  the new test and final exercise as roots: **0 diagnostics**, exit **0**
  (`scoped-typecheck.log`).
- Exercise LSP initially lacked the repository `@` alias because `.omo` is
  outside configured roots. Entry imports were changed to relative paths.
  The subsequent fresh-diagnostic request timed out at 3000ms; do not count
  exercise LSP as a pass. Final scoped TypeScript and real execution both pass.
- The first attempt to execute the reviewer's `/tmp` script failed Vite's
  external-entry resolution (`ERR_MODULE_NOT_FOUND`); the checked-in road-only
  exercise uses a worktree-local entry. No test/server policy was relaxed.
- `npm run build`: exit **0**, including application typecheck, editor, player/SDK
  and standalone bundles (`build.log`). Existing circular reexport, mixed
  imports, runtime asset-resolution and chunk-size warnings remain visible.
- Related command below: **127 assertions passed / 10 files**, but exit **1**
  with **one** unhandled Vitest RPC `Timeout calling "onTaskUpdate"` error
  (`related.log`). This is a red command, not a suite pass. The same error
  class is documented in the inherited `../p2/README.md` baseline comparison;
  no clean-base rerun or full aggregate gates were performed in this lane.
  No retry or RPC timeout/config change was used to turn it green.
- `git diff --check`: clean. All edits and evidence copies used `/tmp/apply_patch`.
  Evidence log copies trim trailing whitespace/empty EOF lines for the Git
  whitespace gate; raw command output remains at `/tmp/st_01a07465-*.log`.
  No push, PR or main merge. Aggregate gates remain supervisor-owned.

```sh
npm test -- test/villageOwnedRoadClassification.test.ts \
  test/authorVillageFacade.test.ts test/villageBuilderSeam.test.ts \
  test/villageHouseProtection.test.ts test/houseProtectionLifecycle.test.ts \
  test/villageProducerProtection.test.ts test/roadObstacleAvoidance.test.ts \
  test/villageBoulevard.test.ts test/villageCrossRoad.test.ts \
  test/villageLandscape.test.ts --maxWorkers=2
```

Assumption: durable accepted ownership metadata, not passability, current tile
art or the larger construction-block mask, defines the environmental boundary.
This is the existing Phase 2 contract; no new ownership source was invented.

Ultraworked with [omo](https://github.com/code-yeongyu/oh-my-openagent)

Co-authored-by: sisyphus-dev-ai <sisyphus-dev-ai@users.noreply.github.com>
