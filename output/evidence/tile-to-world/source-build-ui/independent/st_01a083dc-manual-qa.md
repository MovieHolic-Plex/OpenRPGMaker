# source-build-ui focus-fix independent manualQa

Goal: independent NARROW keyboard/focus/eligibility recheck of frozen source Build UI WIP on `/home/main/z-project/rpg-zzu-tile-to-world` base `2961dbe3b0878ecb06f1412183dbd1440dd63e29`. No product edits. Verdict **confirmed**. Not whole-task 11-15 approval. Prior RED `VisualFixVerify.json`, 25 layout PNGs, `focus-fix/red.log`, and `boundary-red.log` were read and not overwritten.

Surface: Database spatial Objects (and one Spaces compatibility card) in Chromium against the frozen worktree.
Exact invocation: `cd /home/main/z-project/rpg-zzu-tile-to-world && flock -w 20 /home/main/z-project/rpg-zzu/.omo/ulw-execute/tile-to-world/validation.lock timeout 360s ./node_modules/.bin/vite-node output/evidence/tile-to-world/source-build-ui/independent/focus-fix-recheck/probe.mts` → Vite `--host 127.0.0.1 --port 43903 --strictPort`, `?blankProject=1&aiBridge=0`, inject canonical fixtures locally. Real `locator.click`. Sequential `keyboard.type` per character. No fill. No evaluate-click. No sleeps. Bounded waits.

## surfaceEvidence

| scenario id | criterion | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| S-K1-1024-keyboard | sequential map stamp-target, numeric dest, seed 19, Tab, one Build+Apply | Chromium Database Objects 1024x768 | viewport 1024x768; toolbar-database → db-tab-spatial-objects; hearth card; click+type per char; Tab; click spatial-build once; click spatial-apply once | PASS | A1, A2, A10 |
| S-K2-1280-keyboard | same plus mid-string caret insert/delete, empty seed, explicit 0 | Chromium Database Objects 1280x800 | Home+ArrowRight×5 insert X then Backspace; clear seed disables; type 0 enables eligible=1; type 19; Tab; one Build+Apply | PASS | A1, A3, A10 |
| S-K3-1440-keyboard | sequential map/numeric/seed 19 Tab one Build+Apply | Chromium Database Objects 1440x900 | same Objects path at 1440x900 | PASS | A1, A4, A10 |
| S-K4-compat | coincident-id compatibility card stays disabled after seed 19 | Chromium Database Spaces 1280x800 | inject interiorRoomKinds id=room-design; click tileset-room card; type seed 19 | PASS | A1, A5, A10 |
| S-K5-layout-reuse | CSS hash unchanged; do not recapture 25-state matrix | hash compare + 1024 geometry | spatial-shell.css e7532cd9; 1024 map 280,216.4375 117.59×32 and 시공 477,122 46×32 match VisualFixVerify | PASS | A1, A6, A7 |

## adversarialCases

| scenario id | criterion | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| ADV-keyboard | input oninput remount | focus/caret during multi-char typing | same mounted node; stamp-target and 19 reach field and proposal without fill | PASS | A1, A2, A3, A4, A10 |
| ADV-caret | mid-string insert/delete | caret survives insertion at index 5 | stampX-target caret 6 then Backspace restores stamp-target | PASS | A1, A3, A10 |
| ADV-eligibility | data-build-eligible canonical | button enablement | eligible=1 only when chrome.build exists; sync updates disabled only | PASS | A1, A10 |
| ADV-compat | coincident localId compatibility card | no-live/no-proposal | Build stays disabled eligible=0 after seed 19; proposal null; live 0 | PASS | A1, A5, A10 |
| ADV-invalid | empty then correction | typing continues and enablement is correct | empty disables; 0 enables; 19 enables then Build | PASS | A1, A3, A10 |
| ADV-live | no live adoption before Apply | preview isolation | live 0 after Build; Apply adopts 1 | PASS | A1, A10 |
| ADV-palette | G2 no fallback painter | palette arming | object Build leaves activePaletteStamp null | PASS | A1, A10 |
| ADV-isolation | owned port/cache | shared 9888 reuse | port 43903 owned then closed; cache removed; 9888 remains MainThread pid 3844652 | PASS | A8, A9 |
| ADV-identity | G10 resolveSpatialBuildSource only | identity guessing | not_applicable: sibling BoundaryFixVerify / parent tests own this class | — | — |
| ADV-atlas | G2/R2 | atlas mismatch | not_applicable: this slice does not compile atlases | — | — |
| ADV-pending | G1 pending inputs | changed pending seed | not_applicable: sibling boundary owns rejected-target traps | — | — |
| ADV-stale | G1/R10 | stale apply | not_applicable: this pass does not mutate pending then apply | — | — |
| ADV-assoc | association-incomplete history | association-incomplete history | not_applicable: this slice does not add occurrence association edits | — | — |
| ADV-nested | nested compile underscope | nested compile underscope | not_applicable: Build uses leaf map destination only | — | — |
| ADV-member | slot-vs-member desync | slot-vs-member desync | not_applicable: space member tokens not in this slice | — | — |
| ADV-landing | hardcoded landing | hardcoded landing | not_applicable: no connection UI in this slice | — | — |
| ADV-drill | frozen-slot drill | frozen-slot drill | not_applicable: no placed drill wiring | — | — |
| ADV-geom | 16/24 geometry | 16/24 geometry | not_applicable: space tile scale not changed | — | — |
| ADV-clone | clone-without-select | clone-without-select | not_applicable: clone handlers unchanged | — | — |
| ADV-synth | synthetic place-preview adoption | synthetic place-preview adoption | not_applicable: this pass does not run place Build | — | — |
| ADV-xss | injection via testid | XSS / injection | not_applicable: static testid tokens, no user HTML | — | — |
| ADV-auth | auth / CSRF | auth bypass | not_applicable: local blank-project Database, no network write | — | — |

## artifactRefs

| id | kind | description | path |
|---|---|---|---|
| A1 | json | FocusFixVerify confirmed | `output/evidence/tile-to-world/source-build-ui/independent/FocusFixVerify.json` |
| A2 | screenshot | 1024 keyboard map/seed/built/applied | `.../focus-fix-recheck/1024x768-keyboard-*.png` |
| A3 | screenshot | 1280 caret, seed 0, seed 19, built, applied | `.../focus-fix-recheck/1280x800-keyboard-*.png` |
| A4 | screenshot | 1440 keyboard map/seed/built/applied | `.../focus-fix-recheck/1440x900-keyboard-*.png` |
| A5 | screenshot | 1280 coincident-id Collision room, 시공 disabled, seed 19 | `.../focus-fix-recheck/1280x800-compat-disabled.png` |
| A6 | screenshot | reused layout captures (CSS unchanged) | `.../visual-fix-recheck/*inspector*.png`, `1024x768-objects-targets.png` |
| A7 | json | prior VisualFixVerify needs-fix (preserved) | `.../independent/VisualFixVerify.json` |
| A8 | md | owned port 43903 cleanup | `.../focus-fix-recheck/cleanup.md` |
| A9 | log | Vite server log | `.../focus-fix-recheck/server.log` |
| A10 | json | probe keystroke/geometry/build state | `.../focus-fix-recheck/qa.json` |
| A11 | json | SHA-256 at capture | `.../focus-fix-recheck/source-hashes.json` |

## Completion

- Independent Chromium on 43903, not 9888/32921/44207. Cache removed. Autosave blankProject errors preserved (count 8).
- V-INPUT-RERENDER-FOCUS is confirmed fixed on current `spatialBuildChrome.ts` hash `91767b56`.
- Do not approve the whole source-build-ui task. Stop at this source-bound keyboard/focus/eligibility verdict.
