# Seven AI validation failures

Base: `3f7b89d647b99f9c3223e90cfee0c9735664a9f6`.
Branch: `fix/ai-seven-validation`.

## Result and evidence

| Criterion | RED or mutation proof | GREEN and real surface |
| --- | --- | --- |
| World structure narration | `red.json`: missing explicit world tool classification | `narration-green.json`; `browser-initial.json` records actual world activity text |
| Reasoning preservation | `../ai-seven-async/baseline-red.json`, `mutation-red.json`, `mutation.patch` | `green.json`; `browser-contracts.json` records two actual reasoning items |
| Successful-write ghost preview | Same async mutation disconnects successful tool publication | `green.json`; actual successful `create_map`, `live_project_diff`, bounds 6x5 |
| Transport recovery | Async mutation removes settings actions and fails both recovery cases | `green.json`; actual refused connection reaches terminal error with settings/retry controls |
| Selection visibility and clearing | `../ai-seven-selection/mutation-results.json` and logs | `green.json`; actual selected chip visible and cleared scope absent, map pin retained |
| Composer help layout | Same selection evidence probes title, DOM, layout and focus wiring | `green.json`; no retired hint node, tooltip retained, action row 36px before/after focus |
| Canonical project storage guard | `guard-mutation-red.json`: actual project-source DB open rejected | `guard-green.json`; supported AI IndexedDB history survives browser reload |

Lead pre-integration target run: **31 passed, 0 failed**, five files (`green.json`).
Original baseline: **7 failed, 18 passed** (`red.json`).
Adjacent preset/project-handoff regression: **46 passed, 0 failed**, six files
(`preset-regression-green.json`).

After merging latest main, the combined 11-file invocation passed all **79**
tests (`integrated-main-green.json`), including two incoming narration tests.
Review subsequently identified a missing
no-substitution template-key case in the guard. That exact case failed first
(`guard-template-red.json`: 1 failed / 8 passed), then all **9** guard tests passed
with `isStringLiteralLike` (`guard-template-green.json`) and strict standalone
typechecking passed. This adds one test without removing an earlier case.

`npm run build` passed, including app typecheck and editor/player/standalone builds.
Changed-file LSP passed except the standalone storage test timed out in LSP; the
same file passed strict standalone `tsc`. Test-inclusive wider typecheck retains
documented baseline timer/type conflicts, not suppressed by this change.

The only production change is explicit classification of two world-structure
tools. The other six original failures were stale test contracts or inaccurate
async/HTTP fixtures. No authentication, session, persistence or CSS implementation
was changed to satisfy them.

## Browser and cleanup

Lead used a disposable Chromium context at `http://127.0.0.1:43791/?blankProject=1`.
DB/model HTTP responses were intercepted; there were no real remote writes or
real model-generated deliverables. `browser-initial.json` and
`browser-contracts.json` record exact actions and observations. Referenced PNGs
are local captured evidence, not uploaded PR attachments.

Latest-main integration changed session/store dependencies, so the lead repeated
every browser criterion on the newly built product at
`http://127.0.0.1:42005/?blankProject=1`. `browser-integrated.json` is the final
real-surface record. It uses the shipped main chunk's actual store/editor/ghost
singletons, not replacement implementations. `integrated-*.png` captures these
final states. Refused transport correctly leaves Send disabled when the normal
UI has cleared the input; fresh input reenables it, and settings recovery opens.

All page errors were empty. The browser was closed and the owned server killed;
`ss -ltnp 'sport = :43791'` returned no listener. Temporary production mutations
were removed/restored. Both isolated worker directories were removed while
retaining their committed branches. Mutation scripts/logs remain as evidence.
The later integrated-product browser and both servers were also closed/stopped;
ports 38959 and 42005 had no listener.

## Final gates and review

The final complete `npm run gates` invocation exited **1**:

- App typecheck: exit 0, no errors.
- Vitest: **16,211 passed / 209 failed**, 103 failed files.
- Within that same complete run, all **34 scoped target tests + 46 preset tests
  passed (80/80)**. No target case failed.
- CSS graph passed, but the CSS budget failed because the file count is 268
  against a stored 267-file baseline. This PR changes no stylesheet.
- Event-editor commit/form/interaction/M2/portal surface snapshots still differ
  from their baselines, including image-generation controls, monster choices and
  NPC graphic teaching controls. Those surfaces are outside this repair.

`gates-summary.json` records the breakdown. The tool reported 43 baseline-relative
gate items; that is not a claim of 43 new product bugs caused by this PR. The
remaining full-repository failures were not all independently diagnosed or
reproduced on an unmodified full upstream tree, and are not blanket-labeled
pre-existing. The gate baseline and failure expectations were not relaxed.

The same final reviewer approved the C5 correction: **APPROVE, no scoped
blockers** (`final-review.md`). The initial rejection is retained there as
historical evidence and explicitly superseded.
