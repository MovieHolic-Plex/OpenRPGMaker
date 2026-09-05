# Empty-argument protection regression

Base: 45921baf3192e42de2e3fa832ccfbd78333826f8.
Worktree: /home/main/z-project/rpg-zzu-house-protection-p1-args.

## Diagnosis and boundary correction

The unchanged hostile empty-argument sweep failed for run_village_pipeline and
build_village (red.log). Their schemas intentionally accept empty arguments and
use generation defaults. Both reach the final completed-house guard, which
correctly rejects changed protected cells after global postprocessing with a
ToolError carrying protected-house-write. The runner retained the issue code but
misclassified its summary as a postprocessing crash.

The minimal caller correction uses the existing normal failure summary for typed
ToolError rejections. Unexpected errors still retain tool-postprocess and the
postprocessing-failure summary. No guard, tool exemption, village pipeline,
manual adapter, schema requirement, or rollback behavior changed. Empty defaults
remain accepted inputs; unsafe generated drafts remain rejected, not repaired.

Five boundary tests cover both protection codes, ordinary/dry-run atomic rollback,
and genuine unexpected postprocessor exceptions through the real runner. The
original sweep and unreadable-failure predicate remain intact. A scheduler.yield
between synchronous tool calls lets worker RPC responses drain without sleeps,
polling, or changing any timeout/assertion.

## Verification

- RED: npm test -- test/toolHostileArgs.test.ts -t 'empty 인자'
  Exit 1, two offending tools, red.log.
- RED: npm test -- test/toolHostileArgs.test.ts -t 'postprocessing error boundary'
  Exit 1, four rejection-classification failures; unexpected-exception test passes,
  red-boundary.log.
- Initial combined and one-worker runs: all 45 assertions passed, but both exited 1
  with [vitest-worker]: Timeout calling "onTaskUpdate". Retained in green.log and
  green-serial.log; neither is accepted as GREEN. Inspection found a 60-second
  worker RPC deadline and a synchronous sweep lasting longer without I/O yields.
- GREEN: npm test -- test/toolHostileArgs.test.ts test/houseProtection.test.ts
  test/toolHouseProtection.test.ts --maxWorkers=1 --minWorkers=1
  Exit 0, 3 files / 45 tests passed, no unhandled errors; green-final.log.
- npm run typecheck:app: exit 0, typecheck.log.
- LSP: no diagnostics on toolRunner.ts, toolHostileArgs.test.ts (including after
  the yield edit), or smoke.mts.
- npm run build:app: exit 0, build.log. Vite emitted bundle-size and mixed
  dynamic/static-import warnings; no build errors.
- Real tool smoke: node_modules/.bin/vite-node --config vitest.config.ts
  .omo/evidence/house-protection-args/smoke.mts
  Exit 0. smoke.json contains both actual empty-input results: ok:false,
  protected-house-write, normal readable summaries, unchanged original projects.
- git diff --check: exit 0.

No broad test rerun, full gates, browser run, push, or merge was performed for this
focused child increment. The real tool surface is headless and exercised directly.
