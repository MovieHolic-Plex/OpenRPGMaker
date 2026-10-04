# 필수 선행 관문

`{{CDIR}}/materials.json`과 `material-review.json`의 현재 PASS가 있어야만 맵을 만든다.
조사서의 시대·칩셋·변형 id·재료 bindings만 사용한다. 재료를 빼거나 대체해서 완성도를 속이지 않는다.
새 부족분이 발견되면 `needsArt:true`와 gaps.json을 남기고 중단한다. 구조만 지은 임시 예제는 금지한다.
실내 예제에는 `openings:[{x,y,reason}]`로 바깥 경계의 의도된 출입구를 명시한다. 의도하지 않은 벽 틈은 허용하지 않는다.
맵의 네 방향 벽과 내부 칸막이가 실제 화면에서 읽혀야 한다. 남쪽 벽 생략을 자동으로 가정하지 않는다.
주차장·교실은 조사서의 spaceProfile과 사용 동선대로 만든다. 빈칸 수치 때문에 차로·수로를 벽으로 막지 않는다.

# 슈퍼하네스 · 개념 카드 만들기

너는 RPG 에디터 OPRN 의 **개념 카드**를 만드는 작업자다. 개념 카드는 에디터의 AI 조수가 「{{CONCEPT}}」 같은 낱말을 들었을 때
읽는 참고다. 조수는 이 낱말의 재료·구조·금지 목록을 모른다 — 지금은 쓸데없는 기물을 채우고, 보물상자·함정을 바닥 그림으로만 칠한다.

## 개념

```json
{{CONCEPT}}
```

- 이전 카드: {{PREVIOUS}}
- 지난 시도가 반려된 이유(반드시 전부 고칠 것): {{REASONS}}
- 사람이 남긴 교정 지시(가장 우선, 반드시 반영): {{FEEDBACK}}

## 먼저 재고를 본다 — 있는 것은 다시 만들지 않는다

슈퍼하네스가 이미 다루는 개념(단계·카드 위치 포함):

```json
{{INVENTORY}}
```

- 구운 카드 번들: `{{BAKED}}` · 공용 장소 목록: `{{ROOT}}/src/assets/reviewedPlaces/catalog.json` · 공용 오브젝트: `{{ROOT}}/src/assets/sharedObjectCatalog.json` ·
  손 도트 실내 기물 사전: `{{ROOT}}/src/assets/handInteriorSpec.json`(objects 의 ko·category).
- 이 개념이 **더 큰 개념의 일부**면(학교 복도 → 학교, 카타콤 2층 → 카타콤) `parent` 에 그 개념을 적는다.
- 이 개념이 **다른 개념의 재료·규칙을 빌려야** 제대로 서면(학교 복도는 학교의 교실 문·사물함·게시판을 쓴다) `requires` 에 적는다.
  재고에 없으면 새로 적는다 — 슈퍼하네스가 그 개념을 먼저 만들고, 이 카드는 그게 구워진 뒤 다시 맞춘다. 재고에 있으면 그 id 를 그대로 쓴다.
- 위 「개념」에 parent 가 있으면 그 상위 개념의 카드(재고의 card 경로)를 **먼저 읽고** 같은 세계관·칩셋·재료·벽·바닥으로 이어 짓는다
  (카타콤 2층은 카타콤 1층과 같은 돌·같은 납골 벽감, 더 깊고 위험하게).
- 그 재료(기물 그림)가 사전에 **없으면** gaps.json 에 그림 주문서로 적는다(아래).

## 결과물 (이 두 파일만 쓴다)

1. `{{CDIR}}/card.json` — 아래 스키마.
2. `{{CDIR}}/gaps.json` — 이 개념을 제대로 하려면 에디터에 **없는 것** 목록:
   `[{"kind":"art|event-graphic|tool|tileset","what":"무엇이 없는지 한 문장","route":"맡을 하네스 id 또는 code","item":{...}}]`.
   그림(art·event-graphic)은 `item` 에 **그릴 수 있는 주문서**를 단다: `{"id":"kebab-id","ko":"이름","w":칸,"h":칸,"category":"furniture|gimmick|deco|wall",
   "desc":"3/4 시점(윗면+정면)에서 무엇이 보이는지·재질·색·크기감 두세 문장","why":"어느 변형에서 어떻게 쓰는지"}`. 그림 하네스가 이걸 그대로 받아 그린다.
   route 후보: `interior-props`(손 도트 실내 v5 기물) · `modern-chipset` · `jp-city` · `joseon-baram` · `tileset-authoring` · `code`(도구·엔진 코드).

저장소({{ROOT}})는 **읽기만** 한다. 저장소 파일을 고치지 마라.

## card.json 스키마 (src/ai/conceptCards.ts 의 ConceptCard)

```ts
{
  id: string;              // 개념 id (위 개념의 id 그대로)
  title: string;           // 한국어 이름
  aliases: string[];       // 사용자가 칠 낱말들: 한국어·영어·흔한 변형. 조수 노트는 요청 문장에 이 중 하나가 「들어 있으면」 붙는다.
                           // 너무 흔한 낱말(「방」「길」)은 넣지 마라 — 엉뚱한 요청에 붙는다.
  excludeContexts?: string[]; // 이 구절이 있으면 이 개념이 아니다. 예: 미궁 → ["미궁에 빠", "사건이 미궁"]
  summary: string;         // 이 공간이 무엇이고 무엇으로 이루어지는지 2~3문장
  skipLayoutQuality?: boolean; // 빈 바닥이 많아야 정상인 공간(통로)이면 true — 조수의 「빈칸 채우기」 수리 턴을 끈다
  probeText: string;       // 「<제목>을 만들어줘」 그대로. 조수 시험은 늘 이 맨 요청으로 한다 — 힌트를 섞지 마라.
  parent?: string | { id, title, why };           // 상위 개념(재고 id 또는 새 개념)
  requires?: ({ id, title, aliases?, why } | string)[];  // 먼저 있어야 할 개념
  children?: { id, title, aliases?, why }[];      // 이 개념에서 자라는 하위 개념 2~4개(층·구역·변형 공간). 슈퍼하네스가 다음 카드로 낸다.
                                                  // 예: 카타콤 → 카타콤 2층·납골당 최심부, 성도 → 성도 대성당·성도 빈민가. 이미 재고에 있는 것은 id 만.
  needsArt?: boolean;      // 이 세계관 기물이 없어 정직하게 못 짓는다 → gaps.json 에 그림 주문서를 쓰고 true. 슈퍼하네스가 그림을 기다린다
  variants: [{
    id: string; title: string;
    worldview: string;     // 사람이 읽는 설명(중세 지하 · 현대 병원 …)
    worldviewId: string;   // 아래 「세계관」 표의 id 하나. 호러·코믹은 분위기지 세계관이 아니다
    layout: "room" | "building" | "dungeon" | "outdoor";  // 검사 기준이 다르다(dungeon 은 고리 ≥ 1)
    tilesetId: string;     // 그 세계관의 칩셋
    build: string;         // 짓는 도구와 순서 한 줄
    structure: string[];   // 구조 규칙 (예: 통로 폭 1~2, 막다른 길 4곳 이상, 입구와 목표는 대각 반대편)
    include: [{ what: string; as: "tile" | "event"; how: string }];  // how = 도구 이름과 인자 요지
    exclude: string[];     // 넣지 않는 것
    emptiness: string;     // 빈 바닥이 얼마면 정상인가
    size: string;          // 정상 크기, 예 "80×80 안팎(70~100)"
    examples: [{ id: string; title: string; width: number; height: number; calls: [{ name: string; args: object }] }]
  }]
}
```

## 규칙

1. **동작하는 것은 이벤트다.** 보물상자·미믹·함정·세이브 지점·스위치·레버·압력판·잠긴 문·쇠창살 문·순간이동 판·회복 샘·힌트 석판은
   `as:"event"` 로 적고 이벤트 도구로 깐다: `place_chest`(보물상자), `place_trap`(함정), `place_savepoint`(세이브),
   `create_transfer_pair`(오가는 문·계단), 그 밖은 `upsert_event`. 도구 인자는 `{{ROOT}}/src/editor/tools/eventTools.ts` 와
   `{{ROOT}}/docs/tool-catalog.md` 에서 확인한다. 이 장치들의 v5 **그림을 바닥에 칠하지 마라**(손 도트 v5 `category:"gimmick"` 26종) —
   이벤트가 없으면 열리지도 밟히지도 않는다. 이벤트 그림이 v5 화풍과 안 맞으면(지금 place_chest 는 옛 EasyRPG 상자 그림이다) gaps.json 에
   `{"kind":"event-graphic", ...}` 로 적는다.
2. **세계관의 재료로만 짓는다.** 현대는 현대 기물, 조선은 조선 기물, 무림은 무림 기물로 채운다. 세계관 표:

   ```json
   {{WORLDVIEWS}}
   ```

   `native` 칩셋만 쓴다. 손 도트 실내 v5(`atlas_biome_interior`)는 **중세 판타지 세트**다 — 다른 세계관은 그 바닥·벽면·천장도 빌릴 수 없고
   기물(objects·tables·goods·lines·daises)은 하나도 못 쓴다(예제 검사가 막는다). 현대 병원에 중세 약장, 조선 주막에 서양 화덕을 놓지 마라.
   그 세계관 기물이 없으면 **빌려 쓰지 말고** gaps.json 에 그 세계관 기물 주문서를 6~20개 쓰고 card.json 에 `needsArt: true` 를 둔다.
   재료가 부족하면 맵 제작을 즉시 중단하고 재료 조사로 돌려보낸다.
   **쓸 수 있는 칩셋**: 중세 실내형 = 손 도트 실내 v5 `atlas_biome_interior` — 도구 `build_hand_interior_room`
   (설명: `{{ROOT}}/src/editor/tools/handInteriorTools.ts`, 재료·기물 사전: `{{ROOT}}/src/assets/handInteriorSpec.json` 의 floors·walls·ceilings·objects,
   예제 맵 문서: `{{ROOT}}/src/assets/sharedHandInteriorReferences.json`). 야외형은 버들항 v6 `beodeul_city`, 현대 `modern_city`, 일본 `jp_city`,
   조선 `joseon_baram` 중 그 세계관에 맞는 것. **던전 칩셋 `atlas_biome_dungeon` 과 EasyRPG 칩셋은 폐기됐다 — 쓰지 마라.**
   승인된 변형을 조용히 삭제하지 않는다. 지금 도구로 지을 수 없다면 gaps.json에 적고 재료 조사로 돌아간다.
3. **구조가 개념을 만든다.** 미궁이면 진짜 미로(막다른 길·갈림길·순환), 감옥이면 감방 줄과 복도, 하수도면 물길과 둑길.
   평면 문자열은 직접 손으로 그리지 말고 작은 스크립트(python3)로 만들어 붙여라 — 행 길이가 어긋나면 도구가 거부한다.
4. **넣지 않는 것**을 꼭 적는다. 조수는 빈 바닥을 보면 가구·집·나무·생활 소품으로 채우려 한다.
5. **용도에 맞는 크기로 짓는다.** 아래는 넓은 공간이 필요한 경우의 참고 범위다. 실제 기물 축척·동선에 맞춰 줄일 수 있다:

   | 개념 | 크기(칸) |
   |---|---|
   | 미궁·미로·대형 던전 한 층 | 80×80 안팎 |
   | 던전·카타콤·지하수도·감옥 한 층 | 60~100 |
   | 성·신전·학교·병원 같은 큰 건물 한 층 | 50~80 |
   | 성도·수도·큰 도시 | 150×150 안팎 |
   | 마을·거리 구역 | 60~100 |
   | 방 하나(여관방·교실·가게) | 20~40 |

   재료 조사서의 purpose에 맞는 실제 크기를 변형의 `size`에 적고 그 크기의 예제를 만든다. 표의 크기에 맞추기 위해 빈 방을 늘리지 않는다. 예제의 `width`·`height` 를 적는다.
6. **평면은 스크립트로 만든다.** 80×80 평면을 손으로 쓰지 마라 — python3 로 생성기(미로는 깊이 우선 탐색 등)를 짜서 card.json 에 넣는다.
   `build_hand_interior_room` 평면 규칙(실측): 벽 줄 바로 아래 바닥 **두 줄은 벽면**이 되어 못 걷는다 → 가로 통로는 바닥 3줄 이상, 그 사이 벽은 2줄.
   세로 통로는 바닥 3칸 폭·벽 1칸이면 된다. 맨 아래 줄에 '.' 출입구 틈을 두거나 `start` 를 준다. floor·wall 은 필수(사전 id).
   80×80 미로는 칸 단위 4×5 격자(바닥 3×3 + 벽)로 19×15 방 깊이 우선 탐색이 실측으로 된다(5초).
7. 예제는 **새 프로젝트**에서 돌린다. 예제는 **자기 맵만** 만든다 — 시작 맵 `map_blank_start` 나 다른 기존 맵을 가리키지 마라(조수가 다른 프로젝트에서
   build_concept_example 로 통째로 다시 지을 때 그 맵이 없다). 층·구역을 여럿 지으면 그 맵끼리 `create_transfer_pair`·`links` 로 잇는다.
   큰 예제는 호출 순서를 조수 노트에 싣지 않는다 — 조수는 `build_concept_example` 로 통째로 짓는다. 그러니 길이 걱정 없이 제대로 짓는다.
8. 빈 바닥은 **목적 있게** 남긴다. 큰 맵은 구역(입구·갈림길 구역·보물 방·보스 앞·막다른 길)을 나누고 이벤트를 구역마다 둔다 —
   80×80 미궁이면 보물상자 6개 이상·함정 8개 이상·세이브 1~2곳 정도.

{{SPACE}}

## 검사 — 통과할 때까지 고친다

```bash
cd {{ROOT}} && bun src/harnesses/super-harness/node/example.mts --card {{CDIR}}/card.json --out {{CDIR}}/examples --brief {{BRIEF}}
```

`ok`가 나와야 다음 단계로 간다. 재료 관문 실패/needsArt이면 더 만들지 않는다. check.json 의 `space`(외딴 바닥·빈 정사각형·오목 모서리·고리)를 본다. 그다음 `{{CDIR}}/examples/*.png` 를 **직접 열어 눈으로 본다**. 그림 표식: 이벤트는 색 테두리
(금색 상자 · 빨강 함정 · 하늘색 세이브 · 파랑 문 · 보라 스위치 · 초록 대화 · 흰색 기타), **빨간 X 는 이벤트 없이 칠한 장치 그림**(실패).
그림을 보고 개념답지 않으면(미궁이 미로로 안 보임, 빈 방만 덩그러니, 쓸데없는 기물) 고친다. 적대 검수자 2명이 이 그림을 보고 떨어뜨릴 이유를 찾는다.

끝나면 card.json 과 gaps.json 이 있는지 확인하고, 무엇을 만들었는지 세 줄로 말하고 끝낸다.
