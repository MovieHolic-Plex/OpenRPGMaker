# Task12 + Task52 combined delivery - build-r4

## Outcome: NEEDS-FIX; no staging or commit

Child `st_01a07bcd` inspected the frozen combined increment on
`agent/life-full-p4` in `/home/main/z-project/rpg-zzu-life-full-p4`.
HEAD remains `ea6b2b358088cb6061783f6ffd162169764a07e9`, not a commit
of this increment. `COMMITTED.json` intentionally does not exist.
`NEEDS-FIX.json` is the machine-readable delivery status.

The three requested r4 supplementary native cases are supported by the raw
receipts. They are **not** repeated blockers. The remaining blocker comes from
comparing the composite evidence with the original DAG's native nonblocking-rug
traversal requirement, rather than accepting the `walk-onto-rug` label.

## Exact remaining prerequisite

Original `DAG.json`, producer NATIVE section, requires walking onto a nonblocking
rug and then Save/resume. The immutable r3 evidence does not demonstrate this:

- `producer-r3/native/raw-slot-1.json` retains rug owner
  `ledger:decoration:rug:1` at `(3,1)`, orientation `down`.
- Its actual `fixture.json` defines that rug as 2x1, `blocksMovement:false`.
  Its cells are therefore `(3,1)` and `(4,1)`.
- `native-qa-final-evidence.json` labels a step from `(2,2)` to `(2,3)` as
  `walk-onto-rug`. For the actual 3x3/passRows1 player, the destination movement
  passage is x1..3/y3, not row1. The origin passage is x1..3/y2.
- The full upper body overlaps a rug cell, but movement passage never crosses
  the rug in that step. Full-body overlap is not a nonblocking-passage test.
  The script itself says it is walking toward a **likely** rug cell and reads
  `decorations-before-rug-walk: []`; it never asserts the traversal geometry.
- `rug-traversal-audit.json` enumerates every recorded movement destination
  after rug placement and before Save. None of those passage rectangles
  intersects the actual rug. No other logged movement fills this requirement.
- R4 uses the blocking table arena and stationary last-exit fixture only; it
  does not supply a nonblocking-rug traversal.

This is an evidence gap, **not a demonstrated product bug**. The needed receipt
is native keyboard movement whose actual passage crosses a known nonblocking
rug, followed by menu Save/raw-owner/Load retention with exact state-driven
waits, source identity and owned cleanup. No source fix or browser rerun was
performed here; both are outside this delivery node's scope.

Menu Save and Load already have r3 owner-existence receipts. They are retained
as such, not rejected because there is no divergent-state restoration test.
Neither a divergent-state test nor saving while standing on the rug is added
as a new requirement here. The missing operation is the actual rug traversal.

## R4 closures verified from raw evidence

Read `ATTEMPT4-INSTRUCTIONS.md`, original DAG, producer-r3 HANDOFF/source
handoff, build-r3 SUMMARY, verify-r3 VERIFY, producer-r4 HANDOFF/source/criterion
map and entry point, fixtures-r4 DB/preflight script and receipts, Task52
working and independent verification, and exact `47-48/VERIFY.md`.
`CLAUDE.md` was ignored.

`native-composite-audit.json` compares actual raw slots with parsed owners and
records full supplementary steps. `fixture-audit.json` records the separate
public-core preflight results, explicitly model-only.

| Criterion | Actual supplementary evidence |
| --- | --- |
| Accepted rotation | Table down -> left at unchanged `(7,9)`; raw rotated slot has left orientation and frozen recovery item |
| Accepted movement | Same table owner `(7,9)` -> `(5,6)`, left orientation and recovery item retained; gold500/potion7 unchanged by rotation/movement |
| Last-local-exit refusal | Target `(0,3)` refuses `blocked`; foot remains `(1,2)`; gold500, potion8, hoe1 and both authored building owners unchanged; no decoration owner |
| Isolated cause | Static preflight accepts; nonblocking live control accepts; blocking live preflight refuses; separate static construction succeeds and spends; actual live model refusal preserves the entire session |
| Remote inputs | Both fresh isolated IDs were absent before authoring, saved and actually reloaded; authored/reloaded/post-probe remote hashes match |

Arena project: `rpg-zzu-life-full-p4-t12-arena-st-01a07ba6`, SHA256
`d8a44e6019cb015ca557bdedb551efd006975f1ba754bc2a3cd611b301b234f8`.
Last-exit project: `rpg-zzu-life-full-p4-t12-last-exit-st-01a07ba6`, SHA256
`ca7bb0339b1472d602db720620e927bc5b81e93cfafa18a9f1ed20df07e24813`.
Both retain 3x3/passRows1 and use legitimate Project inputs, not authored plots
or post-action state injection. Remote projects remain retained for the native
consumer. This node made no remote call.

R4 final command exit0 is bound to the final native script SHA and full separate
stdout/stderr. Attempt1 exit1 (second Save overwrite confirmation) remains
preserved. R4 final raw evidence has no uncaught/page/cleanup errors. Native
navigation arms selection, message, player-movement or presence signals before
keys; no awaited action timeout is converted into success in the r4 action path.

## Original receipts retained without upgrading their claims

R3 focused UI execution is 91/7, including45 lifeFieldInteraction and3 new
rendered-body replay tests, exit0. The new counterfactual replay is RED3/0,
exit1 on preserved pre-render UI; current source was restored. No UI suite,
135-test suite, core355 suite, browser, or image interpretation was run here.

Raw r3 native receipts show 3x3/passRows1 start, adjacent building placement,
overlap refusal without further cost, stored-position level2 upgrade,
meaningful building move to `(11,6)`, actual hoe till7,9, plot/edge refusals,
rendered moving-NPC-origin overlap refusal, rug placement, and menu Save/Load
with building owners equal to the raw slot and the rug UI id retained.
NPC sprite `fractional:false` remains the actual observation: origin versus
logical destination overlap, not a claim of fractional pixel observation.
The rug rotate/move `blocked` observations and false old last-exit verdict
remain immutable history; successful r4 supplementation fills those three gaps.

The r3 script has a caught hoe timeout and movement fallback paths. Final-run
hoe selection is digit1 at `10:22:02.822Z`, only26ms after the previous completed
step, below its4000ms timeout; neither movement fallback error step appears.
No actually swallowed action timeout is established in this final receipt.
Those catch paths are not endorsed as future acceptance logic. The separate
rug traversal gap is established by coordinates, not by guessing a timeout.

All354 files in the inventoried r3/build-r3/verify-r3/fixtures-r4/producer-r4
set were read byte-completely and hashed; JSON receipts were parsed. Full raw
states, commands, streams, failures and before/after inventories are retained
unchanged in `borrowed-inventory.json`. PNGs were mechanically hashed only
(`png-hashes.json`); producer visual judgment is not relabeled as this node's.

## Source equality and CLI gates

All14 declared code/test paths match the r3 and accepted Task52 SHA256 values.
All6655 inventoried compiled source/test/script/public/vendor/package/tsconfig/
Vite inputs match **both before and after** build-r3 diagnostics, app typecheck
and full build. No undeclared dirty path was found. The initial index was empty
and remains unchanged. `initial-identity.json`, `build-reuse.json` and
`final-identity.json` retain exact identities.

Per the scoped reuse instruction, the following direct build-r3 results are
reused, not rerun: configured syntactic/semantic diagnostics for all14 files
(empty diagnostics, exit0); `npm run typecheck:app` exit0; and the **full
`npm run build`** exit0. Read the entire original build stdout/stderr. That
build includes app, export-player/SDK and standalone outputs. Optional-key,
circular/dynamic-import, asset-resolution and chunk-size warnings remain
visible; no warning-free build claim is made.

Task52 independent135 inputs have zero comparable differences. Core355 remains
historical source-bound evidence with explicitly declared later combined
changes and zero unexpected differences, not a newly executed whole-unit355
pass. Comparison receipts retain that distinction.

Factual wiki updates now describe the three r4 closures and separate menu Save
owner-property proof from Load restoration. Canonical INDEX was generated,
not hand-edited. No product/test/UI/scene/core bytes were changed.

| Newly executed command | Result |
| --- | --- |
| `npm run openwiki:index` | exit0 |
| `npm run openwiki:index -- --check` | exit0 |
| `npm run openwiki:verify` | exit0, `ok:true` |
| `git diff --check` | exit0 |
| Four new-source `git diff --no-index --check /dev/null <path>` checks | exit1 each, empty stdout/stderr: difference-only, no whitespace diagnostics |
| Bounded source/archive/rug certificate | exit0 for completing the audit; explicitly emits NEEDS-FIX, not native approval |

`run.py` and `certify.command.json` retain real argv/cwd, separate complete
streams, direct exits and identities. Shared lock acquisition is bounded at
900s; validator commands at900s, final certification at600s, TERM with kill-after
30s. No timeout is success. `lock.exit` is0. The full build was not repeated for
fixture/evidence/prose-only changes.

Owned Python evidence initially had style/unused-import warnings. Formatting
and unused-import cleanup were confined to those evidence scripts; executed
versions remain as `*.py.executed.txt`. Final LSP diagnostics are empty for
`audit.py`, `run.py` and `certify.py`. The initial Codex patch invocation passed
stdin instead of the required argument and created no file; the actual patch
argument invocation succeeded. No product validator was retried to green.

## Publication and cleanup

The actual Task52 parent archive receipt is `52/PARENT-PUBLIC-ARCHIVE.json`;
the extra `52/archive52/` spelling is not an existing directory. Read the real
`52/archive/public-final/PUBLICATION-FINAL.json`, exact1152-path list and all12
chunks. Paths are relative to **Task52 root**, not repository root. The
repository-prefixed inventory is `task52-publication-inventory.json`; no
obsolete470-only list or bulk staging was used.

All328 encoded archive payloads were decoded in memory and compared with their
per-file compressed and original hash/size receipts:452745499 decoded bytes,
all equal. Existing bounded public/privacy clearances remain their stated
limited checks, not a universal privacy guarantee. See
`task52-archive-integrity.json`. Since the native gate is incomplete, no evidence
or source was staged and no publication commit was attempted.

Owned `/dev/shm/st_01a07bcd` scratch is absent. Shared lock was released and
retained. No browser/server/port/profile, foreign cache, dependency tree,
stardew-demo, WISH, prior evidence or remote Git operation was touched.
Source/index and all borrowed inventories remain unchanged; only the three
permitted wiki/index paths and build-r4 evidence are newly written.
`cleanup.json` and `final-cleanup.json` record preservation and owned cleanup.

The combined increment remains intentionally frozen and uncommitted.
Independent full Task12 native acceptance remains pending and is not launched
on this incomplete handoff. Task52's accepted correction and successful combined
full-build receipt are preserved, but final combined delivery is not complete.
