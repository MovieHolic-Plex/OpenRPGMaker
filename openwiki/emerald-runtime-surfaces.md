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

The web export collector also includes the Pokemon fallback backdrop and the
snow climate backdrop selected by `battleBackdrop.ts`. Neither ID has to appear
in a troop row. The compiled campaign probe exposed a forest-backdrop 404;
exporting these implicit dependencies fixes the offline player without changing
the authored terrain, troop or combat rules.

The shop probe supports both source and built player HTML. Built inline BOOT
is replaced with the private fixture/namespace/observation configuration; native
Continue is selected explicitly before loading the genuine predecessor slot.
Failures preserve their original error even when runtime hooks are unavailable.
Portable-media routing only intercepts PNG/JPEG/WebP/OGG/WAV and supplies their
MIME types. JS and CSS stay with the server: fulfilling lazy player chunks as
untyped buffers let the title load but rejected the runtime import on Continue.
The genuine namespace is isolated by a fresh browser context. Final compiled
shop evidence: native buy2 changes1600→1440G and capture orbs10→12, cancellation
preserves state, desktop/narrow pending rows remain complete, errors0/HTTP0.

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

The campaign exporter runs the current `ensureBundledBattleAnimations` on its
detached shipping copy before resolving public files. This is the existing
replacement policy for retired EasyRPG Blow/Sword1/Arrow sheets; it keeps the
canonical document intact and avoids reintroducing retired files. Hydrated host
assets must match their exact SHA, including the currently authored opening BGM.


## Approved field-kit surfaces (2026-10-05)

The Emerald field menu/party/bag and shop use the human-approved field-kit mint,
cream and dark-green palette. The right command window is192logical pixels wide
(left288in480×320), with the native controller and save behavior unchanged.
`oprnMenuSounds` selects the three approved cues, so menu transitions keep the
existing map BGM source alive. This is a scoped change to the Emerald opt-in CSS;
see `pokemon-like-field-kit.md` for approval, canonical adoption and player proof.

## 전투 개편 (2026-10-07, 사용자 「전투는 형편없다」)

- **지형 배경:** `src/battle/emeraldBattleTerrain.ts` 가 싸움이 열린 칸·맵에서 갈래(grass·sand·snow·water·cave·indoor)를 고르고
  `battleDom` 이 `data-emerald-terrain` 으로 단다. 그림은 코드 도트 240×120 `public/assets/emerald-monster/battle/<갈래>.png`
  (`scripts/content/emerald/draw-battle-backgrounds.py`), 발판·트레이너 소개 발판 색은 `--emerald-base*` 변수. 맵에
  `battleBackground: "emerald:<갈래>"` 를 적으면 그것이 이긴다.
- **3세대 문장:** `src/player/emeraldBattleNarration.ts` — 「야생/상대 ○○의 기술!」, 상성·급소 줄(피해 숫자 없음),
  「○○는 쓰러졌다!」, 「사하라는 △△를 내보냈다!」, 「가라! ○○!」, 「○○는 독의 피해를 입었다!」. 결과는 패널이 아니라 문장 창 쪽
  (마지막 두 줄, `data-emerald-page`, 1.3초)이고 「승리!」 도장·「후퇴」 확인 상자는 없다(도주는 바로 필드로).
- **한 마리씩:** 트레이너의 다음 몬스터는 그 교체 비트가 재생될 때 나온다(`battleDom` 의 미재생 적 교체 숨김). 쓰러진 앞 몬스터는
  런타임 스냅샷 `departedEnemies` 로 비트가 끝날 때까지 남아 HP 바·쓰러짐 문장이 재생된다. `monster-journey` 의 `battle-one-foe` 가 지킨다.
- **상태 배지:** HP 상자 둘째 줄 왼쪽(스프라이트 배지는 숨김) — `battle-status-in-box` 검사. 상자 표기는 양쪽 모두 `Lv9`.
- **쓰러진 뒤 교체:** 포켓몬 화면은 「다음은 누구를 내보낼까?」 목록이 바로 뜬다(예전엔 「무엇을 할까? ▸교체」 한 칸).
- **경험치:** `monsterExpInLevelBand` 가 저장 경험치를 현재 레벨 구간으로 맞춘다 — 레벨만 바꾼 저장본이 한 번에 Lv14→20 으로 뛰었다.
