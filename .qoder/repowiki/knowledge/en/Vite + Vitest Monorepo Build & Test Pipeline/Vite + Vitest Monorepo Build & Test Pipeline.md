---
kind: build_system
name: Vite + Vitest Monorepo Build & Test Pipeline
category: build_system
scope:
    - '**'
source_files:
    - package.json
    - vite.config.ts
    - vite.player.config.ts
    - vitest.config.ts
    - vitest.live.config.ts
    - playwright.config.ts
    - tsconfig.app.json
    - pnpm-workspace.yaml
---

RPG ZZU uses a single-root Vite workspace with two parallel build targets — the editor app and a standalone player export — driven entirely by npm scripts, TypeScript, and Vitest/Playwright for testing. There is no Makefile, Dockerfile, or CI pipeline in the repository; the system is local-first and script-driven.

**What system/approach is used**
- **Build tool**: Vite 6 (`vite.config.ts` for the editor, `vite.player.config.ts` for the player). Both use `--configLoader runner` so they can be invoked from any directory inside the repo.
- **TypeScript**: Two tsconfigs — root `tsconfig.json` extended by `tsconfig.app.json`, which restricts compilation to `src/` (excluding `test/`, `evals/`). The default `build` script runs `tsc --noEmit -p tsconfig.app.json` before Vite.
- **Package manager**: pnpm workspace (`pnpm-workspace.yaml`) with a flat lockfile at the root; `package.json` declares all devDependencies centrally.
- **Testing**: Vitest (`vitest.config.ts`) for unit/integration tests under `test/**/*.test.ts`; Playwright (`playwright.config.ts`) for e2e suites under `test/e2e`. A separate `vitest.live.config.ts` intentionally excludes live Supabase-dependent tests from the default run.
- **No containerization / CI**: No Dockerfiles, GitHub Actions, Jenkins, or shell-based build pipelines are present.

**Key files and packages**
- `package.json` — npm scripts that orchestrate dev, build, preview, typecheck, test, and construction harnesses.
- `vite.config.ts` — editor build: `@` alias to `./src`, dev server on configurable port (env `DEV_SERVER_PORT`, default 9999), CORS restricted to localhost, `/api/ai` proxied to `https://yunwu.ai/v1`, custom `aiActivityDiskPlugin` middleware writing AI activity logs to `output/ai-activity/`.
- `vite.player.config.ts` — player build: shims editor-only modules via resolve aliases, outputs to `dist/export-player/` with hashed assets and a `player-manifest.json`.
- `vitest.config.ts` — node environment, 15 s test timeout, excludes `lakeVillageRebuildFinal.test.ts` (requires live Supabase).
- `vitest.live.config.ts` — overrides include to only the live Supabase test with 120 s timeouts.
- `playwright.config.ts` — spins up `npm run dev` on `127.0.0.1:<port>` as a webServer fixture, Chromium-only, traces/screenshots on failure.
- `tsconfig.app.json` — extends root tsconfig, includes only `src/`.

**Architecture and conventions**
- **Dual-target builds**: `npm run build` compiles types, then runs `vite build` (editor) followed by `npm run build:player` (standalone Phaser player). The player config replaces editor-only imports with lightweight shims under `src/player/`.
- **Dev server hardening**: The editor's dev server rejects non-local origins, ignores `.omo/`, `output/`, `tmp/`, `test-results/` from file watching, and exposes a safe `/__rpgzzu/ai-activity` endpoint guarded by an id whitelist regex.
- **Environment-driven ports**: `DEV_SERVER_PORT` controls both the Vite dev server and the Playwright `baseURL`, keeping e2e and manual dev in sync.
- **Test isolation**: Live/dangerous tests are opt-in via a separate config; default suites run headless in Node against happy-dom where applicable.

**Rules developers should follow**
- Use `npm run dev` (or set `DEV_SERVER_PORT`) for development; do not change the default port without updating `playwright.config.ts` accordingly.
- Add new source files under `src/` only; `tsconfig.app.json` will pick them up automatically.
- New unit tests go under `test/*.test.ts`; if a test writes to remote Supabase, move it to `test/lakeVillageRebuildFinal.test.ts` and run via `npx vitest run --config vitest.live.config.ts`.
- To add a new build target, create a `vite.<name>.config.ts` and expose an `npm run build:<name>` script that calls `vite build --config vite.<name>.config.ts --configLoader runner`.
- Do not introduce Makefiles/Dockerfiles — keep everything in npm scripts and Vite configs.
- When adding editor-only imports to the player build, mirror the shim pattern already used in `vite.player.config.ts` resolve aliases.