# P2 — Local SQLite project store (plan)

Source of truth for scope: `docs/superpowers/specs/2026-09-15-oprn-local-sqlite-store-design.md` §3 (guard policy), §4 (storage shape + rules), §5 (port and adapters), §8 P2 row, §10 (engine choice).
Base: branch `local-store/p2`, stacked on P1 (`persistence/p1-port`, PR #845) because P2 reuses `src/project/persistence/core/**` for merge/canonical JSON.

Gate for this stage (from the spec): the local adapter passes the shared contract test, and a headless tool opens a project folder.

## Deliverables

1. `electron/local-store/` — Node-only library: §4 schema (meta, project, maps, commits, changes, ai_activity_logs, ai_conversations, ai_analysis_runs, assets), save rules (single transaction, sha256 CAS, replace changed map mirrors, bump revision, per-map conflict), PRAGMAs (`journal_mode=WAL`, `synchronous=FULL`, `busy_timeout=5000`, `foreign_keys=ON`), `dataVersion()`, `VACUUM INTO` backup. No `electron` import — node scripts and headless agents open the same folder with the same library.
2. `scripts/oprn-store.mjs` — CLI: `init`, `import-json`, `import-package`, `export-json`, `backup`, `info`.
3. Contract test gains a local (real SQLite in a temp dir) adapter: 11 + 11 + 11 = 33 cases.
4. §3 guard policy: SQLite driver import allowed only under `electron/local-store/**`; `electron/**` may import only `src/brand.ts`, `src/project/types/**`, `src/project/persistence/core/**`; `src/**` may import from electron only `electron/shared/**`; renderer adapter file names must not contain `sqlite`; the existing `src/project` + `src/editor` local-DB ban stays.
5. Headless tools open a folder: `--project-dir <dir>` on `scripts/rpgzzu-tools.mjs` and the MCP servers.

## Decisions (with reasons)

- **D1 — driver isolation.** `node:sqlite` `DatabaseSync` sits behind a narrow `Driver` interface in `electron/local-store/driver.ts`, loaded by `await import("node:sqlite")` inside the open path. The API is still flagged experimental; isolating it means a future swap to `better-sqlite3` touches one file, and the repo's test/tsc graph never imports the experimental module unless a store is opened. `@types/node@26.1.1` ships `sqlite.d.ts`, so no new dependency.
- **D2 — no port widening in P2.** Spec §5 defers `ProjectTarget = remote | local` to P4 ("the compiler then points at every place that constructs or compares a target"). Widening now would ripple through ~8 store read sites (`target.projectId`, `target.url`) that P4 is designed to absorb. So `ProjectRepository`/`ProjectTarget` stay untouched in P2, and the local adapter joins the contract test as test-side glue (`test/localStore/localRepositoryFixture.ts`) that maps port calls onto the local library. The guard keeps product code (`electron/**`) from importing the renderer port, which is what P4 will wire through IPC.
- **D3 — assets table now, port `assets` group later.** §4 lists the `assets` table, so the schema and the byte-addressed `assets/` folder land in P2; the port's `assets` group is P3's media separation, so `ProjectRepository` is not extended here.
- **D4 — real SQLite in tests.** Unit tests open a real `project.sqlite` under `mkdtemp`, never a mock, because the CAS/transaction/revision behaviour is exactly what a mock would fake. Every temp dir is removed in the same test file's teardown.
- **D5 — import-json/export-json byte stability.** `project.current_json` stores the serialized text verbatim and `export-json` writes `current_json` unchanged, so a round trip is byte-identical and the sha256 stays valid (spec §4: "직렬화 텍스트를 그대로 저장해 바이트 안정").

## Increments (each ends in one commit)

- **I1** core library + schema + CAS save/merge: RED `test/localStore/localStore.test.ts` (module missing) → GREEN; asserts round trip, sha256 == hash of serialized text, revision bump, maps mirror rows, byte-stable export.
- **I2** conflict + external change: RED `test/localStore/conflict.test.ts` → GREEN; same-map concurrent edit returns `kind:"conflict"` with the map id, disjoint map edits merge and both survive, `null` target is `not-configured`, `dataVersion()` changes after another connection writes.
- **I3** CLI `scripts/oprn-store.mjs` + real terminal evidence (`init`, `import-json`, `info`, `export-json`, `backup`, `import-package`).
- **I4** local contract fixture + contract test registration (33 cases).
- **I5** guards per §3 (`test/noLocalProjectDb.test.ts` policy rewrite + new boundary test).
- **I6** headless `--project-dir` (tools + MCP) + terminal evidence.
- **I7** final verification: contract 33, guards, `tsc --noEmit -p tsconfig.app.json`, root tsc A/B vs the P2 base commit, `npm run test:changed -- <base>`.

## Verification commands

```
npx vitest run test/localStore --reporter=dot
npx vitest run test/persistence --reporter=dot
npx vitest run test/noLocalProjectDb.test.ts --reporter=dot
npx tsc --noEmit -p tsconfig.app.json
node scripts/oprn-store.mjs init <tmpdir> && node scripts/oprn-store.mjs info <tmpdir>
node scripts/rpgzzu-tools.mjs --list
```

## Left for later stages

- P3: media out of JSON (`UploadedAsset.ref`, accessors, 58 sites, migration) and the port's `assets` group.
- P4: `ProjectTarget` union + Electron adapter over IPC (`window.oprn`), start screen, window/lifecycle.
- The IPC channels in `electron/shared/**` are only created when P4 needs them; the guard test lands now so the boundary cannot be crossed before that.
