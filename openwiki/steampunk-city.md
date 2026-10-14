# steampunk_city — 스팀펑크 공업 도시 칩셋 (2026-10-14)

벽돌·철·구리의 증기 도시: 연립·가게·여관 거리, 공장·보일러실·배관 도랑·석탄 마당, 기차역·증기 열차·화물 측선·문형 기중기,
운하 부두·돌다리·잔교·바지선, 비행선 계류탑(땅 위 정박장), 실내 여섯(보일러실·기관실·공방·연구실·여관·선술집).
**하늘섬은 다른 칩셋(sky_island)이다** — 여기서 잡지 않는다.

## 한 줄 지도

| 무엇 | 어디 |
|---|---|
| 그림(코드 손 도트, 16px, 3/4) | `scripts/content/steampunk-city/art/` — terrain·buildings·props·pipes·vehicles·street·interior 일곱 등록부, `palette.py`(잠금 22 램프·116색), `px.py`/`kit.py` 그리개 |
| 관문 내보내기 | `tiledata/steampunk-city/<묶음>/_gate/sp-<id>.png` + `items.jsonl`, `gate_sel.py <묶음> ids…` 로 sel.jsonl |
| 굽기 | `python3 scripts/content/steampunk-city/bake_sp.py [--dry]` → `public/assets/steampunk-city/steampunk-city-chipset.png` · `src/assets/steampunkCity{Tileset,Sheet}.json` · `tiledata/steampunk-city/bake-{pins,report}.json`(번호 핀은 덧붙이기 전용) |
| 참고문서 | `python3 scripts/content/steampunk-city/bake_refs_sp.py` → `src/assets/steampunkCityReferences.json`(이미지 바이트 없음) + `public/assets/steampunk-city-references/*.png` |
| 타일셋 정의·기존 프로젝트 심기 | `src/project/defaults/steampunkCity.ts`(`ensureSteampunkCityTileset/References`), `defaultAssets.ts` 의 `ensureBundledTilesets`·`bundledEasyRpgTilesetBase` |
| 구성기(순수 함수) | `src/project/steampunkCityComposer.ts` `composeSteampunkCity(spec, pal)` |
| 조수 도구 | `src/editor/tools/steampunkCityTools.ts` — `compose_steampunk_city_map`, `link_steampunk_interior` |
| 조수 길잡이 | `src/ai/steampunkCityPolicy.ts` (plainTurn 에서 jp_city **보다 먼저** 판정 — 「증기기관 도시 거리」가 jp_city 의 「도시 거리」에도 걸린다) |
| 장면 QA | `node_modules/.bin/vite-node scripts/content/steampunk-city/qa/compose-scene.mts -- out.json <style> W H seed` → `qa/render_scene.py`(렌더 + 검증) |

## 수량 (굽기 보고서)

조각 163(야외 111·실내 52) · 키트 102 · 칸 835(48열×18줄) · 움직이는 칸 묶음 38(물·증기 구멍·굴뚝 연기·보일러·기관·테슬라 코일·벽난로) ·
정의 위반 0 · 팔레트 밖 0 · 재조립 불일치 0. 가족 라벨 `oprn-steampunk` = 「스팀펑크 도시(도트)」.

## 3/4 관문 (object-gate)

- 모든 조각이 그림 화소 해시 영수증으로 PASS. **프로필 미보정이라 「provisional」** — 「관문 합격」이라고 쓰지 말 것.
- 떨어진 뒤 고친 것: 시계 기둥·광고탑·화분·신호등(정면 입면 → 큰 윗면 원판), 기관차(옆모습·둥근 바퀴·둥근 창 → 상자형 기관차, 직사각 창, 바퀴는 아래 반원만),
  비행선(대칭 옆모습 → 평면 타원 윗면 + 옆 띠, 휜 늑골, 수평 꼬리날개, 곤돌라 지붕).
- **뺀 것(두 번 떨어짐):** 곡물 자루 더미, 누운 압력 탱크, 급수 기둥, 3칸 철 울타리 묶음. 대체: 상자·가스 저장탑·소화전, 울타리는 1칸 `sp-fence`/`sp-fence-v` 이어 찍기.
- 판정자 경향(다음 그림에 참고): 정면 입면·옆에서 본 둥근 바퀴·둥근 창·곧은 세로 늑골·대칭 옆 실루엣은 떨어진다. 넓고 밝은 윗면·객차식 지붕·천창·원판은 붙는다.

## 칸 통행 (bake_sp.py)

- `FOOT`: 키 큰 키트는 맨 아래 N줄만 막힘, 그 위는 ★(뒤로 지나가면 위에 그려짐). 굴뚝 연기는 전부 ★. 문형 기중기는 다리 칸만 막힘(`SOLID_CELLS`).
- `BLOCKED`(아래층이지만 막힘): 물·석축(quay)·승강장 끝·잔교 끝·천장·벽면 u/d·배관 도랑 14종. 배관 덮개 `pipe-grate-*`, 갓돌 `quay-lip`, 다리는 걷는다.

## 구성기 계약 (사용자는 옛 시안의 배치를 싫어했다 — 배치가 그림만큼 중요)

순서 = 계획(구역 줄) → 건물 줄 → 바닥 → 소품. 빈 땅은 반드시 쓰임을 준다(뒷골목·시장 광장·철 울타리 쌈지 공원·석탄 야적장·승강장·화물 측선·비행선 정박장).
- 소품 하나마다: 발자국+여백 빈칸, **자기 바닥 용도만**(석탄은 석탄재 마당, 노점은 광장 포석, 계선주는 둑 줄), 위층 겹침 금지, 시작 칸 BFS 로 이미 닿던 칸이 끊기면 되돌림.
- 건물 접근칸과 그 아래 한 칸은 예약. 도구는 놓은 뒤 엔진 `isPassable` BFS 로 문·접근칸·출구를 검사하고 실패하면 맵을 바꾸지 않는다.
- 최소 크기: street 44×34 · industrial 48×40 · dock 46×34 · 실내 14~16×11~12.

## 적대적 시각 QA (한 번, 2026-10-14)

원본 해상도 5장면(거리·공장 마당·기차역·운하·보일러실, seed 7)에서 결함 8건 → 한 번 고침, 다시 돌리지 않았다.
S1/D2 건물 줄 양옆 빈 공터 → `padRow` 연립으로 메움 · S2 6줄 빈 차도 → 5줄 + 판석 건널목 2곳 · S3 노점 밑 상자 일렬 → 무리 끝 한 묶음(`cluster`) ·
F1 공장 마당 동쪽 빈 땅 → 주택 문 옆 소품 + 석탄 야적장 · F2 맵 폭 전체 역 광장 → 역 양옆 화물 창고·철도원 연립 ·
D1 남쪽 빈 판석 → 운하 보는 벤치·시장 아래까지·공원 넓힘 · B1 보일러실 떠 있는 석탄 더미 → 석탄 통→더미→광차 동선 + 모퉁이 창고 + 화부 작업대.
남은 약점: 역 앞 광장 일부와 공장 줄 위 뒷골목은 여전히 단색 바닥이 넓다.

- **시작 위치 (2026-10-14):** `compose_steampunk_city_map` 의 야외 style 은 시작 맵이 손대지 않은 빈 맵(문·이벤트 없음)이면 새 맵의 시작 칸을 게임 시작으로 잡는다(`src/editor/tools/composerStart.ts`, 작가가 정한 시작은 덮어쓰지 않는다). 실조수 검증에서 모델이 `set_start_position` 을 안 불러 시작 맵이 빈 20×15 로 남던 결함.
- **화풍 정렬 (2026-10-14):** 바닥을 버들항 판석 문법으로 다시 그림 — 자갈 셋트(돌마다 윗면 빛 줄·몸 단 ±1·오른쪽/밑 그늘·가로 줄눈 = 돌 밑 그림자, 드문 그을린 돌), 판석(판 안쪽 윗·왼 빛, 밑·오른 그늘, 판 폭 6~16), 연석 앞면 블록, 벽돌 포석 8×8 바구니(모래 줄눈·벽돌마다 단·그을린 벽돌), 석탄재 마당(큰 얼룩 두 단 + 박힌 잔돌·석탄 덩이), 자갈 도상·침목, 가로수 수관(잎 덩이 8개·덩이마다 5단·윤곽 moss 0), 지붕 슬레이트(판마다 ±1·틈/겹침 몸-2·왼쪽 끝 빛 +2). 낱칸 변주 4종 새 칸(`cobble-c`·`flag-c`·`brickpave-b`·`cinder-c`, 핀 835~838) 을 구성기 `variety()` 가 해시로 흩는다. 영수증 PASS 39 / FAIL 1 — 새 슬레이트의 `sp-shop-gears` 가 떨어져 그 건물만 옛 슬레이트(`buildings.py` `V1_KEEP`)로 남겼다(옛 그림 해시 영수증, 새 칸 839~844 덧붙임). 지표 칸당 고유색 10/14/V34 그대로(윤곽 먹 `ink` 은 이번 판에서 안 바꿈). 남은 이질감: 석탄재 마당은 램프가 어두워 여전히 거칠고 넓게 어둡다, 윤곽이 먹(V34)이다, 그을린 벽돌 포석이 얼룩처럼 보인다.
