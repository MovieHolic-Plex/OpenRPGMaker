# Phase 2 growth preset verification handoff

Task `st_01a0742f`; parent/root `01a073a4-b8a4-7a45-9858-a23e9c9e3761`.
Worktree: `/home/main/z-project/rpg-zzu-growth-presets-p2`.
Branch: `agent/growth-presets-p2`. Reviewed predecessor tip: `2d0f53208f4721aa700b4b864209ee1328e88ac7`.

## Outcome and commits

**PASS: real editor interaction, actual LegacyDb save/reload, and shipped-player behavior.**
No product code, defaults, schema, assets, dependencies, AI tools, genre integration,
or unrelated maps/events/adventure were changed by this child. No push, PR, merge,
full gates, or build was run. The lead owns those integration gates.

Verified, attributed commits:

- **`33564c3ed977db3ca1c6821de92726a3253199eb`** -
  `feat(qa): 성장 프리셋 전용 프로젝트 저장과 재로드 검증 추가`.
  File: `scripts/save-growth-presets.mts`.
- **`3e073d6901c90a3df305a448372381a6aa94e6d3`** -
  `test(growth): 그림 프리셋 편집기와 출하 플레이어 실사용 검증`.
  Files: `scripts/qa/growth-presets-editor.mjs`, `scripts/qa/growth-presets-runtime.mjs`.
- This report is the only subsequent documentation change, at
  `output/evidence/growth-presets/p2/verification.md`.

Both tooling commits use repository Korean Conventional Commit subjects and the
omo attribution plus sisyphus-dev-ai co-author trailer. Each staged diff was
inspected, `git diff --cached --check` passed, the commit exited 0, and its exact
hash was checked with `git log -1 --format='%H %s'`. Tracked status after the QA
commit was clean. This document's commit is recorded in the final task handoff.

## Remote content receipt

**Only authorized project: `rpg-zzu-growth-presets-20260906-wish2`.**
The save tool has no project-ID override and never selects the environment's
shared project as its write target. `rpg-zzu-house-template-gallery` and other
projects were not written.

Before the first save, the exact target returned HTTP **200 / []** through a raw
presence check, and actual `loadProjectFromLegacyDb(config)` returned null.
`saveProjectToLegacyDb(authored, config)` then returned **`kind: saved`**.
The loader subsequently returned matching authored growth/classes/skills/actors,
party/start-actor references and maps, with **zero project reference issues**.
A final read-only verification after browser QA also exited 0.

- Saved full-wire SHA-256: `a271b77be05a5ecc401cc3be35edb1af7ae0dbfc4785657bce7b8aa6e5ad7b64`.
- Matching canonical authored/reloaded content digest:
  `1b8a903695cc7b1cfdbb52ef10a10215771143513ffd9e2333765a6dd35de327`.
- The canonical digest covers growth, classes, skills, actors, party and start
  actors; it is not presented as a full-project wire digest. Maps have a separate
  deep-equality assertion.
- Final totals: **21 classes, 51 skills, 9 actors, 3 trees, 21 skill nodes, 1 map**.
- Added: **15 classes, 18 skills, 3 seven-node trees, 3 demonstration actors**.
- `createBlankProject()`'s original 6 classes, 33 skills, 6 actors and map data
  remain unchanged. All six public catalog entries are applied explicitly.
- Demonstration actors `showcase-promotion-vanguard`, `showcase-promotion-arcane`,
  and `showcase-promotion-ranger` use their respective newly added promotion roots
  at level 21. Existing point settings are not inflated: initial 2 + 20 levels
  gives **22 points per actor**. Their starting party is explicitly selected.
  No additional map, event or adventure is introduced.

Receipts: `save-preflight.json`, `save-result.json`, `save-receipt.json`,
`reload-receipt.json`, and `reloaded-project.json` under this evidence directory.
The first save receipt used insertion-order-sensitive JSON hashes; deep equality
already passed, but those two historical raw hashes differ. The corrected
`reload-receipt.json` is the canonical matching-digest receipt. No content was
rewritten to correct hashing. A second `--save` was intentionally refused before
any mutation because the row exists; its expected exit 1 is preserved.

## Real editor proof

Firefox, actual editor database modal, desktop viewports **1024x768, 1280x800,
1440x900**. Destructive checks use a temporary `?freshProject=1` session and assert
`store.isRemotePersistenceEnabled() === false`.

- Manual tree creation, rename, passive node, skill node and prerequisite edge
  work through real controls. The resulting authored tree is retained during
  subsequent preset checks.
- Both pickers expose exactly **3 loaded 1024x683 illustrated role covers**.
- All roles are selected with Enter in both pickers at all three sizes:
  **18 detached previews**, no authored-data or history mutation.
- Actual preview graphs have **5 nodes / 4 edges** for promotion and
  **7 nodes / 7 edges** for skills, with real loaded semantic node imagery.
- Cancel and Escape preserve data/history; Escape restores opener focus.
  Preview zoom retains focus. At the scrolled bottom, both footer controls remain
  inside the viewport and native Shift+Tab/Tab traverses cancel/apply correctly.
- Every preset is applied twice: **12 additions**, each exactly one history
  boundary. New selection is fully visible at the 1024px floor.
- Existing records, tree settings, positions and all unrelated authored fields
  remain equal; IDs are unique and reference validation stays empty.
- **6 real Ctrl+Z operations** restore the exact state before each second apply.

A new browser context then opens the actual dedicated remote project by
`?project=rpg-zzu-growth-presets-20260906-wish2`, with remote persistence enabled.
Its serialized growth/classes/skills/actors/maps match the actual saved reload.
Loaded promotion and skill graphs and both illustrated pickers are captured.

**Remote request distinction:** zero fixture remote-write attempts; zero remote
project-content write attempts. The real remote editor's normal boot checkout
attempts one `POST /rest/v1/map_edit_locks` for this exact project and
`map_blank_start`. QA blocks it and records the IDs; it does not mock a successful
lock. Trace: `panels/editor.ts` -> `ensureCurrentMapLock` ->
`checkoutMapForEditing` -> `acquireMapLock` -> `upsertMapLock`. This metadata-only
attempt is not a project-content save. The blocked lock may affect the editor's
collaboration status display; it does not replace or fabricate loaded data.

## Shipped player proof

`startPlayerQaServer` and `runRuntimeQa` boot **`player.html`**, through
`exportProjectStoreShim`, never editor play. The harness supplies the exact
`reloaded-project.json` obtained from LegacyDb, not an invented runtime fixture.
The export store's authored growth/classes/skills remain unchanged after play.

For each of the three demonstration actors, real keyboard menu actions prove:

1. Start with 22 points; dependent technique and capstone are locked.
2. Invest root -> technique -> discipline -> mastery; the capstone remains locked
   because the other prerequisite branch is missing.
3. Invest endurance -> recovery -> capstone, then finish root rank 3/3.
   Every spend matches the authored cost. The rank-capped root is disabled.
4. Both level-5 promotion branches are offered. Advance through one branch and
   its level-12 final class: **two actual promotion tiers per role**.
5. Common-tree investments survive promotion. Reset refunds **15 points**, from
   7 back to **22**, resets every node rank, and locks prerequisites again.

There are zero uncaught page errors and zero runtime remote-write attempts.
The script records 55 high-level action/state entries; it is not a raw trace of
all navigation keystrokes. Boot/mutation DOM observers and store subscriptions
are armed before triggers. Timers only bound failure; no fixed sleeps, polling
delays, delayed key presses, test skips or mocks replacing unknown data were added.

## Exact verification commands and exits

All commands ran from the worktree above. Process exit codes were captured before
printing log tails, not inferred from a pipeline's final command.

| Command | Exit / result | Evidence |
| --- | --- | --- |
| `./node_modules/.bin/vite-node scripts/save-growth-presets.mts --save` | 0, first save and reload | `save.log`, `save.exit`, save receipts |
| Same `--save` after row creation | **1 expected**, refuses existing target | `save-refused-existing.log`, `.exit` |
| `./node_modules/.bin/vite-node scripts/save-growth-presets.mts --verify` | 0, canonical reload; 0 again after browser QA | `reload.log`, `.exit`; `final-reload.log`, `.exit` |
| `node scripts/qa/growth-presets-editor.mjs` | **0**, complete final run | `editor.log`, `.exit`, `editor/report.json` |
| `node scripts/qa/growth-presets-runtime.mjs` | **0**, complete final run | `runtime.log`, `.exit`, `runtime/report.json` |
| `npm test -- test/growthPresetStudio.test.ts test/growthPresets.test.ts test/growthTrees.test.ts test/growthTreeArt.test.ts test/growthTreeArtSurfaces.test.ts --maxWorkers=2` | **0: 5 files / 67 tests, one run**, 41.21s | `qa-tests.log`, `.exit` |
| `npm run typecheck:app` | 0 | `qa-typecheck.log`, `.exit` |
| Scoped compiler command below | 0, zero diagnostics | `qa-tool-typecheck.log`, `.exit` |
| `node --check scripts/qa/growth-presets-editor.mjs` | 0 | session command output |
| `node --check scripts/qa/growth-presets-runtime.mjs` | 0 | session command output |
| `git diff --check`; `git diff --cached --check` | 0 | session output; `save-staged.diff`, `qa-staged.diff` |

Scoped TypeScript API command (the executed configuration expression is retained):

```sh
node --input-type=module <<'JS'
import ts from 'typescript';
const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys.readDirectory ? ts.sys : ts.sys, process.cwd());
const program = ts.createProgram(['src/vite-env.d.ts', 'scripts/save-growth-presets.mts'], { ...parsed.options, noEmit: true, allowImportingTsExtensions: true });
const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
console.log(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCurrentDirectory: ts.sys.getCurrentDirectory, getCanonicalFileName: f => f, getNewLine: () => '\n' }));
console.log(`Focused tooling TypeScript diagnostics: ${diagnostics.length}`);
process.exit(diagnostics.length ? 1 : 0);
JS
```

Final fresh LSP diagnostics on all three tooling files: no diagnostics found.
Two intermediate fresh requests timed out under load; final requests succeeded.
Markdown has no configured language server. No full gates, build, Lighthouse,
ZIP or single-HTML export run is claimed.

Failures corrected in QA only, with no skipped assertions or product edits:

- Editor initially counted arrowhead paths as edges: `8 !== 4`, exit 1,
  `editor-path-count-failure.log`. The source paints one edge path and one tip;
  the check now counts actual edge paths.
- Browser wire comparisons initially treated normalizer-added optional
  `undefined` properties as different from absent JSON keys, exit 1:
  `editor-wire-comparison-failure.log` / directory and
  `runtime-wire-comparison-failure.log` / `.json`. Comparing through actual
  `serialize` fixes representation mismatch without discarding authored fields.
- One runtime unified patch failed to apply; a subsequent already-launched run
  therefore repeated the same failure, preserved as
  `runtime-unapplied-patch-failure.log`. The corrected patch and final run passed.
- Remote editor's automatic lock metadata was initially classified as a content
  write, exit 1: `editor-lock-guard-failure.log` / directory. The source-traced
  distinction above records the blocked request, verifies its target, and retains
  the zero-content-write assertion. The entire final editor run then passed.
- Final browser project snapshots travel as JSON strings to avoid Playwright's
  per-cell object-transport overhead; data comparisons remain complete.

## Evidence inventory and visual handoff

Absolute evidence root:
`/home/main/z-project/rpg-zzu-growth-presets-p2/output/evidence/growth-presets/p2/`.

| Final surface | Screenshots | Image-decode checks | Layout groups | Action/state entries |
| --- | ---: | ---: | ---: | ---: |
| `editor/` | 35 | 88 | 12 | 55 |
| `runtime/` | 23 | 216 | 18 | 55 |
| Total | **58** | **304** | **30** | **110** |

These image checks count repeated rendered instances across viewports, not 304
unique assets. `evidence-inventory.json` lists every final PNG with dimensions and
SHA-256; an independent Node `pngjs` `PNG.sync.read` pass decoded all 58 PNGs and
exited 0. Both `report.json` files contain URLs, natural sizes, element/parent
rectangles, layout overflow and action results. Off-screen scrollable rows can
decode successfully; that alone is not proof of simultaneous on-screen visibility.

Start visual review with:

- `editor/promotion-picker-1024.png`, `editor/skill-picker-1024.png` and their
  `1280` / `1440` variants.
- `editor/{promotion,skill}-graph-1024.png` and `*-bottom-1024.png`.
- `editor/{promotion,skill}-{vanguard,arcane,ranger}-applied-{1,2}.png`.
- `editor/remote-{promotion,skill}-{loaded,picker}.png`.
- `runtime/{vanguard,arcane,ranger}-invested-1024.png`, `*-promotion-1024.png`,
  and `*-promoted-refunded.png`.
- Runtime harness `runtime/SUMMARY.md` covers the initial title beat;
  `runtime/report.json` is the complete subsequent interaction proof.

**Use the final `editor/` and `runtime/` folders.** Older screenshots directly at
this evidence root came from the predecessor and can contain superseded ranger
art; failure directories are historical, not final acceptance evidence.

Final bundled cover SHA-256 values, checked with
`sha256sum public/assets/generated/growth-presets/{vanguard,arcane,ranger}.png`:

- vanguard: `342985355ab3712899a3045962aefe6352682b3ecbd8cf4fc88635c1ddb35c77`
- arcane: `39fe5ae74ab29c76105d980bcbfb979a3428cd6d1a69feea237ffcf5fe54a3fe`
- ranger: `684ff227d9f994c3c18105aa44bd5a483a9634e10736b57c706ac70a3639aeb7`

This child did not view PNGs or make aesthetic/subject judgments. The inherited
UI handoff reports lead visual approval of all three corrected covers; that is
not this child's independent visual approval. **Lead image-capable QA
(gpt5.6-luna) still owns final integrated-screen visual judgment.** Numerical
geometry, decoded pixels and passing interaction assertions are not substituted
for that judgment. Raw PNG/JSON/log evidence is gitignored and remains in this
worktree; only this report is force-added, so preserve/copy the evidence directory
when moving the handoff elsewhere.

## Cleanup and rerun contract

`editor/cleanup.json`, `runtime/cleanup.json`, and `process-cleanup.json` confirm
both browsers closed and the dedicated player server closed. The transferred
editor Vite listener PID **4158896** was verified to belong to this worktree,
terminated with SIGTERM, and awaited with Linux pidfd (no polling loop).
`ss -H -ltnp '( sport = :9851 )'` and the same command for port **43509** returned
no listeners, exit 0. npm/sh parents **4158832/4158895** and all recorded QA
launcher PIDs were subsequently absent from `/proc`. No owned browser/server is
left running; other worktrees' processes were not touched.

For a future rerun, use **`--verify`**, never overwrite or delete the remote row.
It regenerates the real reloaded JSON and receipt needed by both QA scripts.
The editor script accepts `GROWTH_QA_BASE`; this run used the inherited
`http://127.0.0.1:9851`. A new worktree-local editor server must be started for a
rerun (the runtime script starts and closes its own player server). Both scripts
use Firefox by default; `GROWTH_QA_BROWSER=chromium` is an explicit alternative,
not verified in this run. All implementation and persistence scope is complete;
remaining ownership is lead visual judgment and full integration gates/build.
