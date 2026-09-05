# Phase 1 Mac onboarding producer evidence

## Delivered

Implementation commit: **`af52a52a1acee3cd415eea79bfde26294e4af163`** (`feat: add private Mac launcher and setup`).
Branch: `agent/mac-onboarding-p1`. Base: `f11d6febb662ce47c1737ac914258b0c886d4466`.
Task: `st_01a072e7`. Execution date: 2026-09-06 UTC.
Scoped worktree: `/home/main/.herdr/worktrees/rpg-zzu/wish-mac-mac-onboarding-p1`.
Host: Linux x64, Node **v24.11.1**, npm **11.6.2**. This is **not macOS/Finder QA**.

- Added executable `Start RPG Maker.command`, `scripts/mac-launch.mjs`, and `scripts/setup-local.mjs`.
- Added `mac:launch`, `setup:local`, and `test:mac-onboarding` npm scripts; no engines, lockfile, application UI, application source, content, or existing env-file changes.
- Added focused Node tests and a narrow Node 24 `macos-latest` workflow (path-filtered PR/manual dispatch, read-only repository permission, no DB secrets).
- Updated quickstart/testing wiki and regenerated its index.
- No system tools installed, no dependency repair performed, no PR/push/merge. The provisioned `node_modules` link remained in place.

## Runtime and private-configuration contract

Both new entrypoints require Node 24 and npm. `npm ci` runs only if the `node_modules` path is absent, including preservation of dangling links and partial installs. Recovery instructions leave the decision to move a broken install aside to the owner. Child commands receive cancellation signals and are reaped.

The wizard masks the key in a real Terminal. It accepts an anon-role JWT or publishable key, an HTTPS Supabase origin (HTTP loopback only), and an existing application project id. It rejects admin/service-role/secret/database credentials, URL credentials, paths, queries, fragments, controls and unsafe remote HTTP. Project ids support Unicode, spaces, dollars and URL-sensitive characters; quotes, backslashes, controls and ids over 200 characters are rejected rather than ambiguously serialized.

The only remote setup request is a GET to `/rest/v1/projects`, with `Accept-Profile: rpg_zzu`, an encoded exact project filter, `select=project_id`, and `limit=1`. It rejects redirects without forwarding credentials and bounds duration (10 seconds) and response size (64 KiB). Auth, schema, server, malformed-response, network and missing-project failures have value-free actionable errors. There are no migrations or remote writes.

Existing env files are immutable. New `.env.local` is exclusively created and explicitly set to `0600`, including under a restrictive inherited umask. Failure/cancellation before creation leaves no file. Vite's real `loadEnv('development', root, '')` supplies existing dotenv precedence and expansion. Generated values round-trip through Vite; the key is server-only and the legacy browser key is blank. Higher-precedence development files or shell overrides cause fresh setup to stop rather than silently save shadowed values. The launcher pins the validated, normalized configuration snapshot into its own process environment before Vite loads it, preventing mid-probe file changes from switching the actual upstream/key/project.

The launcher changes to its own checkout and retains the existing Vite configuration with **`configLoader: 'runner'`**. It binds only **`http://127.0.0.1:9999`**, strict port, TLS disabled, and opens the encoded `?project=` URL only after its own successful listen. It never chooses/reuses another port or kills another server. Browser-open failure prints the same URL; `--no-open` supports noninteractive QA. SIGINT/SIGTERM close owned resources, including cancellation during startup. Bun is optional for editing/Node login; its absence produces an AI-completion warning rather than an installation attempt.

## Focused RED / GREEN

Committed console logs normalize trailing whitespace only; diagnostic text and results are preserved.

All fresh setup fixtures are temporary directories with synthetic credentials. Tests synchronize on requests, terminal input, process output, listen/close, promises, and signals; there are no sleeps, polling loops, prose-lock tests or retry-to-green logic.

| Evidence | Result |
| --- | --- |
| [p1-red.log](p1-red.log): focused command before production files existed | Exit 1; 15 failures at the missing launcher/setup/wrapper entrypoints. This initial RED is missing implementation, not an assertion-level behavioral regression. |
| Initial implementation focused run | Exit 0; 21 passed in one run. |
| [p1-boundary-red.log](p1-boundary-red.log): restrictive umask, URL-normalized non-origin input, command cancellation | Exit 1; 3 assertion failures captured before their production fixes: mode `0 !== 384`, missing URL exception, and parent killed instead of reaping the child. |
| [p1-snapshot-red.log](p1-snapshot-red.log): CLI configuration changed during the probe | Exit 1; Vite received no pinned server URL/key/project/proxy snapshot before the production fix. |
| [p1-green-final.log](p1-green-final.log): final full focused command | **Exit 0; 25 passed, 0 failed, 0 skipped, one run (2.67 seconds).** |

Final command:

```sh
node --test test/macLauncher.test.mjs test/setupLocal.test.mjs
```

The real Vite collision test reserves a temporary occupied port and remaps only the requested test port, keeping actual Vite create/listen/close and `strictPort` behavior. The original HTTP server still serves its ownership marker afterward. Other tests cover quoted spaces/Unicode paths from `/`, Node versions, missing npm, install failure/preservation, exclusive-create races/symlinks, env precedence/redaction, malformed/oversized responses, browser failure/no-open, startup ordering and signals.

## Additional verification

- LSP diagnostics on both production `.mjs` files and both test files: **no diagnostics**, including after the final fixes.
- `node --check` on all four `.mjs` files; `/bin/bash -n 'Start RPG Maker.command'`; executable bit; package JSON parse; workflow YAML parse: **passed**.
- `npm run typecheck:app`: **exit 0**, [p1-typecheck.log](p1-typecheck.log). An earlier tool invocation was terminated at its 120-second tool limit with no compiler diagnostics; the completed invocation used a sufficient execution bound. This was not a test retry or a suppressed compiler failure.
- `npm test -- test/supabaseProjectConfig.test.ts test/supabaseProxyPath.test.ts test/supabaseProjectSync.test.ts test/vitePreviewProxy.test.ts`: **4 files / 42 tests passed in one run**, [p1-related-tests.log](p1-related-tests.log).
- `VITE_CACHE_DIR=.vite-cache/mac-onboarding npm run build:app`: **exit 0**, [p1-build-app.log](p1-build-app.log). Output includes the record-picker circular-chunk warning, five mixed static/dynamic import advisories, the large-chunk advisory, and missing optional AI-key notices. None were suppressed. Application source did not change; same-base warning comparison remains supervisor-owned.
- `npm run openwiki:verify`: **exit 0**, no failures. `node scripts/openwiki-index.mjs --check`: current. `git diff --check`: passed.
- In-memory scan of evidence text against the provisioned Supabase key values: **no credential matches**; keys were never printed. The existing private `.env.local` was not copied, printed, edited or committed.
- Full `npm run build`, full suite and `npm run gates` remain supervisor-owned as delegated. No claim is made that those supervisor gates passed or that their same-base failure comparison is complete.

## Actual terminal and Vite/browser surface

### Private setup through a Linux pseudo-terminal

[p1-terminal.json](p1-terminal.json) records actual `node scripts/setup-local.mjs` execution from `/`, in disposable fresh folders:

- Synthetic local Supabase GET received the exact project filter and `rpg_zzu` profile.
- Successful setup exited 0 and created `0600` config; the supplied synthetic key never appeared in terminal output.
- Ctrl-C at key entry exited 1 and left no config file; no key echoed.
- This proves Linux PTY behavior, not Mac Terminal/Finder behavior.

### Launcher and existing online project

[p1-launcher.log](p1-launcher.log) and [p1-surface.json](p1-surface.json) record the actual executable wrapper via `/bin/bash .../Start RPG Maker.command --no-open`, launched from `/` and awaiting its own listen announcement before HTTP/browser actions.

- Origin: **`http://127.0.0.1:9999`**; project: **`rpg-zzu-house-template-gallery`** (the already provisioned test convenience, not a shipped default).
- GET `/`: **200**, actual Vite app entry. GET `/auth/providers`: **200**, JSON object, existing Node auth route.
- **Headless Firefox** loaded the existing project through same-origin `/supabase/rest/v1/projects` and `/maps`, both **200**.
- Store subscription observed the loaded project title and **2 maps**; persistence was `{ kind: 'ready', projectId: 'rpg-zzu-house-template-gallery', source: 'env', url: '/supabase' }`.
- DOM mutation subscription observed the actual editor canvas mounted. Browser page exceptions: **0**.
- Screenshot: local `output/evidence/mac-onboarding/p1-existing-project.png`, **1440 x 900**. [p1-screenshot.json](p1-screenshot.json) records 654 sampled colors. The image attachment tool cannot render images for this producer, so no visual-inspection claim is made. The PNG and local reproduction runner are intentionally not committed; they remain available in this worktree for independent inspection.
- SIGINT to the owned launcher: **exit 0**, no terminating signal. Port 9999 had no listener after cleanup. Hash comparison confirmed the provisioned private env file was unchanged.

The provisioned convenience backend uses legacy remote HTTP/client-key configuration, which the new launcher intentionally does not accept as novice configuration. QA used an **ephemeral loopback, GET-only bridge** to that already provisioned backend, passing the private key through process environment only. The actual launcher still enforced its normal URL/probe/proxy contract. This does **not** prove an external HTTPS Supabase deployment end to end.

The bridge forwarded only GETs. The existing editor attempted one `POST /rest/v1/map_edit_locks`; the bridge returned **405** and did not forward it. No content was authored and no remote writes/migrations were performed. Two failed optional `/v1/browser/hello` requests were recorded separately (`NS_ERROR_DOM_BAD_URI`); they are the existing developer bridge, not Supabase failures.

### Preserved browser failure

[p1-surface-chromium-failure.json](p1-surface-chromium-failure.json) records the initial Chromium attempt: HTTP endpoints succeeded, but five app-module requests were aborted with **`net::ERR_NETWORK_CHANGED`** before browser project loading. No app page exception occurred. The host had multiple `NO-CARRIER` bridge interfaces; `openwiki/testing.md` documents this Chromium/netlink failure and the Firefox alternative. The failure was not hidden or retried blindly. The installed Firefox exercised the same launcher/app path successfully, including a fresh final-code run.

## Remaining acceptance limitations

1. **No actual macOS/Finder is available.** Actions are disabled per the binding brief; the new macOS job is dormant, not executed Mac evidence. Actual Mac execution or explicit reviewer acceptance of this gap is required before merge.
2. Live browser proof is Linux headless Firefox with the disclosed read-only loopback bridge. Chromium's host-network failure and the external HTTPS deployment gap remain explicit.
3. Browser opening through macOS `/usr/bin/open` has unit ordering/failure coverage but was not executed on a Mac. The real surface used `--no-open`.
4. Screenshot capture/nonblank pixels are verified, but visual review belongs to the independent verifier because this producer cannot view image attachments.
5. Full supervisor gates and independent review/approval are not producer claims. No PR, push or merge was performed.
