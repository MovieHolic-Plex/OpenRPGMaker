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

## 결과물 (이 두 파일만 쓴다)

1. `{{CDIR}}/card.json` — 아래 스키마.
2. `{{CDIR}}/gaps.json` — 이 개념을 제대로 하려면 에디터에 **없는 것** 목록: `[{"kind":"art|event-graphic|tool|tileset","what":"무엇이 없는지 한 문장","route":"맡을 하네스 id 또는 code"}]`.
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
  variants: [{
    id: string; title: string;
    worldview: string;     // 중세 지하 · 현대 · 호러 …
    tilesetId: string;     // 아래 「쓸 수 있는 칩셋」 중 하나
    build: string;         // 짓는 도구와 순서 한 줄
    structure: string[];   // 구조 규칙 (예: 통로 폭 1~2, 막다른 길 4곳 이상, 입구와 목표는 대각 반대편)
    include: [{ what: string; as: "tile" | "event"; how: string }];  // how = 도구 이름과 인자 요지
    exclude: string[];     // 넣지 않는 것
    emptiness: string;     // 빈 바닥이 얼마면 정상인가
    examples: [{ id: string; title: string; calls: [{ name: string; args: object }] }]
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
2. **쓸 수 있는 칩셋**: 실내형(지하·미궁·감옥·동굴 속·성 안·건물 안) = 손 도트 실내 v5 `atlas_biome_interior` — 도구 `build_hand_interior_room`
   (설명: `{{ROOT}}/src/editor/tools/handInteriorTools.ts`, 재료·기물 사전: `{{ROOT}}/src/assets/handInteriorSpec.json` 의 floors·walls·ceilings·objects,
   예제 맵 문서: `{{ROOT}}/src/assets/sharedHandInteriorReferences.json`). 야외형은 버들항 v6 `beodeul_city`, 현대 `modern_city`, 일본 `jp_city`,
   조선 `joseon_baram` 중 그 세계관에 맞는 것. **던전 칩셋 `atlas_biome_dungeon` 과 EasyRPG 칩셋은 폐기됐다 — 쓰지 마라.**
   지금 도구로 지을 수 없는 세계관 변형은 카드에 넣지 말고 gaps.json 에 적는다. 변형은 1개 이상, 실제로 지어지는 것만.
3. **구조가 개념을 만든다.** 미궁이면 진짜 미로(막다른 길·갈림길·순환), 감옥이면 감방 줄과 복도, 하수도면 물길과 둑길.
   평면 문자열은 직접 손으로 그리지 말고 작은 스크립트(python3)로 만들어 붙여라 — 행 길이가 어긋나면 도구가 거부한다.
4. **넣지 않는 것**을 꼭 적는다. 조수는 빈 바닥을 보면 가구·집·나무·생활 소품으로 채우려 한다.
5. 예제는 **새 프로젝트**에서 돌린다(시작 맵 `map_blank_start` 는 버들항 20×15 빈 맵). 예제 호출은 새 맵을 만들고(`build_hand_interior_room` 에 새 mapId) 그 맵에
   이벤트를 놓는다. 예제 크기는 30×30 이하 — 조수 노트에 호출 순서가 4000자까지만 실린다. 호출 수는 짧게.

## 검사 — 통과할 때까지 고친다

```bash
cd {{ROOT}} && bun src/harnesses/super-harness/node/example.mts --card {{CDIR}}/card.json --out {{CDIR}}/examples --brief {{BRIEF}}
```

`ok` 가 나올 때까지 고쳐라. 그다음 `{{CDIR}}/examples/*.png` 를 **직접 열어 눈으로 본다**. 그림 표식: 이벤트는 색 테두리
(금색 상자 · 빨강 함정 · 하늘색 세이브 · 파랑 문 · 보라 스위치 · 초록 대화 · 흰색 기타), **빨간 X 는 이벤트 없이 칠한 장치 그림**(실패).
그림을 보고 개념답지 않으면(미궁이 미로로 안 보임, 빈 방만 덩그러니, 쓸데없는 기물) 고친다. 적대 검수자 2명이 이 그림을 보고 떨어뜨릴 이유를 찾는다.

끝나면 card.json 과 gaps.json 이 있는지 확인하고, 무엇을 만들었는지 세 줄로 말하고 끝낸다.
