# Task52 independent verification

Verdict: **confirmed for the explicitly authorized uncommitted normalization correction**.
Required fixes: **0**. This accepts the scoped working bytes, not baseline HEAD alone.
No Task12, UI/native, Phase4, or overall-goal approval is given.

Verifier: independent child `st_01a07afe`, Sisyphus-Junior; actual `PI_MODEL=gpt-6-astra`.
Date: 2026-09-07. Read-only product worktree: `/home/main/z-project/rpg-zzu-life-full-p4`.
All verifier writes, retained captures, runners and private caches were confined to this `52/verify` directory. The pre-existing shared QA lock was used without changing its contents.

## Exact accepted identity and scope

HEAD remained `ea6b2b358088cb6061783f6ffd162169764a07e9` throughout. No commit is required for this intermediate gate; the canonical Task52/12 plan explicitly assigns the combined final delivery/commit to the later node.

| Scoped input | SHA-256 |
| --- | --- |
| Original normalizer, equal to `git show HEAD:src/project/databaseRecordModel.ts` | `390700d58fe0cd382dab957e096351047ff76c81c25e0018964bdfca5e9a299f` |
| Accepted `src/project/databaseRecordModel.ts` (46,246 bytes) | `c27eb4c534e39a6b0c68c2d3650aadb905c8f42e0d053d10f79c8092aa6cbdfd` |
| Accepted new `test/playerBodyProjectPersistence.test.ts` (6,375 bytes, 22 cases) | `0dd6e5c03614aa124a4d953c8f80e6189fbdaebe0c31bf0b3335619861372ef1` |
| Producer declared `scoped.diff`, independently hash-checked | `49a65f01aa7c243141e956a7d3388ae3733ab3577eaf69dbe963b9db70812d80` |

The actual tracked product diff is retained as `actual-product.diff`, byte-equal to producer `product-diff.stdout`. The actual untracked test diff is retained as `new-test-diff.stdout` (normal nonempty `git diff --no-index` exit1, not a validator failure). These are real source/test changes, not a claim against an unchanged baseline.

The product correction is seven added lines including one import. `normalizeSystemRecords` reconstructed a whitelist and discarded the already-declared `SystemRecords.playerFootprint` and `playerPassRows`. The correction includes each defined optional independently, calls existing `normalizeCharacterFootprint`, and normalizes passage rows with existing `normalizePassRows` against the normalized authored height. It does not add a feature, expand the whitelist generally, change schema versions, or edit session, farming, save, movement, rendering, existing tests, or wiki code.

Read actual current normalizer, footprint primitives, body resolver, IO implementation/validation, ProjectSession declaration, save compatibility tests and the complete new test. Public IO exports are actually named `serialize` and `deserialize`; the independent probe aliases these imports as `serializeProject` and `parseProject`. No substitute parser or serializer is used.

Canonical plan read: `/home/main/.herdr/worktrees/rpg-zzu/wish-html/.omo/plans/life-systems-full-implementation.md`, Task52/12 entries at lines343-356. Also read producer HANDOFF/SOURCE-HANDOFF and the prerequisite `/home/main/z-project/rpg-zzu-life-full-p4/.omo/evidence/life-full-20260906/47-48/VERIFY.md`; its acceptance is not expanded here.

## Original execution evidence reviewed, not recreated

Read the complete original baseline, initial RED, contract-corrected RED, and final focused stdout/stderr, plus producer diagnostics, public probe and app typecheck outputs. `producer-record-audit.json` retains their actual command objects, full streams, exits, and extracted before/after identities. `producer-original-manifest.json` fingerprints all112 original producer files without modifying them.

| Producer stage | Recorded direct result | Verified source/test relationship |
| --- | --- | --- |
| Baseline characterization | 28 passed / 5 files, exit0 | Original normalizer; one-case baseline test |
| Initial RED | 20 failed / 2 passed, exit1 | Original normalizer; actual 3x3-to-1x1 loss and malformed-wire rejection |
| Contract-corrected RED | 20 failed / 2 passed, exit1 | Original normalizer; exact final test bytes |
| Final focused suite | 135 passed / 9 files, exit0 | Accepted corrected normalizer and final test |
| Diagnostics/public probe/app typecheck | exit0 each | Accepted bytes; producer typecheck stderr contains only npm update notice |

All seven producer validator before/after identity pairs compare equal. The producer's saved original normalizer is byte-equal to actual HEAD content. Final test bytes are byte-equal to `red-contract.test.ts` and its pre-fix identity hash.

The first RED was behavioral, not an import or setup failure. Its malformed-wire expectation was initially incorrect: the established parser rejects malformed geometry before normalization. The corrected RED retains malformed cases, asserts typed rejection, and separately checks bounded direct-input normalization. It still fails20 cases before the product edit. No skipped/deleted failing test or success-by-retry is needed for this gate. Original failure streams remain intact and are not presented as verifier executions.

## Independent executions

Every command ran from `/home/main/z-project/rpg-zzu-life-full-p4` under exclusive shared `flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock`, with `timeout --kill-after=10s 600s` execution bounds. Parallel submissions were serialized by that lock; no heavy validators overlapped. Source/HEAD/index/status and carryover checks occurred **inside the acquired lock before and after each validator**.

| Label | Direct command | Result |
| --- | --- | --- |
| `diagnostics` | `node .omo/evidence/life-full-20260906/52/verify/diagnostics.mjs` | exit0; zero configured syntactic/semantic diagnostics in corrected source, new test and independent probe |
| `focused` | Exact focused command below | exit0; 135 tests / 9 files passed, one execution only |
| `public-probe` | `node .omo/evidence/life-full-20260906/52/verify/probe-runner.mjs` | exit0; independent assertions and full captures |
| `typecheck-app` | `npm run typecheck:app` | exit0; `tsc --noEmit -p tsconfig.app.json`, empty stderr |
| `certify` | `python3 .omo/evidence/life-full-20260906/52/verify/certify.py` | exit0; scoped hashes, carryover, all validator identities/cleanup, original source equality, whitespace and runner syntax |

```sh
node scripts/run-vitest.mjs run --configLoader runner --cache=false --maxWorkers=2 --minWorkers=1 \
  test/playerBodyProjectPersistence.test.ts test/playerFootprint.test.ts \
  test/characterFootprint.test.ts test/ioFootprintValidation.test.ts \
  test/lifeSaveVersion.test.ts test/p0ProjectSchema.test.ts \
  test/p1FoundationSchema.test.ts test/p2ProjectSchema.test.ts test/p2SpatialSchema.test.ts
```

No tests were retried, timing limits increased, diagnostics suppressed, or failures masked. Configured diagnostics completed before app typecheck. The diagnostics and Vite loader scripts were reused from producer with only evidence-path substitution; their executions are new. `public-probe.ts` was independently authored, not copied from producer. The Vite loader imports actual modules without HTTP listener, env-file load, watcher, browser, or mocked results and closes in `finally`.

For each of the five labels, `*.lock-command.json`, `*.command.json`, `*.stdout`, `*.stderr`, `*.exit`, `*.lock-exit`, `*.before.json`, `*.after.json`, and `*.cleanup.json` preserve direct argv/cwd/environment, separate full streams, exits, state and cleanup. `initial.json` is the common source/index/status identity. All validator identities match it exactly.

## Independently observed public behavior

`captures/` contains **133 complete captures, 436,989,272 bytes**, indexed with exact SHA-256 and sizes in `capture-manifest.json`. These include full Project input objects, exact wire bytes read back from disk, full parsed outputs, every roundtrip Project/session/body, malformed input/rejection/normalized output, override input sessions/results, Save4/5 wire input, parser output and resumed sessions. `*.wire.json` is unmodified wire text. Non-wire capture objects explicitly tag JavaScript `undefined` and nonfinite numbers so those direct inputs are not silently lost by JSON encoding. These are newly executed verifier captures, not synthetic producer evidence.

- **3x3/pass1** survives public serialize/parse and real `startSession`/`resolvePlayerBody`. At foot anchor(5,7), full body is left4/right6/top5/bottom7; passage is left4/right6/top7/bottom7. Full body is not reduced to passage geometry.
- **2x5/pass2**, **8x8/pass7**, and **4x6 with passage omitted** survive the same path. The omitted passage resolves to full height6 while the optional key stays absent.
- Each of seven cases, including passage-only1, both absent and explicitly undefined, passes **four subsequent canonical roundtrips** with byte equality, normalizer idempotence, and a newly started real session each time. Legacy absent/undefined inputs are also byte-stable from the initial wire. Authored noncanonical property ordering is not claimed to survive the first parse unchanged.
- Missing body/passage keys are not materialized independently. No authored body copies are installed into the session as overrides. Defaults remain1x1/pass1.
- Four independently captured session override cases establish passage-only priority, footprint-only priority retaining authored passage, both overrides, and clamping passage to shortened resolved height. Project wire bytes remain unchanged.
- Nine independent malformed/direct cases cover oversized axes, negative/zero values, fractional/string inputs, null footprint, unsafe integer height, NaN and both infinities. Each malformed wire is rejected with actual `ProjectFormatError`; direct normalization matches explicit expected bounded bodies, is idempotent, and yields a valid Project roundtrip/start body. The rerun22-case regression additionally covers missing width, array/string footprint, null/string/unsafe passage and independent key presence.
- **Project remains version4.** Both an actual frozen legacy Save4 writer and current Save5 writer produce captured bytes read by current `readSaveSlot`; parser output is Save5 and `applySaveSnapshot` retains authored3x3/pass1. Stored input bytes and Project bytes remain unchanged. These captures intentionally use no body overrides; no new override persistence contract is invented. The18 existing Save version tests separately pass legacy-key fallback, old-reader rejection, namespace, quota and original/live-state preservation constraints.
- Every new session starts with **farmPlots `{}`**. ProjectSession has no authored farmPlots field; the probe adds none and does not seed plots or mutate UI. The correction does not change start-state contracts or persist live occupancy context.

## Carryover preservation

All11 pre-existing UI/test files and3 wiki/index files match **both** producer before and after fingerprints. These values were enforced before and after each independent validator; no carryover was repaired or reverted.

| File | SHA-256 |
| --- | --- |
| `src/player/lifePlacementScene.ts` | `275318021fbdfdfa0a8bcb131314fd7a75bf5a8fba1c37fdd35b47eac4739565` |
| `src/player/lifeLedger.ts` | `9e7ffb6f6e3bdd24f22d723556513570be03a5cb0394640ea718d918e5cfebcb` |
| `src/player/playerStatusMenuDetails.ts` | `26b30f5a06f8fc49ce9a815d7493300c4aae42d2d8b1693304cf9a2a3f96b67b` |
| `src/player/playerStatusMenu.ts` | `5d33e4a4844ddf2a5f623928b2c730ca514cdca29922d7435feeff2a4a3d6370` |
| `src/player/playerStatusMenuController.ts` | `7cf1dd019700f5ad8e19a170f6aa33fccfa0bfdce388eb00241c364bf81565e7` |
| `src/player/playerStatusMenuTypes.ts` | `40efe968f6d087034ec01e134f87043327eac5108d0b20ddb4b1b6ddee54972c` |
| `src/player/playerStatusMenuDetailTypes.ts` | `42ac4b0a3b6e06b1f6f5b594843b7c61cf85f141dd46c6711a9fc9b30a89614a` |
| `src/player/PlayScene.ts` | `a3c2fe2b3baad143cdef4db6de14590137316669961a451ec65407b0c156225d` |
| `test/lifePlacementSceneUi.test.ts` | `78403533ace4a55fa78c8b1e77e8466c87a18f1db187c5c38e0968a4821f6b56` |
| `test/p2SpatialPlayIntegration.test.ts` | `b7329262d031932ab515ec5647026e0a956c8275a145051e40f8ccc8403a9e51` |
| `test/p2SpatialRuntimeUi.test.ts` | `927d55ec45b0a72e8cd0240270701f9983f76734f1ace7b1d145cd822663be2f` |
| `openwiki/INDEX.md` | `f4f8175857676327901917c0311aaaa8aa075fa7da9dc500cfbdb88793344106` |
| `openwiki/runtime-project-schema.md` | `feb484a28a8f8eac0030f1bb087950e9e271b856489daa12d7fa49dc755c8b8d` |
| `openwiki/runtime-sessions.md` | `9184b3206751003d7b120d78b0d0fba4a8f7e0d2f3e14b5109e10e3e472f2521` |

## Cleanup and gate limits

Private per-validator TMPDIR/XDG/Vite/npm caches were created only inside this evidence directory and removed in `finally`. Existing dependencies were used; npm update notification was disabled and npm offline mode enabled. No dependency installation, remote action, checkout/sparse/read-tree/reset, index mutation, commit, browser/UI/image action, or source/test/wiki edit occurred. Git optional locks were disabled for read-only inspection. The shared lock was released by process exit and not deleted. Evidence and full captures were retained; `cleanup.json` summarizes the five cleanup receipts.

**Full build and actual3x3 native player loading were not run here, are not waived, and are not claimed by this verdict.** They remain later combined Task12 gate obligations along with its native prerequisites and final combined docs/commit delivery. Native farming setup must use actual tilling or a declared valid Save input, not an invented Project farmPlots start field. No UI, Task12 or goal approval follows from this scoped confirmation.
