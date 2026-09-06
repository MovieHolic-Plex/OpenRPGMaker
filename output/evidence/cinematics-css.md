# Cinematics CSS file-count regression

Task: `st_01a07576`. Date: 2026-09-06.
Worktree: `/home/main/z-project/rpg-zzu-wish-cinematics-css`.
Branch: `agent/wish-cinematics-css`.
Starting commit: `17492434a52fe4e3248e81ab1913abfb60be000b`.
Integration commit: the single commit containing this report; resolve with
`git log -1 --format='%H %s' -- output/evidence/cinematics-css.md`.

## Delivered change

Moved all 68 lines of `src/styles/runtime/cinematics.css`, byte-for-byte, to
`src/styles/runtime/playSurface.css`, separated by one blank line. Deleted the
redundant file and removed its import from `playerRuntime.css`. In
`test/playerRuntimeCss.test.ts`, removed only the newly added `./cinematics.css`
required-import entry. Both `.cinematic-sequence` and `.cinematic-terminal`
required-selector entries and every original assertion remain unchanged.
Updated the runtime-sessions wiki's single ownership reference to the existing
play-surface owner. No runtime TypeScript, scrolling behavior, schema, editor UI,
dependencies, gate scripts or baselines changed.

Ownership was checked against `AGENTS.md`, OpenWiki quickstart/index/project map,
runtime pre-edit routing, runtime sessions, and actual styles/imports. The
play-surface sheet already owns stage overlays and is shared by exported-player
and editor closures. No cinematic selector occurs elsewhere in those source
styles. The rule move adds no new presentation behavior.

## Regression evidence and verification

The supervisor receipt at
`/home/main/.herdr/worktrees/rpg-zzu/wish-3/.omo/ulw-loop/wish-cinematics-0906/phase1-initial-gates.json`
records `npm run gates -- --json` on `17492434`, exit 1:

- Application typecheck: exit 0, zero errors.
- CSS budget: exit 1; sole exceeded metric `cssFileCount 267 -> 268 (+1)`.
- CSS graph: exit 0, no new graph violations.
- Tests: 163 failed; comparison with `4c7cf588` reports no new failing files.
- Surface axis also reports an existing snapshot-test failure. This CSS fix does
  not claim that full gates or the existing failing test suite are green.

This worker did not rerun full gates or a full application build.

| Verification | Observed result |
| --- | --- |
| Untouched `4c7cf588` archive: `npm run gates -- --only css --json` | Exit 0; budget 0, graph 0; 267 CSS files; no regressions |
| Untouched task base `17492434`: `npm test -- test/playerRuntimeCss.test.ts --testNamePattern='detects an omitted required import'` | Exit 1; original `.action-hud` assertion fails before edits; five unrelated tests unselected |
| Final `npm run gates -- --only css` | Exit 0; budget 0, graph 0; no regressions |
| Final `node scripts/check-css-budget.mjs` | Exit 0; 267 files, zero regressed metrics |
| Final `npm test -- test/playerRuntimeCss.test.ts` (one complete run) | Exit 1; 5 passed, 1 pre-existing failure; no skipped tests |
| TypeScript LSP: `test/playerRuntimeCss.test.ts` | No diagnostics |
| Exact-byte assertions against `git show 17492434:<path>` | Pass: original play-surface bytes plus one newline plus original cinematics bytes; aggregator/test differ only by designated import removal |
| `git diff --check` | Exit 0 |

The untouched comparison extracted `src`, `scripts`, both gate/budget baseline
JSON files and `package.json` with `git archive 4c7cf588` into a disposable directory
inside this worktree's `.omo`; the directory was removed afterward. No checkout,
source replacement or baseline change was needed.

Final budget values (baseline / current):

```text
hexLiterals       1668 / 1642
important          988 / 733
undefinedVars       61 / 61
globalRootFiles     10 / 10
cssFileCount       267 / 267
```

Final gate output:

```text
css            exit=0  budget=0  graph=0
No regressions against .omo/gates-baseline.json
```

The passing complete-closure test builds through the real
`vite.player.config.ts` into an isolated output directory, reads emitted CSS, and
checks all required runtime families (including both cinematic selectors) and
battle skins, while excluding editor CSS. The ordered shared-import assertion,
existing selector families, missing-resource declaration checks and edge-dock
omission test also pass. This is emitted production-player verification, not a
source-grep substitute. The focused test's internal player build is the only
production build used here.

## Preserved failure

Before edits and after the move, the same test fails:

```text
FAIL exported player runtime CSS > detects an omitted required import in a disposable built entry
AssertionError: expected true to be false
expect(hasCssSelector(fixtureCss, ".action-hud")).toBe(false)
Expected: false
Received: true

Final: Test Files 1 failed (1); Tests 1 failed | 5 passed (6)
```

The omitted import is `actionHud.css`, but the untouched `playSurface.css` already
contains `.play-stage.cutscene-hud-hidden .action-hud`. The test's selector
predicate therefore still sees `.action-hud` in emitted bytes. Its assertion is
preserved, not weakened, deleted or skipped. Earlier phase evidence also records
this same result against untouched `8bb02872` styles in
`output/evidence/cinematics-p1/runtime.md`.

Local raw command logs (not integration artifacts):
`.omo/cinematics-css-untouched-base-gate.log`,
`.omo/cinematics-css-base-omission.log`, `.omo/cinematics-css-gate.log`, and
`.omo/cinematics-css-tests.log`.

## Limitations and integration

CSS LSP could not run: configured Biome executable is absent. Markdown has no
configured LSP. No dependency was installed. CSS budget/graph validation and real
production CSS emission ran; no new browser/visual approval is claimed for this
exact-rule relocation. Native `apply_patch` is not exposed in this session;
changes used the available exact-replacement editor and an explicit file removal,
then exact-byte verification.

Recent Git history uses English Conventional Commits and the omo footer plus
`sisyphus-dev-ai` co-author attribution; the integration commit follows that
convention. The branch has no configured upstream. No push, PR or merge was
performed. Assumption: the requested existing play-surface owner is the intended
home; the runtime wiki and current stage-overlay rules support that choice.
