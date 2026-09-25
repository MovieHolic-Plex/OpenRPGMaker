# 칩셋 계열 지키기 + Rasak 마을·실내 묶음

작성 2026-09-25. 사용자 요청(원문 요지):
- "사용자가 어떤 칩셋을 쓸지는, 지금 보고 있는 칩에서 파생된 걸 쓰던가(easyrpg 계열이면 easyrpg), 아니면 타일이 달라지는
  경우에는 사용자에게 말해야 한다. 타일셋 느낌이 확 바뀌어도 괜찮냐고, 이렇게 바뀐다고 견본까지 보여 줘야 한다."
- "이제 Rasak 마을 도시, 실내를 해 보자."

## Global Constraints

- Rasak 그림(팩 PNG·아틀라스·렌더·맵 캡처·참고문서 그림)은 저장소에 절대 넣지 않는다. `~/third-party-assets/rasak/`·`/tmp/mzai/` 에만.
  저장소에는 스크립트와 글자 자료(`tiledata/rasak-fantasy/*.json|md`)만. 라이선스: 재배포 금지, 링크 허용.
- 워크트리 hard rule: 전체 gates·전체 vitest·전체 typecheck·git stash 금지. 사용자가 "테스트까지 해 보라"고 했으므로
  **바꾼 영역의 집중 vitest 와 바뀐 파일 대상 `noEmit` tsc 탐침만** 허용. vitest 는
  `timeout 900 systemd-run --user --scope -q -p MemoryMax=8G node scripts/run-vitest.mjs run <files>` 로 감싼다.
  tsc 탐침: 임시 `{"extends":"./tsconfig.json","compilerOptions":{"noEmit":true},"include":[],"files":["./src/vite-env.d.ts","./test/pngjs.d.ts",...]}`
  를 `node --max-old-space-size=7000 node_modules/typescript/bin/tsc -p` 로, `systemd-run ... MemoryMax=8G` 로 감싼다. **`noEmit` 필수**.
- 제품 문구는 한국어, 쉬운 말. 새 식별자에 rpgzzu 계열 이름 금지(OPRN).
- 아키텍처·도구 계약을 바꾸면 같은 변경에서 `openwiki/*.md` 를 고친다(`teaching-assistant-tilesets.md`, `editor-ai-tools.md`).
- 커밋 메시지 끝: `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

---

## Part A — 칩셋 계열 지키기 (코드, `src/` · `test/`)

### 규칙 (사용자 결정 그대로)

1. 조수가 새 맵을 만들거나 맵의 칩셋을 정할 때 **기본값은 사용자가 지금 보고 있는 맵의 칩셋**이다.
2. 조수가 고른 칩셋이 지금 보는 맵과 **다른 계열**이면 도구가 거부한다. 같은 계열 후보가 있으면 그것을 쓰라고 알려 주고,
   없으면 `ask_tileset_change` 로 사용자에게 **견본 그림 두 장(지금 / 바뀔 것)** 을 보여 주며 묻고 턴을 끝내게 한다.
3. 사용자가 승인하면 그 계열로의 변경이 이 대화(세션)에서 허용된다. 거절하면 지금 계열 안에서만 만든다.

### Task A1: 계열 판정 `tilesetFamily`

- 새 파일 `src/project/tilesetFamily.ts`:
  ```ts
  /** 칩셋 계열 — 그림체가 같은 묶음. 같은 계열끼리는 말없이 바꿔도 되고, 다른 계열로 가려면 사용자 승인이 필요하다. */
  export function tilesetFamily(project: Pick<Project, "tilesets">, tilesetId: string): string
  export function tilesetFamilyLabel(project: Pick<Project, "tilesets">, family: string): string  // 사람용 이름: "EasyRPG", "Rasak Fantasy", ...
  export function sameFamilyTilesets(project: Pick<Project, "tilesets">, family: string): TilesetDef[]
  ```
  판정 순서: (1) `TilesetDef.family`(새 선택 필드, 문자열) 가 있으면 그것. (2) `referenceSourceTilesetId` 를 따라 뿌리로 간 뒤 다시 판정.
  (3) `image.type === "uploaded"` 이고 family 가 없으면 `uploaded:<뿌리 id>`. (4) 번들이면 `tilesetArtStyle()`(`src/project/tilesetArtStyle.ts`) 값
  (`easyrpg`·`castle`·`slates`·`lpc`·`modern`·`oga`·`scarloxy`·`other`) — forest_harmony·tibo 는 이미 easyrpg 로 나온다. 없는 id 는 `unknown:<id>`.
- `TilesetDef` (`src/project/types.ts`) 에 `family?: string` 선택 필드 추가 + 스키마/검증 경로가 있으면 같이(옛 프로젝트 불변, 저장 왕복 유지).
  `openwiki/runtime-project-schema.md` 에 한 줄.
- 시험 `test/tilesetFamily.test.ts`: easyrpg 번들 둘 = 같은 계열, forest_harmony = easyrpg, castle ≠ easyrpg, 업로드 family 없음 = `uploaded:<id>`,
  업로드 둘이 같은 `family` 면 같은 계열, 파생(referenceSourceTilesetId) 은 원본 계열.

### Task A2: ToolContext 에 지금 보는 맵과 승인 목록

- `ToolContext`(`src/editor/tools/types.ts`) 에 선택 필드:
  `currentMapId?: string` — 사용자가 지금 보고 있는 맵. `approvedTilesetFamilies?: readonly string[]` — 사용자가 이 대화에서 승인한 목표 계열.
- 채우는 곳: Pi 경로(`src/ai/piAgent/protocol.ts` 의 요청 `currentMapId` 는 이미 있다 → 워커가 도구 ctx 를 만들 때 넣는다;
  `approvedTilesetFamilies` 는 요청 필드를 새로 추가), 채팅 경로(`src/ai/assistantSession.ts` 가 ctx 를 만드는 곳, `getCurrentMapId`),
  헤드리스 `scripts/pi-agent.mts`(`--current` 는 이미 있다, 새 `--approve-tileset-family <계열>` 반복 가능).
  ctx 를 복제·재생성하는 곳(checkpoint, 팀 모드 레인, `runToolDefinition` 호출자)이 필드를 떨어뜨리지 않게 grep 으로 확인.

### Task A3: 실행기 계열 검사 + create_map 기본값

- `toolRunner.ts` 에서 `rejectUploadedTilesetSwap` 옆에 `rejectTilesetFamilyChange(ctx, before, draft, name, args)`:
  - 기준 계열 = `before.maps[ctx.currentMapId].tilesetId` 의 계열. `ctx.currentMapId` 가 없거나 before 에 없으면 검사 안 함(옛 동작 유지).
  - 대상 = draft 에 **새로 생긴 맵** 전부 + **tilesetId 가 바뀐 맵** 전부. 대상 맵 칩셋 계열이 기준과 다르고
    `ctx.approvedTilesetFamilies` 에 그 계열이 없으면 `ToolError(code "tileset-family-change")`.
  - 메시지(한국어, 모델용): 지금 보는 맵 칩셋(이름·계열) → 도구가 쓰려던 칩셋(이름·계열), 같은 계열 후보 목록(id·이름, 최대 8개),
    그리고 지시: "같은 계열 후보 중 맞는 것을 tilesetId 로 지정해 다시 불러라(이 도구가 tilesetId 를 못 받으면 create_map(tilesetId=후보) 로
    빈 맵을 만든 뒤 칠하기 도구로 직접 깔아라). 맞는 후보가 없으면 칠하지 말고 ask_tileset_change 로 사용자에게 견본을 보여 묻고 턴을 끝내라."
  - `allowsTilesetChange` 도구(revert·reset)는 건너뛴다. 읽기 도구·dryRun 도 같은 경로를 타는지 확인(쓰기만 검사).
  - 업로드 바꿔치기 검사(`uploaded-tileset-replaced`)는 그대로 둔다(currentMapId 가 없어도 동작하는 안전망).
- 기본값: `create_map` 이 `tilesetId` 없이 불리고 `ctx.currentMapId` 가 있으면 실행기가 인자에 **지금 보는 맵의 tilesetId** 를 넣는다
  (정의에 `defaultsTilesetToCurrentMap: true` 같은 플래그를 두고 create_map 만 켠다). 그 칩셋에서 create_map 의 바닥 채움이 말이 되는지 확인
  (업로드 타일셋이면 빈 칸/첫 바닥 타일 — 지금 코드가 쓰는 채움 타일을 확인하고, 업로드 타일셋에 없는 번호를 깔지 않게).
  다른 도구(generate_map·던전/실내 파이프라인)는 EasyRPG 번호를 가정하므로 **주입하지 않는다** — 계열 검사가 막는다.
- 시험 `test/tilesetFamilyGuard.test.ts`: (a) 현재 맵이 업로드 계열인데 run_dungeon_room_pipeline 으로 새 맵 → 거부, 메시지에 후보·ask_tileset_change;
  (b) 같은 계열 칩셋으로 create_map → 통과; (c) 승인 목록에 대상 계열이 있으면 통과; (d) currentMapId 없음 → 옛 동작;
  (e) reset_project·revert_last_edit 통과; (f) create_map tilesetId 생략 → 현재 맵 칩셋으로 생성; (g) easyrpg 맵 보면서 easyrpg 던전 파이프라인 → 통과.

### Task A4: `ask_tileset_change` 도구

- `mode: "read"`, domains core(또는 map). 인자 `{ toTilesetId: string, reason: string, purpose?: string }`.
  `ctx.currentMapId` 의 칩셋을 from 으로. 없는 toTilesetId 는 ToolError. 반환 data:
  `{ kind: "tileset-change-question", fromTilesetId, toTilesetId, fromFamily, toFamily, fromLabel, toLabel, reason, purpose }`,
  summary: "사용자에게 칩셋 계열 변경을 물었다. 답을 기다리며 이 턴을 끝내라(더 칠하지 마라)."
- read 도구도 ctx 를 받을 수 있는지 확인 — `run(draft,args)` 는 ctx 를 못 받는다. 필요하면 ToolDefinition 에 선택 `runWithContext?(ctx,args)`
  를 추가하거나, from 을 인자(`fromTilesetId`)로 받고 실행기가 currentMapId 로 채워 준다. 가장 작은 쪽을 택하고 ledger 에 적는다.
- 레지스트리·도구 카탈로그(`docs/tool-catalog.md` 에 이 도구 행만 추가 — 전체 재생성 금지)·라벨(`aiToolLabels.ts`)·활동 서술.
- 시스템 프롬프트(Pi `src/ai/piAgent` 기본 프롬프트·채팅 경로 공통 지침)에 한 줄: "새 맵의 칩셋은 사용자가 보고 있는 맵과 같은 계열로. 다른 계열이 필요하면
  ask_tileset_change 로 묻고 끝낸다." — 짧게.

### Task A5: 패널 견본 질문 카드

- Pi 턴이 끝났을 때 이번 턴 도구 결과에 성공한 `ask_tileset_change` 가 있으면 대화 끝에 카드(새 모듈 `src/editor/panels/aiTilesetChangeCard.ts`)를 띄운다.
  기존 `aiCreationChoice.ts` 의 모양·클래스(`ai-creation-*`)를 참고하되 새 클래스는 `ai-tileset-change-*`.
- 카드 내용: 제목 "타일 느낌이 바뀌어요", 조수가 준 reason, 그림 두 장 나란히 — 왼쪽 "지금" = 사용자가 보고 있는 맵의 실제 화면 일부(맵 크롭 렌더,
  `drawMapTileLayers` 로 현재 맵 중앙 최대 16×10칸), 오른쪽 "바뀐 뒤" = 대상 칩셋 견본. 대상 견본: 대상 타일셋에 참고문서 그림이 있으면 purpose 가 맞는(없으면 첫)
  용도의 첫 그림, 없으면 아틀라스 앞부분 12×8칸을 칸 그대로 그린 견본. 버튼 둘:
  「이 타일로 바꿔도 좋아요」 → 세션 승인 목록에 toFamily 추가 후 자동 후속 요청
  `[사용자 승인] 칩셋 계열 변경 허용: <fromLabel> → <toLabel>. 원래 요청을 이어서 하라.` 전송,
  「아니요, 지금 타일로」 → `[사용자 거절] <fromLabel> 계열 안에서만 만들어라. 이 계열로 못 만드는 부분은 무엇이 부족한지 말하라.` 전송.
  승인 목록은 패널 세션 상태(대화 새로 시작하면 비움)에 두고 Pi 요청의 `approvedTilesetFamilies` 로 보낸다.
- 시험(jsdom, 기존 패널 시험 모양을 따른다): 결과에 질문이 있으면 카드가 뜨고, 승인 클릭이 승인 목록과 후속 요청을 만든다, 거절도.
  브라우저 증거: dev 서버(`npm run dev:worktree`) + 모델 없이(메모리 `companion-mock-for-studio-screenshots`) 카드 화면 캡처 1장을
  `verify-shots/tileset-change-card/` 에(Rasak 그림이 들어가지 않는 EasyRPG→castle 같은 번들 조합으로 찍는다).

### Task A6: 위키

- `openwiki/teaching-assistant-tilesets.md`: "칩셋 계열 규칙" 절(판정 순서, 실행기 검사, create_map 기본값, 질문 카드, 헤드리스 플래그).
- `openwiki/editor-ai-tools.md`: `ask_tileset_change` 와 `tileset-family-change` 코드.

---

## Part B — Rasak 마을·도시, 실내 묶음 (콘텐츠, 로컬 전용 + 스크립트·글자 자료만 커밋)

선행 묶음(field·swamp·cave)과 같은 절차를 새 묶음 두 개에 적용한다. 차이: **마을은 제작자 타일 프리뷰가 없다**(p24 는 손그림 세계 지도),
실내는 p21(서재·거실 저택)·p22(여관·부엌, 조명 덧칠 강함)가 참고 그림이다. 그래서 "프리뷰 재현" 대신 **우리가 엔진으로 조립한 완성 예제 맵**을 기준으로 삼고,
p21·p22 는 문서 속 "분위기 참고 그림"(글·배치 규칙의 근거)으로만 쓴다.

### 묶음 구성 (`tiledata/rasak-fantasy/bundles.json`)

- `rasak_town` "Rasak · 마을·도시": A1 `Town/A1_City`, A2 `Town/A2_City`, A3 `Town/A3_City1`, A4 `Town/A4_City`, A5 `Town/A5_City`,
  B `Town/Tileset_Town`, C `Town/Tileset_Building`, D `Town/Tileset_Structure`, E `Town/Tileset_Market`,
  추가 `Town/Tileset_Fences`, `Town/Tileset_Garden`, `Town/Tileset_Farm`, `Town/Tileset_Crops`, `Nature/Tileset_Nature_TreesSummer`.
- `rasak_interior` "Rasak · 실내": A2 `Interiors/A2_Inside`, A4 `Interiors/A4_House`, A5 `Interiors/A5_House`,
  B `Interiors/Tileset_HouseInterieur`, C `Interiors/Tileset_LivingRoom`, D `Interiors/Tileset_Tavern`, E `Interiors/Tileset_Storage`,
  추가 `Interiors/Tileset_SmithAndWorkshop`, `Interiors/Tileset_Tailoring`, `Interiors/Tileset_Royal`.
- 모든 Rasak 묶음 타일셋에 `family: "rasak-fantasy"` (Part A 계열 판정과 연결). 기존 세 묶음에도 넣는다.

### 단계

- B1 굽기: `bake_atlas.py --bundle rasak_town|rasak_interior` (빠진 슬롯 A1 등 처리 확인).
- B2 이름표: 자동타일 kind(A1~A5)·물체(B~E·추가) 한글 이름·층·통행. 선행과 같은 명세 방식(`knowledge/work/spec_a.py`·`spec_o.py` 에 묶음 항목 추가,
  대조 그림 `work/sheet_*.png` 을 직접 보고 이름). 시트가 많아 시트별로 나눠 맡긴다(서브에이전트는 명세 조각만 쓰고, 합치기·빌드는 감독자).
  A3 건물 자동타일(지붕 윗면 + 벽 앞면)은 MZ 규칙: 윗줄 = 지붕(윗면), 아랫줄 = 벽. 층: 물체는 기본 3층, 바닥성은 1층, 러그·바닥 장식은 2층.
- B3 연결 규칙: 프리뷰가 없으므로 분류별 기본 규칙(같은 종류만 / 물끼리 / 벽→A4 / 지붕 윗면끼리)을 쓰고, 예제 맵 렌더를 눈으로 검수해 고친다.
- B4 완성 예제 맵(엔진 조립, 스크립트로 재현 가능): 마을 2장(작은 마을 30×22 — 흙길·집 A3 3~4채·울타리·밭·우물·나무 / 도시 광장 32×24 — 돌바닥 A5·분수·시장 좌판·
  석조 건물), 실내 2장(민가 16×12 — 벽 A4·마루 A2·침대·식탁·난로 / 여관 1층 24×16 — 카운터·술통·식탁 여러 개·러그 2층·계단).
  네 층·그림자를 실제로 쓴다. 스크립트 `scripts/content/rasak/compose_examples.py`(글·배열만 저장소, 그림은 로컬).
- B5 참고문서 용도 4개: `town_village`, `town_city`, `interior_house`, `interior_tavern`. 선행 5용도와 같은 틀
  (규칙 첫 쪽 — 층 분해·밀도 목표·길·덩이·금지 도구 / 번호 사전 / 예제 배열 / 물체 도감 그림 / 정상·오류 그림). 건물은 "A3 지붕+벽 자동타일로 집 짓는 조리법"을
  단계별로(지붕 w×h, 벽 1~2줄, 문·창은 B~E 물체) 쓴다. 실내는 "A4 벽 윗면·앞면 → A2 바닥 → 가구 3층 → 러그 2층 → 그림자" 순서.
- B6 적용: `apply-assistant-pack.mts apply` 로 `study-project-layers` 에 새 타일셋 2개 + 참고문서 저장 → 다시 열어 왕복 확인(project id·revision 보고).
  저장 전 `cp -a` 백업, `fuser` 로 DB 사용 프로세스 없음 확인.
- B7 헤드리스 조수 시험(`/tmp/mzai/run.sh`): 요청 4개(작은 마을 / 도시 광장 / 민가 실내 / 여관 실내), 현재 맵 = 같은 묶음의 빈 맵(`--current`).
  추가로 계열 시험: 현재 맵 = Rasak 마을, 요청 "동굴 만들어 줘"(Rasak 동굴 묶음을 고르는지) / 현재 맵 = Rasak 마을, "성 만들어 줘"(ask_tileset_change 로 묻는지).
- B8 시각화 `~/claude-viz/rasak-town-interior.html`: 예제 맵·조수 결과·층 분해·계열 시험 결과, 렌더 확인 후 주소 전달.
- B9 README·메모리 갱신, PR.
