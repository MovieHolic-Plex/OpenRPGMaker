# Task10 correction - exact forage dates across all accepted years

Status: corrected and verified. This closes the parent's in-scope task10 expiry finding; it is not waived as a baseline failure. Parent independent verification/integration remains separate.

## Identity and minimal change

Worktree: `/home/main/z-project/rpg-zzu-life-full-field-input`
Branch: `agent/life-full-field-input`
Correction base: `038ff8b47b127e604dad6a5c5cb50597ef543c20`

Original forage SHA256: `94167a19a6eb77d640336c5b2fb054f0df9bf2150bab45b6e4f8651ad2c7e3da`
Corrected forage SHA256: `5c80ae0b3e413b0fac294c4ab50c821c07a4b14f3d804046465263399189e09d`

Only production file `src/project/seasonalForage.ts` changed. The regression was added to the owned `test/lifeFieldInteraction.test.ts`; everything else in this correction is task-owned evidence/documentation.

The old helper converted a valid safe-integer year into an unsafe Number absolute ordinal before subtracting. At year9007199254740991, spring days1 and3 could round to the same ordinal and yield age0. The same calculation affected generation cursor ordering, expiry cleanup and modulo-based spawn cadence.

The private helper now converts validated year/day/season-length components to bigint before multiplication or addition. Generator cursor comparisons, cleanup, interval modulo, and collector age all use that exact ordinal. Invalid prior cursors still refuse as stale. No arbitrary year limit, accepted-date restriction, shared clock framework or persisted BigInt field was introduced. Existing session/project dates remain numbers and day-key strings. No changes to dayTransition, farming, tools, XP, recovery or Save5/Project4 were needed.

## RED retained, parent originals unchanged

`parent-original/` contains byte-identical copies of the parent's probe, result and execution files. The original files in `/home/main/z-project/rpg-zzu-life-full-p3/.omo/evidence/life-full-20260906/phase3-parent-checks/` were not written. Hash/equality checks are recorded in `source-cleanup.json`.

The unchanged probe was copied into separate `red-public/` and `green-public/` directories solely to keep its output/cache local. Both script copies are byte-identical to the parent script and load current source from this worktree through Vite.

- `red-public/output.txt.gz`, `exit`, `forage-date-result.json`: reproduced parent RED on the original SHA. Year1 refused, but year9007199254740991 granted1 and changed ownership. Exit1, source stable, server/cache cleaned.
- `red-tests.txt.gz`, `red-tests.exit`: 8 failed / 37 passed before the production fix. These include extreme-date expiry, future-date refusal, generator ordering/cadence and year-boundary failures.

## Final source verification

`execution.json` contains exact argv/cwd/start/end/status and raw output SHA256 for each final command, with identical before/after corrected source hashes. Every heavy command used `flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock`, fixed300s test/public/native/typecheck budgets and fixed600s build budget. No timeout was extended to recover a failure.

| Check | Actual result |
| --- | --- |
| `npm test -- test/lifeFieldInteraction.test.ts` | 45/45 passed, exit0 (`focused.txt.gz`). |
| Same 17-file related selection as original task10 | 283 passed / 2 unrelated inherited snapshot-fixture failures, exit1 (`related.txt.gz`). All 45 task10 cases pass. |
| Compiler API diagnostics, before typecheck/build | All nine original task10 source/test files checked, zero diagnostics, exit0 (`diagnostics.txt.gz`, `diagnostics.exit`). |
| Identical parent Vite real-API probe | Normal year1 and extreme year9007199254740991 both generate1, then resolve/collect day3 as expired, inventory0, complete state unchanged; exit0 (`green-public/forage-date-result.json`). |
| `npm run typecheck:app` | Exit0. |
| `npm run build` | App, exported player and standalone bundles complete; exit0. Existing asset-resolution/chunk warnings remain in raw output. |
| Final native keyboard proof | Five Z inputs across three dedicated player.html scenarios; exit0 (`native-neutral-execution.json`, `native-neutral/player.json`). |
| Exact final PNG comparison | Exit0: 3,408 changed pixels confined to marker x128..191/y188..259 (`native-neutral/pixels.json`). |

The added deterministic real-API regressions exercise normal and maximum-safe-integer years, age0 and unexpired age1, exact expiry and later expiry, future-spawn refusal, full session/RNG/owner preservation, actual `handleAction` consumption and expired-overlay hiding. Shared-generator tests cover adjacent-day cleanup, duplicate/backward/invalid cursors, exact three-day cadence and 28/99-day year transitions. Unexpired catches still grant exactly1 and remove the owner, without consuming RNG.

The broader suite's only failures remain the two `actionDebounceFootprint.test.ts` snapshot tests with `TypeError: Cannot read properties of undefined (reading 'registry')` in their unchanged incomplete scene fixture. The original `../inherited-failures.json` records their provenance. They were not skipped, altered or classified as task10's expiry bug. No full-project green claim is made.

## Native evidence and retained screenshot-comparison failure

The initial corrected-source native gameplay run (`native/`) passed every keyboard/state assertion. Its additional exact screenshot comparison failed (`pixel-failure.txt.gz`, `pixel-failure.json`) because virtually the whole canvas changed, not just the marker. The test fixture started at dawn: `playSceneTime.ts` transitions from clear tint to morning alpha0.08 over1500ms, independently of the completed sleep fade. Thus sleep completion alone does not imply pixel-identical background. The failed captures and unchanged assertion script are retained.

The final fixture uses an authored noon dayStartHour12. The existing day-phase tint is white/alpha0, identical to its initial tint, so this unrelated visual transition has no changing pixels. No sleep, polling, timeout increase, result injection, weaker comparison, product rendering change or timing-luck retry was used. `player-neutral.mjs` preserves all keyboard assertions and exact prearmed action/DOM signals; `pixels-neutral.mjs` preserves the original marker-only comparison. This corrected deterministic fixture passed once on the same production SHA.

Final captures: `native-neutral/fish-caught.png`, `catch-energy-refusal.png`, `authored-tool-refusal.png`, `forage-generated.png`, `forage-picked.png`.

Final native proof uses actual Firefox player.html and exportProjectStoreShim, not editor play. Z catches1/spends energy; repeated Z refuses without state/RNG changes; an authored missing-tool rule refuses; a real underfoot sleep event advances the calendar and generates forage, then Z picks it up. All scenarios enable action combat and observe no swing audio/cooldown. No reward or generated owner is injected. The extreme-year proof is the real-API/handleAction regression and identical public Vite probe; native gameplay uses a normal authored calendar and verifies the corrected module's integration. Source hashes in the native receipt match the corrected source. Image attachments could not be visually decoded by this model; exact pixel evidence is not claimed as aesthetic inspection.

## Cleanup and handoff

`source-cleanup.json` and `final-cleanup.json` record exact source/test Git blobs and hashes, parent evidence preservation, all native contexts/browser/server closed, port35433 closed, public Vite servers/caches closed, both owned native caches absent, exclusively owned dist removed after build, and the pre-existing `.vite-cache` preserved. No remote writes, dependency changes, shared-cache deletion or sibling-source edits.

Root `10/SUMMARY.md` now points to this corrected completion evidence. `10/WIKI-PROPOSAL.md` supplies the exact arithmetic and revised test-count notes; shared wiki/INDEX remain parent-owned and untouched. Every original RED/failure is retained (raw output compressed byte-for-byte), and all correction changes/evidence ship in this commit.
