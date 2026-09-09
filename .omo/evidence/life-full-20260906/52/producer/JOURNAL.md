# Task52 producer journal

Scope: sole product writer in `/home/main/z-project/rpg-zzu-life-full-p4`, HEAD `ea6b2b358088cb6061783f6ffd162169764a07e9`. Only product correction permitted: `src/project/databaseRecordModel.ts`; own new regression: `test/playerBodyProjectPersistence.test.ts`. All receipts are durable under this directory. No evidence cleanup is authorized.

Read: root AGENTS; quickstart; INDEX routing; PROJECT_WIKI; runtime-pre-edit-routing; runtime-project-schema focused sections; SystemRecords and player body design; public IO, body helpers, session field/initialization locations; canonical plan52/12 at `/home/main/.herdr/worktrees/rpg-zzu/wish-html/.omo/plans/life-systems-full-implementation.md`; exact core acceptance `/home/main/z-project/rpg-zzu-life-full-p4/.omo/evidence/life-full-20260906/47-48/VERIFY.md`; producer-r2 SOURCE-HANDOFF and build-r2 final identity. Programming/TypeScript/philosophy and debugging/Node skill references were read. CLAUDE.md was not read.

Initial hypotheses and distinguishing evidence:
1. Authored fields disappear at Project normalization: inspect serialization vs deserialization and direct normalizeSystemRecords; public regression must start a session from the parsed Project.
2. New-session overrides replace authored dimensions: inspect session declarations and compare resolvePlayerBody with and without newly started session. Session overrides are absent initially.
3. Invalid wire geometry is normalized differently than valid geometry: distinguish strict shape validation from direct runtime normalization, retain both contracts. No schema validator changes allowed or needed.

Observed sequence:
- Initial HEAD exact; 11 UI/test bytes equal producer-r2 and build-r2 source hashes. Three wiki hashes equal build-r2 docs (INDEX/schema differ from older producer-r2 wiki checkpoint, as expected from intervening docs work).
- Baseline before product edit: 28/5 tests GREEN. Existing legacy fixture removes only unrelated redundant titleGraphic seed; legacy Project serialized bytes remain equal.
- Initial RED: 20 failed / 2 passed. Valid 3x3/passRows1 public serialize -> deserialize -> startSession -> resolvePlayerBody returns 1x1. All APIs loaded correctly. Eleven malformed cases revealed the existing strict wire rejection boundary; initial expectation of permissive wire normalization was incorrect. Full original test/streams/direct exit are retained as red.*.
- Test-only contract correction before product edit: keep strict wire rejection assertions, then separately exercise direct normalization against existing helpers and round-trip the normalized result. Valid-field cycle stability compares canonical bytes after first load, rather than assuming arbitrary input property order survives reconstruction. No failing case removed or skipped. red-contract.* preserves the exact final test and another behavioral RED: 20 failed / 2 passed, including the same 3x3 -> 1x1 failure.
- Product correction adds one import and conditional preservation of two declared optionals, normalizing with existing helpers and normalized authored height. No new setting, session change, farming change, movement change, render change, or Save contract.
- Final configured diagnostics on source/test/probe: exit0. Final 135/9 suite: exit0, run once on final source. Retained actual public probe: exit0. App typecheck: exit0; npm printed only an update notice.

Artifacts/resource ownership:
- Durable: own new test, before-source/test snapshots, run.py, diagnostics.mjs, public-probe.ts, probe-runner.mjs, public input/result, all command/identity/stdout/stderr/exit/cleanup receipts and handoffs.
- Runtime scratch: run.py journals each uniquely created `/dev/shm/task52-<label>-*` path in its command receipt before executing commands; sets private TMPDIR/XDG/Vite/npm caches; removes only that path after direct exit. Each command uses shared flock timeout900 and execution timeout600 with kill-after10s. No sleeps, polling or retry-to-green.
- Probe uses a Vite module loader with no application config/env loading, no HTTP listener, watcher disabled and HMR disabled; finally closes loader. No window, browser, UI, image or remote operations. Disk input is a test fixture, not an authored shipped demo.
- No dependency install, checkout, reset, stash, sparse operation, stage, commit or merge. No build: the final combined Task12 CLI node owns full build after native prerequisites. Evidence remains available; product correction remains frozen uncommitted.

Native boundary: ProjectSession has no authored farmPlots contract; startSession's empty farmPlots is intentional and observed in the public probe. Later native QA must till or supply a declared valid Save input. This is not another product fix.
