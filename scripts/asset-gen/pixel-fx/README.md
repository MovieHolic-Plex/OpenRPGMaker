# retro2003 skill effects

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


## retro2003 로스터 2차 r2w5 — b1(Animal)·b3(Monster1)·b5(Monster3) (2026-09-29)

- 공용 모듈 lib_r2w5.py: 시트는 r2w5_<직업 키>.py 에 @sheet(키, frame, frames, anchor, Pal) 로 등록하고, <키>.py 는 한 장만 만드는 진입점이다.
  frame·frames·anchor 는 src/assets/retroRosterSkills/b1·b3·b5.ts 에서 읽어 대조하고 다르면 멈춘다.
- 스킬 표(정본): gen_r2w5_b1_ts.py·gen_r2w5_b3_ts.py·gen_r2w5_b5_ts.py 가 묶음 TS 를 생성한다. 재사용 시트는 PNG 크기와 대조, 새 시트는 스킬당 1장.
- 실행: python3 scripts/asset-gen/pixel-fx/lib_r2w5.py dog reaper siren (직업 키별 전부 + 무대판) 또는 python3 scripts/asset-gen/pixel-fx/<키>.py
- 검수판: .omo/r2w5/<묶음>/fx/

