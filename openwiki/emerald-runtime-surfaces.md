# Emerald runtime surfaces

An authored `meta.oprnMonsterStyle: { version: 1, reference: 'emerald' }` opts a project into a consistent GBA presentation. The predicate lives in `src/project/emeraldMonsterStyle.ts`; there are no campaign or species ID checks. `configureEmeraldMonsterStyle` selects field-list / pokemon / handheld and authors 480×320 / cameraZoom2, giving a 15×10 field of native16px tiles.

## Owners

- `src/player/emeraldSurfaces.ts` stamps `data-monster-style=emerald` / `data-emerald-surface` and imports the single scoped stylesheet `src/styles/runtime/emeraldSurfaces.css`.
- BattleDOM chooses a local480×320 uniform-fit binder only for this profile. Ordinary640×480 battle scaling and Gen1/RM2k3 mechanics remain under their existing owners. Never change `BATTLE_LOGICAL_WIDTH/HEIGHT` to adjust this skin.
- Field-list menu stamps `data-emerald-page` (party / summary / box / bag / item-context / item-target / command) and pocket/state attrs. The existing controller owns cursor movement, activation, equipment, inventory, saving and cancellation.
- Party has six stable visual slots: one large left plus five small right. Empty slots are noninteractive; selecting a real instance enters the independent summary with actual HP/stats/moves/current PP, pending skill replacement/rejection and box transfer. The box toggle remains a real action. Front-resource sibling `_icon` is preferred if it exists; ordinary fronts remain fallback. A32×32 icon is displayed in a64×64 logical canvas;64×64 battle fronts/backs use128×128 and summary art128×128, preserving integer2× source scaling. No species schema field is required.
- Bag has left bag/pocket/description and right eight-row list. Existing filter/sort controls remain reachable in the list. Emerald opens the existing context for each item; Use enters the real target route, with effects/restrictions shown in context. Item targeting clears the former context owner so `itemActionId` cannot intercept the target page. No unsupported Toss/Give action is invented.
- Handheld dialogue is a bottom quarter frame with measured actual body width and a maximum two visible lines. Long Korean lines paginate without truncating. Name/portrait chrome is hidden in this compact profile; narration content, voice, tags, confirm/cancel behavior and the L backlog shortcut remain. Choices use a compact right window.

## Geometry and reference

240×160 native GBA coordinates are multiplied uniformly by2 into480×320. UI font is Galmuri9 at18px; borders are integer multiples of2px. The battle stage uses pale status cards, a turquoise/red message frame, text2×2 commands and a visible cursor. Submenus expand into the full bottom strip and retain scroll/current PP/item/target nodes. Do not restore fan-reference stripes, skewed dark cards or colored touch buttons here.

Original primary references: [display constants](https://github.com/pret/pokeemerald/blob/master/include/gba/defines.h), [menu window geometry](https://github.com/pret/pokeemerald/blob/master/src/menu.c), [party geometry](https://github.com/pret/pokeemerald/blob/master/src/data/party_menu.h), [bag](https://github.com/pret/pokeemerald/blob/master/src/item_menu.c), [battle windows](https://github.com/pret/pokeemerald/blob/master/src/battle_bg.c), [official real screenshots](https://www.pokemon.co.jp/game/gba/emerald/battle.html). This is an original Emerald reference skin, not imported Nintendo assets or a claim of Gen3 mechanics.

## Focused browser evidence

Launch only with the repo worktree launcher using the standalone player QA config:

```bash
PLAYER_QA_WATCH=1 npm run dev:worktree -- --config vite.player-qa.config.ts
OPRN_QA_URL=http://127.0.0.1:9913 OPRN_QA_PROJECT=/path/to/portable/project.json node scripts/qa/runtime/emerald-surfaces.probe.mjs
```

The probe routes a portable full-campaign copy into `player.html` / `exportEntry` / export store shim. It only applies the profile and omits cinematic opening in that copy. It uses an isolated save namespace, real starter choice, real menu keyboard, session-only six-party preparation, medicine/currentHP/inventory, and the actual wild troop via `scene.playBattle`. It does not write a canonical store. Read SUMMARY first, then its immediate-review PNGs. This is source shipping-entry evidence, not a built export or full unassisted playthrough. Opening/title, shared assets and shop have separate owners.

Do not call it complete campaign validation: canonical save/reload and final compiled export belong to the supervisor. No gates/Vitest/typecheck suites are needed or authorized by this probe.

### 2026-10-04 evidence receipt

`/tmp/oprn-emerald-20261004/surfaces-browser-fresh/SUMMARY.md` and `report.json` record the full72map/60species portable factory export. Native six-slot party, independent stats/current-PP summary, bag context/use/target and actual medicine HP/inventory mutation were reached. Fight/moves/currentPP and Bag/items used the actual battle DOM. The viewport was960×640 with a480×320 scene inside the game host; editor chrome0, page errors0, HTTP errors0. The probe moves away from the lab NPC before directly launching the QA battle so Enter cannot trigger a separate field conversation. This direct scene launch is session preparation, not proof of encounter frequency or campaign progression. Art at this snapshot is the existing authored front/back fallback; new shared creature icons/assets are a separate integration.

The previous revision25 portable file failed before title because17 authored battle animations referenced absent pixel-fx resources; the receipt is `/tmp/oprn-emerald-20261004/raw-v25-boot-failure/failure.json`. This surface probe uses the new portable factory export and does not normalize or claim to repair that old loading failure. Compatibility belongs to its dedicated loader change.

## Shipping icon dependencies

`collectProjectStrings` in `webExportAssets.ts` includes an existing uploaded
`_front` → `_icon` sibling for every Emerald species. The menu derives that ID at
runtime, so ordinary direct-string scanning otherwise prunes all60icons. Missing
icons retain the authored front fallback; exports never invent a resource.

Native combat revealed the normal Pokemon skin's110px enemy base variables
overriding the128px Emerald canvas. Emerald image selectors also include the
resolved skin attribute and set both base variables to128px. Static original
sprites disable the generic fractional `battler-breathe` scale; registered idle
strips and container attack/hit motion remain available.

Native first-gym QA also exposed a result-window cascade collision: the Emerald
24px inset retained the generic centered window's `translate(-50%,-50%)`, moving
the title and rewards outside the stage. Emerald clears that transform and fixed
width/height ceiling, reserves the confirm/prompt rows and scrolls actual rewards
inside the remaining space. It does not alter victory, XP, badge or item handling.
Emerald detail pages also disable the generic horizontal entrance tween. Native
immediate skill-replacement screenshots otherwise catch the title beyond the
crop before the tween settles; fixed pages retain their16px logical inset.

## Genuine predecessor Continue evidence (2026-10-04)

`emerald-continue-native.probe.mjs` copies the actual predecessor slot's exact
bytes into a private browser under `starlight-islands-v1:save-slot:v5:1`, then uses
native title/load/party keys. The compiled candidate retains map/position, gold,
inventory, party/box, species/level/HP and known moves/current PP, skips the new-game
intro, uses authored2× zoom on480×320 and loads the actual32×32 party icon. This is
predecessor compatibility evidence, not a new save or canonical-store receipt.
