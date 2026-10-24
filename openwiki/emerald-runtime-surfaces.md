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

## 전투 2단계 (2026-10-15, 안 A: 원작 3세대 문법 완성, 새 그림 0)

- 글자는 한 글자씩 찍힌다(`battleDirectorDom.ts` 타자기, 줄 문장 키로 중복 방지). 전투 중 확인키는 먼저 줄을 끝까지 채운다(`completeBattleMessageTyping`).
- 포획: 타임라인 항목 `shakes: 0|1|2|3`(엔진 굴림). `playCaptureCinematic(field, targetId, success, shakes)`가 흔들림 횟수만큼 구슬을 흔든다. 던지는 순간 몬스터 돌진 모션은 끈다(`captureEntryActive`). 구슬은 독자 도안(원작 몬스터볼 모양 금지).
- 진화: `emeraldEvolutionScene.ts`가 `previewMonsterEvolution`(레벨·우정 조건만, 아이템 진화 제외)으로 전투 화면이 닫히기 전에 실루엣 교체 장면을 연다. 규칙 적용은 여전히 `applyBattleRewardsToSession`.
- 레벨업 상자: `emeraldResultRows`가 레벨 문장 줄에 `stats`(오른 양 → 새 수치 두 장)를 싣고, 마지막으로 공개된 줄에 붙은 것만 `.battle-levelup-stats`로 문장 창 위에 보인다. 수치는 `monsterBattleStatsForSpecies`(종족·레벨·IV) 차이이며 `snapshot.eventState.monsterCollection.instances[*].ivs`를 읽는다. 기술 교체 선택은 아직 없다.
- 트레이너 연출: `TroopRecord.trainerSprite`(`front`/`back`/`throw?`)가 있을 때만 슬라이드 인·볼 던지기, 없으면 연출 없이 시작.
  - **캠페인 배정(2026-10-16)**: `src/project/examples/monsterExpedition/trainerArt.ts` 가 번들 `public/assets/battle-trainers/<역할>/front.png` 역할만 쓴다(새 그림 없음). 체육관 관장은 `gymLeaderArt`, 리그·두목·관측탑은 `trainerArtByMap`(world.ts)·`typeArt`, 부하(grunt_N)·회사원·길 트레이너는 접미사·이름으로. `back` 은 `EXPEDITION_HERO_BACK`(hero_m — 기본값 `oprn_emerald_trainer_hero_back` 은 번들 파일이 없어 반드시 명시). 필드 걷기 칩은 아직 전부 people1 6번이라 전투 그림과 모양이 다르다(알려진 한계).
  - 조수 `place_trainer` 는 `trainerSprite` 를 안 주면 이름의 직업 말(`inferTrainerRoleFromName`)로 같은 번들을 배정하고 경고로 알린다.
  - 시각 QA: `TOWN_STAGE=trainer|emote node scripts/qa/runtime/monster-town.mjs <project.json>` — 시야선 진입 → 「!」 → 접근 → 대사 → 소개 슬라이드 → 승리 서술·상금 → 승리 후 대사.

## 픽셀 격자 계약 (2026-10-16, 시각 QA D12)

**한 문장:** 화면 480×320 = GBA 240×160 의 정확히 2배라서 논리 화소 1 = 화면 2px 이고, 화면에 보이는 모든 도트(타일·칩·몬스터·인물·테두리·글꼴)는 이 2px 의 정수배이며 정수 배율로만 확대한다.

| 요소 | 계약 | 구현 |
|---|---|---|
| 창 | 정수 배율만, 남는 창은 여백(letterbox). 1 미만으로 줄어드는 작은 창만 비정수 허용. 소수 devicePixelRatio(Windows 125%·150%)에서는 **기기 화소** 정수 k 를 고르고 CSS 배율은 k/dpr, 무대 왼쪽 위도 1/dpr 격자(2026-10-24, `calculatePlaySurfaceScale`/`Placement` 의 dpr 인자 — 전에는 CSS 2배가 기기 2.5px 로 도트 폭이 들쭉날쭉했다). 정수 dpr·터치 배치는 그대로 | `resolvePlaySurfaceScaleMode`(`project/playSurfaceScaleMode.ts`)가 에메랄드 프로젝트는 저작값과 무관하게 `integer`(2026-10-20부터 해상도를 저장한 다른 게임도 기본 integer) · `bindEmeraldBattleSurface` 가 `floor` |
| 타일·걷기 칩 | 16px 타일 ×2 카메라, 칩 24×32 ×2 | 기존(변경 없음) |
| 몬스터 그림 | **캔버스 ≤64×64, 1 도트 = 1 논리 화소, 표시 128×128(2배)** · idle 스트립 프레임 64×N | `src/player/monsterArtScale.ts` `integerArtBox` — 상자 128 에 들어가는 최대 정수 배율. 64→128(2배), 112 캔버스→112(1배). `bindIntegerArtScale` 이 `--art-box-width/height`·`data-art-scale` 을 심고 CSS 가 읽는다. 오프닝 소개 몬스터(`.cinematic-creature`)도 같은 규칙 |
| 글꼴 | Galmuri9 **18px**(9px 글리프 2배) 하나. 36px 는 제목 한정. 12·14·16·20·6.5·8px 와 Galmuri11(로드 안 됨→비도트 폴백)은 쓰지 않는다 | `emeraldSurfaces.css`·`playSurface.css`·`fieldHud.css`(collector 테마)·`monsterCampaignMenu.css` |
| 테두리 | 2px 의 정수배(논리 1~2px) — 창 4px·안쪽 줄 2px·HUD/안내 2px | 기존 |
| 인물 전투 그림(트레이너) | **미정합**: 번들 128×128 매끈한 그림(3000색+)이 1배로 그려져 도트가 2배 격자와 안 맞는다. 64 격자 도트 인물 그림이 생겨야 풀린다(그림 작업) | 이 계약의 열린 항목 |

112 캔버스 종은 1배(112px)로 정수 표시되지만 도트 절반 크기(화면 1px 도트가 많다)라 격자에 완전히 맞지는 않는다. 새 몬스터 그림은 64 캔버스로 만든다(`monster-collect-species` 하네스의 112 캔버스는 이 계약에 맞춰 줄여야 한다).

측정: `GRID=1 node scripts/qa/runtime/poke-vqa.capture.mjs <캠페인.json> <출력폴더> [장면]` — 이미지 원본/표시 배율·글꼴·테두리·Phaser 스프라이트 표시 크기를 `report.json` 의 `metrics` 에 남긴다(헤드리스 크롬은 `unshare -rn`).
