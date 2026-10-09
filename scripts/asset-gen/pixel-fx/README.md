# retro2003 skill effects

## 직접 저작 요청의 최신 경로 (2026-10-05)

직전 `snes-study-redraw-20261005` 판도 사용자 반려다. 현재 공용 화염/빙결/번개/홀리/용권은
`hero_magic_rework.py`가 선택한 `flame_cels.py`·`crystal_cels.py`·`lightning_cels.py`·
`aether_cels.py`·`water_band_cels.py`의 직접 쓴 문자 행과 좌표를 사용한다.
소환 본체는 기존 `pixel-enemies/hydra-three.png` 첫 셀을 재사용한 `summon-hydra-reuse.json`이다.
`python3 scripts/asset-gen/pixel-fx/snes_study_redraw.py --install`로 10개 층과 배경 셀 사본 4장을 패킹한다.
완전한 원본은 `hand-authored/*.study.px.json`; `hand_pixels.py`는 이 원본을 먼저 읽는다.
화염·빙결·번개·용권 본체·착탄의 기존 개별 `.py`도 같은 그림을 재현한다.
층 크기/칸 수/노출 시간/앞뒤 순서는 `src/assets/retroClassSkills.ts`에 함께 등록돼 있다.
소환 원화는 96px 본체를 128px 한 칸에 배치해 유지한다. 새로 그린 용이라고 보고하지 않는다.
배경은 직접 저작한 128px 폭의 긴 물결 띠를 배치하고 단색 바탕만 32px 타일로 반복한다.
10개 층의 64칸을 각각 새로 그린 그림 64장으로 보고하지 않는다.
근거와 범위: `docs/experiments/hero-magic-rework-20261005/README.md`.

### 이전 반려/철회 기록

후속 공용 효과 **24종(각64×8)과 소환 v2도 사용자 반려**다. 공용 등록/기본값 배선을 철회했다.
`build_shared_hand_fx.py`는 반려 기록 폴더에만 출력한다. `dragon_hand_cels.py`는 반려 원본이다.
철회 당시 소환 PNG와 `monk_dragon_aura.py`는 작업 전 HEAD로 복원했다. 이후 위의 새 원본으로 교체했다.
원본/PNG/배선 사본과 당시 기술 확인 기록은 `docs/experiments/shared-hand-fx-20261005/README.md`.

도형/수식으로 만든 FF6 참고4종 시안은 사용자 반려다. 새 직접 도트 작업은
`openwiki/pixel-dot-authoring.md`의 두 스킬로 각 프레임의 문자 격자·좌표를 직접 저작한다.
보조 코드는 출력·검사만 맡는다. 아래는 기존 시트의 생성/재현 경로이며 새 직접 저작의 품질 기준이 아니다.

### 첫 화염·빙결·번개·소환 직접 도트 4종 (역사)

`hand-authored/<key>.hand.json`이 픽셀 저작 원본이고, `hand_pixels.py`는 명시된 행을
1:1로 배치해 `<key>.px.json`으로 펼친다. 이름을 가진 몸통/얼굴 조각은 같은 좌표에서 유지하고,
날개 자세와 브레스는 별도의 행으로 찍었다. 도형 생성·자동 변형·보간은 없다.

| 스킬 | 원본 키 | 셀 × 프레임 | 런타임 간격 |
|---|---|---|---|
| 파이어볼 | mage_fire_burst | 64 × 10 | 60ms |
| 블리자드 | mage_blizzard | 64 × 10 | 60ms |
| 연쇄 번개 | mage_chain_bolt | 64 × 8 | 60ms |
| 용권 멸살의 소환 층 | monk_dragon_aura | 128 × 12 | 72ms |

화염·빙결·번개의 기존 `.py` 진입점도 같은 문자 원본을 읽는다. 소환 직접 격자는 반려 기록만 남겼다.
공용 PNG는 `public/assets/generated/pixel-fx/`에 반영된다. 시트 크기·프레임 수·앵커·스킬 ID는 기존 계약을 따른다.
직접 도트 검토판과 수정 전 공용 시트는 `docs/experiments/hand-magic-20261005/`에 있다.
소환의 별도 검토 GIF는 시간 단위가 10ms이므로 70ms, 실제 플레이어와 대화 미리보기는 72ms다.
옛 라이브러리의 보조 GIF 속도는 런타임 검증 근거로 쓰지 않는다.

Original pixel-coordinate art authored for OPRN Studio with Python 3 and Pillow.
No AI image generation, source-image tracing, resizing or antialiasing is used.

Run `python3 scripts/asset-gen/pixel-fx/fire.py` for one strip, or
`python3 scripts/asset-gen/pixel-fx/fx_lib.py` for all seventeen strips.
The output is `public/assets/generated/pixel-fx/<name>.png`: 64×64 cells,
eight horizontal frames, five opaque colours plus transparent. Generation asserts
binary alpha and at most twelve RGBA colours. The runtime renders at exactly 2×.

The PNGs use the repository's artwork licensing terms. Associated sounds are the
existing EasyRPG RTP assets; their attribution remains in `assets/easyrpg/AUTHORS.md`.

## Class skill sheets (hero · guardian)

`lib_hero.py` draws the class_hero and class_guardian layer sheets listed in
`src/assets/retroClassSkills.ts` (22 keys, including the shared `hero_dust`).
Each `<key>.py` holds one sheet's frame formulas; `python3 <key>.py` rebuilds
that sheet and `python3 lib_hero.py` rebuilds all 22. Frame size and count are
read back from the contract file and asserted before writing.

Shapes are aliased PIL masks painted on a palette-index canvas, so alpha is 0/255
and each sheet stays within its palette (at most 12 colours). Shading comes from
mask dilation and erosion, and fades use a checker dither. The build prints and
asserts size, alpha, colour count, non-empty frames and frame-to-frame change.
Review images (4× previews, 2× GIFs on #202840, per-class sheet and battler
composite) go to `.omo/pixel-fx/` and are not committed.

## Class skill sheets (samurai · ninja)

`lib_samurai.py` draws the 28 class_samurai / class_ninja layer sheets (reusing the
`lib_scout.py` cel, checks and review boards). Samurai keeps to indigo night, white steel
and sakura pink; ninja to violet shadow and iron grey, with the element ink of each jutsu
added on top. `python3 lib_samurai.py` rebuilds all 28 plus `.omo/pixel-fx/samurai-*` and
`ninja-*` boards; `python3 <key>.py` rebuilds one. Anchor, frame size and count are read
back from `src/assets/retroClassSkills.ts` and a mismatch aborts before writing.


## Class skill sheets (monk · bard)

`lib_monk.py` draws the 21 class_monk and class_bard sheets from the 2026-09-28
extension of `src/assets/retroClassSkills.ts`. It reuses the `Cel` primitives,
checks and review boards from `lib_scout.py` and asserts each script's anchor,
frame size and frame count against the contract before writing.
`python3 lib_monk.py` rebuilds all 21 plus `.omo/pixel-fx/{monk,bard}-{sheet,composite}.png`;
`python3 lib_monk.py monk` or a single key limits the run.

Colour identity: monk is gold and orange fire, with earth browns for ground hits and
blue only for chi. Bard is rainbow notes on a dark plum outline, with blue for the
lullaby and violet for the requiem. Screen sheets dim the stage with a checker-dithered
oval (`shade`) and never with a solid fill, so battlers stay visible.

## Class skill sheets (druid · witch)

`lib_druid.py` draws the class_druid (10) and class_witch (12) sheets on top of the
`lib_mage.py` index canvas. `python3 lib_druid.py` rebuilds all 22, `python3 <key>.py`
one sheet. Each script's FRAME, FRAMES and ANCHOR are compared with
`src/assets/retroClassSkills.ts` and a mismatch aborts the build. Colour identity:
druid LEAF green, BARK brown, MOON silver (+ blossom pink); witch HEX violet,
TOXIC green (+ BLOOD crimson for life drain, GLASS lilac for the mirror).
Checks: size, binary alpha, ≤16 colours, no empty cell, neighbour change ≥ 5 % of ink.
Review output: `.omo/pixel-fx/<key>-preview.png`, `druid|witch-sheet.png`, `druid|witch-composite.png`.

## Monster skill sheets 0–17 (retro2003)

`lib_monster_0_17.py` draws sheets 0–17 of `RETRO_MONSTER_FX_SHEETS` in `src/assets/retroMonsterSkills.ts`
(acid, slam, drain, screech, sting, web, scythe, howl, charge, tusk, claw, fang, shell, hellfire, curse skull, bone arrow).
It reuses the `lib_samurai.Ink` cel and the `lib_scout` checks. Each script's anchor, frame size and count are compared
with the contract, and the build also stops if the first 18 contract keys change order.
Direction is the mirror of the class sheets: monsters stand on the left, so projectiles face right and hits arrive from the left.
Every cell ends with `fx_edge.fade_edges`. Colour identity: poison is acid green and violet, darkness is violet, black and crimson,
fire is orange-red with soot, earth is brown dust. `python3 lib_monster_0_17.py` rebuilds all 18 and writes
`.omo/mfx/<key>-preview.png`, `frames-0_17-part*.png` and `board-0_17*.png` (stage mock-up with actor1-0).

## Monster skill sheets 36–52 (retro2003, monster → ally)

`lib_monster_36_52.py` draws RETRO_MONSTER_FX_SHEETS[36..52] of `src/assets/retroMonsterSkills.ts`
(17 keys, `mon_smoke_bomb` … `mon_judgment_sky`). `python3 lib_monster_36_52.py` rebuilds all of them,
`python3 mon_<key>.py` one. Each script's anchor, frame size and frame count are compared with the contract
(and the key must fall inside index 36–52); a mismatch aborts before writing. Direction is mirrored from the class
skills: monsters stand left, so projectile cells face right and cuts, thrusts and breath travel left → right.
Target cells put the ally's feet on row 56. Screen sheets end with `fx_edge.fade_oval`, target/user sheets with
`fade_edges`, and a despeckle pass clears ink with no neighbour within 2 px. Colours: smoke olive, steel +
blood, gale mint + feathers, rock/dust brown-orange, fire orange-red, rage blood-red, dark violet-black + crimson.
Review output goes to `.omo/mfx/<key>-preview.png` (4×) and `.omo/mfx/board-36_52.png` (stage #405838, monster
stand-in square, actor1-0 at 2×; `-partN.png` slices stay under 1900 px).

## Monster skill sheets 18~35 (retro2003)

`lib_monster_18_35.py` draws RETRO_MONSTER_FX_SHEETS index 18~35 of `src/assets/retroMonsterSkills.ts`
(18 keys, `mon_arrow_hit` … `mon_hex_flame`, listed in contract order with duplicate keys removed). The key list,
anchor, frame size and frame count are all parsed from the contract, and a mismatch aborts the build.
`python3 lib_monster_18_35.py` rebuilds every sheet; `python3 <key>.py` rebuilds one.
Monsters stand on the left, so projectiles face right on the first frame and slashes come in from the left.
Every cell is finished automatically: screen layers get `fade_oval`, and body layers get `fade_edges` on all four sides.
Colours: poison yellow-green + violet, darkness violet/black/crimson, ice blue-white, fire orange/red, earth brown.
Checks: size, binary alpha, ≤16 colours, no empty frame, neighbouring frames differ, isolated pixels (counted before edge dithering).
Review output: `.omo/mfx/<key>-preview.png` and `.omo/mfx/board-18_35(-partN).png`, a mock stage on #405838 with a monster square and actor1-0 at 2x.


## r2w1 묶음 a1·a2 (2026-09-29)

직업 모듈 r2w1_<classKey>.py 가 스킬 8개와 새 시트를 가진다. python3 lib_r2w1.py <a1|a2> 로 시트+확인판(.omo/r2w1/<batch>/), --emit <batch> 로 묶음 TS. a2 부터 스킬당 새 시트 ≤1장, 나머지는 기존 시트 재사용(Skills.check(reuse) 가 검사: 몬스터 투사체 금지, screen 은 128 화면 시트만).

## r2w2 — 묶음 a3·p1 이펙트 (2026-09-29)

공용 모듈 lib_r2w2.py. 스킬표 정본은 emit_r2w2_skills.py → src/assets/retroRosterSkills/a3.ts·p1.ts 로 생성, 각 <key>.py 는 그 .ts 의 anchor·frame·frames 와 다르면 멈춘다.
python3 scripts/asset-gen/pixel-fx/lib_r2w2.py a3 p1 은 묶음이 소유한 접두(a3: berserker_…swordsman_, p1: scholar_…priest_monk_)의 시트 137장(a3 82 · p1 55)을 다시 굽고 .omo/r2w2/<batch>/fx/ 에 4배 미리보기를 쓴다.
p1 은 스킬마다 새 시트 최대 1장이고 나머지 층은 기존 시트(focus·heal·sleep·cleric_*·mage_*·mon_* 등)를 재사용한다.

## retro2003 2차 로스터 p2·p3 (r2w3, 2026-09-29)

- 목록 정본 `r2w3_skills.py` → `python3 r2w3_emit.py p2 p3` 가 `src/assets/retroRosterSkills/p2.ts·p3.ts` 를 쓴다. 공용 모듈 `lib_r2w3.py`.
- p2 직업별 모듈 `r2w3_<class>.py`(8개). p3 는 새 시트 16장을 `r2w3_p3.py` 한 파일에 두고, 나머지 층은 `reuse()` 로 기존 시트를 읽기만 한다(스킬당 새 시트 ≤ 1, emit 이 검사).
- 생성 전 묶음 파일의 frame·frames·anchor 가 등록값과 다르면 멈춘다(`check_contract`). 검토판은 `.omo/r2w3/<batch>/`.

## retro2003 로스터 2차 r2w5 — b1(Animal)·b3(Monster1)·b5(Monster3) (2026-09-29)

- 공용 모듈 lib_r2w5.py: 시트는 r2w5_<직업 키>.py 에 @sheet(키, frame, frames, anchor, Pal) 로 등록하고, <키>.py 는 한 장만 만드는 진입점이다.
  frame·frames·anchor 는 src/assets/retroRosterSkills/b1·b3·b5.ts 에서 읽어 대조하고 다르면 멈춘다.
- 스킬 표(정본): gen_r2w5_b1_ts.py·gen_r2w5_b3_ts.py·gen_r2w5_b5_ts.py 가 묶음 TS 를 생성한다. 재사용 시트는 PNG 크기와 대조, 새 시트는 스킬당 1장.
- 실행: python3 scripts/asset-gen/pixel-fx/lib_r2w5.py dog reaper siren (직업 키별 전부 + 무대판) 또는 python3 scripts/asset-gen/pixel-fx/<키>.py
- 검수판: .omo/r2w5/<묶음>/fx/


## retro2003 로스터 b4 (Monster2 8종)

스킬 64개, 레이어 72장. 공용 모듈 `lib_r2w8.py`, 키마다 `<key>.py` 하나. 규격(anchor·frame·frames)은 `src/assets/retroRosterSkills/b4.ts` 에서 읽고 다르면 멈춘다.
`python3 lib_r2w8.py` 전부, `python3 lib_r2w8.py class:oni_warrior` 직업 하나(확인판·가상 무대 합성판 `.omo/r2w8/b4/fx/`), `python3 lib_r2w8.py <key>` 시트 하나.
전투 도트 9칸 시트는 `scripts/asset-gen/party-pixel/monster2-<i>.py`, 확인판은 `review_b4.py`.

## Roster batch p5 (retro2003 2차 로스터)

People5-3~5-7 다섯 직업(무녀·사막 전사·메이드·은자·노병)의 새 시트 26장. 클래스별 생성기
`fx_shrine_maiden.py` `fx_desert_warrior.py` `fx_maid.py` `fx_hermit.py` `fx_old_warrior.py`,
공용 모듈은 p4 와 같은 `lib_r2w4.py` (계약: `src/assets/retroRosterSkills/p5.ts`, 스킬당 새 시트 최대 1장,
나머지 층은 기존 시트 재사용). `python3 fx_<class>.py` 로 그 직업 시트와 확인판(`.omo/r2w4/p5/`)을 다시 만든다.
투사체(ofuda·plate·flask)는 머리가 왼쪽. screen 128 층은 `fade_oval` 로 둥글게 끝난다.

## 묶음 m6 (OPRN 자체 Monster6 — 전설의 괴수 8명)

예티·인어 전사·사이클롭스·나방 인간·바실리스크·지니·키메라·타락 천사의 새 시트 20장(키 접두 yeti_ · merfolk_ · cyclops_ ·
mothman_ · basilisk_ · djinn_ · chimera_ · dark_angel_). 시트마다 <키>.py 하나, 공용 모듈 lib_nm6.py
(팔레트 색인 칸·도형·Bayer 디더, 마무리 fade_oval/fade_edges, 검사, 확인판 .omo/nm6/fx/).
스킬 표 64개는 gen_m6_ts.py 가 src/assets/retroRosterSkills/m6.ts 로 쓴다 — 재사용 레이어의 anchor·frame·frames 는
기존 정의에서 읽어 오고, 스킬당 새 시트 최대 1장·레이어 PNG 크기를 검사한다. 투사체 3장은 머리가 왼쪽.
걷기 칩은 scripts/asset-gen/oprn-charset/monster6.py, 전투 15칸은 scripts/asset-gen/party-pixel/monster6-<i>.py + pp15_nm6.py
(칩 함수를 같은 배율로 다시 불러 대기 칸 = 칩 왼쪽 서 있는 칸).

## m5 (Monster5 저주받은 물건 8명, nm5, 2026-09-29)

- 공용 모듈 lib_nm5.py, 새 키 32장(접두 mimic_pal_·living_armor_·lantern_ghost_·doll_·book_demon_·scarecrow_·clockwork_·candle_imp_), 키마다 <key>.py.
- run() 은 src/assets/retroRosterSkills/m5.ts 의 frame·frames 와 스크립트가 다르면 멈춘다. 128 은 fade_oval, 64 는 fade_edges. 투사체 첫 칸은 왼쪽.
- 전부 다시 굽기·미리보기: python3 scripts/asset-gen/pixel-fx/lib_nm5.py → .omo/nm5/d-fx-preview-{1,2}.png, 키별 .omo/nm5/fx/<key>.png.


## retro2003 3차 로스터 m4 (Monster4 숲·요괴 8명, 2026-09-29)

- 스킬 표 정본 gen_nm4_ts.py → src/assets/retroRosterSkills/m4.ts. 재사용 층은 키만 적고 anchor·frame·frames 는 기존 정의에서 읽어 온다(PNG 크기도 대조). 스킬당 새 시트 ≤ 1, 새 키는 <classKey>_ 접두.
- 새 시트 16장(직업마다 대표 1 + 필살기 하늘 1): 그림 nm4_sheets.py, 공용 lib_nm4.py(RGBA 캔버스, screen 은 fade_oval · 나머지 fade_edges), 키마다 <key>.py 진입점.
- python3 lib_nm4.py 전부 · python3 lib_nm4.py <key> 한 장. 미리보기 .omo/nm4/fx/<key>.png.
