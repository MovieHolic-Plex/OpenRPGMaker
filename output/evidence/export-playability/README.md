# Export playability verification

Tested implementation base: `d1d5e7e9`. Production repairs are committed through
`da3bc7c8`; this directory also records the final QA and test-fixture changes.
No authored game content or Supabase rows were changed.

## Result

The actual editor menu produced both downloads. The downloaded ZIP passed the
gameplay loop at an origin root and under `/games/demo/` without a root-asset
fallback. The downloaded HTML passed through `file://` with HTTP blocked.

`gameplay-green.json` contains the action log, media observations, saved/loaded
state, negative-export results, and cleanup receipts.

| Criterion | Root ZIP | Nested ZIP | File HTML |
| --- | --- | --- | --- |
| Keyboard movement and NPC quest choice | PASS | PASS | PASS |
| Authored combat, target attacks and victory | PASS | PASS | PASS |
| Four party images decode | 712 px each | 712 px each | 712 px each |
| Four declared font faces decode | PASS | PASS | PASS |
| BGM decoded and playing | PASS | PASS | PASS |
| Authored map transfer | PASS | PASS | PASS |
| Save, reload and manual slot load | PASS | PASS | PASS |
| Restored map/position | forest (14,4) | forest (14,4) | forest (14,4) |
| Restored quest/gold/inventory | exact | exact | exact |
| Required-resource failures / uncaught errors | 0 / 0 | 0 / 0 | 0 / 0 |

Both negative menu cases passed: HTML substituted for player JS, and a missing
required party image, produced an error and no download. Adjacent editor Test
Play also moved in response to an actual arrow key.

The nested run recorded one expected cancellation of the already decoded and
playing BGM stream. It remains visible in `cancelledMedia`; only `media`
`ERR_ABORTED` events for an exact URL with prior decode/play proof qualify.
Other failures remain fatal.

## Reproduction

```sh
npm run dev:worktree -- --port <private-port>
npm run qa:export -- --editor-url http://127.0.0.1:<private-port> --out <evidence-dir>
npm run typecheck:export-qa
```

This host repeatedly generated Chromium `ERR_NETWORK_CHANGED` during the large
development-module graph. The recorded run therefore used `--api-transport`,
which forwards real same-origin responses with bounded concurrency; it never
substitutes application code, game data or menu actions. Exported games used
normal browser networking. The transport is recorded in the result JSON.

The harness imports a deterministic, test-only copy of the existing four-map
fixture through the real file chooser. It does not teleport, inject quest flags,
force battle outcomes, or call save/load internals.

Screenshots remain at:
`/tmp/rpg-export-implementation-20260906/qa-approved/`.
They are not represented as an aesthetic review; behavior and image/font
decoding are established by browser state and action evidence.

## RED to GREEN

- `asset-red.log`: actual runtime party URLs, ZIP bytes and HTML table entries
  were absent before dependency-closure repair.
- `runtime-url-red.log`: booted exports still resolved title and tileset URLs
  at the origin root.
- `catalog-red.log`: configured CDN music was omitted from ZIP/HTML.
- `invalid-zip-red.log`: empty/HTML media bytes were accepted.
- `battle-urls-red.log`, `system-css-red.log`, `hires-url-red.log`: actual idle,
  high-resolution and compiled CSS producers still bypassed portable URLs.
- `menu-red.json`: the real menu failed on the development server's HTML
  fallback instead of a player manifest.
- `gameplay-first.json`: real play exposed remaining idle/CSS defects after
  the initial unit-level fixes.
- `final-focused.log`: final related batch, 13 files / 108 tests passed.

Build and narrow gates passed: full `npm run build`, app typecheck, QA
typecheck, CSS budget/graph/live, TypeScript diagnostics, and the real cold-dev
HTTP package/manifest test. The final player build reported 12 bundle files and
60 runtime assets. Earlier recorded builds legitimately had fewer bundle files
before fonts became Vite-managed assets.

## Whole-repository failures

The whole repository is **not reported green**.

The first `npm run gates` exceeded its deadline. A four-worker full test run
produced a report covering 1614 files: 14,457 passed, 177 failed, and 15 existing
live/probe skips. It was interrupted near its deadline to preserve results.
The newly added URL file, collected after that run started, was separately
covered by the final focused batch.

All 30 failure-file candidates outside the tracked baseline were run against
clean `d1d5e7e9` and the feature tree: 34 failures on the base, 35 before the
fixture correction on the feature tree. The sole additional case used an empty
CSS stub in `growthTreeArtExport`; it now supplies valid CSS and retains every
image-byte assertion. The final focused batch passes.

Generic `STACK_TRACE_ERROR` entries were re-run rather than assumed to be
product defects. Remaining database view-toggle timeout behavior also
reproduced in an isolated test on the clean base. Pre-existing M2 and portal
surface mismatches reproduced on that same base. No baseline files were
rewritten, and no test assertions were removed or disabled.

`validation-summary.json` records the comparison scope and concrete failures.
Full local reports and build logs remain under
`/tmp/rpg-export-implementation-20260906/`.

## Review

Self-review found no remaining blocker attributable to the export repair.
The standalone and ZIP readers preserve their existing schema/manifest
contracts; runtime resource selection is shared rather than duplicated.
External source URLs are used only to fetch catalog bytes into canonical local
paths. Editor URLs remain unchanged unless the exported entry point explicitly
registers a game base.

This was a direct ultrawork run, not an `ulw-plan` run, so no plan-gated reviewer
approval is claimed. The repository-wide failures above remain visible.
