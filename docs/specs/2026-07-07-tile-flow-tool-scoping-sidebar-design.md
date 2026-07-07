# 타일 시공 흐름 · 툴 노출 스코핑 · AI 사이드바 IA 재설계

- 작성일: 2026-07-07
- 작성자: Claude Fable 5 (설계·감독) — 구현은 Fable 5 HIGH 서브에이전트
- 대상 브랜치: `feat/phase-6a` (truth source `/home/main/z-project/rpg-zzu-wt-6a`)
- 연관: [[rpg-zzu-v2-spec-location]], `docs/specs/2026-07-07-tile-tools-v3-design.md`

## 0. 배경 — 실측에서 드러난 3중 실패

사용자가 빈 맵에서 "벽을 깔아라 → 9×3" 을 실제로 시켜본 세션 로그를 코드로 역추적한 결과,
`build_wall` 한 번의 실패에 **독립 버그 3개가 층으로 쌓여** 있었다. 여기에 툴 홍수와
사이드바 IA 문제가 겹쳐 "승인했는데 벽이 안 깔린다" 가 발생했다.

### 실패 A — 승인해도 시공되지 않음 (3중 버그)

1. **스펙 게이트 오적용.** v3 공정 프리미티브(`build_wall` 등)가 레거시 배치 툴용
   `set_build_spec` 게이트를 탄다. 근거: `src/ai/buildSpec.ts:62` 의 `SPATIAL_BUILD_TOOLS`
   집합에 v3 6종이 등록돼 있어, `assistantSession.ts:507`→`specGate()`(L316)에서
   "밑그림 없음" 으로 차단된다. v3 는 **승인 어휘 자체가 명세**이므로 이 게이트가 불필요하다.

2. **승인이 '이름'만 만들고 '패턴 파츠'를 안 만듦 (핵심).**
   `propose_tile_vocabulary` 수락 시 `origin:"user"` + `patternKind` 까지는 붙지만,
   `patternGrammar.parts`(9칸을 TL/T/TR·L/C/R·BL/B/BR 역할로 매핑)를 채우지 않는다.
   근거: `src/editor/tools/v3/vocabularyTools.ts` 의 `approveGroupItem`(~L243)은 메타만 기록하고,
   파츠 생성은 T1b 위저드/별도 단계에 미뤄져 있다(L63 주석). 그래서 승인된 벽조차
   `build_wall` 이 "patternGrammar.parts 정의 안 됨" 으로 전개 실패한다 — 로그의 바로 그 에러.

3. **승인이 시공을 이어주지 않음.** 제안 후 턴이 끝난다. 사용자가 카드를 수락하면 어휘만
   커밋되고, `build_wall` 은 **다시 요청해야** 실행된다. 그 사이 모델은 옛 툴
   (`tile_group`/`set_group_layout`/`suggest_group_from_range`)로 새 그룹 `흰-벽-2` 를 만들어
   미승인 상태로 재차 꼬였다.

### 실패 B — 툴 홍수

LLM 에 **70개** 노출(등록 99, deprecated 29). deprecated 는 옛 배치 4종·palette 뿐이고,
v3 와 경쟁하는 옛 타일 지식 툴이 살아있다: `tile_group`·`set_group_layout`·
`suggest_group_from_range`·`tile_metadata`·`tile_cluster_rule`·`render_group_sample`·
`show_tile_grid`·`show_tiles`·`extract_terrain_template`·`upsert_terrain_template`·
`validate_structure`. minimax-m3 같은 작은 모델은 이 70개 안에서 v3 정공법 대신 옛 툴로 샌다.

### 실패 C — 사이드바 IA 붕괴

우측 AI dock(`aiChatPanel.ts`, 2581줄)이 대화 로그·추론·툴 실행·어휘 카드·제안 카드·설정·
폰트·도크 버튼을 **한 세로 스택에 평평하게** 쌓는다. 결정이 필요한 카드가 로그에 섞여
스크롤 위로 사라진다. dock 폭도 너무 좁다.

---

## 1. 목표 / 비목표

**목표**
- G1. "승인 = 즉시 시공" 을 구조적으로 보장 — 승인 후 사용자가 재요청하지 않아도 시공된다.
- G2. 승인 어휘가 **항상 전개 가능한 파츠**를 갖는다(빈 patternGrammar 로 승인 완료되지 않음).
- G3. 타일 작업 중 LLM 에 노출되는 툴을 **v3 프리미티브 + 필수 맵 툴 ~12개**로 좁힌다.
- G4. 우측 dock 을 3-존 IA(헤더 / 대화 / 고정 액션 존)로 재편하고 폭을 넓힌다.
- G5. 네이티브 `alert`/`confirm` 을 커스텀 인앱 모달로 대체한다.

**비목표**
- 새 patternKind(포켓몬식 등) 추가 — 이번엔 RM-TYPE(nine_slice/vertical/autotile)만.
- 레거시 배치 툴(집짓기 batch)의 스펙 게이트 자체는 유지(v3 만 게이트에서 제외).
- 모델 판단 기반 모드 추론 — 결정적(활성 탭) 규칙만 쓴다(원칙 0).

---

## 2. 설계

### 2.1 승인+시공 융합 (G1·G2, 실패 A)

**개념:** 제안 카드가 "이번에 하려던 시공"을 **보류 액션**으로 안고 있다가,
사용자가 카드에서 교정 후 **[승인하고 시공]** 한 번 누르면 → 어휘 커밋 → 파츠 자동 생성 →
보류된 프리미티브 실행 이 한 제스처로 끝난다.

**2.1.1 스펙 게이트에서 v3 제외 (버그 1)**
- `src/ai/buildSpec.ts:62` `SPATIAL_BUILD_TOOLS` 에서 `build_wall,build_roof,place_door,
  place_window,lay_path,place_props` 6종 제거. `SPEC_BOUNDARY_SLACK_TOOLS`(L72)에서도 동일 제거.
- 결과: v3 프리미티브는 `assistantSession.ts:507` 의 `SPATIAL_BUILD_TOOLS.has(name)` 분기를
  타지 않아 게이트를 건너뛴다. 승인 어휘 소비 검증(미승인 하드차단)은 프리미티브 내부에 그대로 유지.
- 레거시 배치 툴(`paint_tiles`,`build_house`,`clear_region` 등)은 집합에 남겨 게이트 유지.

**2.1.2 승인 시 패턴 파츠 자동 생성 (버그 2, 핵심)**
- 신규 헬퍼 `derivePatternGrammar(patternKind, tileIds, tileset)` 를
  `src/editor/tools/v3/rmTypeExpander.ts` 에 추가(전개기와 같은 파일 — 파츠 정의·소비를 한곳에).
  - `nine_slice_expandable`: tileIds 9개를 row-major 로 `{tl,t,tr,l,c,r,bl,b,br}` 에 매핑.
    9개 미만이면 승인 거부(사실 위반) — `ToolError code:"pattern-underspecified"`.
  - `vertical_expandable`: 열 단위 `{top,mid[],bottom}` (3의 배수 tileIds → 상/중(반복)/하).
  - `autotile`(3x3 8방향): `buildEightNeighborVariantMap`(기존 함수) 로 variantMap 생성.
  - 그 외/미지원 patternKind: 파츠 없이 승인은 가능하되 **facts 에 "전개 불가" 명시**하고
    프리미티브가 그 그룹을 만나면 명확한 재교정 안내.
- `vocabularyTools.ts` `approveGroupItem`: 승인 확정 직전에
  `group.patternGrammar ??= derivePatternGrammar(...)` 를 호출해 파츠를 채운 뒤 origin:user 로 커밋.
  이미 파츠가 있으면(사실) 유지하고 patternKind 불일치만 경고(현행 L243 로직 보존).
- **불변식:** origin:"user" 이고 patternKind 가 전개형인 그룹은 **반드시** patternGrammar.parts 를 갖는다.
  테스트로 강제(§4 T2).

**2.1.3 보류 액션 큐 + 원클릭 실행 (버그 3)**
- 프리미티브가 "미승인 어휘" 로 실패할 때(현재는 그냥 에러), assistantSession 이 그 호출을
  **보류 시공(pendingBuild)** 으로 최근 제안 카드에 첨부한다:
  `{ tool: "build_wall", args, label: "벽 (8,6) 6×5" }`.
- 카드 수락 핸들러(aiChatPanel): 어휘 커밋(=파츠 생성) 성공 후, 첨부된 pendingBuild 가 있으면
  **같은 사용자 제스처 안에서** 해당 프리미티브를 draft 에 직접 실행하고 changeset 으로 커밋한다.
  모델 재호출 없음(결정적). 실패 시 커스텀 모달로 사유 표시.
- 버튼 라벨: pendingBuild 있으면 **"승인하고 시공"**, 없으면 기존 **"승인"**.
- 사용자가 카드에서 이름/역할/patternKind/tileId 를 교정하면 그 값이 커밋값(현행
  reassembleSelectedProposalProject 경로 재사용)이며, pendingBuild 의 wallVocabId 도 교정된 groupId 로 리바인드.

### 2.2 컨텍스트 모드 툴 스코핑 (G3, 실패 B)

**2.2.1 잔존 옛 타일 툴 deprecated (무조건)**
- `toolRegistry.ts` `tagV1()`/superseded 맵에 추가로 다음을 deprecated 마킹:
  `tile_group, set_group_layout, suggest_group_from_range, tile_metadata, tile_cluster_rule,
  render_group_sample, show_tile_grid, show_tiles, extract_terrain_template,
  upsert_terrain_template, validate_structure`.
  (getTool/실행 호환은 유지 — LLM 노출만 제외. 70 → ~59.)

**2.2.2 활성 탭 기반 모드 스코핑**
- 각 툴에 `domains?: readonly ToolDomain[]` 태그를 부여(`ToolDomain = "tile"|"map"|"event"|
  "database"|"world"|"quest"|"battle"|"system"`). 태그는 툴 파일에서 정적으로 선언.
- 에디터가 현재 모드를 **결정적으로** 계산: 활성 우측 패널 탭 / 마지막으로 연 편집 대상.
  - 타일 팔레트/타일셋 패널 활성 → `mode:"tile"`.
  - 이벤트 에디터 활성 → `mode:"event"`. DB 모달 → `"database"`. 등.
  - 판정 불가/일반 → `"map"`(기본, 넓게).
- `toOpenAiTools(tools, { mode })`: `deprecated!==true` **AND**
  (`mode` 없음 OR `tool.domains` 가 mode 를 포함 OR tool 이 `domains:["*core*"]`) 필터.
  - **코어 상시 노출**: `create_map, get_project_summary, list_resources, tile_query` 등 소수는
    모든 모드에서 보이게 `core` 태그.
  - 타일 모드 화이트리스트(예상 ~12): `propose_tile_vocabulary, build_wall, build_roof,
    place_door, place_window, lay_path, place_props, tile_erase, tile_query, create_map,
    resize_map, get_project_summary`.
- assistantSession 이 턴 시작 시 현재 mode 를 읽어 `toOpenAiTools(mode)` 로 tools 배열 구성.
- **원칙 0 안전:** mode 는 UI 상태에서 나오는 결정적 값이지 모델 판단이 아니다.

**2.2.3 모드 배지**
- dock 헤더에 현재 모드 + 노출 툴 수 표시: `🀫 타일 · 12툴`. 모드 전환 시 갱신.

### 2.3 사이드바 3-존 IA + 폭 확대 (G4, 실패 C)

- **① 헤더(상단 고정):** 모드 배지(2.2.3) · 폰트 크기(기존 3-tier) · 설정 아이콘 · 도크 버튼.
  잡컨트롤을 모두 여기로 수렴.
- **② 대화(가운데, 유일 스크롤 영역):** 메시지 흐름. 추론(💭)·툴 실행(🔧)은 **기본 접힘**
  아코디언(기존 `ai-tool-detail`/`ai-reasoning-item` 재사용). 로그는 로그답게.
- **③ 액션 존(입력창 바로 위, 고정 pin):** 지금 결정이 필요한 것만 — 어휘/시공 제안 카드 +
  **[승인하고 시공]**. 스크롤과 무관하게 고정. 결정 없으면 접힘/숨김.
  기존 `renderVocabularyCardList`·제안 카드를 로그(②)에서 이 존으로 이동.
- **폭:** dock 기본 폭 확대(현행 대비 넓게, 예 `--ai-dock-width` 기본 상향) + 좌측 리사이저로
  사용자 조절 가능. localStorage 로 폭 저장.

### 2.4 커스텀 모달 (G5)

- 신규 `showConfirm(opts): Promise<boolean>` / `showAlert(opts): Promise<void>` 컴포넌트
  (`src/editor/ui/modal.ts` 등). 스타일된 오버레이 + 제목/본문/확인·취소. testid 부여.
- 네이티브 사용처 9곳 마이그레이션: `mapDeleteConfirm.ts:30`, `clusterAiModal.ts:543/549`,
  `EditScene.ts:1056`, `mapHistoryPanel.ts:125`, `aiChatPanel.ts:719`, `menu.ts:420/428`,
  `editor.ts:362`. 동기 `confirm` → async 로 전환(호출부 await 화).
- Playwright 헤드리스 대비: `typeof window==="undefined"` 가드는 기존처럼 통과(자동 승인) 유지.

---

## 3. 파일별 변경 지도 (구현자용)

| 영역 | 파일 | 변경 |
|---|---|---|
| 게이트 제외 | `src/ai/buildSpec.ts` | `SPATIAL_BUILD_TOOLS`·`SPEC_BOUNDARY_SLACK_TOOLS` 에서 v3 6종 제거 |
| 파츠 생성 | `src/editor/tools/v3/rmTypeExpander.ts` | `derivePatternGrammar()` 신규 |
| 승인 파츠 | `src/editor/tools/v3/vocabularyTools.ts` | `approveGroupItem` 에서 파츠 자동 생성 + 불변식 |
| 보류시공 | `src/ai/assistantSession.ts` | 미승인 실패 시 pendingBuild 첨부; 게이트 분기에서 v3 제외 확인 |
| 원클릭 | `src/editor/panels/aiChatPanel.ts` | 카드에 [승인하고 시공]; 액션 존 분리; 헤더 배지; 폭 |
| deprecated | `src/editor/tools/toolRegistry.ts` | 잔존 옛 타일 툴 마킹; `toOpenAiTools(mode)` 시그니처 |
| 도메인 태그 | 각 툴 정의 파일 | `domains`/`core` 태그 부여 |
| 모드 판정 | `src/editor/panels/editor.ts` (또는 store) | 활성 탭 → mode 계산·전달 |
| 커스텀 모달 | `src/editor/ui/modal.ts`(신규) + 9 호출부 | showConfirm/showAlert |

---

## 4. 수용 기준 (테스트)

- **T1 (게이트):** 승인 어휘가 있는 맵에서 `build_wall` 이 `set_build_spec` 없이 성공한다.
- **T2 (불변식):** `propose_tile_vocabulary`(nine_slice, 9 tileIds) 수락 후 그룹의
  `patternGrammar.parts` 가 9칸 매핑을 갖는다. 8개 이하면 승인 거부.
- **T3 (융합):** 제안 카드에 pendingBuild(build_wall) 첨부 → 수락 한 번으로 lowerTiles 에
  벽이 실제로 칠해진다(재요청 없이). 교정된 groupId 로 리바인드됨을 확인.
- **T4 (스코핑):** `toOpenAiTools({mode:"tile"})` 가 ~12개만, 옛 타일 툴 0개 노출.
  `mode:"event"` 는 이벤트 툴 포함·타일 프리미티브 제외. deprecated 는 어떤 모드에서도 0.
- **T5 (모달):** `showConfirm` resolve(true/false) 동작; 마이그레이션된 호출부가 await 로 분기.
- **T6 (실측, 간단):** minimax-m3 로 "벽 깔아줘" → propose → 수락(원클릭) → lowerTiles 벽 확인.
  (기존 v3d 드라이버 확장, 스크린샷 1장.)

전체 `npx tsc --noEmit` + `npm test` 그린 유지(현재 2221 passed / 1 skipped 기준 증가).

---

## 5. 구현 순서 (권장)

1. 게이트 제외(2.1.1) + 파츠 생성(2.1.2) + T1·T2 — 승인된 벽이 코드상 전개되게 만든다.
2. deprecated + 모드 스코핑(2.2) + T4 — 툴 홍수 제거.
3. 보류시공 융합(2.1.3) + 액션 존(2.3 ③) + T3 — 원클릭 흐름.
4. 3-존 IA·폭(2.3 ①②) + 커스텀 모달(2.4) + T5.
5. 실측 T6 + 스크린샷 → 빌드·서빙.

각 단계 독립 커밋. 커밋 트레일러: `Implemented-by: Claude Fable 5 subagent` +
`Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
