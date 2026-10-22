---
name: interior-room-authoring
description: Use when building or reviewing a 16px RPG interior (house, shop, inn, manor, chapel, castle room, cellar) with OPRN's hand-pixel interior chipset atlas_biome_interior (v5) — plan string gives the room structure, walls and ceilings are automatic, furniture goes in by v5 object id — or when extending that chipset's pixel kit. 손 도트 실내(v5)로 실내를 짓거나 검수할 때, 실내 칩 키트를 늘릴 때.
---

# 손 도트 실내 짓기 (interior room authoring, v5)

실내 칩셋은 **`atlas_biome_interior` 하나**다(계열 `oprn-atlas`, 16px, 시트 48칸 폭). 옛 실내 칩셋
(`easyrpg_chipset_interior` · `tibo_interior_expanded` · LPC 가구)은 2026-09-29 사용자 결정으로 폐기됐다 — 조수 목록에 보이지 않고 새 맵·가져오기·찍기는 거부된다.
원본 손 도트는 `tiledata/hand-interior/v5`(Python: 가구 381종, 건물 25동 26맵의 정답), 칩셋으로 자르는 것은 `scripts/content/hand-interior/build_tileset.py`.

이 문서의 원본은 저장소 `assistant-skills/interior-room-authoring/SKILL.md` 다. 편집기 조수는 같은 내용을 참고문서
「손 도트 실내 (v5)」(`list_tileset_references({tilesetId:"atlas_biome_interior"})`)로 읽는다.
`~/.claude/skills/interior-chipset-authoring` 은 나중에 이 원본을 가리키게 바뀐다(그 §0~0e 판정을 여기로 옮겼다).

## 1. 공통 원칙 (코딩 에이전트·편집기 조수)

### 구조는 그림보다 먼저 (사용자 판정 2026-09-28 「너무 엉성 … 방 구조도, 계단도 엉망」)
1. **벽을 손으로 칠하지 않는다. 평면에서 나온다.** 평면 = 칸마다 안/밖. 막힌 칸 바로 아래 두 줄 = 벽면(못 걸음),
   막힌 칸 중 실내에 닿는 칸 = 천장 띠(어두운 덮개 + 방 쪽 밝은 테두리), 나머지 = 공허. 두꺼운 칸막이 = 평면 안의 막힌 칸(자기 덮개 + 남쪽 벽면 두 줄).
2. 방은 사각형 하나가 아니다: 뒷방·곁방·칸막이·어긋난 북벽, 알코브, ㄱ자, 문 앞 현관.
3. **두꺼운 벽을 지나는 길은 3줄**(벽면 2 + 바닥 1)이거나 칸막이가 먼 벽 앞에서 끊긴다. 1~2줄 구멍은 벽면이 되어 길을 막는다(「부서진 방」).
   동서 칸막이(세로 벽) 틈 1칸 = 문.
4. **위로 가는 계단**: 북쪽 벽 앞, 3칸 폭, 첫 바닥 줄 + 벽면 두 줄을 덮고 벽 속으로 오른다. 방 가운데·옆벽 금지. **아래로**: 바닥의 1×1 구멍.
5. 벽 가구(선반·찬장·옷장·시계·화덕·벽난로)는 북쪽 벽면 앞에만. 걸이(창·그림·선반·병·무기)는 벽면 두 줄 중 **윗줄**에만, 서로·솟는 가구와 겹치지 않는다. 창 → 바닥에 비스듬한 햇빛.
6. 서쪽 벽 덩이 옆 안쪽 5px 그림자, 모든 벽면 밑 접촉 그림자(자동).

### 외부 문과 실내 출구 폭 (사용자 판정 2026-10-07)

- 외부 문이 가로 한 칸이면 실내 남쪽 출구도 한 칸이다. 마지막 줄은 `####.#####`처럼 쓰며 `####..####`로 넓히지 않는다.
- `build_hand_interior_room`의 `exitWidth` 기본값은 1이다. 실제 틈 폭이 다르면 맵을 만들지 않는다. `start:[{x,y}]`는 BFS 출발점을 정할 뿐 두 칸 출구를 한 칸으로 만들지 않는다.
- 넓은 대문을 명시한 경우에만 실제 문 폭에 맞는 `exitWidth`를 준다. 원본 예제의 두세 칸 출구는 그 예제의 큰 출입구다. 한 칸 집 문에 그대로 복사하지 않는다.
- 결과 `exits`의 실제 위치·폭을 읽고 문앞·출구·착지·귀환을 연결한다. 통행 통과만으로 문 폭이나 실제 그림을 합격시키지 않는다.

### 건물과 사람 (v3 판정)
7. 방 하나짜리 건물 금지. 건물 = 여러 방: 뒷방/곁방/칸막이/어긋난 북벽.
8. 사람이 사는 방식대로: 주인은 뒷방에서 카운터 뒤로, 손님은 거리 문에서. 의자는 탁자를 향한다. 책상 의자 = 책상 남쪽 `chair N`. 협탁은 침대 양옆.
   모루는 화덕 앞 1~2칸, 담금 통 곁.
9. **표면 위에 놓일 것은 표면 위에.** 촛대·절구·저울·바구니·지구의는 윗면 가구 위에 — 바닥에 두지 않는다.
10. 불·물은 움직인다(12프레임, 끝 프레임이 첫 프레임으로 흐른다).

### v4 판정
11. 불 쓰는 방(빵 화덕·대장간·부엌)은 돌·타일 바닥 + 돌 벽. 불 옆 나무 바닥은 틀렸다. 벽 재질은 **칸막이 뒤 방 단위로만** 바꾼다 — 한 줄로 이어진 벽을 중간에 바꾸지 않는다.
12. 장작은 앞-위 시점(통나무 걸이 ~1×2칸), 납작한 더미가 아니다.
13. **통행 보장**: 출입구에서 모든 방, 모든 카운터·침대·의자·계단·화덕의 사용 칸까지 BFS. 의자가 문을 막지 않는다(빵집 버그).
14. 탁자·책상·카운터는 자동 타일(아무 W×H) + 윗면. 부엌: 옅은 벽돌·타일 바닥, 냄비 얹은 레인지, 끓는 것은 움직인다.
15. 가게는 손님 동선: 진열을 둘러보고 → 출구 가까운 카운터에서 계산. 창고는 작게. **「공간이 남으면 맵이 큰 것」** — 채우지 말고 줄인다.
16. 예배당 창은 좌우 대칭·같은 간격, 제단 뒤 큰 창. 저택 = 여러 층(층마다 맵, 계단 칸 맞춤), 복도·응접실·식당·부엌·하녀 방·안방·서재·손님방.

### 화풍 (v1·v2 판정 「너무 별로다」「도트가 허접」)
17. 바닥은 조용하게(4~5톤, 명도 차 ~25), 가구는 대비 크게(1px 밝은 테두리 + 거의 검은 윤곽). 이 명도 차가 방을 읽히게 한다.
18. 재료마다 정해진 램프만(나무 8톤). 윗면마다 굴린 테두리(바깥 1px 어둡게, 안쪽 1px 밝게). 앞 모서리 = 밝은 입술 줄, 얼룩진 어두운 줄, 검정 1~2줄(밑 그림자), 다리.
19. 검정은 바닥 쪽·빈 곳·다리 사이에만. 결은 테두리 가까이 드물게. 천은 가장자리 ~3px 만 램프, 가운데는 평평.
20. 표면은 월드 좌표로 칠한다(16px 반복이 띠로 보인다). 칩셋에서는 표면마다 짜임 주기(판자·줄눈·기둥 간격)의 배수(64px 이상)로 접었다 — 벽 기둥·지지목이 원본 자리에 서고 이음매가 줄눈에 떨어진다.

### 주인공 물건이 있는 큰 방 (2026-10-22 조수 실력 시험 — 폴른 스타 세 방: 코딩 에이전트 판 8.2/8.2/8.1, 조수 판 5/5/5)
21. **방마다 쓰임 하나 + 앵커 한 벌.** 알코브·곁방·벽감마다 쓰임을 정하고 그 가구를 세 점 이상 묶는다. 「촛대 + 상자」 채움은 major.
    (서고 = 책장 줄 + 사다리 + 열람대 · 정결 감실 = 달빛 못 + 성수반 + 긴의자 · 기록 감실 = 독서대 + 두루마리 선반 + 책 더미 · 수호 감실 = 석상 한 쌍 + 봉헌대)
22. **주인공은 하나, 입구 → 주인공 축 위.** 큰 주인공 그림이 칩셋에 있다(폴른 스타 조각, #3234): `great telescope`(5×2 발밑, 망원경) 바로 위 북벽에 `dome slit tall`(관측 틈, 천장 줄 y) · 화로 퍼즐은 `great stone brazier`/`great brazier`(+` lit`) · 별 렌즈 `star lens`(4×2) · 바닥 봉인 `star seal`(+` open`) · 돌 단 앞 턱 `dais riser stone L`/`dais riser stone`/`dais riser stone R` + 오르는 `dais steps stone`(2칸). `list_hand_interior_parts` 로 확인하고 1칸 그림 대신 이것을 쓴다.
    큰 그림이 없으면 작은 것을 여럿 흩뿌리지 말고 주인공 세트로 키운다: 단 위 한가운데 하나 + 마법진/깔개 축 + 양옆 짝(기둥·큰 촛대·석상) + 입구에서 단까지 긴 깔개. 큰 그림이 없다는 것은 보고에 적는다.
22b. **단 크기 = 주인공 + 둘레 1칸**(빈 큰 단은 빈 받침대 — 도구 경고 「단 위가 거의 비었다」). **대칭은 설계**: 짝(기둥 넷·석상 한 쌍)을 대칭 깨려고 하나 지우지 않는다(끝 검사도 실내에는 좌우 대칭을 묻지 않는다). 성소 마법진은 `magic circle` — `summoning circle`(붉은 오각별)은 마족 방 전용.
23. **돌 단은 앞 턱으로 높이를 보인다**: 맨 아랫줄에 `dais riser stone L`·`dais riser stone`·`dais riser stone R` + 오르는 곳 `dais steps stone`(도구 경고 「돌 단에 앞 턱이 없다」). 단 위 바닥 무늬(마법진·봉인·앞 턱)는 빌더가 단 위 층에 얹는다. **없는 건축을 평면 홈으로 흉내 내지 않는다**(방 안의 검은 구멍 — 도구 경고 「평면 속 허공」) — 관측 틈은 `dome slit tall` 걸이로.
24. **한 건물 = 벽면 재질 하나**, 바닥은 같은 돌 가족 안에서만(flag·grey 끼리 — dungeon 은 갈색 벽돌로 읽힌다, 도구 경고 「돌 바닥 재질 가족」). 지하에 창 금지. 「사당」은 교회 제단(altar E·reredos)이 아니다 — 불씨 사당 = 켜진 화로 한 쌍 + 봉인석 한 쌍 + 횃불, 앞마당 1~2줄.
25. **빈 바닥 ≤15%**(도구 경고 「빈 바닥」, 합격 판 7~15%): 채우지 말고 벽을 들여 쌓는다('#'), 깊은 알코브는 얕게, 넓은 홀은 칸막이로. 아니면 그 구역에 쓰임 한 벌.
26. **확인 바퀴**: 짓기 → 경고 → `show_map_region` → 요청 낱말마다 「1배에서 그것으로 읽히나」 → `replace:true` 로 다시(최대 3번). 합격 판은 독립 검수 28바퀴였다.
    도구는 1배 구성 검사(`src/editor/handInterior/compositionLint.ts`: 빈 바닥·방 밖 허공·평면 속 허공·걸이 반복·돌 바닥 가족·빈 단·앞 턱 없는 돌 단)를 경고로 돌려준다.

## 2. 코딩 에이전트만

- 칸 사전·시트·예제: `python3 scripts/content/hand-interior/build_tileset.py`(저장소 루트). v5 모듈을 그대로 불러
  구조(천장 32변형·바닥 64·벽면 16) + 가구 381 + 탁자 9 + 줄 11 + 단 5 + 탁상 물건 119 를 칸으로 자르고, 예제 26맵을 층으로 나눠
  **원본 합성과 12프레임 픽셀 차 0, 통행 격자(meta grid) 불일치 0** 을 스스로 검사한다. 하나라도 어긋나면 BAD 가 찍힌다.
- 조립기: `src/editor/handInterior/builder.ts`(room2.render 와 같은 구조 규칙 — 예제 1층 칸 번호가 같다). 도구: `src/editor/tools/handInteriorTools.ts`.
- 참고문서: `bun scripts/content/hand-interior/prepare-references.mts` → `src/assets/sharedHandInteriorReferences.json`(그림 `public/assets/hand-interior-references/`, 바이트 없음).
- 정본: `bun scripts/content/hand-interior/save.mts` → `.oprn-projects/hand-interior-v5-20260929` 저장·재로드 deepEqual.
- 조수 시험: `bun scripts/qa/hand-interior-assistant-run.mts --label <이름> --task "<요청>"`(증거 `verify-shots/hand-interior-assistant/`).
- 새 가구를 그릴 때: v5 폴더의 모듈(kit4·kit5·props5·props6·chapel5, 재료 램프 mat.py)에 함수로 그리고 `OBJ` 에 등록 → `meta5.py`(메타·아틀라스, 바이트 같게 재생성되는지) →
  `build_tileset.py` → `prepare-references.mts` → `save.mts`. 칸 번호는 다시 매겨진다(시트 전체 재생성) — 옛 저장본은 `ensureAtlasBiomeInteriorCurrent` 가 정의를 통째로 바꾼다. 예제 맵은 다시 저장한다.
- 공용 규칙(AGENTS.md): 번들 소유, 기존 프로젝트에도 심기(ensure), 새/기존 양쪽 검증, 적대적 시각 QA 는 새 검수자.
- 함정: RM2k3 투명 칸 자동 보정(`applyCustomChipsetMinimalHarness`)에서 이 시트를 빼야 한다(0~479 가 번호표대로 윗층으로 간다).
  줄 자동 타일은 안쪽 모서리가 여럿 겹친 조합(`NES+NeEs`)까지 굽는다. `spiral stair` 는 층 이동 계단이 아니다(막힌 장식).
  창 빛(`lights`)과 탁상 물건을 얹은 가구는 예제에서만 합성 칸으로 굽는다 — 조수 도구는 탁상 물건을 4층 칸으로 얹는다.
- 박물관·배 안·투기장(interior-plus, 2026-10-14)은 v5 시트 **끝에 덧붙인** 조각이다(칸 번호 덧붙이기만, 기존 칸 불변): 그림은
  `scripts/content/interior-plus/pieces/*.py`(같은 팔레트 v6, iplib 램프) → `python3 scripts/content/interior-plus/bake.py`(관문 영수증 확인 후 덧붙임,
  `build_tileset.py` 끝에서 자동으로 다시 돈다) → `rooms_json.py`·`templates.mts`(방 종류·방 견본) → `prepare-references.mts`. 예제 평면은
  `tiledata/hand-interior/plus/plans/*.json`(방 사각형 입력), 시험 `bun scripts/content/interior-plus/qa/build_plans.mts`. 3/4 관문은 `gate_export.py pending` →
  `object-gate review --batch`, 바닥·벽면은 조립 방(`gate_rooms.py`, kind structure) 영수증으로 덮는다.

## 3. 편집기 조수만

1. `list_tileset_references({tilesetId:"atlas_biome_interior"})` → 「손 도트 실내 (v5)」 용도의 읽는 순서·구조 규칙·사전을 읽고, 짓는 건물과 가까운 예제 하나(입력 인자·정답 배열·그림)를 **그림까지** 본다.
2. 방 목록을 글로 먼저 정한다: 방마다 용도·앵커 가구·문·동선. 공간이 남으면 맵을 줄인다. 예제를 통째로 복사하지 않는다 — 짜임을 배워 새 평면으로.
3. `list_hand_interior_parts` 로 가구 id 를 찾는다: `{room:"빵집"}`(방 종류·건물 → 예제 방에 쓰인 가구를 종류별로), `{query:"여관 벽"}`(여러 낱말, 설명·쓰는 방·놓는 곳·짝 소품까지). 가구 사전 문서(`hand-interior-v5-objects-*`)는 그래도 모자랄 때만.
4. `build_hand_interior_room({mapId, name, plan, floor, wall, zones, ceiling, objects, tables, lines, daises, goods, start, links})` 한 번.
   벽면·천장·그림자는 평면에서 자동이다. `paint_tiles`/`fill_region` 으로 벽을 칠하지 않는다.
5. 오류(error)면 맵이 생기지 않는다 — 메시지 좌표를 고쳐 다시. 경고(닿지 못한 바닥·쓸 수 없는 가구)도 고친다. 고친 뒤 `replace:true`.
6. 여러 층: 층마다 맵. 아래층 `stairs up wood|stone` 발밑 칸들에 `links:[{x,y,toMapId,toX,toY}]`(도착 = 위층 계단 구멍 바로 아래 바닥), 위층 `stairwell down` 칸에 아래층 도착 칸.
7. `show_map_region` 으로 그림을 보고 확인한다. 참고문서에 없는 가구는 만들지 않는다 — 없다고 말하고 가장 가까운 id 를 쓴다. 사용자가 콕 집어 말한 가구 하나가 정말 없으면(`list_hand_interior_parts`·`list_spatial_designs` 둘 다 0건) `generate_missing_object` 로 그려 달라고 요청하고 턴을 끝낸다 — `read_assistant_skill({id:"missing-object-generation"})`.
8. 다른 실내 칩셋(Tibo·EasyRPG 실내)을 쓰라는 요청은 거절된다. 그 이유(폐기)를 사용자에게 말하고 손 도트 실내로 짓는다.
9. 박물관·미술관 전시실(판타지·중세)·배 안(선장실·조타실·배 주방·선원 숙소 / 포 갑판·화물칸·배 감방)·투기장(관중석·모래 마당·검투사 방·무기고)은
   이 칩셋의 방 종류다 — `build_hand_interior_room({layout:{program:"museum"|"ship"|"ship_hold"|"arena"}})`, 말한 방만이면 `layout:{rooms:[{kind:"ship_cabin"},{kind:"ship_cargo"}]}`.
   경계: 호러·고딕·흉가 미술관은 gothic_manor(`build_gothic_place`), 해적 항구·섬 바깥은 pirate_isles, 보고 있는 맵이 pirate_isles 면 그 칩셋의 배 안. 그림·명판에는 글자가 없다.
   관람 통로·배 안 통로·모래 마당은 비어 있는 것이 쓰임이다 — 흩뿌려 채우지 않는다.
10. 해리포터풍·마법 학교(번들 칩셋 wizarding_world) 방·야외는 이 스킬이 아니다 — `list_wizarding_spaces({space})` → `build_wizarding_space({space, name|mapId, doors, density, seed})` 한 번으로 짓는다(13공간 레시피, 통행 한 덩이 보장). 결과 `doorCells` 에 이동 이벤트를 단다.
