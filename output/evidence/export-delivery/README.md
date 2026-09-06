# Dev export delivery - st_01a075e7

Baseline: `d1d5e7e9`; branch: `agent/export-delivery-6077`.

## Delivered behavior

- Normal Vite dev startup needs no manual player build and no package-script change. The first `/export-player/` or `/standalone-player/` request builds both existing player configurations in child Vite processes with `NODE_ENV=production`, then writes the existing fail-closed SDK manifest.
- Each server owns a temporary directory under its Vite cache. Concurrent requests share one build promise. Relevant source/public-file changes invalidate it. Changes during a build cause another build before delivery. Failed builds return an error, never stale output or the editor SPA fallback. Teardown removes the private build directory.
- Standalone export rejects missing required project/CSS assets, empty bytes, HTML document bodies and HTTP `text/html`. Errors name the ingredient path. Nonempty path-byte test stubs remain supported; this is not a media-decoder/signature-validation framework.
- `url(#battle-flash-tint)` remains an SVG fragment and is never fetched. Existing uploaded video/cinematic paths are preserved; public MP4/WebM/OGV MIME types are recognized.
- The CLI now calls the same standalone exporter and does not write an artifact on ingredient failure. The existing menu already catches rejection before download; no menu edit was needed.
- No edits to `package.json`, `webExportAssets.ts`, `inlineAssetStore.ts`, `exportEntry.ts`, battle resource selection, wiki or authored DB/content.

## RED before corresponding production edits

| Log | Observed failure |
| --- | --- |
| `red-dev-endpoints.log` | All three normal-dev ingredient endpoints returned editor HTML with HTTP 200. |
| `red-standalone.log` | 11 failed assertions: missing PNG/font, HTML-200 JS/CSS/media, text/html MIME, empty ingredients and SVG fragment fetch. |
| `red-cli.log` | CLI exited successfully and wrote a 2.34 MB HTML artifact with zero included assets and 714 missing assets. |
| `red-build-environment.log` | The first implementation's in-process build inherited the host's `NODE_ENV=test`, not production. Fixed with isolated child builds rather than mutating the dev server environment. |

Committed command logs have trailing whitespace normalized for git; untouched originals remain locally as `*.raw.log`. RED milestones were reported immediately in the task conversation. CLI harness setup initially failed alias resolution; that was corrected before capturing the actual CLI RED above.

## Final GREEN

- `green-tests-final.log`: 206 tests pass across 10 files, including deterministic build-flight sharing, source invalidation, rebuild failure/retry, child build environment isolation, standalone/CLI failures, ZIP fail-closed behavior and cinematic/video contracts.
- `green-sdk-contract.log`: all 33 artifact/manifest contract tests pass.
- `typecheck-app-final.log`: `npm run typecheck:app`, exit 0.
- `build-app-final.log`: `npm run build:app`, exit 0.
- `green-dev-production-packages.log`: actual normal Vite config, strict HTTP port **16477**, cache **`.vite-cache/export-delivery-16477`**, four Node assertions pass. Both production player builds run through the dev plugin on cold concurrent requests. All seven manifest files match their declared byte counts and SHA-256 hashes; an absent player file returns 404.
- `green-cli-real.log`: standalone production bundle build and real CLI execution using the installed vite-node runner, exit 0; 715 assets, 65.85 MB HTML. Generated HTML is local ignored evidence, not committed.
- TypeScript LSP: no diagnostics on all 10 changed code/test files. The final changed plugin/concurrency/endpoint files were rechecked after the production-child adjustment.
- `git diff --check`: clean.

### Final real HTTP responses and export artifacts

| Endpoint | Status | Content type | Bytes |
| --- | --- | --- | ---: |
| `/export-player/sdk-manifest.json` | 200 | application/json | 493458 |
| `/standalone-player/standalone.js` | 200 | text/javascript | 3535956 |
| `/standalone-player/standalone.css` | 200 | text/css | 291497 |

The same functions called by the export menu succeeded using actual HTTP ingredients:

- Standalone: **69,048,131 bytes**, **715 assets**, **zero missing assets**.
- ZIP: **49,633,312 bytes**, **722 entries**.
- Final cold integration run: approximately 116 seconds including both builds and both package creations under concurrent verification load.

The initial expanded HTTP smoke harness mistakenly rejected the legitimate SDK `player.html` file. Only that assertion was corrected; its failed output remains locally at `http-packages-harness-failure.log`. The final GREEN run above uses production child builds.

## Limits and handoff

- Actual menu clicks, browser/gameplay and full repository gates are assigned to the lead, not claimed here.
- Builds retain unresolved-public-URL warnings (player configs deliberately leave public URLs for packaging), chunk-size/dynamic-import warnings, and the app's record-picker circular-chunk warning. No warnings were suppressed.
- No monitor tool is exposed in this child session. Long commands were bounded, their actual exit statuses preserved, and output captured to the logs above.
- No process-global environment changes are needed for builds; each child explicitly uses production NODE_ENV. No package-script coordination is required.
- Port 16477, owned server processes and temporary `export-players-*` directories were checked after teardown; see `cleanup.log`. No owned server remains.
