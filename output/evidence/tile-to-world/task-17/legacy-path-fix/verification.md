# T17-AV-2: injective canonical-to-legacy room path identity

Task: st_01a0822c. Base: fc5c56e3f1f22164c12f20dc430aa281a8be72c7.
Worktree: /home/main/z-project/rpg-zzu-tile-to-world/.omo/worktrees/spatial-legacy-path-fix.

## Delivered change

`roomsOf` retains the complete root/child-slot path as an array of opaque spatial IDs and JSON-encodes it once when creating the projected room. For the reported fixture, the two identities are now:

- `["collision-root","A/B"]`
- `["collision-root","A","B"]`

JSON string-array encoding preserves both component contents and tuple boundaries, including quotes, backslashes and embedded separators. It is deterministic and does not parse canonical IDs. Canonical source IDs, labels, document contents, geometry and 1-based accumulated floors remain unchanged.

Only three production lines changed, plus one explanatory comment. The existing propagation from `room.id` into bundle places, facility placeIds, thing IDs/memberships, layout room IDs/placeIds and overlay room keys now carries the injective identity. No changes to canonicalConceptSource, canonicalRoomAlias, conceptOverlayFor, tool acceptance or unrelated lookup behavior.

The existing thing ID suffix remains valid: its room prefix is a complete, self-delimiting JSON array; the slot remains opaque and the final slash separates the numeric quantity index. No room ID can be a prefix of another complete JSON-array room ID. No new suffix encoder is needed.

## Original evidence preserved

Read the T17-AV-2 finding in the sibling worktree's `output/evidence/tile-to-world/task-17/independent/AdversarialVerify.json` and its exact `legacy-probes.mts` implementation. The permanent regression promotes `collisionProject` with unchanged default root, child IDs, space selections, quantities, positions and floor values:

- direct A/B -> room-one, two beds, level 1;
- A -> nested -> B -> room-two, one asymmetric hearth, level 1 on each child.

The fixture passes the real checkedDocument schema/reference boundary. The scenario executes registered `runTool(..., "get_concept_facility", ...)`, then real canonicalConceptBundles -> canonicalConceptLayout -> conceptOverlayFor. It asserts exact canonical lookup IDs, two overlay groups with exact multiplicities, distinct room/thing IDs, matching placeIds, exact geometry/floors and unchanged serialized project.

`source-hashes.txt` binds the original verification report, probe, results, compressed snapshot and shared fixture source. `sha256sum --check` returned OK for all five after validation. Original evidence, fixtures and sibling sources were not edited.

## RED / GREEN

Both runs used the same command inside the shared asynchronous authoring monitor:

```sh
flock /home/main/z-project/rpg-zzu/.omo/ulw-execute/tile-to-world/validation.lock \
  timeout 120s env VITE_LEGACY_DB_URL= VITE_LEGACY_DB_ANON_KEY= \
  VITE_LEGACY_DB_PROJECT_ID= LEGACY_DB_UPSTREAM_URL= LEGACY_DB_ANON_KEY= \
  npm test -- test/spatialLegacyPathIdentity.test.ts \
  --maxWorkers=1 --no-file-parallelism --silent=false
```

Monitor: `/home/main/z-project/rpg-zzu/.omo/ulw-execute/tile-to-world/authoring-monitor.mjs`.
The monitor awaited the child exit event. Completion was consumed with an fs.watch subscription and bounded abort, not sleeps or polling delays. The shared monitor's inherited description says task11; the invoked target and worktree in both logs identify this task's actual run.

- RED, `red.log`, monitor `mon_1322CA6Z3RG5H4NC`: **5 failed, 1 passed**, child exit 1, timedOut=false. The exact case reached the overlay assertion after successful registered lookup; received `[["bed_v","bed_v","fixture-asymmetric"]]`, expected `[["bed_v","bed_v"],["fixture-asymmetric"]]`. Two escaped-path variants also merged. Reuse and cross-root cases each had only one distinct room instead of two. Determinism control passed.
- GREEN, `green.log`, monitor `mon_NRBKWJ2CJ3F8QS76`: **6 passed**, child exit 0, timedOut=false. Same unchanged test file; production tuple fix was the only intervening code change. One GREEN execution, no retries, timeout increases, assertions removed or failures hidden. Vitest duration 12.71s, tests 629ms.

The new six-case file covers the exact reported real-runner/layout/overlay scenario, delimiter/escaping edges, valid repeated use of one canonical space, the root tuple boundary across facilities, and deterministic read-only projection.

## Diagnostics and review

LSP diagnostics (severity all) returned **No diagnostics found** for both changed TypeScript files. `git diff --check` passed.

Pure LOC using the requested awk measure:

- src/editor/spatial/legacyConcepts.ts: 110.
- test/spatialLegacyPathIdentity.test.ts: 107.

Architectural review:

1. Responsibility: existing legacy compatibility projection; test file owns its opaque-path identity contract. No neighboring responsibilities added.
2. Boundary purity: existing checkedDocument parser remains the trust boundary; typed SpatialId tuple inside it.
3. Variants: existing exhaustive switch/assertNever retained; no new tagged branching.
4. Escape hatches: none added; no any, casts, non-null assertions or suppressions.
5. Defensive layers: none added in production; test fixture checks narrow optional lookup results.
6. Helpers: none added in production; both test helpers have multiple callers.
7. Tests: five tests fail on the unmodified source, all six pass with the minimal fix; exact real object membership is asserted, not prose.
8. Parameters: no new or changed function exceeds three inputs.
9. Redundant verification: no destructive/setter post-check code added; equality assertions guard the required read-only/deterministic behavior.
10. Naming: no negative-form identifiers added.
11. Logging: no product logging or error boundary changed; existing practice preserved.

## Limitations and cleanup

This is focused offline actual-runner/adapter evidence, not full task17 acceptance. No broad old80 suite, build or full typecheck rerun; only changed-file diagnostics and the narrow regression. No provider calls, browser/UI or image verification, DB operations, SQL/schema/grant changes, push, PR, merge or extra workers. The registered tool invocation is read-only; no store acceptance or publication is claimed.

Both monitored children exited. No server/listener/debugger was started and no temporary instrumentation was added. The temporary debug journal is removed during final cleanup. The adopted node_modules symlink and private .env.local (port 9841) remain as standard worktree environment for the parent, never staged. Only scoped source, permanent regression and this focused evidence are committed.
