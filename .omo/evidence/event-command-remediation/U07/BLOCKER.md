# Historical U07 resolver blocker (resolved; see MANIFEST.md)

Base: `4c619edc7dfde3a3c8214fd6b6f19fffd85c52ff`.
Status at this receipt: **blocked, not complete; no WIP/partially verified commit created**.
Both discovered owners were subsequently authorized and fixed. MANIFEST.md is the final status.

## New ownership blocker: uploaded hero charsets

`G2-F9` requires the selected newly registered charset to render on the player hero.
The real Firefox `player.html` shows the default hero despite a valid saved selection:

- Exported command: `m2-024-change-actor-graphic`, target `actor_hero`, value `u07-charset-new`.
- Real interpreter output: `m2Runtime.actors.actor_hero.characterGraphic = u07-charset-new`.
- Real sprite hook: `{resourceId: easyrpg-charset-actor1, textureKey: tex_easyrpg_charset_actor1}`.
- Asset URL resolves to the registered 288x256 PNG. It is not missing or an invalid media-kind fixture.
- Narrow RED test: `test/eventCommandRemediation/U07/playerSprite.test.ts`.
  Result: **2 tests, 1 failed / 1 passed, exit 1**. The bundled actor2 override is the passing discriminator.

Root/caller trace: `PlayScene.refreshRuntimeSurfaces` (`src/player/PlayScene.ts:410`)
calls `resolvePlayerSpriteResource` (`src/player/playerSpriteResources.ts:23`). That function
reads the correct override, but `findCharsetAsset` at line 43 only searches `CHARSET_ASSETS`;
the uploaded/profile-backed ID misses and falls through to the default hero.
These files are outside the five authorized U07 production files. No runtime fix was attempted.
The needed extension is player sprite resource resolution, with its texture-registration path
traced by the runtime owner; do not replace the assertion with a record-only claim or use a
bundled asset in place of the original uploaded fixture.

## Verified work within ownership

- Original inputs remain byte-for-byte unchanged, including both originally untracked TS files.
  `original-inputs.sha256` checks all five original inputs/receipts. Lossless original TS copies
  are in `original/`.
- Refreshed unchanged RED: **22 tests, 17 failed / 5 passed, exit 1**, identical test-level accounting
  to retained RED. `refresh-red.json`, `refresh-red.log.gz`.
- Related GREEN after scoped production edits: **101 tests, 101 passed / 0 failed, exit 0**.
  Includes all original 22, three named adjacent files, and U05's 59 authoritative validation tests.
  `green.json`, `green.log.gz`.
- Editor: **17 command flows**, real picker/custom controls, Confirm -> outer Apply -> reopen ->
  Cancel -> actual .oprn download -> actual file chooser import. **2 AI HTTP requests**, only the
  image-generation HTTP boundary faked; real queue/parser/insertion/store/profile/onInserted ran.
  **51 focused viewport records** (1024x768, 1280x800, 1440x900); zero page errors/remote writes.
  `surface-utyQuE/editor-observations.json`, `editor-exit.json`, `editor-exported.json.gz`,
  `editor-export.oprn.gz`, `editor-cleanup.json`; invocation exit 0 in `editor-attempt8.log.gz`.
- Dedicated player: **3 scenarios / 8 event-command beats**, all beats pass; registered and AI faces
  appear on the actual battle HUD, and command 102 changes the actual battle backdrop to B after
  the first defend action (the troop-event execution boundary). Three separate final sprite
  assertions fail on the same out-of-scope fallback. **Overall player exit 1**, not GREEN.
  `surface-utyQuE/player-{map,battle,ai-battle}/manifest.json`, `player-observations.json`,
  `player-failures.json`, `player-inputs.json`, `player-negative.json`, `player-cleanup.json`.
- Parallax/escape-location/vehicle/checkpoint are intentionally record-only; no live movement,
  parallax renderer, checkpoint restoration or system BGM/SE playback is claimed. Runtime
  normalization/policies remain with U10/U14/U15/U18/U19 as applicable.

## Finding coverage

| ID | Editor/unit | Player |
| --- | --- | --- |
| G2-F9 | GREEN: manual charset/faceset and AI face; source/codec retain actual new IDs | Face HUD GREEN, uploaded hero sprite BLOCKED as above |
| G2-F15 | GREEN: battleback A->B->A->B, mounted focus, preview/name/value B | Actual battle backdrop B GREEN |
| G3-F22 | GREEN: manual/AI backdrop callbacks, canonical/legacy fields and codec | Exact parallax override records GREEN; live parallax deferred to U15 |
| G3-F24 | GREEN: 026/203/204/207 resource/map/event cards and explicit missing actor | Selected event B removal and recorded vehicle graphic GREEN; no spawn/region semantics claim |
| G4-F11 | GREEN: 027/028/029/074/217 controls, initial authored names, unrelated zero edit | Selected variable receives playerX=2; escape map B/x=0/y=9 record GREEN |
| G4-F13 | GREEN: original six simultaneous-form label cases, real label edits, checkbox false | Checkpoint record preserves false GREEN |

## Attempt accounting and limitations

`green-attempt1`: 40/42; two adjacent fake-DOM tests lacked Element.matches. Fixed by querying the
assembled field row, not patching/suppressing the fake DOM. Original U07 22 were already GREEN.
Editor attempts 1-7 preserve cold-boot timeout, missing page graphic fixture, inspector-vs-dialog
locator ambiguity, duplicate face-preview locator, incorrect sticky-footer assumption and the
outer 300-second execution cutoff. None are counted as product RED. Probe `surface-W79oYA`
shows the existing scroll owner makes actions keyboard-reachable. No CSS/layout changes were made.
Attempt 8 ran with a 900-second process bound and passed. The original 22 assertions/controls were
never weakened. Runtime attempts retain the initial wrong facing/removed-ID-shape assumptions,
the real uploaded-charset failure, troop action-boundary correction and play-canvas disambiguation.

Image Read reports this model cannot receive images. Screenshots were captured, but there is
**no pixel approval**. Build/full gates are lead-owned and were not run. All final changed source,
test, support and scenario files received LSP diagnostics with no diagnostics reported. Pre-existing
production monolith sizes were not refactored outside this focused ownership; the original 258-LOC
test is unchanged. Added support files stay below 250 pure LOC.

No commit/push/PR, remote content writes, paid generation, extra agents, shared harness/wiki/Design
edits, or edits outside this worktree. All owned servers/contexts/caches were closed/removed.
Raw logs remain unchanged and have lossless gzip copies for portable staging; screenshots must
not be staged. `PACKAGING.md` lists the intended evidence selection.
