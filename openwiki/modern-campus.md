# modern_campus — 현대 학교·캠퍼스 칩셋 (설계 1차, 2026-10-13)

> 상태(2026-10-14, 다시 그리기): **첫 판(Sonnet 초안 agent/modern-campus·agent/campus-int)은 「너무 조잡하다」로 반려되어 그림을 전부 새로 그렸다.**
> 배치 id·굽기 배관·방 표·정책 틀만 이어받았고 그림은 하나도 재사용하지 않았다. 지금 정본은 아래 「다시 그리기」 절이다. 그 위 절들은 이력이다.

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

## 야외 1차 확장 (2026-10-13, 같은 브랜치)

코드: `scripts/content/modern-campus/` — `mc_core.py`(Reg·시트) · `terrain.py` · `props_a.py`/`props_b.py`/`props_c.py` · `buildings.py`(조립 건물 한 장을 structure 로 관문에) · `anim.py` · `registry.py`.
산출: `tiledata/modern-campus/<묶음>/_gate/*.png` + `registry.json`(통과분만, `pins.json` 덧붙이기 전용 stable id). **번들 미배선**; 굽기(`bake_mc.py`)는 registry.items 를 읽고 출구에서 `require_all` 을 다시 건다. 교외 도로·보도는 terrain 조각까지만(차선 오토타일 웨이브는 미작성).
시트: `~/claude-viz/campus-outdoor.html`.

| 묶음 | 계획 | 통과 |
|---|---|---|
| 바닥·오토타일(운동장 흙·인조잔디, 포석, 잔디·화단 가장자리, 도로 한/서 차선, 횡단·보도·점자) | 18 | 18 |
| 건물 키트(본관 3·4층·별관·체육관·강당·도서관·기숙사·식당·학생회관·교회·아파트·상가·병원·경찰서·카페) | 15 | 15 |
| 소품(교문 기둥/문·시계탑·게양대·가로등·벤치·거치대·화단·분수·정류장·자판기·담 4종·놀이·정원 등) | ~50 | 45 |
| 탈것(통학 버스·자전거) | 2 | 2 |
| 애니메이션 프레임 | ~20 | 분수4·벚꽃4·단풍4 완성, 시계·깃발은 일부 프레임만(스트립 불완전 → 쓰지 않음) |

관문 탈락(≤4~5회차, 폐기): 구 fence·vending(대체: wall-*·vending2), basket-hoop, tennis-net, 옥상 난간 fence-roof, clock-f0/1/3, flag-f1/3.
교훈: 가는 것(기둥·가로등·철봉)은 정면 입면으로 읽힌다 → 몸통을 넓고 뭉툭하게, 윗면을 6~12행 밝은 슬래브로. 평지붕 건물은 안쪽 지붕면 + 난간 윗면 띠 + 옥상 기물(실외기·물탱크·승강탑)로 통과. 같은 그림도 판정자 편차가 커 재시도 영수증이 갈린다.


## 다시 그리기 (2026-10-14) — 지금 정본

**그림**은 코드 손 도트이고 modern3 램프를 쓴다(`px.C`). 3/4 시점이다: 윗면 + 남쪽 앞면, 빛은 왼쪽 위.
- `scripts/content/modern-campus/art/terrain.py`: 바닥 37. 잔디 a/b/꽃, 운동장 흙·흰 선, 포석 넷, 아스팔트·점선·횡단보도, 연석 8방.
- `art/buildings.py`: 건물 18. 학교 본관 12/8·별관·6칸·급식동·체육관 둘, 대학 강의동 12/9/7/6·도서관·본부·학생회관·연구동·기숙사 7/5/평지붕. 한 장을 그린 뒤 칸으로 자른다.
- `art/props.py`: 소품 38(나무 다섯 포함). 분수는 3프레임 애니메이션이다.
- `interior/interior_art.py` + `campus_interior.py`: 실내 가구 50, 바닥 6, 벽면 5.
- 검수 페이지 `~/claude-viz/campus-wip.html`.

**관문** object-gate(gemini-3.8-flash ×4 과반, 프로필 미보정이므로 **임시통과**):
- 야외 93/93 통과, 실내 61/61 통과(`python3 scripts/content/modern-campus/gate_report.py`).
- 4판까지 다시 그려도 FAIL 이 남은 14종은 기준을 낮추지 않고 **뺐다**(`art/props.py` DROPPED, `campus_interior.py` DROPPED). 참고문서 「없는 소재」에 적었다.
  - 야외: 철망 울타리, 깃대, 소화전, 자판기, 철봉, 허들, 미닫이 교문.
  - 실내: 실내 자판기, 식판 카트, 구급함, 이젤 보드, 앰프 둘, 칸막이 칸.
- 통과시킨 버릇이 둘 있다.
  - 윗면을 사다리꼴로 그린다. 뒤 두 줄을 1~2px 들이고 sumi 사선 가장자리를 넣는다.
  - 윗면에 작은 물건을 올린다.
- 반대로 키 크고 가는 기둥·철망·틀은 끝까지 「정면 입면」으로 읽혔다.

**굽기**는 `python3 scripts/content/modern-campus/bake_mc.py`로 한다(공용 부품 `scripts/content/lib/theme_bake.py`).
- 결과: 칸 950(20행, 768×320), 키트 158, 애니메이션 스트립 9, 그룹 52.
- 야외 조각 92, 실내 기물 103(새 50 + jp_city 학교 기물 재사용 53).
- 정의 위반 0, 재조립 불일치 0. 번호 핀은 덧붙이기 전용이다.
- 나무 키트의 역할은 `prop` + 태그 「나무」다. `tree` 는 역할 enum 에 없다.

**구성기** `src/project/campusComposer.ts`(순수 함수, 씨앗마다 다른 교정)는 계획 → 건물 → 길 → 소품 순서로 짠다.
- `school`(48×36 이상):
  - 남쪽 도로·보도, 벽돌 담과 교문.
  - 북쪽 건물 줄 [옆동·본관·체육관]과 앞 광장.
  - 운동장(흙·흰 선·골대·스탠드)은 주 통로 옆에 두고, 방향은 씨앗이 정한다.
  - 정원, 가로등, 나무 줄(간격을 흔든다), 빈 잔디에는 숲 덩이(`groves`).
- `university`(52×40 이상):
  - 생울타리와 교문, 남쪽 두 동, 북쪽 세 동(같은 키트를 두 번 쓰지 않는다).
  - 쿼드: 벽돌 앞길, 판석 남쪽 길, 십자 길, 분수 광장, 철쭉 화단.
  - 시계탑은 쿼드에 자리가 없으면 교문 가로수길 옆에 선다.
- 조수 도구 `compose_campus_grounds({style, buildings?, seed?})`(`src/editor/tools/campusTools.ts`)가 결과를 맵에 쓴 뒤 엔진 `isPassable` 로 확인한다.
  - 확인 항목: 문 칸은 막힘, 접근칸은 걸을 수 있음, 시작 칸에서 모든 접근칸에 닿음.
  - 실패하면 맵을 바꾸지 않는다.
  - 판 6종×씨앗 12 = 72판에서 실패 0이다(엔진 판정).
  - 이 검사로 한 줄짜리 앞길 위에 놓인 화분이 길을 끊는 결함을 찾아 고쳤다.

**참고문서** `bake_refs_mc.py` → `src/assets/modernCampusReferences.json`(문서 5, 그림 4는 `public/assets/modern-campus-references/`).
- 문서: 사용법, 사전, 학교 예제, 대학 예제, 오류.
- 예제 배열은 구성기 출력 그대로다.
- 검증기는 BFS 를 포함한다: E_BOUNDS · E_OVERLAP · E_DOOR_CELL_OPEN · E_DOOR_ACCESS_BLOCKED · E_DOOR_UNREACHABLE.
- 변조 4종을 모두 잡는다.

**시각 QA 1회**(원 해상도로 잘라 봄; 장면은 학교 둘, 대학 둘, 교실 동, 특별교실 동, 기숙사 1·2층):
- 결함 11을 찾았다: 나무 밑 네모 그늘, 꽃 점 잡음, 48×36 에서 빠진 운동장, 텅 빈 잔디, 도장 찍은 나무 줄, 대학 도서관 중복, 회색 둘레 길, 안 서는 시계탑, 기숙사 서랍장 떠 있음, 교실 서가가 책상에 붙음, 강의실 카트 떠 있음.
- 11개 모두 고쳤다. 시계탑은 개선 패스에서 자리 후보를 넓혀 고쳤다.
- 검사 스크립트(직접 돌린다, 테스트 스위트 아님):
  - `scripts/content/modern-campus/qa/check-campus-compose.mts`
  - `check-campus-interiors.mts`
  - `compose-scene.mts` · `compose-room.mts` + `render_scene.py`

배선은 첫 판과 같다: `bundled.ts`·`bundledChipsetGeometry.ts`·`defaultAssets.ts`·`modernCampus.ts`·`concepts/format.ts`·`seed.json`·`startRoutePaint.ts`·`tilesetFamily.ts`(`oprn-campus`). `defaultMaps.ts` 의 빈칸 잔디는 1번이다.

## 첫 판 기록 — 굽기·번들·조수 길 (2026-10-14, PR bake-themes, 반려된 그림)


- 굽기: `python3 scripts/content/modern-campus/bake_mc.py`(공용 부품 `scripts/content/lib/theme_bake.py`) — 칸 880(19행 768×304)·키트 156·애니 스트립 11·타일 그룹 38. 정의 위반 0, 키트 재조립 불일치 0. 번호는 `tiledata/modern-campus/bake-pins.json` 덧붙이기 전용.
- 관문: 구울 때 모든 새 조각(야외·실내 mc-*)의 object-gate 영수증을 그림 화소 해시로 읽는다. FAIL·영수증 없음은 굽지 않는다(`INCOMPLETE_ANIM` 3·`NO_RECEIPT_INTERIOR` 1 제외). **판정 프로필이 아직 «보정 안 됨»이라 pass 영수증 90장은 임시통과(provisional)** — 보정 전이므로 「3/4 관문 통과」가 아니라 「임시통과」다. 재사용 jp_city 학교 기물 53종은 jp_city 시트에서 화소 그대로 복사한 것이라 이 시트 영수증이 없다(소급 면제, `bake-report.json` legacy_reused).
- 배선: `bundled.ts`·`bundledChipsetGeometry.ts`·`defaultAssets.ts`(`ensureBundledTilesets`)·`src/project/defaults/modernCampus.ts`(정의 + 참고문서 `mc-outdoor`·`mci-interior`)·`combinedTown.ts` 예외·`defaultMaps.ts` 빈칸 잔디 24.
- 배치 예제: `campus_layout.py`(학교 48×36·교외 거리 40×26 + 변조 4종) → `tiledata/modern-campus/examples/*.json`, `src/assets/modernCampusLayouts.json`(구성 도구가 읽는 단계 목록). 엔진 검증: `bun scripts/content/modern-campus/qa/check-campus-outdoor.mts`(isPassable), `check-campus-interiors.mts`(실내 5장), `check-campus-compose.mts`(구성·이음 도구).
- 조수 도구 `src/editor/tools/campusTools.ts`: `compose_campus_grounds`(school/street 템플릿 + 건물 교체 + 씨앗은 들꽃 흩뿌림만) · `link_campus_interior`(문 앞 접근칸 발판 ↔ 실내 출구 발판; jp 도구는 jp_city 전용). 템플릿 구성기이며 땅 모양 자체는 씨앗으로 바뀌지 않는다.
- 활성화: seed.json tilesetHints·`BUILDABLE_CONCEPT_TILESETS`·`startRoutePaint.ts`.
- 시각 QA(1회): 첫 조립에서 판 한 장 잔디·소품 부족·벤치가 길 위·운동장 윗선 없음을 보고 가장자리 칸·들꽃 잔디·가로등·화단·벤치 옮김·가로수를 더했다(재검수 1회).

- **실조수 검증 후 고침 (2026-10-14, argon medium):** 건물 문 중 실내에 안 이어진 것은 `link_campus_interior` 결과가 목록으로 짚어 준다(체육관·별관 죽은 문 2회 연속 발생, `unlinkedBuildingDoors`). `build_hand_interior_room` 의 「참고 예제와 N% 같다」 경고는 「요청을 충족하면 그대로 끝낸다」로 바꿨다 — 옛 문구는 같은 방을 3~6번 재시공하게 했다(361초). 1차 `PROHIBITED_CONTENT` 는 최종 답 생성 턴의 모델 안전 필터 오탐으로 추정(고등학교·긴 문맥, 2차 재현 안 됨; 코드 원인 아님).
