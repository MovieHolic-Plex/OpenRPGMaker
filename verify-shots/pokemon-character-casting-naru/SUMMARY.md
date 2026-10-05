# Naru: newly authored character review candidate

Candidate: `explorer-1c9395185ff2b26e`.
Review: http://mdc-server:18316/?candidate=explorer-1c9395185ff2b26e
Durable package: `~/.local/share/oprn/pokemon-character-casting/candidates/explorer-1c9395185ff2b26e/`.

## Inspect first

- `naru-walk-6x.gif`: actual walk GIF enlarged at integer scale for viewing.
- `decoded-gif.png`: all four GIF frames in up/right/down/left directions.
- `review-1100.png`: actual browser review page and candidate selection.
- `review-320.png`: mobile page.

## Source and findings

Source: `harness-data/pokemon-character-casting/authored/naru-v1/naru.px.json`, SHA `ba3a4a2a0a172391bf6eb028e5516e44ab6435433ec8062182423dfaba222c0d`.

Codex GPT-6 explicitly authored all twelve 16×32 palette grids. Python only maps symbols to colors, packs poses and exports the cycle. The renderer does not read the original NPC sprite images. No original pixel crops, automatic mirroring, pose tweening, sprite resizing or palette quantization. Original Emerald sprites were visually observed as proportion and timing references. This describes model-authored pixel rows, not human authorship.

The first right walk had the near arm moving with the near leg. Six rows were explicitly patched to reverse the arm cycle. The final decoded frames show opposing arm/leg movement, a fixed left-side map bag and stable face/hair under a 1px step bob. Tiny-scale facial appeal remains for the user to judge.

## Technical checks

- Native import/check/preview passes: 14 opaque colors, binary alpha, 20–21px ink height, correct head/feet positions, head movement ≤1px, distinct lower-body step poses.
- Native check warns about large raw frame changes because the body bobs by 1px. Registered upper-body change is within the existing threshold. Thresholds and native implementation were not changed.
- Casting queue verifies exact native PNG/GIF pixels, four frames, 130ms timing, infinite loop and the 48×128 atlas. `native-check.json` retains the report.
- `diversity.json`: comparison with all six current original NPC candidates passes existing body/silhouette and recolor controls.
- `browser-record.json`: 19 focused browser, persistence and permission checks pass. Direct link and reload select Naru, all media load, manual frame selection works, mobile does not overflow, and pending download is blocked.
- Reference-wave activation was checked on copied storage: it preserves the independently authored collection and does not write user decisions.

The existing user decision count was 1 before and after verification. QA wrote zero production votes. Naru is pending on readback. Existing human selection was preserved. No canonical game writes or actual gameplay claims are made; context is a placement mockup. All final pixels and provenance are stored in the persistent harness package and the authored source directory.
