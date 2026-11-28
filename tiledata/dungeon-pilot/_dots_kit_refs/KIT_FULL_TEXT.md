# 픽셀 도트 에셋 생성: 프롬프트와 레퍼런스

RPG 쯔꾸르 2000/2003 느낌(16×16px 타일)의 게임 오브젝트를, AI 에이전트가 코드로 한 픽셀씩 그리게 하는 지시서와 참고 그림 전체예요. 세계관은 두 가지예요: 현대 한국 도시, 중세 판타지 항구 마을 "버들항".

흐름실제 지시서시점 규칙참고 그림심사 프롬프트교훈결과 예시

## 흐름

1. 품목 목록현대·버들항 품목 수백 개. 품목마다 시점, 캔버스, 목표 크기, 알아볼 특징이 정해져 있어요.

2. 지시서 만들기공통 틀에 품목 정보와 참고 그림 목록을 채워 작업 하나를 만들어요.

3. 그리기Antigravity 에이전트(Gemini 4 Neon)가 서브에이전트 5개로 동시에, 작업마다 변형 5장을 Python + Pillow 코드로 그려요. 이미지 생성 모델은 금지.

4. 기계 검사캔버스 크기, 투명 배경, 실제 그린 크기, manifest를 자동 검사해요.

5. 심사작업마다 새로 띄운 Claude Opus 5.5가 후보를 1배·확대로 보고 쓸 만한 것을 모두 남겨요. 하나도 없으면 수정 메모를 붙여 다시 그리게 해요.

16×16px맵 타일 한 칸
0.13px/cm실제 크기 비율 (170cm 캐릭터 = 22px)
5장작업 하나당 변형 수
약 $0.02심사 1건 비용
약 4~5분작업 하나 (서브에이전트 기준)

## 실제 지시서

지금 큐에 들어간 실제 지시서 두 개예요. 품목마다 이름, 캔버스, 목표 크기, 시점 규칙, 참고 그림 목록만 바뀌고 나머지는 같아요. 지시서는 영어로 써요.

현대 예시: #302 자전거 거치대 48×16px · standing지시서 복사
지시서 전문 보기
```
# MODEL: Antigravity agent. Line 1 of notes.txt = the exact model and thinking level you actually ran.

# TASK: Five independent variants of steel bicycle rack, SPEC 5 (board #302, job 1302, output beodeul_cityv2_1302.zip)

SETTING: a modern Korean city

Draw five ORIGINAL pixel-art sprites of the same object for a modern Korean city in an RPG Maker 2000/2003-style game (OpenRPGMaker, 16x16 px map tiles). Draw every pixel with code (Python + Pillow): no image generation model, no tracing, no copying reference pixels. A fresh reviewer keeps every one that meets the quality bar at native 1x, so make every one a serious, finished attempt.

## 1. References (open every file at native size AND at 4x nearest-neighbour before drawing)
All files are in ~/work/agy-dots/refs/.
- ref_mod1_char.png
- ref_mod_scale.png
- ref_palette_v3.png
- ref_s4_best_row.png
- ref_ez_row_4x.png
- ref_ezx_row_4x.png
- ref_demo_modern_city_props.png
- ref_mod1_row_2x.png
- EasyRPG pieces show the target finish at 16 px per tile: chunky readable silhouettes, 3-5 tone clusters per material, a dark 1 px outline, light from the top-left. Use them for silhouette, cluster size and shading habits. Do NOT copy their palette or trace their pixels.
- ref_mod1_char.png / ref_mod_scale.png: the player character (170 cm = 22 px tall) and a ruler with 50/100/170/300 cm lines. Your object must look right standing next to this character.
- ref_palette_v3.png: the modern palette (118 colours). Pick every colour from it, except the one shadow colour in section 6.

## 2. Camera (hard rule)
- Orthographic RPG Maker view, light from the top-left. Show ONLY the FRONT face plus a narrow TOP band (lid, roof, top edge) above it, about 1/4-1/3 of the visible height.
- NO SIDE WALLS: never draw the left or right side face. No isometric diamond, no two-point perspective, no vanishing lines. A visible side face is an automatic fail.
- The object faces the camera (facing down).

## 3. Size (hard rule)
- Canvas: exactly 48x16 px (3x1 tiles), transparent background, object bottom-aligned and horizontally centred.
- Opaque pixels (ground shadow excluded) must match: target visible 42-48 x 12-16 px. Measure with a script; a file outside the range fails the machine check and cannot be picked.
- Real-world scale is 0.13 px per cm (170 cm person = 22 px). Small hand-held or table-top items are drawn larger than real scale on purpose so they fill one tile.

## 4. Readability and identity (hard rule)
- What makes this object recognisable, and what each sprite must show clearly at 1x: row of bent steel loops standing on a bar, shiny with light highlights
- ONE object per file. No table under it, no person, no floor tile, no second object, no text or logos (shapes that suggest buttons or a screen are fine).
- Blind test: a player who is not told the name must name the object in one second at 1x. If it could read as "a box" or "a blob", enlarge its defining feature.
- Small canvases need FEWER, larger shapes, not more detail. No single-pixel noise, no dithering.

## 5. The 5 sprites (one per file)
1. steel bicycle rack (canvas 48x16 (3x1 tiles), target visible 42-48 x 12-16 px; id city-md-bike-rack-01; name_ko 자전거 거치대; facing down)
2. steel bicycle rack (canvas 48x16 (3x1 tiles), target visible 42-48 x 12-16 px; id city-md-bike-rack-02; name_ko 자전거 거치대; facing down)
3. steel bicycle rack (canvas 48x16 (3x1 tiles), target visible 42-48 x 12-16 px; id city-md-bike-rack-03; name_ko 자전거 거치대; facing down)
4. steel bicycle rack (canvas 48x16 (3x1 tiles), target visible 42-48 x 12-16 px; id city-md-bike-rack-04; name_ko 자전거 거치대; facing down)
5. steel bicycle rack (canvas 48x16 (3x1 tiles), target visible 42-48 x 12-16 px; id city-md-bike-rack-05; name_ko 자전거 거치대; facing down)

## 6. Outline, colour, shadow
- 1 px outline on every edge that touches transparency, using the DARKEST shade of the material it encloses (not pure black, never a light colour on the outer edge; glass or chrome may have at most a few rim-light pixels).
- Clean ramps of 3-5 tones per material: highlight on top-left surfaces, shadow on bottom-right. Clean, bright mid-tones; real contrast. Avoid muddy grey-brown, low-saturation results.
- Optional ground shadow under the object: colour #4c557f at alpha 85/255. It is the ONLY semi-transparent colour; every other pixel is alpha 0 or 255.

## 7. Variety across the five
Same object, same camera, same canvas and size range, but five genuinely different designs: vary the colour family, the model/shape (old vs new, rounded vs boxy), condition (new, worn, dented, dirty), and one or two accessories. Do not make recolours of one drawing. Write one short line per variant in notes.txt saying what makes it different.

## 8. Self-review (ONE pass, keep it cheap)
Draw all five in one script. Then look ONCE at a single contact sheet of all five (1x and enlarged): (a) camera against section 2, (b) outer outline is the darkest tone, (c) at 1x next to the character, would a player name it in one second? Fix only clear failures in ONE edit of the script, not a rewrite, and do not loop on further looks. The machine check (canvas, alpha, opaque size, manifest) is done by the check command; fix whatever it reports. The reviewer picks the good ones, so five honest variants beat endless polishing.

## 9. Deliverables (flat ZIP, nothing else inside)
- modern_s4_01.png ... modern_s4_05.png in the order of section 5.
- manifest.json: a list of 5 objects {"file","id","name_en","name_ko","description","tags","tiles","facing"}; copy file/id/name_ko/tiles ("3x1")/facing exactly from section 5; tags = 5-10 short words; description = one detailed sentence about that variant.
- notes.txt: line 1 model + thinking level; then one line per file: name, opaque size, what makes the variant different, self-score 0-10.
- preview_2x.png: all five at 2x on grey #767670 next to the character.
Name the archive beodeul_cityv2_1302.zip.

## Opus review
After submission a fresh Opus 5.5 session sees a blind contact sheet (each candidate at 1x and enlarged) and keeps every candidate that meets the quality bar (no fixed number). If it picks none, the job comes back with a "Rework" section below: read it and redraw all of them with those notes.

```

버들항 예시: #303 물지게 32×16px · standing지시서 복사
지시서 전문 보기
```
# MODEL: Antigravity agent. Line 1 of notes.txt = the exact model and thinking level you actually ran.

# TASK: Five independent variants of shoulder yoke with pails, SPEC 5 (board #303, job 1303, output beodeul_cityv2_1303.zip)

SETTING: Beodeul (버들항), a medieval-fantasy harbour town

Draw five ORIGINAL pixel-art sprites of the same object for Beodeul (버들항), a medieval-fantasy harbour town in an RPG Maker 2000/2003-style game (OpenRPGMaker, 16x16 px map tiles). Draw every pixel with code (Python + Pillow): no image generation model, no tracing, no copying reference pixels. A fresh reviewer keeps every one that meets the quality bar at native 1x, so make every one a serious, finished attempt.

## 1. References (open every file at native size AND at 4x nearest-neighbour before drawing)
All files are in ~/work/agy-dots/refs/.
- ref_bd6_row_3x.png
- ref_bd6_city_harb_wooden_crates_stack.png
- ref_beodeul_props_best_4x.png
- ref_beodeul_style_row_4x.png
- ref_beodeul_char_4x.png
- ref_bd_scale_4x.png
- ref_bd9_row_2x.png
- ref_bd6_row_3x.png and the other ref_bd6_* files are THE STYLE: existing Beodeul harbour-town art (church, timber and stone houses, warm trees, the harbour crate stack). Your object must look like it belongs in that same game when placed next to them: same dark outline, same warm wood/stone/brick ramps, same shading steps and texture density (wood grain, planks, rope, stone blocks), same 3/4 top band.
- ref_beodeul_props_best_4x.png and ref_beodeul_style_row_4x.png: approved Beodeul props, the quality bar.
- ref_beodeul_char_4x.png / ref_bd_scale_4x.png: the Beodeul character and size ruler (0.13 px per cm). Your object must look right standing next to this character.
- Colour: sample ramps from the ref_bd6 art: weathered oak and pine browns, tarred dark wood, rope tan, wet stone greys, rusted iron, faded sail cloth, sea teal and blue, small accents of red and ochre. Warm and slightly dark overall; highlights only on top-left edges. Do NOT use bright modern plastic colours.

## 2. Camera (hard rule)
- Orthographic RPG Maker view, light from the top-left. Show ONLY the FRONT face plus a narrow TOP band (lid, roof, top edge) above it, about 1/4-1/3 of the visible height.
- NO SIDE WALLS: never draw the left or right side face. No isometric diamond, no two-point perspective, no vanishing lines. A visible side face is an automatic fail.
- The object faces the camera (facing down).

## 3. Size (hard rule)
- Canvas: exactly 32x16 px (2x1 tiles), transparent background, object bottom-aligned and horizontally centred.
- Opaque pixels (ground shadow excluded) must match: target visible 26-32 x 12-15 px. Measure with a script; a file outside the range fails the machine check and cannot be picked.
- Real-world scale is 0.13 px per cm (170 cm person = 22 px). Small hand-held or table-top items are drawn larger than real scale on purpose so they fill one tile.

## 4. Readability and identity (hard rule)
- What makes this object recognisable, and what each sprite must show clearly at 1x: curved wooden shoulder yoke with a wooden pail hanging from each end
- ONE object per file. No table under it, no person, no floor tile, no second object, no text or logos (shapes that suggest buttons or a screen are fine).
- Blind test: a player who is not told the name must name the object in one second at 1x. If it could read as "a box" or "a blob", enlarge its defining feature.
- Small canvases need FEWER, larger shapes, not more detail. No single-pixel noise, no dithering.

## 5. The 5 sprites (one per file)
1. shoulder yoke with pails (canvas 32x16 (2x1 tiles), target visible 26-32 x 12-15 px; id city-bd-water-yoke-01; name_ko 물지게; facing down)
2. shoulder yoke with pails (canvas 32x16 (2x1 tiles), target visible 26-32 x 12-15 px; id city-bd-water-yoke-02; name_ko 물지게; facing down)
3. shoulder yoke with pails (canvas 32x16 (2x1 tiles), target visible 26-32 x 12-15 px; id city-bd-water-yoke-03; name_ko 물지게; facing down)
4. shoulder yoke with pails (canvas 32x16 (2x1 tiles), target visible 26-32 x 12-15 px; id city-bd-water-yoke-04; name_ko 물지게; facing down)
5. shoulder yoke with pails (canvas 32x16 (2x1 tiles), target visible 26-32 x 12-15 px; id city-bd-water-yoke-05; name_ko 물지게; facing down)

## 6. Outline, colour, shadow
- 1 px outline on every edge that touches transparency, using the DARKEST shade of the material it encloses (not pure black, never a light colour on the outer edge; glass or chrome may have at most a few rim-light pixels).
- Clean ramps of 3-5 tones per material: highlight on top-left surfaces, shadow on bottom-right. Clean, bright mid-tones; real contrast. Avoid muddy grey-brown, low-saturation results.
- Optional ground shadow under the object: colour #4c557f at alpha 85/255. It is the ONLY semi-transparent colour; every other pixel is alpha 0 or 255.

## 7. Variety across the five
Same object, same camera, same canvas and size range, but five genuinely different designs. STAY INSIDE THE BEODEUL PALETTE for every variant: no blue, green, crimson or other bright paint jobs unless the object is naturally that colour (sea water, a lantern glow, a small red or ochre accent). Vary instead: wood type and tone (light pine, oak, dark tarred), shape and proportions, construction details (hoops, planks, nails, ropes, patches), condition (new, weathered, repaired, salt-stained) and contents or accessories. Do not make recolours of one drawing. Write one short line per variant in notes.txt saying what makes it different.

## 8. Self-review (ONE pass, keep it cheap)
Draw all five in one script. Then look ONCE at a single contact sheet of all five (1x and enlarged): (a) camera against section 2, (b) outer outline is the darkest tone, (c) at 1x next to the character, would a player name it in one second? Fix only clear failures in ONE edit of the script, not a rewrite, and do not loop on further looks. The machine check (canvas, alpha, opaque size, manifest) is done by the check command; fix whatever it reports. The reviewer picks the good ones, so five honest variants beat endless polishing.

## 9. Deliverables (flat ZIP, nothing else inside)
- modern_s4_01.png ... modern_s4_05.png in the order of section 5.
- manifest.json: a list of 5 objects {"file","id","name_en","name_ko","description","tags","tiles","facing"}; copy file/id/name_ko/tiles ("2x1")/facing exactly from section 5; tags = 5-10 short words; description = one detailed sentence about that variant.
- notes.txt: line 1 model + thinking level; then one line per file: name, opaque size, what makes the variant different, self-score 0-10.
- preview_2x.png: all five at 2x on grey #767670 next to the character.
Name the archive beodeul_cityv2_1303.zip.

## Opus review
After submission a fresh Opus 5.5 session sees a blind contact sheet (each candidate at 1x and enlarged) and keeps every candidate that meets the quality bar (no fixed number). If it picks none, the job comes back with a "Rework" section below: read it and redraw all of them with those notes.

```

## 시점 규칙
품목 종류마다 지시서 2절에 들어가는 문단이에요. 건물·탑은 어색해서 지금은 만들지 않아요.

### 일반 소품·가구·기계 (standing)

```
- Orthographic RPG Maker view, light from the top-left. Show ONLY the FRONT face plus a narrow TOP band (lid, roof, top edge) above it, about 1/4-1/3 of the visible height.
- NO SIDE WALLS: never draw the left or right side face. No isometric diamond, no two-point perspective, no vanishing lines. A visible side face is an automatic fail.
- The object faces the camera (facing down).
```
이 시점에 추가되는 참고 그림: ref_mod1_row_2x.png

### 위에서 본 것: 탁자·침대·소파·부두 (topdown)

```
- Seen from ALMOST DIRECTLY ABOVE, like ref_ezt_table_long_h.png, ref_ezt_table_round.png and ref_ezt_desk_low.png. The flat top surface (table top, seat cushions, water surface) is at least 75% of the visible height; the front edge below it is at most 3 px; legs are 1-2 px stubs or hidden.
- The object fills its tiles so it lines up with the 16 px map grid. Surfaces are EMPTY (nothing standing on a table or desk).
- No side walls, no perspective, light from the top-left.
```
이 시점에 추가되는 참고 그림: ref_ezt_table_long_h.png, ref_ezt_table_round.png, ref_ezt_desk_low.png, ref_base_tables_row_4x.png

### 탈것: 차·배·수레 (vehicle)

```
- 3/4 side view facing RIGHT: the full side profile of the vehicle plus a visible ROOF band on top (25-35% of the visible height), like a car seen from slightly above. Never a flat pure side view without a roof band, never a front or top-down view, never isometric.
- All wheels sit on one ground line; front of the vehicle points right; windows show a light reflection.
- Boats and carts use the same camera: side profile facing right plus a visible deck or top band.
```
이 시점에 추가되는 참고 그림: ref_demo_vehicles.png, ref_demo_modern_city_scene.png

### 의자 (chair)

```
- Near top-down like ref_ezt_chair_front_a.png / ref_ezt_chair_front_b.png: the seat is seen from above, the backrest is a band along the TOP edge, the chair faces down toward the camera.
- No side walls, no perspective, light from the top-left.
```
이 시점에 추가되는 참고 그림: ref_ezt_chair_front_a.png, ref_ezt_chair_front_b.png

### 기둥·등·표지판 (slender)

```
- Orthographic RPG Maker view, light from the top-left. A thin upright object: show the pole/post and its head or sign from the front, with a small base on the ground line.
- No side faces, no perspective. Keep the post 2-4 px wide with a 1 px outline so it stays readable.
```
이 시점에 추가되는 참고 그림: ref_demo_modern_city_scene.png

## 참고 그림

EasyRPG(무료 RPG 쯔꾸르 호환 엔진) 공개 그래픽과 승인된 우리 그림이에요. 베끼지 말고 실루엣, 색 덩어리 크기, 명암 습관만 따라 하라고 지시해요.

### 현대 작업 공통 (7장)
현대 캐릭터 (크기 기준, 170cm = 22px)
ref_mod1_char.png현대 크기 자 (50/100/170/300cm)
ref_mod_scale.png현대 팔레트 v3 (118색)
ref_palette_v3.png승인된 품질 기준 줄
ref_s4_best_row.pngEasyRPG 소품 줄 (4배)
ref_ez_row_4x.pngEasyRPG 추가 소품 줄 (4배)
ref_ezx_row_4x.png현대 도시 소품 데모
ref_demo_modern_city_props.png

### 버들항 작업 공통 (7장)
버들항 건물·나무 줄 (화풍 기준)
ref_bd6_row_3x.png버들항 항구 상자 더미
ref_bd6_city_harb_wooden_crates_stack.png승인된 버들항 소품 (품질 기준)
ref_beodeul_props_best_4x.png버들항 화풍 줄
ref_beodeul_style_row_4x.png버들항 캐릭터 (4배)
ref_beodeul_char_4x.png버들항 크기 자 (4배)
ref_bd_scale_4x.png버들항 소품 줄 (2배)
ref_bd9_row_2x.png

### 시점별로 추가되는 그림 (9장)
탁자 기본 실루엣 (4배)
ref_base_tables_row_4x.png현대 도시 장면 데모
ref_demo_modern_city_scene.png탈것 시점 데모 (3/4 옆모습)
ref_demo_vehicles.pngEasyRPG 의자 A
ref_ezt_chair_front_a.pngEasyRPG 의자 B
ref_ezt_chair_front_b.pngEasyRPG 낮은 책상
ref_ezt_desk_low.pngEasyRPG 긴 탁자 (위에서 본 모습)
ref_ezt_table_long_h.pngEasyRPG 둥근 탁자
ref_ezt_table_round.png현대 소품 줄 (2배)
ref_mod1_row_2x.png

## 심사 프롬프트 (Claude Opus 5.5)
작업마다 새 세션으로, 후보 시트 이미지 한 장과 이 문장만 보내요. 입력 약 4,500토큰, 결과는 JSON.

```
Read the image {시트 이미지}. It is a blind contact sheet of {후보 수} candidate sprites of ONE object: {물건 이름}. Canvas {캔버스} px. Each cell shows a code, the sprite enlarged, and the same sprite at native 1x to its right. What must read at 1x: {알아볼 특징}. Judge mainly the 1x versions: (1) a player names the object in one second, (2) camera follows the RPG Maker rule (front face plus top band, no side walls or perspective; top-down for tables/sofas/fountains; vehicles 3/4 side view with a roof band; BUILDINGS AND TOWERS 3/4 top-down with the roof or top levels clearly seen from above, a flat front elevation fails, doors about as tall as a 25 px character), (3) clean pixel clusters, dark outer outline, clear shading, no noise, (4) fits {세계관}. These codes failed machine checks, never pick them: {기계 검사 탈락 코드}. The bar: would a game developer happily place this sprite on a map as it is? These candidates usually come from a strong model and are often all usable, so keeping most or all of them is normal. KEEP every candidate that is clean, readable at 1x, follows the camera rule and fits the setting, even if it is simple. REJECT only clear problems: unreadable or reads as a different object; wrong camera (visible side walls, perspective, a flat elevation for a building); messy noise or a broken outline; colours that clash with the setting; or a near-duplicate of a candidate you already kept. Return JSON: {"visible":true,"seen":[every code in reading order, top row left to right then bottom row],"picks":[{"id":"code","reason":"one short Korean sentence on what is good"}],"rework":"if picks is empty: 2-4 concrete English redraw instructions, else empty string"}. If you cannot see the image return {"visible":false}.
```

## 교훈 (LESSONS.md)
지금까지 심사 결과에서 뽑은 요령이에요. 서브에이전트가 매번 그리기 전에 읽어요.

```
# Lessons from 107 Opus reviews (2026-11-26). Read before drawing. Max 20 lines.
- Make the object instantly readable at 1x: one confident, solid silhouette that fills about 12 to 14 px of the 16 px tile, never a tiny blob.
- Draw the defining features the object is known by (lighthouse red bands, taxi checker stripe and roof light, ATM screen and keypad, anvil horn) so the reviewer names it in one second.
- Shade every material with a 3 to 4 tone ramp (highlight, mid, shadow, deep shadow) and keep wood, iron, brass and stone ramps visibly separate.
- Wrap the whole sprite in a dark 1 px outline, using a darker hue of the local color, and keep pixel clusters clean with no stray noise.
- Use the RPG Maker 2003 3/4 top-down camera: show the top face (roof bands, rims, counter tops, lids) as a lit strip above the front face.
- Push contrast between adjacent materials: dark wood frame vs bright contents, grey metal vs lit display, dark posts vs pale net.
- Add 2 or 3 small story details that fit the setting (iron corner caps, brass locks, nails, mugs, buoys, coiled rope), but never random clutter like fruit or leaves.
- Bind wood with dark iron straps or hoops that each carry a 1 px highlight, and give plank or stave seams dark gap lines.
- Shape curved objects with curved shading (barrels, kettles, cones, boat hulls with upturned bow and stern) so they cannot read as flat boxes.
- Give the silhouette a distinctive structure: braced legs, crossbars, arches with keystones, stepped tops, pyramids of crates or sacks.
- Make each variant differ in form or palette (added base plate, swapped colors, different stacking) while keeping the core identity.
- Light from the top left: brighten top and left edges, shadow bottom and right edges, including on recessed panels and bevels.
- Avoid the top failure, ambiguous form: a cask must lie on its side on a cradle with its round head shown, a trap must have a domed slatted top, so neither reads as a chest or crate.
- Avoid undersized key faces: make a bar or counter front about 40 to 50 percent of the height with 3 to 4 recessed panels, not a 3 to 4 px strip.
- Draw rope as a thick 2 px tan strand with lighter twist dots and show where it goes (over a wheel, coiled in a spiral), so it never reads as a sack.
- Show mechanical parts explicitly: a pulley needs a round sheave with a dark axle pin, a steel frame, a top ring and a separate hooked iron hook.
- Use glowing elements (lantern glass, fire, screens, embers) as the brightest pixels with a yellow to red or light to dark ramp.
- Render water as dark with a few bright highlight or foam pixels inside a clearly outlined stone or wood rim.
- Keep surfaces purposeful: polished long-grain highlights on a counter, not a plank floor or crate pattern pasted on.
- Check the sprite at 1x before finishing, and if the object name is not obvious, enlarge its defining feature and simplify everything else.
- Give stepped structures (stairs, gangplanks, docks) unmistakable silhouette cues like sturdy post railings, flared bottom steps, and crisp bright step edges vs dark riser shadows.
- For bars, counters, and tables, match the silhouette to the named object (e.g. dark panelled front + brass rail for bars; clean top + stub legs for tables) so it never reads as a generic crate.

```

## 결과 예시 (최근 5장 작업에서 남은 그림)

#294 맨홀 뚜껑 · 2/5 남김
#292 인도 볼라드 · 4/5 남김
#291 얼음 덩이 · 4/5 남김
#290 차량 신호등 · 3/5 남김
#289 징검돌 · 5/5 남김
#288 배달 오토바이 · 5/5 남김
#287 굴 무더기 · 4/5 남김
#286 병원 침대 · 4/5 남김
#285 연잎 · 5/5 남김
#284 분리수거함 · 4/5 남김
#283 고래 턱뼈 아치 · 5/5 남김
#282 주유기 · 5/5 남김
