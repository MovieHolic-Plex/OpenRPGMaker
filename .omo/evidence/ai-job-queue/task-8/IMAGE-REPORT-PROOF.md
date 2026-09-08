# Image report partial: cause and fix

Not TASK8_COMPLETE. Not a 10-case family pass. Application/store/auto-review/persistence unchanged.

## Cause (measured, not inferred from `report=partial`)

Focused diagnostic `grok-image-diag` (`087196c9-…`, commandExit 0) dumped the terminal report **before** cleanup.

PNG fixture is a valid 1×1 PNG (`png-fixture.json`: naturalWidth/Height 1; bytes start `89 50 4E 47`). Generated face artwork **decoded and was ready**.

`report-dump.json`:

| Section | Preview | Status |
|---|---|---|
| `artwork:generated-face_…-bust:generated` | artwork | **ready** 1×1 |
| `change:actors/actor_hero:generated` | `faceResourceId` | **ready** 1×1 |
| same actor section | `characterResourceId` | **missing** `Artwork was not captured: easyrpg-charset-actor1` |
| same actor section | `battleCharacterResourceId` | **missing** `Artwork was not captured: generated-actor-hero-01-battle` |
| `artwork:image-output:generated` | image | **ready** 1×1 |
| `applied.status` | | `not-applied` (not `unavailable`) |
| `failure` | | `null` |

`renderJobReport.ts` treated **every** `*ResourceId` on a changed DB record as a preview. Linking only `faceResourceId` still walked unchanged charset/battle fields. Those IDs are not in uploaded snapshots or tileset `reportAssets` (`pinBundledReportAssets` only pins tileset/graft images). Missing sibling previews ⇒ `sections.some(p.status !== "ready")` ⇒ **`partial`**.

Not: PNG undecodeable, missing optional before-map, `applied.unavailable`, or “no reportAssets on image family.” Admission already pins tileset reportAssets via `admissionWithPinnedAssets`.

## Discriminating regression then fix

RED then GREEN: `test/aiJobReports.test.ts`
`does not mark unchanged sibling actor ResourceId fields as missing image artwork`

- RED: previews `[battleCharacterResourceId, characterResourceId, faceResourceId]`
- Fix (`src/ai/jobs/renderJobReport.ts`): skip `*ResourceId` fields whose value equals the prior record.
- GREEN: only `faceResourceId`. Full `aiJobReports.test.ts` 22 passed.

## Focused image E2E (healthy ready assertion kept)

`grok-image-e2e` `--grep "actor face image field"`
run `e6a2e03d-099d-46ad-b7c4-700fdcffbbd2` origin `http://127.0.0.1:44805`

- commandExit **0**, graceful, remainingPids `[]`
- job family image, generation **succeeded**, report **ready**
- spec still waits `report:ready` and artwork `data-status=ready` (not a partial=ready workaround)

## Full matrix after correction

`grok-families-r16` did **not** complete 10 cases. Chat `holdThenClose` 408 waiting `generation=succeeded` after 4 provider ops; job **interrupted** on shutdown. Image case never reached. Not an image-report regression (isolated image e2e already green). Next owned work is that chat generation-wait flake/hang, not sibling ResourceIds.

## Artifacts

| path | what |
|---|---|
| `image-diag/report-dump.json` | terminal sections/statuses |
| `image-diag/png-fixture.json` | 1×1 PNG decodes |
| `grok-image-e2e.log` | 1 passed |
| `grok-families-r16.log` | chat 408, 9 not run |
