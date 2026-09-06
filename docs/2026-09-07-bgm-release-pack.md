# BGM release pack verification

## Delivered

- Published private release: <https://github.com/MovieHolic-Plex/rpg-zzu/releases/tag/bgm-v1>
- Draft implementation PR: <https://github.com/MovieHolic-Plex/rpg-zzu/pull/674>
- Release target: `eb0e14ffbec575b8d727ac6def76ab19dd4c4811`
- Source commands: `npm run bgm:pack`, `npm run bgm:install`, `npm run bgm:verify`.
- No merge, shared production restart, credential edits, runtime resolver changes or authored project writes.

The release contains 281 CC0 tracks: 273 MP3 and 8 WAV, totaling 1,303,934,164 audio bytes.
Ordinary Git contains the trusted manifest and installer, not the large pack.

| Asset | Bytes | SHA-256 |
|---|---:|---|
| `rpg-zzu-bgm-v1.tar` | 1,304,157,696 | `615a481cb5e3be7f42eceaaecd1f1d1cce4755fd040459d54d0929793daae9e2` |
| `bgm-release-v1.json` | 62,320 | `68c9c3f4d391fa46b87f9401bd400615aecd5655f4fc1aa52fe198c55396fe2c` |
| `SHA256SUMS` | 171 | `8ab68ad7d1a60872b1e71d36efc92020779af5a542d6b9b17c4db6f30b24ac2e` |

GitHub's uploaded digests matched the local artifacts. The release is published, not draft,
and was explicitly created/published with `--latest=false`. The 221 available upstream
digests matched; 60 tracks without upstream digests have observed bytes pinned in the new
manifest. They are not described as independently upstream-verified.

## RED to GREEN

Evidence paths below are relative to `output/evidence/bgm-release-pack/` in the verification
worktree `/home/main/z-project/rpg-zzu-bgm-release-pack`.

| Contract | RED | GREEN |
|---|---|---|
| Pack/install API and safe real tar roundtrip | `red.log`: 20 explicit missing-contract assertions, before production code | `lead-tests.log`: 22 Node tests passed |
| Final verification and cancellation | `review-red.log`: 2 additional regressions failed before correction | `review-green.log`, `cli-cancellation.log`: final verification, SIGINT130/SIGTERM143, child reap and cleanup |
| Catalog and export compatibility | Existing catalog/export contracts retained | `lead-tests.log`: 29 tests passed in 2 files |
| Non-starter local BGM | `browser-red/proof.json`: absent MP3 returned Vite HTML fallback; native media error4, paused, readyState0 | `browser-production-isolated/proof.json`: real shipped-player native playback, no errors |

Tests exercise corrupted size/hash, invalid manifest, unexpected/duplicate/missing files,
traversal, links, unsafe destinations, lock contention, partial promotion, offline rerun and
repair. They use real tar/filesystem/HTTP behavior rather than mocking the installer result.

## Published private-release acceptance

Run:

```bash
node scripts/qa/bgm-release-cli.probe.mjs
```

`published-cli.json` records these actual outcomes:

1. Default installer invoked real authenticated `gh release download`; 281 files installed.
2. Independent verification matched all 281 file hashes.
3. Rerun with an empty `PATH` succeeded with zero files installed: no gh or download required.
4. A separate `gh release download` retrieved the published tar and matched its pinned digest.
5. Manual `--archive` installation into a path with spaces, with empty `PATH`, installed and verified 281 files.
6. A correct-length, invalid-hash archive exited1 with `Byte count or SHA256 mismatch`.
   Full before/after hashes proved the existing destination was unchanged.
7. The valid published archive repaired exactly one deliberately damaged file and preserved
   an unrelated file; all 281 hashes matched again.

The probe exited0. `published-cli-cleanup.json` records removal of its entire temporary
checkout/archive tree. No private token or signed download URL was recorded.

## Real player proof

With the pack installed and production output built:

```bash
VITE_BGM_CDN_BASE= npm run build
VITE_BGM_CDN_BASE= node scripts/qa/bgm-release.probe.mjs production-isolated
```

The probe uses the existing `player.html` harness, a test-only single-map fixture and real
Enter input. It observes native media events, not a mocked Audio constructor or play call.
The successful host run additionally placed temporary profiles/evidence on an owned tmpfs:

```bash
TMPDIR=/dev/shm/bgm-release-qa \
QA_EVIDENCE_DIR=/dev/shm/bgm-release-qa/evidence \
VITE_BGM_CDN_BASE= node scripts/qa/bgm-release.probe.mjs production-isolated
```

Observed resource: `cc0-bgm-rtp-twn-001`.

- HTTP200, `audio/mpeg`, 3,019,436 bytes, same-origin `/export-player/assets/cc0/audio/catalog/`.
- Two advancing native `timeupdate` observations; final currentTime `0.583287`.
- Volume `0.7`, muted false, paused false, readyState4, no media error.
- Zero external requests, zero runtime/console errors, both title and playback beats passed.
- Screenshot: `browser-production-isolated/report/02-non-starter.png`.
- Trace: `browser-production-isolated/trace.zip`.
- Action/state evidence: `browser-production-isolated/proof.json` and `report/manifest.json`.

No aesthetic verdict is claimed: the evidence concerns actual media playback.

## Checks, limitations and cleanup

- Full `npm run build` exited0: application typecheck, application bundle, player/SDK and standalone bundle.
- Changed source/test/probe LSP diagnostics were clean. Plain JSON/ignore files had no configured LSP;
  JSON was parsed and verified through the real installer and catalog tests.
- Supervisor full gate command
  `timeout --signal=TERM --kill-after=15s 900s npm run gates -- --json`
  exited124. It produced no completed gate report. **No full-suite pass or baseline-regression
  verdict is claimed.** `gates.log` retains the incomplete run; focused checks/build passed separately.
- Initial host Chromium dev attempts failed with `ERR_NETWORK_CHANGED`; a larger demo probe
  encountered `ERR_INSUFFICIENT_RESOURCES`. Firefox's transient playback followed by decode
  error3 was rejected as insufficient, despite the first probe printing GREEN. These failed
  artifacts were retained. The final isolated production run passed the stronger criterion.
- Root-disk exhaustion required removing only owned caches and using tmpfs for acceptance.
  All test browser/server processes, downloads, temporary roots and tmpfs directory were removed.
  Port44451 was independently confirmed closed. Captured evidence was copied back before cleanup.
- Generated local dist, source audio cache, uploaded tar duplicate and 278 QA-installed nonstarters
  were removed. The three tracked starter files, source worktree and isolated package dependencies remain.
- Linux/Chromium was exercised. macOS/Windows execution and physical speaker output were not tested.
- Bare ULW HEAVY self-review: archive/network/filesystem boundaries required the tier; source diff,
  integrity checks, native playback, publication and cleanup evidence were audited. No ulw-plan
  reviewer gate was triggered.
