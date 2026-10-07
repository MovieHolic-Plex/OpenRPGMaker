# 지역 시트 작업 지침 (감독이 작업자 에이전트에게 주는 계약)

본 시트 `monster-overworld`(마을·도로·동굴·실내·체육관 2차)는 이미 있다. 지역 시트는 같은 화풍으로 **다른 장소의 컨셉 + 타일 종류 + 보여 주기 맵 한 장씩**을 만든다.
에디터 안 AI 조수가 맵은 직접 깐다 — 우리가 만들 것은 「이런 장소를 깔 수 있는 타일과 그 문법을 증명하는 견본 맵」이다.

## 1. 절대 규칙

- **모든 픽셀은 좌표로 손으로 찍는다.** 생성 이미지 금지. Scarloxy·pret(닌텐도) 픽셀 복사 금지 — 잰 구조·문법만 쓴다.
- 원작 그림·조립본은 받지도 두지도 않는다(2026-10-07 저작권 정리로 `lib/pret_ref.py` 와 캐시 삭제). 잰 구조·문법 메모만 쓴다.
- 금지 명령: `npm run gates`·`gates:*`·`npm test`·`npx vitest`·`node scripts/run-vitest.mjs`·전체 `typecheck`·`git stash`(모든 변형). 원격 DB(Supabase/LegacyDb) 쓰기 금지. push·PR 금지.
- **다른 에이전트와 같은 파일을 고치지 않는다.** 새 파일만 만든다:
  `recipes/monster_<x>.py`(+ 필요하면 `recipes/<x>_*.py` 도우미), `harness-data/tileset-authoring/monster-<x>/seed.json`, `node/monster_<x>.mts`.
  공유 파일(`monster_overworld.py`·`outdoor2.py`·`interior2.py`·`gym2.py`·`cave.py`·`lib/*`·`node/kitlib.mts`·`harness.py`)은 **읽고 import 만** 한다.
  공유 파일에 꼭 고칠 데가 있으면 고치지 말고 최종 보고에 「감독에게 요청」으로 적는다.
- 자기 워크트리 브랜치에서 작업 단위마다 로컬 커밋(`feat(harness): …` 형식, 끝 줄 `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`).

## 2. 화풍 계약 (본 시트와 같아야 한다)

- 정면 위 3/4 시점. 빛은 왼쪽 위, 그림자는 오른쪽 아래(반투명 `(0,0,0,64)` 오른쪽 2px·아래 3px 가 본 시트 가구 규칙).
- 윤곽은 검정이 아니라 **그 재료의 가장 어두운 톤**(실내·체육관 가구는 통일 윤곽 `i2_ol #4a4a62`).
- 바닥 질감은 **조용하게**: 바탕 + 밝은 두 톤 덩이(`px.clumps`). 1px 잡음·어두운 점 남발 금지(적대 검수에서 「시끄럽다」로 떨어졌다).
- 램프는 3~5톤. 시드 `palette` 에 hex 목록으로 넣는다. 시트 전체 불투명 색 ≤ `limits.max_colors`(320).
- 바닥 칸(OPAQUE 목록)은 투명 픽셀 0. 물체·소품은 투명 바탕 + 위층(바닥이 받친다).
- 기준 화풍 예시(먼저 읽어라): `recipes/outdoor2.py`(턱·풀·꽃·표지판), `recipes/forest.py`(9조각 숲), `recipes/interior2.py`(벽·바닥·가구),
  `recipes/gym2.py`(올린 칸막이 오토타일·장치), `recipes/cave.py`(동굴 벽·모래 오토타일). 본 시트 그림: `bash cycle.sh <run>` 이 `/tmp/viz/*.png` 에 그린다(감독용 — 너는 돌리지 말고 이미 있는 파일을 본다).

### 2-1. 같은 물체는 함수 하나 (정본 표)

두 시트에 같은 물체·재료가 나오면 **정본 함수를 import 해서 호출**한다. 자기 시트에서 다시 그리지 않는다(색만 다르면 팔레트 인자로).
품질 루프 검수에서 「같은 장치인데 다른 그림」이 시트마다 [중]으로 떨어졌다(밀 바위·자르기 나무·얼음·용암·지붕·야자·마트).

| 물체·재료 | 정본 |
|---|---|
| 풀·꽃·턱·나무·숲·민가·센터·마트·지붕 | 본 시트 (`outdoor2.py`·`forest.py`·`buildings.py`, SECTIONS 이름으로 물려받기). 풀숲 덩이 귀·잎끝만은 아래 「키 큰 풀 덩이 귀」 행 |
| 괴력 밀기 바위 | 본 시트 `gym2.boulder` (`g2_boulder*`, 동굴 `cave_boulder` 도 같은 그림) |
| 바다·잔물결 | 해안 `coast.sea_px` |
| 야자 | 해안 `coast.py` 야자 함수 |
| 용암(흐름·껍질·뜨거운 테) | 던전 `dungeon_cavern.lava_cell(P, 255, f, key)` |
| 얼음 판·미끄럼 얼음·얼음 바위 | 던전 ice_cave 얼음 함수 |
| 유적 돌기둥 | 던전 유적 `ru_pillar` |
| 눈 더미 · 분기공(증기 구멍) | 던전 `ic_drift` · `lv_vent` |
| 외톨이 활엽수 `tree_a/b`·`forest_o`·`atree_a` | 본 시트 숲 벽 수관 `forest.crown`(옅은 타원 그림자) — 동그란 공 수관 금지 |
| 침엽수(눈 침엽수 포함) | 본 시트 `pine_a`, 눈은 색 인자·덧칠만 |
| 통·계류주 | 해안 `barrel`·`bollard` |
| 동굴 벽(모든 동굴) | 본 시트 `cave.granite_wall`, 색만 인자 |
| 깨는 바위 · 정지 칸 | 본 시트 `cracked_rock` · gymspin 정지 칸 |
| 워프 판 | 체육관 에스퍼 워프 판 |
| 묘비 | 던전 `gh_grave_*` |
| 실내 잔디 바닥 | 본 시트 풀 |
| 얼음 판 줄눈 | 없음(정본 던전 얼음 그대로) |
| 나무다리 `bridge_h/v` | 야생 `wild_river.log_bridge(P,o,"1")` (본 시트가 import) |
| 바위 고원 통행 | 윗면만 걷는다, 앞면 줄은 전부 막힘 — 계단만 통로(야생 `gface` 문법) |
| 자르기 나무 | 야생 `wild_forest.cut_tree` |
| 바위 벼랑·돌계단·굴 입구 | 야생 절벽 함수(본 시트 `rock_at*`·`rock_stairs`·`cave_mouth` 가 import, 사막·재 벼랑은 색 인자만) |
| 바위 벼랑 띠 끝(둥근 어깨·발끝) | 야생 `wild_mountain.add_round_face(sh, P, pre, top_px, low_px, shade_px)` → `<pre>_rnd<m>` 10칸(m = 12·76·6·38·4·3·19·9·137·1 = `wm.ROUND_MASKS` 키 S\|W·S\|W\|SW·S\|E·S\|E\|SE·S·N\|E·N\|E\|NE·N\|W·N\|W\|NW·N). 시트 없이 `round_face_set(...) -> {이름: 그림}`. 색은 `P["cliff"]`·바닥 함수 셋(`face_tile` 과 같은 인자). 배치 `node/wild_round.mts` `roundFace(rs, f, 앞면그룹, pre, [고원그룹…])` — join·faceVary 뒤, 사선 계단은 떼지 않는다. I6: 고원 윗면·옆벽에 붙은 어깨와 오목 모서리는 원 앞면을 유지하고 열린 발끝만 둥글게 한다(고원 속 변형 `memberTileIds`도 인식). 감독 결정 I4 W3: 모든 벼랑 띠 끝(본 `gface`, 기후 `dface`·`vface`·`iceface`)  · 본 시트 `plateau` 절에 `gface_rnd<m>` 10칸 구움(d98, 야생 gface_rnd 와 바이트 대조) |
| 키 큰 풀 덩이 귀·잎끝(둥근 귀) | 야생 `wild_tall.add_round_tall(sh, base, ramp, grounds)` → `<base><v>r<g><bits>`(v 0·1, bits 1..15, 바닥 글자 g) · `<base>_fringe_s_<a\|b\|ab>` · 옆 잎끝 두 벌 `<base>_fringe_<e\|w>_v<n>` · `<base>_fringe_<e\|w>_v<n>_<a\|b\|ab>`. `ramp` = 그 풀숲 램프(`P["tall"]`·`P["tall_snow"]`·`P["tall_ash"]`), `grounds = [(글자, ground_px)]`. `<base>0/1`·`<base>_fringe_s` 가 먼저 있어야 한다. 시트 없이 `round_tall_set(...)`, 낱칸 `tall_round`·`side_fringe`·`fringe_trim`. 배치 `node/wild_round.mts` `roundTall(rs, f, /^<base>\d$/, base, gnd)` — 잎끝을 다 깐 뒤 save 직전(옆 잎끝 `<base>_fringe_e/w` 를 두 벌로 바꾸고 귀에 닿은 끝을 자른다). 감독 결정 I4 W2: 모든 풀숲  · 본 시트 `ground` 절에 `tall` 한 벌 구움(바닥 `g` 하나 = 풀: `tall<v>rg<bits>` 30칸 · `tall_fringe_s_<a|b|ab>` · `tall_fringe_<e|w>_v<0|1>[_<a|b|ab>]`, d98, 야생 같은 이름과 바이트 대조) — `ground` 절을 받는 해안은 같은 이름을 그대로 쓴다(bake 규칙은 본 seed 의 `tall\dr[g]\d+`·`tall_fringe_[sew](_v\d)?(_(a|b|ab))?` 를 옮긴다) |
| 포켓몬 센터 문장·지붕색 | 본 시트 센터 그대로(기후 덮개·얼룩은 문장 위를 피한다) |

건물 크기(통합 I4 W1, 원작 미로마을 비례): 센터·마트 4×4(지붕 2줄 + 벽 2줄, 문 1칸 = 둘째 칸 `entrance dx 1`, 문장은 지붕 앞면 가운데),
민가 4×4(`house_i/j` 만 5×4), 2층 `two_*` 4~5×6, 상점 `shop_*` 6×4, 오두막 `cabin_*` 4×4. 지붕 높이는 `buildings.ROOF_H`(33px, 옛 49) — 지붕을 다시 칠하는 덮개(눈·재)는 49 를 적지 말고 이 상수를 읽는다.

## 3. 맵 문법은 장소에서 배운다

장소의 문법(무엇이 걷는 땅이고, 무엇이 벽이고, 소품이 어디 붙는지, 크기 비례)을 글로 먼저 적은 뒤 타일을 정한다.
원작 지도를 내려받아 조립·렌더하던 도구는 2026-10-07 저작권 정리로 지웠다. 원작 그림을 저장소·캐시·시각화 서버에 두지 않는다.

## 4. 기반(이미 있음 — 그대로 쓴다)

- **시드 상속**: `{"extends": "monster-overworld", ...}` — 팔레트·집·관문을 물려받고 다른 것만 적는다. 사전은 재귀 병합, 목록은 갈아 끼움, `null` 은 키 삭제.
  공통 절 중 안 그리는 것의 관문은 지운다(예: `"gates": {"water": null, "cave_floor": null}`). `bake.object_kinds` 의 목록을 덮으면 **본 항목까지 다시 적어야** 한다.
- **공통 절**: `mo.build(seed, ["ground","trees","forest","houses","landmarks", ...])` 가 `Sheet` 를 돌려준다. 이어서 `sh.section(...)`/`sh.add(name, img)`/`sh.end_section()` 으로 자기 절을 붙인다.
  절 이름: `mo.SECTIONS`. 예시 뼈대: `recipes/monster_coast.py` · `node/monster_coast.mts` · `harness-data/.../monster-coast/seed.json`.
- **이름 규칙**: 여러 칸 물체는 `이름.x.y`(굽기가 물체로 묶는다; 종류는 `bake.object_kinds` 접두사). 오토타일 47변형은 `<접두사><마스크>`(마스크는 `px.ALL47`), 4프레임 물은 `_f0.._f3` + `sh.anim.append(dict(baseTile=..., frames=4, fps=3))`(4칸이 한 행에 이어지게 `row_start`).
- **굽기 의미**: 시드 `bake.rules` = `[{"re": 정규식, "pass": "open"|"shut", "terrain": "none|water|sand|snow|stone|tall_grass", "label": "...", "slide": "up|down|left|right|ice|stop", "ledge": "down|left|right"}]` — 위에서 첫 일치.
  오토타일은 `bake.autotile` 에 `[그룹id, 접두사, 종류, {옵션}]`, 종류 `path`(걷는 구역)·`edge`(가장자리 막힘)·`water`(막힘+4프레임)·`plateau`·`wall`·`block`, 옵션 `{"terrain":…, "label":…, "slide":"ice"}`. `bake.autotile_names[그룹id]` 도 넣는다.
  바닥 받침 칸: `bake.backing`(기본 `grass0`) — 투명 낱칸 밑에 깔 너의 바닥.
- **미끄럼**: 엔진에 `tileset.slideTiles` 가 있다(얼음 `ice`: 얼음 위에서 들어온 방향으로 계속, `stop`: 멈춤, 화살표: 그 방향으로 벽·정지 칸까지). 얼음 퍼즐은 이것으로 증명한다.
- **오토타일 모양**: `px.inside_mask(mask, 이름, depth, radius, amp)` — radius<0 이면 칸 전체 사분원(여러 칸 구역의 모서리가 둥글다). 47변형이 서로 다르고 이음매가 맞아야 draw 가 통과한다(`FAMILIES`·`autotile_masks` 를 레시피에 선언).
- **쇼케이스**: `node/kitlib.mts` 의 `Kit`/`Field` — `k.field(이름,W,H,바탕)`, `paint(그룹, 칸들)` → `shape()`, `stamp(물체,x,y)`, `lo/up(x,y,칸)`, `forest(그루집합, 접두사)`, `save()`.
  검사: `k.expectReach(f, 시작, [목표], "설명")`·`expectNoReach`(퍼즐이 길을 막는지)·`k.check(조건, 메시지)` — 엔진 `canMove`·턱·`slideAfterStep` 그대로. 마지막에 `k.done()`.
- **한 바퀴**: `bash src/harnesses/tileset-authoring/cycle_theme.sh monster-<x> <run>` → draw(구조 검사·관문) → bake → 쇼케이스 검사 → `/tmp/viz/monster-<x>/<맵>.png`, `sheet.png`.
  draw 가 실패하면 중단된다 — 실패 로그를 읽고 고친다. **draw 가 통과했는지 꼭 확인하고 그림을 본다**(옛 run 그림을 보고 「바뀌었다」고 착각한 적이 있다).

## 5. 작업 순서와 완료 기준

1. 원작 지도 3장 이상을 그려 보고 장소별 문법을 5줄 이내로 적는다(무엇이 걷는 땅·벽·경계·소품·비례).
2. 타일 목록을 정하고 그린다. 각 장소마다: 바닥(2~4 변형), 경계(오토타일 또는 조각), 벽/장애물, 그 장소만의 소품 4종 이상, 출입구.
3. 장소마다 보여 주기 맵 한 장(원작 크기 비례). 도달 검사로 「입구→목적지」가 이어지고, 퍼즐은 「장치 없이는 안 된다」까지 증명한다.
4. **적대적 시각 검수를 스스로 3회 이상**: 매번 맵 PNG 를 원 크기와 확대(잘라서 4배) 둘 다 Read 로 보고, 같은 배율의 원작 그림 옆에서
   「포켓몬 GBA 맵으로 읽히는가 / 본 시트와 같은 화풍인가 / 무엇이 틀렸나」를 10개 이상 적고 고친다. 숫자(검사 통과)는 근거가 아니다 — 눈으로 본 것만.
5. 끝나면 `/tmp/viz/monster-<x>/REPORT.md` 에: 장소별 문법 요약, 타일 목록(이름·쓰임·통행), 맵 목록과 도달 검사 결과, 검수 회차별 고친 것, **남은 한계(정직하게)**, 감독에게 요청할 공유 파일 변경.
   최종 메시지에도 같은 요약과 커밋 해시를 쓴다.
