# mdc-server save routing repair — 2026-09-18

The live `mdc-server:9888` listener was Vite preview launched by the user systemd
`rpg-zzu.service`. Its HTML had no `__OPRN_BRIDGE__`/browser bridge. With the current
repository selector this is a memory adapter without a persistence target.

Changed `scripts/start-preview.mjs` (also used by `npm start`) to launch the existing
SQLite HTTP host. Explicit existing project selection is required; missing storage
fails before serving an editor. No live project was selected or replaced.

Validation:
- `node --check` for the launcher and new regression contract: passed.
- Missing project launch: exit 1 with configuration instructions.
- `npm run build:packaged` and `node scripts/build-electron.mjs`: exit 0, with
  existing bundler warnings (circular chunks/CSS/import.meta).
- Browser exercise on port 19883 with a SQLite backup and copied assets from an
  existing project: team login, bridge ready, save the same document, exact
  serialized content and SHA comparison, browser reload and load again. Results
  in `proof.json`; no page errors. Original project data was not written.
- Regression suite `test/startProjectHost.test.mjs` added but not run; suites and
  gates require explicit user instruction under AGENTS.md.

Deployment still requires identifying which existing user project should back
mdc-server, then setting OPRN_PROJECT_DIR and restarting with the bridge build.
The existing shared-host login and AI restrictions remain applicable.
