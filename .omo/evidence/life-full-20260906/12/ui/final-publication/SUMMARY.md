# Task12 final acceptance publication

Task12's scoped core, UI and native acceptance is verified on product commit
`2c136343eae7e39700fe4b0752d96b6e9c89e70d`, branch `agent/life-full-p4`.
This publication changes evidence only. Task52 remains complete; this is not
Task13, Phase4, overall-goal approval, or a PR/push/merge.

The actual publication SHA and parent are recorded in `COMMITTED.json`, written
only after the single evidence commit. That receipt is intentionally excluded
from its own commit; no second commit or amend is implied.

## Accepted evidence and historical boundaries

| Scope | Evidence and outcome |
| --- | --- |
| Historical core RED | `../../core/red-behavior.log.gz`: 4 intended failures / 2 passes. Initial missing-export/fixture failures are not behavioral proof. |
| Historical UI RED | `historical-ui-red/red.log`: 2 failures, exit1. Exact original producer-r2 command/stdout/stderr/exit and handoff copies; originals untouched. |
| Historical rendered-body RED | `../producer-r3/replay/red.stdout`: 3 failures, exit1, counterfactual pre-render replay, not a newly recovered original. |
| Historical core GREEN | Original 269/15 in `../../core/SUMMARY.md`; later 355/18 in `../../../47-48/VERIFY.md`. Neither is a current UI count or a publisher rerun. |
| Independent UI | verify-r5 executed 91/7, including lifeFieldInteraction45 and rendered-body3. verify-r6 reuses byte-identical output on unchanged source/test inputs. |
| Independent native | `../verify-r6/VERIFY.md` confirms corrected general, arena/last-exit and rug groups. verify-r5's earlier verdict, scripts and traces remain immutable history; no old timeout is invented. |
| Direct parent UI | `../parent-final-2c136343/native/ui.*`: 91/7, exit0. |
| Direct parent safety | `../parent-final-2c136343/native/safety.*`: named lifePlacementSafety11/1, exit0. |
| Direct parent native | arena-lastexit, rug and general-replay: all exit0, empty stderr, empty recorded page/harness errors and successful cleanup. |
| Build | Existing source-bound build-r5/build-reuse and build-r3/build.exit=0 are reused, not rerun here. The existing archive is not decoded or restaged. |

`../../red.json`, `../../green.json` and `../../occupancy.json` are the named
acceptance indices. GREEN now says `verified` and names actual command, stdout,
stderr and exit files rather than ambiguous prefixes. Every named-index path
resolves to a published candidate or already committed evidence (the occupancy
command-root field is intentionally a directory).

The historical producer-r2 RED references were not tracked in Git. Their exact
bytes are copied into this permitted publication root, with source/destination
SHA256 equality in `VALIDATION.json`. No historical logs, failed attempts,
snapshots, verdicts or assertions were rewritten.

## Direct domain audit

The publisher read actual parent command/output/exit and before/after/cleanup
receipts and parsed full native records and raw slots. Mechanical checks confirm:

- General: shed placement spends 10 gold, upgrade reaches level2/gold470,
  relocation reaches (11,6), and plot/edge/rendered-NPC refusals preserve gold.
  The target-overlap observation has fractional rendered movement, not just an
  unrelated NPC at boot. Both building and decoration survive the saved/load UI.
- Arena: table rotates to current orientation left at (7,9), then moves to
  (5,6). Current orientation comes from owner/slot fields, not next-action text.
- Last exit: refusal leaves foot (1,2), gold500, both authored blockers and no
  new decoration; raw inventory retains hoe1/potion8.
- Rug: passage at foot (8,9) intersects actual cells (7,9)/(8,9); the origin
  passage does not. Live state diverges to foot (8,10)/rug (7,11), then Load
  restores foot (8,9)/rug (7,9). Slot1 and newly written slot2 have equal complete
  parsed owner/rights/foot/inventory/gold domains, matching actual raw sessions.
  Both recorded storage writes start absent (beforeBytes0), report changed=true,
  and retain distinct slot numbers. Parent afterBytes are 3736 and 3794; these
  are not substituted with the independent verifier's differently timed slots.

The first parent general invocation exited1 with ENOENT for a missing copied
fixture. Its original command and failure bytes remain published. A separate
`general-replay` changes exactly one input read path to the verified fixture;
script comparison proves no native action/assertion or product change. The
already passing UI/arena/rug groups were not rerun for that input-path fix.
Safety11 is a separate direct parent result. No tests, build, native execution,
dependency operation or image interpretation was performed by this publisher.

## Identity, safety and commit protocol

- All 14 code/test and 3 wiki SHA256 values match build-r5 COMMITTED.
- All 9388 present tracked non-evidence files match the accepted Git blobs;
  there are zero sparse-absent tracked non-evidence paths. Initial index and
  tracked diff are empty. Product, tests, wiki, scripts and configs stay read-only.
- Parent scripts equal verify-r6; fixture hashes, command script hashes and
  preserved stream byte counts match their actual inputs. The sole general
  replay input-path difference is explicitly recorded.
- `PRESERVATION.json` freezes immutable candidate identities before staging.
  `ALLOWLIST.txt` enumerates every exact path to stage; `MANIFEST.json` records
  SHA256, byte size and Git blob identities before staging. Its self-identity
  cannot be embedded recursively and is recorded afterward in COMMITTED, along
  with every other actually committed blob.
- Bounded complete UTF-8 candidate scans found no credential/private-reasoning
  signatures. Only permitted roots are collected. Public DAG task instructions
  are retained, not model configuration or private reasoning. No Task13 data,
  env files, credentials, caches or unrelated changes are included.
- `PNG-HASHES.json` records 99 PNG signatures, dimensions and hashes mechanically.
  Visual judgment is reused from verify-r6/png-read.json, not reinterpreted here.
- LSP diagnostics are unavailable because the configured Biome server is not
  installed. No dependency installation was performed. JSON parsing, reference,
  byte-identity and domain validators provide the metadata checks instead.
  A scan of the generated report matched its own two documented reasoning-tag
  regex literals; these are scanner definitions, not private reasoning. The
  report is scanned excluding only its `rules` object, whose definitions were
  separately reviewed; no evidence payload is excluded.
- Source/docs whitespace checks are separate from immutable raw streams, which
  retain original trailing spaces/blank lines. Metadata syntax and reference
  validation do not relabel raw-output whitespace as a product failure.

`VALIDATION.json` includes a publisher-validator correction: its initial raw-slot
lookup used a nonexistent field and stopped before publication. The read-only
lookup was corrected to the actual schema; successful validation followed. No
product, historical receipt or native assertion was changed.

## Cleanup and limits

All six parent cleanup records have empty errors and their scratch paths are
absent. The parent root `/dev/shm/life-t12-parent-01a0727b` is absent. Existing
shared lock/dependencies/browsers remain untouched. The publisher creates no
server or browser; its own temporary read/validation files are removed after
commit, with the post-commit cleanup check recorded in COMMITTED.

Only the explicit safe allowlist is staged. Post-commit checks require the real
SHA/parent, exact changed paths and blob identities, unchanged protected source,
unchanged historical evidence, and an empty index. COMMITTED is an intentionally
local, unstaged post-commit receipt under this evidence directory.
