# Opening still release pack

## Source and delivery

`assets/opening-stills-plan-v1.json` contains the authored tibo Imagen prompt plan.
`bun scripts/generate-opening-stills.mts --staging artifacts/stills-staging --jobs 3`
resumes completed files and checkpoints names, tags, prompts and actual dimensions.
Provider: Google Antigravity / gemini-3.1-flash-image, using the existing private
OAuth store. No credentials or provider responses are committed. Original images
stay in staging; full-frame JPEG delivery copies retain their native resolution.

The first release contains **32 new stills**, eight themes × four shots: winter,
underwater, sky islands, modern town, desert, forest, gothic mystery and space.
The 18 earlier bundled mood stills remain available without installation. This
is an initial pack, **not a claim that thousands of images have been produced**.
Larger batches use the same resumable manifest and delivery pipeline.

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
