# sky_steam 칩셋 (하늘섬 A + 증기 산업도시 B)

> 상태: 설계 중, 번들 배선 없음. 근거 계약: AGENTS.md 3/4 관문(object-gate), tiledata/AI-REFERENCE-CONTRACT.md.

## 공용 모듈 (`scripts/content/sky-steam/`)
- `palette.py` — `K(name, t)` 9단 램프. 월드맵 steampunk 재질(brass soot magi copper iron) + 새색 sky cloud + 섬(grass rock earth wood canvas red). 이름은 추가만.
- `registry.py` — `Cv`(캔버스) · `@piece(id,name,w,h,kind,line,solid,frames)` · `run_cli('A'|'B')`: `export` → `tiledata/sky-steam/pieces/<line>/_gate/*.png` + `/tmp/sky-<line>-batch.jsonl`, `status` = 영수증만 읽기(모델 호출 없음).
- 파일 소유: A = `sky_a_*.py`, B = `steam_b_*.py`.
- 관문: `npm run harness -- object-gate review --batch /tmp/sky-A-batch.jsonl 2>&1 | grep -E "^(PASS|FAIL)"` (판정자 gemini-3.8-flash x4, rail-kits 의 rules.ts 변경과 같다).

## 줄 A — 하늘섬 (`sky_a_*.py`, 상태: 번들 배선 없음)

**계약.** 서 있는 조각은 3/4 탑뷰: 깊은(5줄+) 밝고 결 있는 윗면 판 + 뒤 모서리 윤곽 + 어두운 앞면. 섬 = 윗면(풀) + 앞 절벽면 + 매달린 뿌리/바위. 구름 바다·풀 윗면·절벽 앞면은 평면 오토타일(kind `terrain`), 구름·증기는 `organic` 면제(판정자 과반이 「종류가 맞다」 해야 함). 사람·글자·생성 이미지 없음, 코드 손 도트만. 얇은 기둥은 관문이 「정면 입면도」로 떨어뜨린다 → 몸통을 윗면 있는 상자(`box`)로 만든다(판단 근거: 라운드 기록 아래).

**파일.** `sky_a_lib.py`(slab/face/box/island/roof/tex_ell/plinth) · `sky_a_kit.py`(키트·탈것) · `sky_a_props*.py`(소품) · `sky_a_tiles.py`(오토타일·애니) · `sky_a_all.py`(`export|status`) · `sky_a_pack.py`(시트·사전·예제·검증) · `preview.py`. 산출은 `tiledata/sky-steam/`: `pieces/A/_gate/*.png`(관문 입력), `sheet-A.png` / `sheet-A.json`(사전), `example-A.json` / `example-A-ok.png` / `example-A-bad.png`.

**실행 순서(재현).**
1. `cd scripts/content/sky-steam && python3 sky_a_all.py export` → `/tmp/sky-A-batch.jsonl`
2. `npm run harness -- object-gate review --batch /tmp/sky-A-batch.jsonl 2>&1 | grep -E "^(PASS|FAIL)"` (판정자 gemini-3.8-flash ×4, 과반·중앙값; 그림이 한 화소라도 바뀌면 영수증 무효)
3. `python3 sky_a_all.py status` (영수증만 읽음) → 모두 pass 인지 확인
4. `python3 sky_a_pack.py` → 통과한 조각만 시트에 묶고, 예제를 만들어 자동 검증(정상 0건·오류 3건이 나와야 정상)

**사전(시트 `sheet-A.png`, 16px, 24열 × 26행, 0기준 칸 좌표, id = 행*24+열).** 이 칩셋의 번호만 쓴다(다른 칩셋 번호 섞지 말 것). 하위/상위: 모든 조각은 상위(캐릭터 위 덧그림) 한 장 스탬프이고, 걷는 칸(`walk`)은 조각 안 상대 좌표. 구름 바다 바닥(`sky-a-cloud-sea` 4변형)이 하위 전체를 깔고 그 위에 조각을 올린다. 투명 바탕, 윤곽 1화소(OL).

| id | 이름 | 칸 | kind | 원점 칸 (id) | 프레임 | 걷기 |
|---|---|---|---|---|---|---|
| `sky-a-island-s` | 하늘섬 작은 덩이 | 4×4 | structure | (0,0) id 0 | 1 | walk 2 |
| `sky-a-island-m` | 하늘섬 큰 덩이 | 6×5 | structure | (4,0) id 4 | 1 | walk 8 |
| `sky-a-house` | 부유 마을 집 | 3×3 | structure | (10,0) id 10 | 1 | - |
| `sky-a-windmill` | 풍차 탑 | 2×4 | structure | (13,0) id 13 | 1 | - |
| `sky-a-mooring` | 정박탑 | 2×4 | structure | (15,0) id 15 | 1 | - |
| `sky-a-airship` | 비공정 | 6×4 | structure | (17,0) id 17 | 1 | - |
| `sky-a-harbor` | 하늘 항구 | 6×4 | structure | (0,5) id 120 | 1 | walk 6 |
| `sky-a-shrine` | 부유 신전 | 4×4 | structure | (6,5) id 126 | 1 | - |
| `sky-a-whale-pier` | 고래 선착장 | 5×3 | structure | (10,5) id 130 | 1 | walk 5 |
| `sky-a-rock-root` | 바위 뿌리 | 3×3 | structure | (15,5) id 135 | 1 | - |
| `sky-a-gondola` | 곤돌라 | 3×2 | structure | (18,5) id 138 | 1 | - |
| `sky-a-rope-crate` | 밧줄 상자 | 1×1 | box | (21,5) id 141 | 1 | - |
| `sky-a-crate-stack` | 화물 상자 더미 | 2×2 | box | (22,5) id 142 | 1 | - |
| `sky-a-gas-tank` | 증기 가스 탱크 | 2×2 | round_body | (0,9) id 216 | 1 | - |
| `sky-a-anchor-box` | 닻 보관함 | 1×1 | box | (2,9) id 218 | 1 | - |
| `sky-a-water-tank` | 지붕 물탱크 | 2×2 | round_body | (3,9) id 219 | 1 | - |
| `sky-a-cargo-net` | 화물 그물 더미 | 1×1 | box | (5,9) id 221 | 1 | - |
| `sky-a-tree-sky` | 섬 나무 | 2×3 | organic | (6,9) id 222 | 1 | - |
| `sky-a-bush` | 덤불 | 1×1 | organic | (8,9) id 224 | 1 | - |
| `sky-a-flowers` | 들꽃 | 1×1 | organic | (9,9) id 225 | 1 | - |
| `sky-a-cloud-puff` | 구름 덩이 | 2×1 | organic | (10,9) id 226 | 1 | - |
| `sky-a-cloud-mist` | 구름 안개 | 2×1 | organic | (12,9) id 228 | 1 | - |
| `sky-a-pulley-crane` | 도르래 기중기 | 2×2 | frame | (14,9) id 230 | 1 | - |
| `sky-a-watch-hut` | 감시 오두막 | 2×2 | structure | (16,9) id 232 | 1 | - |
| `sky-a-cloud-sea` | 구름 바다 바닥 | 4×1 | terrain | (18,9) id 234 | 1 | - |
| `sky-a-grass-top` | 섬 풀 윗면 | 4×1 | terrain | (0,12) id 288 | 1 | - |
| `sky-a-island-edge` | 섬 가장자리 절벽 앞면 | 3×1 | terrain | (4,12) id 292 | 1 | - |
| `sky-a-cloud-edge` | 구름 바다 가장자리 | 3×1 | terrain | (7,12) id 295 | 1 | - |
| `sky-a-bollard` | 계류 기둥 | 1×1 | column | (10,12) id 298 | 1 | - |
| `sky-a-signpost` | 표지판 | 1×2 | column | (11,12) id 299 | 1 | - |
| `sky-a-chimney-stack` | 굴뚝 | 1×2 | column | (12,12) id 300 | 1 | - |
| `sky-a-barrel` | 통 | 1×1 | round_body | (13,12) id 301 | 1 | - |
| `sky-a-telescope` | 관측 망원경 | 1×1 | other | (14,12) id 302 | 1 | - |
| `sky-a-propeller-pod` | 프로펠러 엔진 포드 | 2×2 | box | (15,12) id 303 | 1 | - |
| `sky-a-bridge` | 구름 다리 | 5×3 | structure | (17,12) id 305 | 1 | walk 5 |
| `sky-a-airship-anim` | 비공정(프로펠러 회전) | 6×4 | structure | (0,15) id 360 | 4 | - |
| `sky-a-windvane` | 바람개비 석주 | 1×2 | column | (0,19) id 456 | 1 | - |
| `sky-a-hot-air-balloon` | 소형 기구 | 2×3 | structure | (1,19) id 457 | 1 | - |
| `sky-a-windmill-anim` | 풍차 탑(날개 회전) | 4×4 | structure | (3,19) id 459 | 4 | - |
| `sky-a-lighthouse` | 하늘 등대 오두막 | 3×3 | structure | (19,19) id 475 | 1 | - |
| `sky-a-boiler` | 증기 보일러 | 2×2 | round_body | (22,19) id 478 | 1 | - |
| `sky-a-market-stall` | 장터 가판 | 2×2 | structure | (0,23) id 552 | 1 | - |
| `sky-a-well` | 빗물 우물 | 1×1 | container | (2,23) id 554 | 1 | - |
| `sky-a-bench` | 벤치 | 1×1 | low_furniture | (3,23) id 555 | 1 | - |
| `sky-a-planter` | 화단 상자 | 1×1 | container | (4,23) id 556 | 1 | - |
| `sky-a-hut-flag-anim` | 감시 오두막 + 지붕 깃발(펄럭) | 2×3 | structure | (5,23) id 557 | 4 | - |
| `sky-a-sack-stack` | 곡물 자루 더미 | 2×2 | box | (13,23) id 565 | 1 | - |
| `sky-a-cannon-box` | 신호 대포 상자 | 1×1 | box | (15,23) id 567 | 1 | - |
| `sky-a-stone-wall` | 섬 돌담 | 2×1 | box | (16,23) id 568 | 1 | - |
| `sky-a-steam-cloud` | 증기 구름 | 2×1 | organic | (18,23) id 570 | 1 | - |

**구름 섬 연결 규칙(다리·승강기).**
- 섬 윗면(`island-*`)의 걷는 칸과 다리(`sky-a-bridge`, 5×3, 걷는 줄 = 상대 y 1)·선착장(`whale-pier`, 걷는 줄 = y 0)의 걷는 줄이 **같은 지도 y** 에서 4방향으로 이어져야 한다. 다리 원점 x = 앞 섬 걷는 칸 끝 x + 1 − 0, 다리 y = 섬 걷는 줄 y − 1.
- 다리 길이 = 5칸 고정(더 길면 `sky-a-bridge` 를 연달아). 섬 사이 최대 간격 = 다리 한 개 폭. 간격이 더 크면 비공정으로만 간다.
- 최소 크기: 섬이 다리를 받으려면 걷는 칸이 가장자리에 2칸 이상(`island-s` 는 걷는 칸 2). 금지: 다리 끝이 걷지 못하는 칸(절벽 앞면·구름)에서 끝나는 배치, 섬 간 대각선 연결.
- 승강기(수직 이동): 섬의 윗면 끝 칸 + `sky-a-pulley-crane`(도르래 기중기) 옆 칸에 전이 이벤트를 놓고 다른 층 지도의 같은 모양 칸으로 `transfer`.
- 겹침 우선순위(그리는 순서): 구름 바다 → 구름 덩이 → 섬(큰 것부터) → 다리·선착장 → 소품 → 비행 탈것(맨 위).

**비공정 탑승 이벤트.** 비공정(`sky-a-airship` 6×4)의 갑판 윗면 칸 = 상대 (1..4, 2). 선착장 걷는 줄 끝 칸에 이벤트 `at`(출입 칸, 걷는 칸이어야 함)을 두고, `face` 방향 바로 옆 칸이 갑판 칸이어야 한다. 그림(출입구)·접근칸(출입 칸)·이벤트(`transfer:airship-map`)를 구분한다: 그림은 갑판과 계류, 접근칸은 선착장 끝, 전이는 이벤트. 탑승 뒤에는 비행 지도로 `transfer`.

**정답 배열/예제 `example-A.json`.** `ok.objs = [id, 칸x, 칸y]` 6개(큰 섬 → 다리 → 작은 섬 → 다리 → 선착장 → 비공정) 가 정답 배치이고 `links` 가 이어져야 할 걷는 칸 쌍, `boardEvent` 가 탑승 칸. `example-A-ok.png`(흰 점 = 걷는 칸, 자홍 사각형 = 이벤트 칸) 와 `example-A-bad.png`(붉은 점) 를 나란히 보라. 확대는 nearest-neighbor 만 썼다. 이 그림들은 실제 조각 시트에서 스탬프한 것이지 AI 모형이 아니다.

**자동 검사 `sky_a_pack.py validate` — 오류 코드.** `NOT_CONNECTED a->b`(다리가 섬과 안 이어짐) · `EVENT_NOT_WALKABLE c` · `EVENT_NOT_ADJACENT_DECK c`(탑승 칸이 갑판과 안 닿음) · `OUT_OF_MAP id`(지도 밖). `example-A-bad.png` 는 이 중 3개를 실제로 일으킨다(다리 아래로 떨어뜨림 / 탑승 칸을 갑판에서 2칸 뗌 / 섬을 지도 밖에 놓음). **확인 범위:** 구조와 걷기 연결만. 이벤트 실행, 미적 품질, 저가 모델 성공률은 이 검사로 주장하지 않는다. 저장 전 실패 시 부분 배치를 남기지 않는 것은 스탬프 도구(미구현, 번들 배선 때)의 일이다.

**상속 검토(결과: 0).** 기존 하늘 자원 — `tiledata/atlas-scenes/images/sky-{isle-shrine,dock-isle,airship-deck}.png`(장면 통짜 그림), `scripts/content/atlas-scenes/pieces_scenes.py` 의 비공정 3종·`floating_isle`·구름 3종 — 은 (a) EasyRPG ship 시트 텍스처(`texture_tile`, 2026-10-07 폐기·파일 삭제)에서 만들어 지금은 다시 그릴 수 없고, (b) `scene_art.py` 가 저장소에 없어 구름 조각도 렌더되지 않으며, (c) 장면 통짜 PNG 는 `structure` 로 관문을 통과해 보였지만 조각이 아니라 EasyRPG 시트 파생 장면이라 의미 없는 통과다. 그래서 하나도 물려받지 않고 처음부터 그렸다. (월드맵 steampunk `floating`·비행선 아이콘은 월드맵 전용 시점이라 쓰지 않음.)

**라운드 기록(관문 실측, 모델 판정은 불안정해 같은 그림도 틀릴 수 있다).** 얇은 기둥(바람개비·깃발대·가스등·계류 기둥·표지판·굴뚝)은 「받침 윗면 6줄」을 붙여도 판정자가 몸통(기둥)만 보고 「정면 입면도」라 했다 → 몸통을 굵은 돌/철 기둥 상자로 바꾸자 통과, 깃발대·가스등은 얇아서 끝내 상자형(`flag stand`)도 거절 → **버림**(4라운드 안에 통과 못 함). 애니메이션 프로펠러·깃발·풍차 날개 단독은 거절 → 풍차는 몸통·지붕과 통째, 비공정은 갑판 통째, 깃발은 오두막 지붕 위로 바꿔 통과. 기구(`hot-air-balloon`)는 기낭이 몸통으로 읽혀 거절 → 바구니를 크게 키워 통과. 증기 분출 세로 기둥은 `organic` 종류 불일치 → 가로 `steam-cloud` 로 교체.
