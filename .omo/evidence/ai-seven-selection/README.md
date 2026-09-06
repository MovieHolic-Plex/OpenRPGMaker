# Selection/composer current-UI regression repair

Task: st_01a07751. Branch: agent/ai-seven-selection. Base: 92ab32474.
Only `test/aiSelectionChipScope.test.ts` and this evidence directory are committed.
No production changes, inherited narration changes, remote/model writes, push or PR.

## Delivered contracts

- Real happy-dom panel/composer, not disconnected fabricated chips or hint spans.
- The shipped assistant CSS cascade is processed by Vite: tokens, the complete ordered
  assistant aggregator (including 12, composer, 18 and 19), then the late editor UI-mode
  constraints. No retired repair stylesheet is loaded.
- Idle current-map pin stays visible. Adding selection keeps the host and clear control
  visible, prioritizes scope, and hides only nonselection siblings. Clearing restores
  the map pin without removing the editor selection.
- Keyboard help stays on the textarea title, never occupies the action row, and the
  shipped 36px minimum row height and focus/blur wiring remain intact. No fixed prose assertions.
- Both send-routing tests remain. Dismissed scope is exactly null, the region runner
  is not called, and the payload equals a truly unselected send. Active scope reaches
  the region runner with the exact map/rectangle/instruction.
- Fixed sleeps and counted microtask flushes are gone. Each send subscribes before the
  click to `is-turn-running` mutations and awaits running -> terminal. The 2000ms timer
  only rejects a missing transition; observer and timer are always disposed.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Original `npm test -- test/aiSelectionChipScope.test.ts` | 2 failed, 3 passed: idle host got block rather than obsolete none; deleted 14 CSS ENOENT | `baseline-red.log` |
| Final targeted command, after restoring every mutation | 5/5 passed, exit 0 | `post-mutation-green.log` |
| Final file plus aiComposerInputUx, aiComposerDeck, aiChatPanelComposerMode; `--maxWorkers=1` | 21/21 passed in one invocation, exit 0 | `final-scoped-green.log` |
| Source mutations on final test version | 15/15 caught by intended assertions; all original bytes restored | `mutation-results.json`, `mutation-*.log` |
| LSP, final test file, all severities | No diagnostics | `diagnostics.txt` |
| `npm run typecheck:app` | exit 0; production unchanged | `typecheck-app.log` |
| Full typecheck before CSS-loader narrowing | exit 2, 824 baseline errors; output byte-identical with original test restored; zero errors in this test | `typecheck-comparison.txt`, `typecheck-excerpt.txt` |
| Additional final full-typecheck attempt | exceeded 180s under workstation contention; not claimed green | local ignored `typecheck-final.log` |
| `git diff --exit-code -- src` and `git diff --check` after final mutation run | exit 0 | checked immediately before commit |

The whole-application stylesheet version exposed a 15-second happy-dom selector-scan
 timeout in the combined run (`full-app-css-timeout.log`). The correction was to load
 the complete **assistant-owned cascade plus its late shell constraints**, excluding
 unrelated runtime/database styles, not to raise a timeout or weaken assertions.
The final idle visibility case took 866ms in the combined run and 1823ms after the final
 mutation series. All 15 mutations were rerun against this final loader. The initial
 happy-dom experiment also exposed its missing unset `flex-wrap` initial value; the
 test instead checks the actual authored `white-space:nowrap` rule on the action lead
 (`first-repair.log`). Real browser geometry remains lead-owned.

The full-repository build/gates and product browser QA belong to the lead; this child
 did not duplicate them. Lead reported C4 PASS and later all browser criteria/build PASS.
See `browser-qa.md` for precise selection/input states, computed styles, geometry,
 routing inputs, and the lead's two 1440 x 900 screenshot paths.

## Mutation reproduction

Run only in an isolated clean worktree:

```sh
python3 .omo/evidence/ai-seven-selection/mutation-proof.py
```

The runner edits actual shipped CSS/DOM source seams one at a time, executes all five
 tests for each mutant, requires the intended assertion to fail, and restores original
 bytes in `finally`. Each log begins with the exact mutation diff. It concludes with
 the unchanged production source and a full-file GREEN run. It never edits aiChatPanel.ts.

Mutants cover idle/scoped host visibility, scope priority, sibling-only hiding,
 clear-button visibility, removed title help, restored hint DOM (with and without its
 retired class), action-row display/height/nowrap, focus/blur classes, and detached send.
The detached-send mutant also correctly fails both routing tests because the actual
 control disappears. No tests were skipped or deleted.

`apply_patch` was not installed on this worker. Source edits used the provided exact
 replacement editor; mutation patches are preserved verbatim in the evidence logs.
