# U05 evidence-only package

This commit packages already verified evidence for code commits
`8f9f6c222f7ecdbfcf1a3366d33be54ece867670` and
`b5521e4d73ce17b8adc971c90096217419c2c403`. It does not amend or change source/test
files and does not repeat application tests, typechecks, builds, or browser QA.

## Contents and byte preservation

- `tracked-files.txt` is the exhaustive repository-relative allowlist staged for
  this evidence commit. No directory was force-added recursively.
- `package-index.json` records the byte length and SHA-256 of every packaged
  artifact except that index itself. It also records original decoded bytes for
  compressed artifacts and the selection/credential-check result.
- `manifest.md` / `manifest.json`, `commit-receipt.json`, `cleanup.json`, and
  `wiki-amendment.md` are preserved original handoff documents. Original RED,
  follow-up RED/GREEN, accepted editor/player observations, immutable inputs,
  source hashes, and the significant fixture/driver failure receipts are retained.
- `final-equivalence.log.gz` losslessly stores the 2 MB stale-fixture assertion
  dump. Integration additionally compresses fourteen raw logs/summaries whose
  captured trailing whitespace or final blank lines would fail the repository
  whitespace gate. Their bytes are not edited. The original uncompressed paths
  remain in historical prose; each gzip entry maps its original path, byte
  length and SHA-256 through `decoded` in the package index. Use `gzip -dc` to
  read any such artifact. Other artifacts, including all JSON fixtures, remain
  byte-for-byte at their original relative paths.
- Screenshots/videos are deliberately NOT included. Historical JSON/Markdown
  references to image filenames are retained as recorded, not represented as
  bundled visual evidence. No raster/video payload, credentials, `.env` files,
  Vite cache, transient Playwright output directory, stale WIP patch, or unrelated
  ignored directory is included.
- Original `original.test.ts` / `original.fixture.ts` are archival source copies,
  not runnable tests at these paths. Vitest includes `test/**/*.test.ts` and the
  TypeScript project includes `src` and `test`; these archives are outside both.
  Shipped tests continue to import only tracked `test`/`src` modules, not evidence.

Verify package bytes only (does not execute any application validator):

```sh
node .omo/evidence/event-command-remediation/U05/verify-package.mjs
```

The index and allowlist describe this original evidence package. Fresh
integration runs live separately under `supervisor/`, whose `summary.json`
records their inputs, results and cleanup. They do not overwrite these receipts.

The existing manifests intentionally retain their recorded absolute worktree and
now-deleted temporary paths. `accepted-fixtures/` contains the portable copies;
`acceptance-input-provenance.json` and `acceptance-normalized-hashes.json` explain
which inputs were actually consumed and why the final fixture correction required
new acceptance runs.

## Reproduce recorded commands (not run during packaging)

Use a **disposable checkout** with the two code commits applied. The archived
runners write fresh reports to fixed evidence paths, so do not run them over the
only copy of this historical package. Dependencies and Firefox must already be
installed by the repository's normal setup. Run from the repository root.

`qa-runner.mjs`, `playwright.config.mts`, `typecheck.mjs`,
`fixture-equivalence.mts`, `input-normalized.mts`, and the historical isolated-map
runner are included. The runtime scenario and H0 fixture CLI are tracked in the
code commits/repository; they are not duplicated here.

```sh
E=.omo/evidence/event-command-remediation/U05
RUN_ROOT=$(mktemp -d /tmp/event-command-u05-reproduce-XXXXXX)
# In this disposable copy only, replace the historical root pointer.
printf '%s\n' "$RUN_ROOT" > "$E/owned-root.txt"
export E2E_FREEZE_DEV_SERVER=1
export VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= VITE_SUPABASE_USE_PROXY=0
export VITE_CACHE_DIR="$RUN_ROOT/fixture-cache"

# Pure, positional H0 CLI and original-fixture equivalence.
node node_modules/vite-node/vite-node.mjs --script \
  scripts/prepare-event-command-remediation.mts U05 "$RUN_ROOT/fixtures"
node node_modules/vite-node/vite-node.mjs --script \
  "$E/fixture-equivalence.mts" "$RUN_ROOT/fixtures/project.json"

# Original accepted five editor cases, excluding the separately recorded increment.
U05_RUN_NAME=reproduce-editor node "$E/qa-runner.mjs" editor \
  'U05 (map:|common:|troop:|missing state)'
# Reads the editor-map.json export just produced, then exercises seven player cases.
U05_RUN_NAME=reproduce-player node "$E/qa-runner.mjs" player
# Additional real inline-variable creation path.
U05_RUN_NAME=reproduce-inline node "$E/qa-runner.mjs" editor \
  'EXP inline variable creation'

# Main narrow/adjacent suite (current tree additionally contains the inline case).
npm test -- test/eventCommandRemediation/U05.test.ts \
  test/actorM2CommandBodies.test.ts test/eventEditorStagedState.test.ts \
  test/learnSkillCommandBody.test.ts test/changeExpCommandBody.test.ts \
  test/commandEditModalPreview.test.ts --maxWorkers=2
# The recorded follow-up focused command.
npm test -- test/eventCommandRemediation/U05.test.ts \
  test/changeExpCommandBody.test.ts test/commandEditModalPreview.test.ts --maxWorkers=2
node "$E/typecheck.mjs"
```

To reproduce against archived inputs rather than regenerate, copy the exact
`accepted-fixtures/*.json` files to `$RUN_ROOT/fixtures/`. The accepted player
source hash in `player-scenarios.json` matches `accepted-fixtures/editor-map.json`.
Do not replace that export with the unedited CLI fixture.

For the original RED, use the recorded original base in a separate disposable
checkout and place the two archival source files back under their original
`test/eventCommandRemediation/U05.*.ts` paths. `prep-manifest.md` contains the exact
RED invocation. Do not import the archival Vitest module through the fixture CLI;
that intentionally reproduced fixture failure is separately recorded.

After a reproduction run, retain the resulting receipts elsewhere and remove
only the newly created `$RUN_ROOT`. The archived cleanup receipts describe the
original executions, not a future reproduction.
