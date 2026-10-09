# Opening still release pack

## Reviewed descriptions and production queue (2026-09-22)

`list_opening_media(kind:"image")` must use `PICKER_KIND.image` (`still`), not the
generic `image` picker. The latter omits the dedicated mood catalog. Results now
include actual visual `description`, `mood`, narrative `useCases`, coherent
`series`, `cautions`, and `suitableForOpening`. Queries match every space-separated
word across names and metadata. Prompt text is not used as a visual description.

All 37 existing entries were visually reviewed. The 13 reused welcome images had
invented names unrelated to their pixels; their names, tags and descriptions are
corrected. Two contain collage/UI and are marked unsuitable reference images.
Standalone bundled art uses distinct series IDs; sharing an art style does not
prove a shared world. Four-shot release groups retain their reviewed series.
`opening-stills-source-v1.json` is also attached to the existing Release as a
description/provenance sidecar. The pinned image archive and manifest are unchanged.

`assets/opening-still-library-plan.json` is a **production plan, not delivered art**:
24 worlds × 12 narrative shots × 8 lighting setups = 2,304 pending images.
`node scripts/plan-opening-still-library.mjs` expands it to
`artifacts/stills-library-plan.json`, including prompts and intended descriptions.
Use `bun scripts/generate-opening-stills.mts --plan artifacts/stills-library-plan.json
--staging artifacts/stills-library-staging --jobs 3 --limit 32` for bounded batches.
Generated entries have `reviewStatus:pending`; inspect actual pixels, correct the
description/cautions, reject lettering/collage/defects, then approve explicitly.
Both catalog generation and packing reject unapproved rows. Approved v1 contains
19 images; quota exhaustion on this follow-up produced **zero additional images**.
No pending ID is inserted into the runtime or AI catalog.

## Quota-aware production job

The expanded plan now fills four beats (panorama → home → threat → road) for all
24 worlds before other shots or lighting variants. `--include-initial` prepends
the initial 32-image plan so its 13 missing shots are completed as well.

```bash
node scripts/plan-opening-still-library.mjs --include-initial --out artifacts/stills-production/plan.json
node scripts/run-opening-still-queue.mjs --plan artifacts/stills-production/plan.json --staging artifacts/stills-production --batch-size 32 --jobs 2
node scripts/run-opening-still-queue.mjs --staging artifacts/stills-production --status
```

The queue runs finite batches through the existing tibo generator. Quota failures
record the provider reset time plus a one-minute margin and wait without making
API requests. Unknown reset times wait six hours. `--not-before <ISO date>` can
carry a known quota response into the first start. SIGTERM saves the waiting time
and releases locks; restarting with the same plan resumes it. Ordinary failures,
invalid/missing batch receipts, no progress and <2 GiB free disk stop the job.
The queue checks the plan hash on resume rather than silently switching work.

Each successful image atomically checkpoints its dimensions, byte count and hash.
Existing output is verified and skipped. Corrupt manifests fail rather than
resetting the queue and spending quota again. Separate `.queue.lock` and
`.generate.lock` prevent competing writers. Inspect their owner PID before
removing a stale lock after a process crash; do not automatically delete locks.

`queue-status.json` shows progress and the next attempt; `run-status.json` is a
unique receipt for the latest batch. `review/index.html` and 32-image pages are
rebuilt after each batch. They label unreviewed descriptions as **generation
requests**, not verified descriptions. Finishing generation means
`awaiting_review`; the queue never changes the catalog, approves images or
publishes a Release.

This task's running service is `oprn-opening-stills.service` in the user systemd
manager, working in the 99ba checkout. Use `systemctl --user status
oprn-opening-stills`, `journalctl --user -u oprn-opening-stills`, and
`systemctl --user stop oprn-opening-stills` to inspect or stop it. It is a transient
service, not a boot-time automation: keep this checkout and staging until the job
is finished. Its finite plan contains 2,336 rows (32 initial + 2,304 library),
including the 19 already reviewed images copied into production staging.

## Initial pack

`assets/opening-stills-plan-v1.json` contains the authored tibo Imagen prompt plan.
`bun scripts/generate-opening-stills.mts --staging artifacts/stills-staging --jobs 3`
resumes completed files and checkpoints names, tags, prompts and actual dimensions.
Provider: Google Antigravity / gemini-3.1-flash-image, using the existing private
OAuth store. No credentials or provider responses are committed. Original images
stay in staging; full-frame JPEG delivery copies retain their native resolution.

The first release contains **19 reviewed stills** across winter, underwater, sky islands, modern town and
desert. Four shots each, except modern town with three. The plan has 13 pending
shots: 12 were blocked by tibo quota exhaustion, and one modern-town image was
rejected for a baked-in English caption. Pending images are not in the release
or runtime catalog.
The 18 earlier bundled mood stills remain available without installation. This
is an initial pack, **not a claim that thousands of images have been produced**.
Larger batches use the same resumable manifest and delivery pipeline. Quota
exhaustion stops the batch without retrying every remaining prompt.

`npm run stills:pack -- --staging artifacts/stills-staging` validates every image,
builds the tar and checksums, regenerates the runtime and searchable catalogs,
and pins `assets/stills-release-v1.json` plus the completed source manifest.
Publish `artifacts/stills-release/{rpg-zzu-stills-v1.tar,stills-release-v1.json,SHA256SUMS}`
to the private `stills-v1` GitHub Release. Binary images do not enter Git.
Do not republish different bytes under an existing release tag without coordinating
its pinned manifest and consumers; new editions need an explicit version migration.

## Installation and integrity

- `npm run stills:install`: download via authenticated gh, verify and install.
- `npm run stills:install -- --archive /path/rpg-zzu-stills-v1.tar`: offline install.
- `npm run stills:verify`: compare every file's size and SHA-256 with the pinned manifest.

Target: `public/assets/stills/pack/` (gitignored). Healthy installations skip download.
A directory lock serializes installers. Validate the archive hash, allowed flat
regular-file entries and every extracted file **before** replacing the installed
directory. Missing files, corrupt data, links and unknown members fail. Replacement
uses staging on the same filesystem; normal failure/cancellation removes staging
and the lock. After an uncatchable process kill, remove `.install.lock` only after
confirming no installer is running. Free space should accommodate archive, extracted
files and the previous installation during replacement.

## Runtime and authoring contracts

`openingStillPackRuntime.ts` owns the ID → filename map. `openingStillMoods.ts`
owns editor/AI labels and search tags. The catalog generator preserves the array
declaration and bundled mood rows, and flattens prompt newlines in generated comments.
`resourceReferenceValidation.collectResourceIds` includes every pack ID, so choosing
a catalog image survives serialize/deserialize even on another machine.

Normal cinematic playback renders only imagery and authored narration; there is
no keyboard/scroll instruction footer. Keyboard advance/skip and narration scroll
still work. Loading/failure status remains only while media needs attention.

The resolver uses `VITE_STILL_CDN_BASE/stills/v1/<file>` when configured; otherwise
`/assets/stills/pack/<file>`. The export collector fetches the configured CDN source
but always places it at `assets/stills/pack/<file>` in the game ZIP. Install the pack
before a local/offline export. A missing image is an export failure, not a successful
empty ZIP. The player uses the local exported path; licenses use `withInlineAsset`
for subdirectory hosting and standalone HTML as well.

## Verification and examples

`test/openingStillPack.test.mjs`: generator syntax, install/verify/repair, missing
members preserving the old pack, checksum and manifest validation.
`test/openingDelivery.test.ts`: titled new-project seed, removal/disable preserved
through actual store normalization, catalog search + roundtrip, CDN export, and
attribution rebasing/embedding.

`scripts/qa/save-opening-examples.mts` authors two isolated example IDs,
`oprn-opening-winter-1126` and `oprn-opening-ocean-1126`, saves to Supabase and reloads
before writing local evidence. `scripts/qa/capture-opening-examples.mjs` consumes
those reloaded documents in the dedicated shipped-player harness, checks all four
images and title card, checks attribution interaction and records two GIFs. Results
and persistence receipts are under `verify-shots/opening-examples/` (local evidence).

The final export proof (`scripts/qa/verify-opening-export.mts`) builds real ZIPs
using a CDN source adapter, serves only ZIP entries under `/games/<theme>/`,
blocks external CDN requests and checks all scenes plus the attribution dialog.
It loads exporter modules through Vite to populate `import.meta.env`; plain tsx
imports cannot exercise the CDN setting. The script asserts a CDN source fetch.
The runtime manifest must not list `generated/opening/*.png`: those paths omitted
`assets/` and broke SDK packaging. Opening pictures are usage-selected dependencies
from the project, not mandatory files for every exported game.

The license button is an explicit pointer owner in both the runtime event blocker
and shipped player CSS; updating only the event blocker leaves it unclickable in
exports. Its dialog stops key propagation to the game. The pointer CSS checker
recognizes the same owner, and the shared runtime rule includes that owner selector.
