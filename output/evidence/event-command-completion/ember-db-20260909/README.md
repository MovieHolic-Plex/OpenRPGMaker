# Ember Supabase persistence gate

Completed for **`rpg-zzu-event-command-ember-20260908`**. The corrected factory
project was saved through `saveProjectToSupabase` and independently reloaded
through `loadProjectFromSupabase` in a fresh OS process. No production source was
changed. This is only the pending Ember DB gate, not a repeat of other campaign QA.

## Provenance and isolation

- Worktree: `/home/main/z-project/rpg-zzu-ember-db-0909`
- Branch: `agent/ember-db-0909`
- Base: `agent/event-completion-20260907`,
  `95513f0b009b4f22b106e931072129c07e3f317f`
- Factory: `src/project/defaults/emberQuestGame.ts`,
  `createEmberQuestProject`; no QA spawn/switch overrides were applied.
- The worktree tooling supplied `.env.local` and port `9841`. Its initial
  `node_modules` symlink was replaced with a private directory copy before
  executing project modules. Vite used `configFile: false`, an isolated cache,
  no watchers/HMR, and no listening browser server.
- Credentials came only from this worktree's `.env.local`:
  `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. The script hardcodes the authorized
  target and never uses the environment's default project id.
- The integration worktree was read-only. No npm script, checkout, or write ran
  there. No push, PR, full build, full tests, or gates were run for this item.
- Receipt timestamps are UTC on 2026-09-08. The `20260909` evidence directory is
  the explicitly requested label (the local workstation date was September 9).

## Exact completion commands and exit codes

Worktree creation, from `/home/main/z-project/rpg-zzu`:

```sh
npm run wt create ember-db-0909 -- --base agent/event-completion-20260907
```

Exit **0**. It created the branch at the base above, copied env, and assigned port
9841. From the new worktree:

```sh
unlink node_modules && cp -a --reflink=auto /home/main/z-project/rpg-zzu/node_modules ./node_modules && test ! -L node_modules && test -d node_modules && test -f .env.local && printf 'Private node_modules directory and .env.local present\n'
node --check scripts/ember-db-0909.mjs
node scripts/ember-db-0909.mjs --save
node scripts/ember-db-0909.mjs --verify
```

Each command exited **0**. The script's language-server diagnostics reported
**No diagnostics found** before execution. The two live commands are the focused
integration verification: they call the real persistence/validation/runtime
resolver modules and assert their results, without network mocks or timing waits.
The save ran once; the verify ran once, in a separate invocation after save exited.
A separate Node evidence audit exited **0**: all JSON receipts parsed, save/reload
hashes and summaries agreed, both receipt exit codes were zero, and all five
added files contained **0** occurrences of the configured anon key. A later
language-server request for the evidence directory was unavailable because the
Biome server is not installed; no dependency was added just for evidence lint.

**Do not repeat `--save`: the target is now occupied.** `--verify` is read-only,
requires the committed save receipt, and can be repeated. The script refuses any
existing target before save, rechecks absence through the real loader immediately
before saving, and rejects any mutation whose row/filter is not the exact target.

## Observed remote sequence

An initial read-only credential/connectivity preflight returned HTTP **200**, then
queried the exact id and returned **0 rows**, at `2026-09-08T18:04:31.363Z`.
`preflight.json` preserves this initial check. The save command independently
repeated both checks and made the immediate real-loader absence check.

| Save process 188199 | HTTP | Observation |
| --- | --- | --- |
| GET projects, select project_id, limit 0 | 200 | Connectivity confirmed |
| GET exact project id | 200 | 0 rows; unused/absent |
| `loadProjectFromSupabase(config)` | 200 | `null`; still absent before write |
| POST projects | 201 | Real project upsert succeeded |
| DELETE maps, exact target filter | 204 | Real mirror replacement path |
| POST maps | 201 | Target map mirror saved |
| DELETE tilesets, exact target filter | 204 | Real mirror replacement path |
| POST tilesets | 201 | Target tileset mirror saved |

The child-table deletes are part of the repository's unmodified full-save path
and were scoped only to the new authorized id. There was no project DELETE and no
write to `rpg-zzu-house-template-gallery` or any other project id. The HTTP wrapper
only checks and records real requests; it does not replace responses or modify
request bodies, methods, or persistence headers. It adds a bounded request timeout.

Save completed at `2026-09-08T18:08:12.304Z`, result `kind: saved`.

| Fresh reload process 192771 | HTTP | Observation |
| --- | --- | --- |
| GET projects connectivity check | 200 | Connected |
| GET exact project id including current_json | 200 | Exactly 1 row |
| Real loader GET current_json/current_sha256 | 200 | Remote snapshot loaded |
| Real loader GET maps mirror | 200 | Real overlay path exercised |
| Real loader GET project_commits tip | 200 | Async read completed before receipt |

Fresh reload completed at `2026-09-08T18:08:27.159Z`. It made **5 GET requests and
0 remote writes**. It did not call the factory or use a local project export.

## Round-trip assertions and exact observed values

Both raw `current_json` and the project returned by the real loader passed the
reference and encounter assertions. Therefore the corrected encounter was stored
in the DB; it was not merely repaired into existence by load normalization.

- `map_mist_forest` -> `ev_forest_slime` -> `ev_forest_slime_fight` contains exactly
  **1** `battleProcessing` command, targeting **`troop_slime_pair`**.
- `system.initialTroopId` also equals `troop_slime_pair`.
- The troop's `enemyIds` and `members[].enemyId` both equal
  **`["enemy_slime", "enemy_meadow_slime"]`**, in that order.
- The real `enemyBattlers(project, troop)` resolver returns exactly **2** battlers:
  `enemy_slime` with **55 HP**, `enemy_meadow_slime` with **60 HP**; both
  `hidden: false`.
- Counts preserved: **5 maps, 13 tilesets, 29 events, 5 enemies, 5 troops,
  1 actor, 8 items**. Schema version **4**.
- Authored starting map/position preserved: **`map_ember_village`, (16, 14)**.
- `validateProjectReferences` completed without throwing;
  `collectProjectReferenceIssues` returned **0** issues.
- `projectLint` returned **0 errors, 3 warnings, 0 info** (**3 total issues**).
  The same warnings were observed on the factory project before saving, the raw
  stored JSON, and the reloaded project. They are `runtime-support:setSelfSwitch`
  on `ev_forest_herb_1` at (5,6), `ev_forest_herb_2` at (12,21), and
  `ev_forest_herb_3` at (25,12), all on `map_mist_forest`.
  **Lint pass means zero blocking errors, not warning-free.** The warnings were
  retained verbatim in the receipts and were not fixed in this DB-only task.

Persisted `current_sha256` exactly matches the actual save result:

```text
b47722b03fa4e0ae2dd6132161ac64617cd6504481a3bd6cf2d15172d16500ef
```

A recursively key-sorted JSON SHA-256 proves the **entire raw stored JSON** matches
what the real saver serialized (Postgres JSON object ordering is not significant):

```text
eea8c28d1e2af25f26867170e0c6ff83c8be0a694203b2e3c1cfd05c440a189f
```

## Evidence and scope limits

- `save-receipt.json`: connectivity, unused target, full HTTP status trace,
  authored observations, save result/hash, process id, timestamp, exit code.
- `reload-verification.json`: fresh process id, one remote row, raw whole-project
  hash equality, raw and loaded validation/encounter observations, zero-write
  assertion, full HTTP status trace, exit code.
- `preflight.json`: first independent read-only connectivity/target observation.
- `scripts/ember-db-0909.mjs`: reproducible, single-target live integration check.

Observed equality covers the entire raw wire payload, plus the counts, encounter,
start state, and validation summary after the repository's normal load repair and
map overlay. Byte-for-byte equality of the normalized in-memory loaded project is
not claimed. The preflight is a read-before-write check, not an atomic database
reservation; no concurrent writer was observed. No browser/editor opening, physical
playthrough, full campaign tests, or full build was repeated. Prior player QA stays
in the earlier `ember/` evidence and is not claimed as newly verified here.
