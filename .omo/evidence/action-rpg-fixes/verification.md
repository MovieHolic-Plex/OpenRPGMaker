# Action RPG authoring correction verification

Initial baseline: `58105616b`; final integration includes main `b9dec50fb`.
The investigation and final authoring used the actual
in-editor AI, not scripted model responses. Existing combat was not rebuilt.

## Current-main integration

Main advanced while the final review was running. The local merge preserves both
action proof and the newer NPC reward, per-map specification, navigation-repair
and dependent-call contracts.

The integration first exposed 17 failing cases. Strict scene preflight was
extended for the newly supported reward checkpoints, targeted interactions and
delta assertions; ordinary NPC errors retain their correction examples. Valid
flat `set{x,y}` input also exposed an unwanted synthesized `to` field, fixed at
the shared coordinate-normalization boundary.

The final combined run passed **359 tests across 32 files**, and the full build
passed again. The actual browser AI executed `run_action_combat_test` on the
merged code and passed in one call, without project changes or page errors.
The compiled-player CLI still observed all 50 outcomes; host
`ERR_NETWORK_CHANGED` asset warnings in that rerun are retained in its logs and
are not represented as an aesthetic pass. See `post-merge-validation.json`.

## Verified result

The integrated gate approved `b31389d39`. Its optional scene-cancellation note
was then addressed: the existing `choose` index `-1` executes the interpreter's
cancel branch, while indices below `-1` remain invalid. The actual cancellation
regression failed before the fix; all **64 cancellation/reward/action checks**
passed afterward. This focused follow-up supplements the 359-test integration
run rather than representing a new whole-repository green run.

Remote project: `oprn-6d2d581f84`, title `검과 회피 검증`.
After `store.flush()` returned `saved`, the actual LegacyDb loader returned:

- One existing 20x15 map renamed `검과 회피 훈련장`.
- System and map action-combat flags enabled.
- One melee spawn and one projectile spawn, each `maxAlive: 1`.
- One guide, `npc_action_guide`, at `(10,10)`.
- Guide retry preserved ID, name and position; enemies and spawns were unchanged.
- The final guide has no inferred missing-portrait command.

Browser AI: `gemini-3.7-flash`. Corrected creation used 20 tool calls and 12 LLM
calls, versus the investigation's 64 stages and 48 LLM calls. Two invalid
resource arguments were rejected and corrected without partial mutation.
A cold development-player build exceeded the old 60-second limit; a failing
fake-clock regression captured this and the default now uses the existing
120-second ceiling. Actual subsequent verification passed.

## Real-surface scenarios

| Criterion | Exact channel/action | Result |
|---|---|---|
| Honest completion | Browser AI calls `run_action_combat_test` with `mapId:"map_blank_start", pass:true` | Extra field rejected; response reports failure and checklist says `진행 막힘` |
| Recovery | Same conversation, call with only `mapId:"map_blank_start"` | Actual proof passes; checklist returns to `검증 완료` |
| Authoring | `ai-input` + `ai-send`, request one reused arena, melee/projectile enemies and one guide | Saved/reloaded real action game; no turn-based substitute or unrelated quests/shops/boss |
| Guide retry | Actual AI `place_npc` with `guide:"action-controls"` and existing ID | One guide remains at `(10,10)`; dialogue shows attack/moving-dodge keys without a missing face |
| Direct combat | Shipped `player.html`, walk into range, release movement, then Space | Slime removed and gold `0 -> 20` |
| Dodge | Shipped player, Shift + ArrowRight | Stamina `100 -> 80`, dodge window `500ms` |
| HUD | Same saved project in shipped player | Weapon `청동 검`, canonical keys, farming chip display `none`, HUD inside stage bounds |
| Mixed compatibility | Private copy with farmable area | Weapon retained; distinct `농사: 빈 손` chip visible |
| Non-action compatibility | Private copy with action disabled; keyboard route to actual field enemy | No action HUD; farming hand retained; contact opens real turn-based battle |
| Paired proof | `node scripts/qa/runtime/action-rpg.scenario.mjs` | Actual compiled `/export-player/`, export-store shim, 50 observations, all eight outcomes, no page/HTTP errors, source unchanged, iframe removed |

The paired proof records damage without directional dodge and dodge-specific
rejection of the matching attack, not merely positive iframe time. Forged
copies, wrong-map receipts and stale project revisions are rejected.

## RED and GREEN

- Actual-session RED: wait-only action checks and failed-then-skipped mandatory
  verification both published `verified`. Both regressions pass after wiring.
- Title RED received `새 프로젝트` rather than the requested name. Both remote
  creation paths now set default titles and preserve custom titles.
- HUD RED found no weapon element and a visible unrelated farming chip.
- Guide RED found an invented portrait. The generated guide now omits it.
- Cold-start RED timed out after 90 fake-clock seconds; GREEN accepts an owned
  completed run before 120 seconds and leaves no timers.
- Tool UI RED classified action proof as `build`; it is now explicit
  `inspect`/`shield` with a Korean label.
- Final changed-test run: **205 passed, 0 failed**, 23 files.
- Actual-session/adjacent integration checks: **40 passed**.
- Final `npm run build`: **exit 0**, including app typecheck, editor, player and
  standalone bundles.

No failed behavior was accepted by skipping or weakening a test. The obsolete
unsupported-action expectation now checks restored support; the prose snapshot
became equality between shipped policy copies instead of pinning wording.

## Full gate and baseline distinction

The lead ran `npm run gates`. That whole-suite invocation recorded **15,313
passed / 257 failed** before the final small corrections; it was not green.

A clean checkout at `58105616b` reproduced the same CSS count ratchet
(`267 -> 268`) and the same six event-editor surface failures. Thresholds and
snapshots were not relaxed.

The clean baseline ran 539 assertions from new failure candidates: 479 passed
and 60 failed. Timing-sensitive candidate files then ran on the implementation
under the same worker/time settings: 178 passed and 3 failed. Those three also
failed on the clean baseline. No persistent new failure remained in this
comparison. Updated action-policy contracts pass in the final 205-test run.

## Evidence and limits

- Detailed captures/AI exports: `output/evidence/action-rpg-fixes/`.
- Numeric player proof: `verify-shots/runtime-qa/action-rpg/receipt.json`.
- Notepad: `/tmp/ulw-action-fixes-20260907-003157.vzuZ0P.md`.

Vite module requests needed Playwright `route.fetch` for host
`ERR_NETWORK_CHANGED`; it served unmodified same-server bytes. Model/DB results
were not mocked. Compiled-player proof used no interception.

Screenshots were captured but image attachments were unavailable to the model.
No aesthetic approval is asserted. Actual DOM text, geometry, keyboard inputs,
runtime outcomes and remote persistence were inspected.
