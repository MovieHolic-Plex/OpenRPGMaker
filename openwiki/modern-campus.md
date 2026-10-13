# modern_campus — 현대 학교·캠퍼스 칩셋 (설계 1차, 2026-10-13)

> 상태: **설계 + 첫 조각 10종(코드 손 도트)만.** 번들 배선(`bundled.ts`·`defaultAssets.ts`)·참고문서·굽기는 아직 없다.
> 기획 원문: `~/claude-viz/chipset-gaps.html` ② 현대 학교·캠퍼스. 그림 코드 `scripts/content/modern-campus/campus_props.py`.

## 목적

학원·연애·학교 호러·코미디의 공통 무대. 한국·서양식 중·고등학교, 기숙사, 대학 캠퍼스, 교외 거리.
`jp_city`(일본 거리·小学校 33종 이미 있음)와 같은 현대 계열이되 **비일본**: 붉은 벽돌·베이지 콘크리트·철제 교문·초록 칠판.
상표·글자·사람 금지(사람은 Actor1). 생성 이미지 금지, 코드 손 도트만.

## 3/4 계약 (AGENTS.md 「새 도트 그림은 3/4 탑뷰 관문」)

- 16px 칸 = 1m. 윗면 + 남쪽 앞면 한 겹. 빛 왼쪽 위, 그림자 오른쪽 아래. 윤곽 `sumi`. 옆면(아이소)·정면 입면 금지.
- 건물: 지붕 윗면(평지붕은 슬래브 윗면 띠 + 옥상 난간 윗면) + 정면 한 겹. 교실 실내는 벽 윗면 띠 + 앞면 벽 + 바닥.
- 종류(kind)는 정직하게: 교문 structure, 기둥 column, 벤치 seat, 거치대 frame, 자판기·신발장 tall_furniture, 화단 container.
  `flat`·`terrain` 은 정말 평평한 것(운동장 선·바닥)만. 칠판·사물함 같은 벽걸이는 `wall_mounted`(과반이 「종류가 맞다」여야 한다).
- **관문 정본 = object-gate**(`npm run harness -- object-gate review --batch tiledata/modern-campus/_gate/items.jsonl`). 영수증은 그림 화소 해시에 묶인다. 상태는 아래 「관문 결과」.

## 내용 목록 (전체 윤곽)

| 묶음 | 내용 | 추정 칸 |
|---|---|---|
| 바닥·오토타일 | 운동장 흙/인조잔디, 교정 포석, 캠퍼스 잔디·화단 가장자리, 아스팔트(한국/서양 차선), 보도·점자블록, 흰 선 오버레이(운동장·주차) | 800 |
| 교문·담 | 교문(기둥+철문) · 담장 1칸 · 담 끝/모서리 · 철망 담 · 옥상 난간(콘크리트 턱 + 철망) | 250 |
| 교사 키트 | 본관 3~4층(벽돌/콘크리트, 창 띠, 현관 차양, 계단실 돌출부) · 별관 · 체육관 · 강당 · 도서관 · 기숙사 동 · 식당 · 학생회관 | 2,200 |
| 운동장 | 트랙 곡선(타원 오토타일, 별도 웨이브), 골대, 농구 골대, 철봉, 조회대, 스탠드 | 500 |
| 교정 소품 | 신발장 줄, 자전거 거치대, 화단, 벤치, 자판기, 시계탑, 분수, 버스 정류장, 게양대, 쓰레기통 | 600 |
| 실내 가구 | 교실(책상·의자·교탁·사물함·칠판 걸이)·복도·교무실·도서관·보건실·화장실·급식실·기숙사 방·동아리 방 | 아래 |
| 애니메이션 | 시계·깃발·분수·벚꽃/단풍 낙하 | 스트립 ~20 |
| **합계** | | **약 5~7k칸** (jp_city 15k 의 약 40% 규모) |

### 실내 대응 (새로 그리지 않는다)

| 필요한 방 | 쓸 곳 |
|---|---|
| 교실·복도·교무실·도서관·보건실·화장실·급식실 | 공용 손 도트 실내 v5 `atlas_biome_interior` 의 기물 + jp_city `blocks/interior_school.py`(sc-, 학교 가구)·`interior_public.py`·`interior_wet.py`(화장실). roomKit 방 짓기(`openwiki/room-kit...` 메모리 참조)로 칸막이·문 |
| 폐교 호러 | jp_city `dungeon_school.py`(as-) 그대로 |
| 기숙사 방 | v5 침실 기물 + `interior_bed.py` |
| 새로 필요한 것(실내) | 한국식 교실 규격 책상 줄·교실 앞문/뒷문·사물함 벽 줄·급식 배식대 — 실내 v5 시트에 덧붙이기(번호 불변·덧붙이기 전용) |

즉 실내 칸은 `modern_campus` 시트에 **안 넣는다**. 야외·건물 외형만 새 칩셋, 실내는 v5/jp_city 재사용 + 부족분은 v5 에 덧붙임.

## 팔레트 잠금

- 새 램프를 만들지 않는다. `tiledata/atlas-pick/palette/modern3.pal`(jp_city 와 같은 램프 키)만:
  붉은 벽돌 `renga`·`kawara`, 베이지 콘크리트 `conc`·`kinari`, 철 `tekko`, 초록 칠판 `kokuban`·`lino`, 흙 `soil`, 나무 `ita`·`yuka`, 윤곽 `sumi`.
  (기획서의 「램프 3개 추가」는 불필요 — 이미 modern3 에 있다. 모자라면 추가 대신 단 이동.)
- 마커색 `#e040c0` 금지, 반투명 금지. 검사는 `campus_props.py selftest`(색 ⊂ modern3, 알파 0/255).

## 재사용 vs 신규

- 재사용(참조·복사 import, jp_city 파일 수정 금지): 그리개 `K`/`Cv`(공용 `atlas-pick/modern_style_bible_proof.py`), 팔레트, `bricks`/cube 패턴(`street_hand.py prop()` 계열), 교정 소품 개념(`blocks/school.py` 33종: 철봉·정글짐·조례대 — 일본풍이라 외형만 새로), 실내 전부.
- 신규: 벽돌 교문·철문, 한국/서양 교사 외형, 신발장·사물함 줄, 서양식 차선·보도, 캠퍼스 잔디/포석 오토타일.

## 참고문서 계획 (`tiledata/AI-REFERENCE-CONTRACT.md`)

`tiledata/tilesets/modern_campus/` 에 정본. 용도 4: ① 사전(칸 번호·좌표·통행) ② 교정 배치(교문→본관→운동장 순서, 담 반복식, 관문 반복/고정 구분) ③ 교사 조립 예제(1층 현관·창 띠·계단실 완전 배열 + 정상/오류 그림) ④ 학교 평면 3종(교실·복도 연결, 문 그림/접근칸/출입 이벤트 분리). 자동 좌표 검증 + 변조 오류 코드. 이 첫 묶음엔 아직 없음.

## 번들 계획 (AGENTS.md 「새 타일은 공용에 추가」)

1. 굽기: jp_city `bake_jp.py` 블록 계약(`jp-city/CONTRACT.md`) 복제 → `scripts/content/modern-campus/bake_mc.py`, 블록은 `blocks/*.py`(`build()`→cells/kits). 번호 핀 `pins.json`(덧붙이기 전용).
2. 시트 `assets/…` + `src/assets/bundled.ts`(칸 수·시트 높이·열 수) + `src/project/defaults/defaultAssets.ts` 정의 + `ensureBundledTilesets`.
3. 참고문서 번들 JSON(`src/assets/modernCampusReferences.json`, 그림은 `public/assets/...` 축소) + `ensureModernCampusReferences`. 새 프로젝트·기존 프로젝트 양쪽 검증.
4. 출구마다 `object_gate.require_all(..., context="bundle")` 를 굽기 앞에 건다. 영수증 없는 칸은 굽지 않는다.
5. 조수: `campusPolicy.ts`(칩셋 고르기 #10), 컨셉 힌트 「현대 학원·캠퍼스 → modern_campus」, 계열 `oprn-jp` 와 구분(계열 전환 거부 규칙 확인).

## 첫 조각 10종 (`campus_props.py`)

gatepost · gate(4×2) · fence · bench · bike-rack · vending · flowerbed · shoe-locker · field-line-h · field-line-corner.
산출 `tiledata/modern-campus/_gate/mc-*.png`(투명) + `preview/_all-x4.png`. 이 모듈은 jp_city 산출물을 건드리지 않는다.

## 관문 결과

2026-10-13, 판정자 둘×두 번, 이 체크아웃 영수증 `harness-data/object-gate/receipts`(화소 해시에 묶임):

| 조각 | 종류 | 결과 |
|---|---|---|
| gatepost · gate(4×2) · bench · bike-rack · flowerbed · shoe-locker | column/structure/seat/frame/container/tall_furniture | PASS |
| field-line-h · field-line-corner | flat | PASS |
| fence(2×2) | structure | **FAIL** 5회차까지 — 판정자 절반이 갓돌 윗면 7행을 「정면 입면의 띠」로 읽는다 |
| vending | tall_furniture | **FAIL** 5회차까지 — 윗덮개 8행은 읽히나 몸통을 정면판으로 보는 판정자가 과반 |

FAIL 둘은 **3/4 관문 미통과** — 굽지 않는다. 교훈: 윗면과 앞면의 명암·색 차이가 작으면(같은 램프 단 근처) 판정자가 앞면 띠로 읽는다. 윗면은 앞면보다 확실히 밝은 중립색, 앞면 맨 윗줄에 어두운 입술 줄, 윗면 6행 이상.
판정자 편차가 커서(같은 그림에서 4표 중 1~2표 pass) 한 번의 FAIL 로 그림 결함을 단정하기 어렵다.
