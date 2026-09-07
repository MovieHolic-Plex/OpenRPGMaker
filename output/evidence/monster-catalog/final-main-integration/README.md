# Final main integration - 2026-09-07

## Outcome and provenance

Authorized merge **into** `agent/monster-catalog-0907` in
`/home/main/z-project/rpg-zzu-monster-catalog-0907`:

- First parent (approved feature): `02acae3604b014f8c5a7e9861d03cdda286e35cb`.
- Second parent (exact requested main): `147218a2dcfd5d5996e666395e53626706904a60`.
- Merge base: `142db78e9eb3cd762bacd63cb0324c709392f6ed`.
- Verified product/document tree before adding this evidence:
  `439baa6c205c72b267aedbf9a714d62e0a57c612`.
- The merge commit containing this directory is the deliverable; obtain its exact
  SHA with `git log -1 --format=%H --first-parent -- output/evidence/monster-catalog/final-main-integration`.

`git merge --no-commit --no-ff <second-parent>` returned 1 only for the expected
`openwiki/INDEX.md` conflict. `merge.log` and `conflict-stages.txt` preserve that
result. Ran `npm run openwiki:index` against **all merged wiki pages**, then staged
the result. No ours/theirs replacement or authored wiki content deletion.
`npm run openwiki:index -- --check` passed afterward.

`DESIGN.md` and `openwiki/runtime-project-schema.md` auto-merged. The audit checks
that both equal Git's automatic textual merge. Every other nonoverlapping parent
blob/mode is preserved exactly. There are **no hand-authored product-code or test
changes** in this increment. The only resolution is the generated index; the
remaining new files are this integration evidence.

## Checks (direct child exit status, no pipeline masking)

| Check | Result | Evidence |
|---|---|---|
| App compiler diagnostics: `npm run typecheck:app` | Exit 0, no errors | `typecheck-app.log`, `typecheck-app-exit.json` |
| Focused Vitest, one run, 37 files | 492 passed, 3 known failures; 0 pending/todo; exit 1 retained | `focused.log`, `focused.json`, `focused-exit.json` |
| Feature-changed files within that run | All 257 tests passed (includes monster metadata/appearance/persistence/UI, dependency retry/read contract, Ember, original context, SHA256) | `audit.json` |
| All six changed-upstream Vitest files | All 108 tests passed: event relocation, BGM catalog, event preview/transport, sidebar modes/R1 | `audit.json` |
| Upstream BGM release Node tests | 22/22 passed, exit 0 | `bgm-node.log`, `bgm-node-exit.json` |
| Full production `npm run build` | Exit 0: app compiler, editor, player + SDK, standalone bundle | `build.log`, `build-exit.json` |
| Generated wiki freshness | Exit 0 | `wiki-check.log`, `wiki-check-exit.json` |
| Actual editor browser surface, existing monster QA script | Exit 0, Firefox, 10 PNG captures | `browser.log`, `browser-exit.json`, `browser/` |
| Parent preservation and failure comparison | Passed | `audit.py`, `audit.json` |
| New evidence scripts | Node syntax check and Python compilation passed | Commands below |

Biome LSP diagnostics were attempted on `src` before the build. The tool reported
`Command not found: biome`; installation is prohibited for this task. No LSP-clean
claim is made. The full app TypeScript compiler provided the available diagnostics.
Build warnings about large chunks, mixed static/dynamic imports, and the unresolved
`/generated/battle-reference-forest.png` build-time URL remain visible in `build.log`.

### Retained known test failures (not a green-suite claim)

1. `monsterCollection.test.ts`: `blocks uncapturable troops and excludes captured enemies from EXP` - expected undefined to be `victory`.
2. `monsterCollection.test.ts`: `simulateBattle strict script captures a weakened slime and fails at full HP` - expected 0 to be 1.
3. `monsterEvolutionTypeChart.test.ts`: `writes type charts and species type/evolution data through database tools` - `define_monster_species` rejects ambiguous graphic selection; expected false to be true.

All three match the **complete failure messages and stacks after source-root
normalization** in the already-frozen pristine-main evidence
`../full-suite/upstream/existing-66/batch-08.json`, baseline
`142db78e9eb3cd762bacd63cb0324c709392f6ed`. `audit.json` preserves names, current
messages, and the baseline report SHA256. These are not a new concern, so no
additional upstream checkout or baseline rerun was needed. No assertion was edited,
skipped, retried, or suppressed to make the run green.

### Browser scope and limitations

Executed the unchanged `scripts/qa/monster-metadata.mjs` against an owned Vite
server on port 11973, using its explicitly persistence-disabled `freshProject`
boot, not shared DB content. Passed widths 375, 768, 1024, 1280 and 1440; decoded
preview bounds, reachable controls, keyboard selection, dirty cancellation,
validation, atomic apply, undo/redo, reset, replacement-draft retention and cleanup.
The script recorded **zero remote writes, page exceptions, or HTTP error statuses**,
and stopped its server. PNG existence/signatures/dimensions and DOM/image geometry
were checked by the executable script; this is not a new human visual approval.

Console warnings were **not** clean: the unavailable loopback browser companion
(`/v1/browser/hello`) and persistence-disabled autosave messages remain in raw
results. Every warning string and failed-request shape already occurs in
`../../monster-ui/browser/results.json`; `audit.py` checks this explicitly.

## Reproduction and boundaries

`run-check.py` records the exact argv, cwd, elapsed time, exit code and owned
`TMPDIR=/dev/shm/st_01a0793a/tmp` for each command. Focused Vitest ran with
`--maxWorkers=2 --no-file-parallelism --no-cache`; its full expanded file list is in
`focused-exit.json`. The validation-only `local-only.mjs` preload rejects external
network calls while allowing real loopback HTTP fixture servers and existing
call-through/mocked transports. Inherited credential-related environment variables
are not passed to the validator. No dependencies were installed or changed beyond
the exact incoming upstream package manifests; normal workspace dependency
resolution was used (including ambient Zod), with no temporary type alias workaround.

Browser invocation additionally used `MONSTER_QA_BROWSER=firefox`,
`MONSTER_QA_PORT=11973`, `MONSTER_QA_OUT=.omo/st_01a0793a-browser`. That owned symlink
pointed to `/dev/shm/st_01a0793a/browser` to keep browser artifacts/cache on RAM;
completed artifacts were copied to `browser/`, and the symlink was removed. Raw
capture paths in results therefore identify their original execution location.

Evidence-script validation:

```sh
node --check output/evidence/monster-catalog/final-main-integration/local-only.mjs
PYTHONPYCACHEPREFIX=/dev/shm/st_01a0793a/pycache python3 -m py_compile \
  output/evidence/monster-catalog/final-main-integration/audit.py \
  output/evidence/monster-catalog/final-main-integration/run-check.py
python3 output/evidence/monster-catalog/final-main-integration/audit.py
```

The complete historical 17,108-test suite was **not rerun**. The entire existing
`full-suite/` evidence subtree, including immutable `raw-d932`, is unchanged from
the first parent and is checked by the audit. Shared main, the parent's review
checkout, DB contents, credential files and other agents' branches were not edited.
No push, PR operation, or feature-to-main merge is part of this deliverable.

The all-files `git diff --cached --check` reported whitespace in verbatim Vite/
Vitest/compiler stdout and unified-patch context lines. These raw artifacts are
preserved, not reformatted. `whitespace-check.log` retains those findings; the
product and authored-evidence whitespace check passes with only `*.log` and
`*.patch` in this evidence directory outside its scope.
