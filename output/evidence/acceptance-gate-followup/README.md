# Acceptance verification follow-up: final evidence

The requested real-model coverage investigation, canonical saved-project
verification, shipping-player comparison and complete gate diagnosis are
accounted for. Introduced DOM/transport-fixture regressions were repaired.
**The repository-wide gates remain red; this packet does not claim all tests
pass.** The final integrated code/test source is
`ce551ee45d5c61b02bbb13bef7b8aa5a77bb061e`; a later documentation commit may contain
this packet without changing those executable inputs.

PR #691 was merged externally as `b9ed935bc` while gate verification was still
underway. This session did not merge it. The repairs are on
`fix/acceptance-gate-regressions` for a separate follow-up PR. The user's final
authorization is **commit and PR only, not merge**.

## Complete runs, not inferred green totals

| Executed source | Files | Cases | Passed | Failed | Skipped | Actual test exit |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Baseline `e05a99b91` | 1,826 | 18,328 | 18,089 | 216 | 23 | 1 |
| First candidate `5bdc4630` | 1,828 | 18,352 | 18,006 | 323 | 23 | 1 |
| Repaired candidate `0798a67b` | 1,829 | 18,363 | 18,128 | 212 | 23 | 1 |

The baseline and repaired full run used the same normal test inventory rules,
four isolated threads, private network/devices/caches and unchanged test/hook
deadlines. No file was removed from discovery, no extra skip was added, and no
new unhandled-error reason appeared. The final comparison retains every changed
case/reason rather than comparing failure counts alone.

The four-thread instrumented baseline took 2,511 seconds; the repaired candidate
took 4,250 seconds. The old 1,200-second observation limit was insufficient to
establish completion or a globally hung runner. These measurements do not assign
every timing difference to host load or claim the original monolithic command
passed. The gate wrapper buffers sequential stages; actual child receipts and
independent file/case inventories are the authority.

Files: `baseline-summary.json`, `baseline-coverage.json`,
`candidate-0798-summary.json`, `candidate-0798-coverage.json`,
`candidate-0798-comparison.json`.

## Repairs and later-source validation

- `0798a67b`: faithful select identity/options/index/value and node adoption.
  Enhancement remains enabled. Affected validation restored 119 previously
  failing candidate cases; all 95 direct custom-select crash records disappeared.
  The affected 21-file run was 274 passed / seven baseline failures, not green.
- The ghost fixture now answers request coverage and non-streaming author
  execution separately. Actual requests/events identified fixture-rejected
  execution and retry backoff; the ten-second deadline was not increased.
- `e01811cfb`: the swap fixture creates the two actual selectable events before
  rendering. Existing canonical-field/runtime assertions and all 14 case names
  remain. The lead reran the entire file: 14 passed, exit 0
  (`selector-e018-receipt.json`).
- `dd9346e5`: merges incoming `8ab349dfc` into the follow-up branch, preserving
  both coverage and independent-review protocol/approval assertions.
- `ce551ee4`: respects incoming working-before-pending priority while proving
  actual keyed-row movement through status changes, plus removal and cleanup.

On `ce551ee4`, the lead directly ran:

| Scope | Observed |
| --- | --- |
| App typecheck | Exit 0 |
| Seven focused files | 109 passed, zero failed; exit 0 |
| Full `npm run build` | Exit 0, including editor, player/SDK, standalone and runtime archive |
| Actual Firefox `player.html` comparison | Eight checkpoints, zero page errors; exit 0 |

The seven files are observability, request coverage, fake-DOM contracts, staged
state, independent review, session review and approval lifecycle. See
`lead-integrated-validation.json` for the exact command and direct monitor
completion extract. These are scoped validations of the integrated source,
**not a relabeled full-suite run of that later commit**.

## Red surface gate and remaining differences

The lead also executed the actual surface gate on both incoming `8ab349dfc` and
integrated `ce551ee4`. Each accounted for ten axes / 115 assertions:
**107 passed, eight failed, exit 1**. Every named assertion status matches.
The additional shell snapshot failure relative to the older baseline already
exists on incoming main. See `surface-current-main-comparison.json` and both
surface receipts.

Equal failure identities do not make every changed reason cosmetic. The native
select correction exposes invalid IDs and placeholder-only controls in the
already-red commit-probe fixture. Some probe floors decline because nonexistent
records no longer manufacture selections/commits. Product listeners are unchanged;
the floors and snapshots were not lowered or refreshed to hide this coverage
debt.

`final-delta-report.md`, `final-delta-cases.json` and
`final-delta-validation.json` account for all 17 final reason records:
seven load-sensitive deadline records, two existing synchronization/load records,
six presentation-only existing failures, the native-contract/probe debt, and the
staged-selector fixture subsequently repaired at `e01811cfb`.

Publication export remains red in its one narrow candidate control:
15,374.968 ms against the unchanged 15,000-ms deadline; baseline was
14,225.303 ms. Its runtime and computed-collector closures are identical, but
the exact slow stage remains unproven. Other timing controls, raw values,
multiplicity, source skips and existing unhandled failures remain recorded.
No retry was used to replace those outcomes with a lucky pass.

## Diagnostic trace integrity

The full test command finished, but the first summarizer failed on one damaged
optional `collected` diagnostic for `undoHistory.test.ts`, line 11562.
The original trace was retained byte-for-byte. Only the intact appended `start`
frame was recovered into a separate derived stream; no missing diagnostic or
test result was invented.

Independent raw JSON, queued/end file identities and terminal count all agree
on 1,829 files. That module's 15 cases passed in the untouched test report.
The captured-before, after-recovery and recorded raw trace SHA-256 all equal
`96aa4f42eaf8bbb082f1dbaaf0b97321a5eb6fa25518e819761017f1864bc3f1`.
See `trace-recovery.json` and `lead-trace-integrity.json`.

## Real model, remote save and current player

The earlier actual Gemini/Codex authoring and independent Supabase reload are
preserved in Git at `5bdc4630` / `e01811cfb`. Incoming main removed those tracked
run artifacts; this follow-up does not reintroduce the large output tree.
Only the three hash-checked handoff inputs were restored locally under ignored
paths for the final player run.

- Owned project: `oprn-qa-functional-48c68b5f-2d4`.
- Remote SHA-256:
  `b03e73c068b972a35221b3e84447f296f54986552da1743997a1f32e452ce30c`.
- Canonical file SHA-256:
  `ce9695ca460f438ffa130798d8f887257de4eba1a792a50dc91fce2c7a3380c4`.
- Current player source: `ce551ee4`; script blob:
  `60c1611b297d4caeb1b666ed8f7c64386656153c`.
- New game: Village `(10,8)`, 100 gold, no potions/antidotes.
- Purchase: two potions, 80 gold.
- First and second reward interactions: antidote stays one.
- Authored outgoing/return gates work; final state is Village `(10,8)`,
  80 gold, two potions and one antidote.

`integrated-player.json` records all eight checkpoints and three distinct handled
action receipts. The run uses real direction/action input hooks and keyboard
shop/dialogue controls, not teleport or money/inventory assignments.

The broader authored request still has unsupported/unquoted semantic obligations.
Those remain unverified; quote coverage is not universal semantic proof. Actual
project persistence was verified, but the separate optional remote commit-log
receipt reported `persisted=false`. Potion-use/optional farming-capture fields
and visual-design quality were not certified.

For reproduction, restore the historical handoff into an empty, ignored local
directory without staging the old output tree:

```bash
git archive e01811cfb6e3ca72f933b4a729b5894345b4bd41 output/evidence/acceptance-live/handoff | tar -x
node scripts/qa/acceptance-live-player.mjs output/evidence/acceptance-integration-final/player
```

Complete raw reports, diagnostic timelines and byte-identical runner helpers are
retained in the local baseline/candidate worktrees. This compact packet preserves
the full comparison and case-level dispositions without committing the private
caches or the 242-MB optional diagnostic trace.
