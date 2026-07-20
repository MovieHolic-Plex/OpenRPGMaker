# 영역 작업 박스 고도화 — A(부분 적용) + E(컨텍스트 제안) + F(폴리싱)

- 작성일: 2026-07-20
- 관련 이전 작업: `2026-07-20-region-task-stamp-design.md`(스탬프 만들기),
  `2026-07-06-region-ai-task-design.md`(영역 작업 모달 본체)

## 목적

영역 작업 박스(`regionTaskModal.ts`)의 결과 검토/상호작용 경험을 고도화:
- **A**: AI 결과를 전체 적용/버리기에서 **레이어 + 구역 덩어리(chunk)** 단위 부분 적용으로.
- **E**: 정적 4개 추천 칩을 **영역 주변 인접 타일 분석** 기반 동적 추천으로.
- **F**: **키보드 단축키**(textarea 비포커스시) + **슬래시 자동완성** + **영역 통계 칩**.

세 방향 모두 핵심 실행 모델(`runRegionTask`, `PendingRegionApply`)은 건드리지 않고
**순수 함수 추가 + 모달 UI 확장**으로 끝난다.

## 배경 — 이미 존재하는 조각

- `PendingRegionApply`(`pendingRegionApply.ts`)가 `baseProject` + `clippedProject`를
  모두 들고 있어 셀 단위 diff가 가능. `onApply`는 `applyProject(clipped, label, mapId)`
  로 `recordProjectSnapshot` + `store.replace`를 부른다(runRegionTask.ts:629).
- `SUGGESTED_REGION_COMMANDS`(`suggestedCommands.ts`)는 12개 정적 코퍼스.
  `nextSuggestedRegionCommands(4)`가 로테이션으로 4개 반환.
- `describeChipsetTile(tileId)`(`chipsetMapping.ts`)가 타일 id → 라벨("집 지붕",
  "잔디" 등) 변환. 커스텀 타일은 "타일 240" 폴백.
- `isMapWaterTile` 헬퍼가 물 판단(wiki에 언급됨).
- 오토타일 그룹 멤버십: `TilesetDef.autotileGroups[].memberTileIds`.
- `replaceTileStack`/`topTileInStack`(`mapOverlayTiles.ts`) — 현재 stub.
- AI 스킬 서치 자동완성 패턴: `aiSkillDrawer.ts` 가 키보드 위/아래/Enter 선택 UI를
  이미 구현 — 슬래시 자동완성은 이 패턴을 단순화해 재사용.

## 결정 사항 (확정)

### A. 부분 적용 — 레이어 + 구역 덩어리
- 영역 내 각 셀의 lower/upper 변화를 계산해 **4-연결성(상하좌우)**으로 묶어 chunk 형성.
- chunk 라벨은 주요 타일의 `describeChipsetTile` 결과 + 셀 수 (예: "집 1동(5칸)",
  "길 3칸"). 커스텀 타일은 "타일 240(5칸)" 폴백.
- UI: before/after 썸네일 아래에서 토글 트리:
  ```
  ☑ 하위 레이어 (8칸)
    ☑ 집 1동 (5칸)
    ☑ 길 3칸
  ☐ 상위 레이어 (4칸)
    ☐ 나무 2그루
  ```
- 적용 버튼 3개: `[선택 N칸 적용]` `[모두 적용]` `[버리기]`.
- 선택 적용 = 선택된 chunk 셀만 base 위에 clipped 값을 덮어쓴 병합 프로젝트 생성 →
  `applyProject(merged)`. undo 1개 유지.

### E. 컨텍스트 인식 제안 — 인접 타일 신호
- 영역 바깥 1타일 두르레이트(최대 `(w+2)*(h+2) - w*h` 셀)를 스캔.
- `categorizeTileForContext(tileId, tileset)` 신규 헬퍼가 타일을 5카테고리로 분류:
  `water | road | forest | building | other`.
  - water: `isMapWaterTile` + 물 오토타일 멤버
  - road: 흙길/포석 오토타일 멤버 (`DEFAULT_ROAD_AUTOTILE_GROUP`, `DEFAULT_COBBLE_AUTOTILE_GROUP`)
  - forest: 나무 canopy/trunk 타일 (260-263, 290-293 등)
  - building: 지붕/벽 타일 휴리스틱
- 카테고리별 가중치로 추천 재구성:
  | 인접 카운트 | 추천 추가 |
  |---|---|
  | water ≥ 3 | 🚢 부두, 🌉 다리 |
  | road ≥ 2 | 🌳 가로수, 🏪 상가 |
  | forest ≥ 3 | ⚔️ 사냥터, 🔥 캠프파이어 |
  | building ≥ 2 | 🧱 울타리, 🌷 정원 |
- 영역 크기 필터: 15×15 이상만 "마을/여관/축제" 거시 제안 유지, 3×3 이하면 제외.
- 항상 4개 반환. 컨텍스트 분석이 빈 결과면 기존 정적 로테이션 폴백.

### F. 시각/접근성 폴리싱
- **키보드 단축키** (textarea 비포커스시에만; 포커스시엔 기존 `Ctrl+Enter` 유지):
  - `Enter` = 실행
  - `S` = 스탬프로 만들기 (인라인 에디터 진입)
  - `R` = 같은 지시로 재실행 (지시어 유지 + 재실행)
  - `/` = textarea 포커스 + `/` 입력 → 자동완성 드롭다운
  - `Esc` = 닫기 (기존, 항상 작동)
  - 구현: `document.addEventListener('keydown')` + `document.activeElement` 체크.
    textarea/input에 포커스면 단일키 무시(입력 간섭 방지).
- **슬래시 자동완성**:
  - 소스: E의 동적 추천 + 전체 코퍼스(12개) + 최근 지시어 5개(localStorage
    `rpgzzu:region-recent-instructions`).
  - 키보드: 위/아래 선택, Enter 확정(지시어 채우기), Esc 닫기, 클릭으로도 선택.
  - 성공적 실행(apply) 후 지시어를 localStorage 최근 목록에 unshift(중복 제거, 5개 cap).
- **영역 통계 칩**: header의 region chip 옆에 항상 보이는 컴팩트 칩.
  - `summarizeRegionTiles(map, region)` → top 3 카테고리 + 개수 (예: "잔디6·물3·빈3").
  - 클릭하면 레이어별 상세 펼침(선택적).

## 아키텍처

### A. 부분 적용 데이터 흐름
```
result.pending (base + clipped)
  ↓ groupRegionChanges(base, clipped, mapId, region)  [순수 함수]
  ↓   for each cell in region:
  ↓     lowerChanged = base.lower[i] !== clipped.lower[i]
  ↓     upperChanged = base.upper[i] !== clipped.upper[i]
  ↓   4-연결성 BFS → chunks
  ↓   각 chunk: 주요 타일 id → describeChipsetTile → 라벨
  ↓ { lower: Chunk[], upper: Chunk[], unchangedCells: number }
  ↓
UI: 토글 트리 (chunk 체크박스)
  ↓ 사용자가 N개 chunk 선택
  ↓
composePartialProject(base, clipped, mapId, region, selectedChunkIds)  [순수 함수]
  ↓   merged = structuredClone(base)
  ↓   for chunk in selectedChunks:
  ↓     for cell in chunk.cells:
  ↓       merged.lower[i] = clipped.lower[i]  (chunk.layer === "lower")
  ↓       merged.upper[i] = clipped.upper[i]  (chunk.layer === "upper")
  ↓   return merged
  ↓
applyProject(merged, label, mapId)  [기존 runRegionTask 의존성 주입]
```

### E. 컨텍스트 제안 데이터 흐름
```
project, mapId, region
  ↓ suggestRegionCommandsByContext(project, mapId, region, count=4)  [순수 함수]
  ↓   map = project.maps[mapId]
  ↓   tileset = project.tilesets[map.tilesetId]
  ↓   주변 1타일 두르레이트 수집:
  ↓     for (x,y) in region 외곽 ±1:
  ↓       if (x,y) not in region and in map bounds:
  ↓         cat = categorizeTileForContext(map.lowerTiles[idx], tileset)
  ↓         counts[cat]++
  ↓   추천 생성:
  ↓     pool = []
  ↓     if counts.water >= 3: pool.push(dock, bridge)
  ↓     if counts.road >= 2: pool.push(trees-along-road, shop)
  ↓     if counts.forest >= 3: pool.push(hunting-ground, campfire)
  ↓     if counts.building >= 2: pool.push(fence, garden)
  ↓   크기 필터:
  ↓     if region.width*height < 9: pool = pool.filter(isMicro)
  ↓     if region.width*height >= 225: pool.push(village, inn, festival)
  ↓   if pool.length < 4: 정적 코퍼스에서 충원
  ↓   return pool.slice(0, 4)
```

### F. 단축키 + 자동완성 + 통계
- 단축키: `document.addEventListener('keydown', handler)`. handler 내부:
  ```ts
  const active = document.activeElement;
  const textFocused = active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement;
  if (textFocused) return; // 단일키 무시 (Ctrl+Enter는 별도 리스너)
  if (event.key === 'Enter') execute();
  else if (event.key === 's' || event.key === 'S') enterStampEditor();
  else if (event.key === 'r' || event.key === 'R') void execute(true); // 같은 지시 재실행
  ```
- `/` 키: textarea에 포커스 + `/` 텍스트 삽입 + 자동완성 드롭다운 오픈.
- 자동완성 드롭다운: `aiSkillDrawer` 패턴 단순화 버전. 소스:
  - 동적 추천(E) 4개 + 코퍼스 12개 + 최근 5개 = 최대 21개, 중복 제거.
- 통계 칩: header에 `▦ (5,7) 3×3 · 잔디6·물3` 형태로 통합.

## 구성요소 (각 1책임)

1. **`groupRegionChanges(base, clipped, mapId, region)`** — 순수. A.
2. **`labelRegionChunk(chunk, tileset)`** — 순수. chunk 주요 타일 → 라벨. A.
3. **`composePartialProject(base, clipped, mapId, region, selectedChunkIds)`** — 순수. A.
4. **`categorizeTileForContext(tileId, tileset)`** — 순수. E.
5. **`suggestRegionCommandsByContext(project, mapId, region, count)`** — 순수. E.
6. **`summarizeRegionTiles(map, region)`** — 순수. F.
7. **최근 지시어 저장/조회**(`loadRecentInstructions` / `pushRecentInstruction`) — F.
8. **`regionTaskModal.ts` 확장** — 부분 적용 UI, 동적 추천 연동, 단축키, 자동완성, 통계 칩.

## 에러 / 경계

- A: 빈 변경(changedCells=0)이면 부분 적용 UI 숨김 + 기존 "변경 없음" 요약 유지.
- A: 모든 chunk 체크 해제 시 `[선택 적용]` 비활성화.
- E: 맵/타일셋 접근 불가 → 정적 코퍼스 폴백.
- E: 인접 카테고리 전부 0 → 정적 폴백.
- F: textarea 포커스 중 단일키 입력 → 무시(사용자가 입력하는 문자 보호).
- F: localStorage 접근 불가(프라이빗 모드 등) → 최근 지시어 기능 조용히 비활성.
- F: 단축키 충돌: 박스가 닫혀있으면 리스너 제거(`activeModalCleanup`).

## 테스트

- `test/regionChangeGroups.test.ts`(신규, 순수):
  - lower/upper 변경 셀 4-연결성 그룹화.
  - chunk 라벨링(주요 타일 describeChipsetTile 결과).
  - 변경 없는 셀은 chunk에서 제외.
  - 빈 변경 → `{ lower: [], upper: [], unchangedCells: N }`.
- `test/partialApplyCompose.test.ts`(신규, 순수):
  - 선택 chunk 셀만 base 위에 clipped 값 적용.
  - 미선택 chunk 셀은 base 값 유지.
  - 영역 밖 셀은 건드리지 않음.
  - 다른 맵은 건드리지 않음.
- `test/regionContextSuggestions.test.ts`(신규, 순수):
  - 물 옆 4타일 → 부두/다리 추천 포함.
  - 길 옆 2타일 → 가로수/상가 추천 포함.
  - 빈 주변 → 정적 코퍼스 폴백.
  - 작은 영역(2×2) → 거시 제안(마을/여관) 제외.
- `test/regionTileStats.test.ts`(신규, 순수):
  - 잔디/물/빈 혼합 → top 3 카테고리 + 개수.
  - 단일 타일 → "잔디 9".
- `test/regionTaskModalEnhancements.test.ts`(신규, fakeDom):
  - 부분 적용: chunk 체크박스 토글 → 선택 적용 시 병합 프로젝트 전달.
  - 단축키: S 입력 → 스탬프 에디터 진입(textarea 비포커스시).
  - 자동완성: `/` 입력 → 드롭다운 표시 → Enter → textarea 채움.
  - 통계 칩: 렌더 확인.
- 게이트: `npm test` · `npm run build` 내 파일 0 에러.

## 비목표(v1)

- **셀 단위 부분 적용**: chunk보다 더 세밀한 개별 셀 선택. chunk가 충분히 실용적.
- **청크 수동 분할/병합**: 자동 4-연결성 결과 그대로 사용.
- **스킬 자동완성**: `/build-house` 등 스킬은 제외(코퍼스 + 동적 + 최근만).
- **컨텍스트 필터링 강도**: 타일셋이 지원하지 않는 추천 자동 제외는 v2.
- **통계 칩 상세 펼침**: 항상 컴팩트 top 3만 표시(클릭 펼침은 v2).

## 파일 임팩트 요약

| 파일 | 변경 |
|---|---|
| `src/editor/regionTask/regionChangeGroups.ts` | **신규(A)** — `groupRegionChanges` + `labelRegionChunk`. |
| `src/editor/regionTask/partialApplyCompose.ts` | **신규(A)** — `composePartialProject`. |
| `src/editor/regionTask/regionContextSuggestions.ts` | **신규(E)** — `categorizeTileForContext` + `suggestRegionCommandsByContext`. |
| `src/editor/regionTask/regionTileStats.ts` | **신규(F)** — `summarizeRegionTiles`. |
| `src/editor/regionTask/recentInstructions.ts` | **신규(F)** — localStorage 최근 지시어. |
| `src/editor/panels/regionTaskModal.ts` | **수정** — 부분 적용 UI, 동적 추천 연동, 단축키, 자동완성, 통계 칩. |
| `src/styles/editor/region-task.css` | **수정** — 청크 트리, 자동완성 드롭다운, 통계 칩 스타일. |
| `test/regionChangeGroups.test.ts` | **신규** |
| `test/partialApplyCompose.test.ts` | **신규** |
| `test/regionContextSuggestions.test.ts` | **신규** |
| `test/regionTileStats.test.ts` | **신규** |
| `test/regionTaskModalEnhancements.test.ts` | **신규** |
| `openwiki/editor-workflows.md` | **수정** — 고도화 내역 bullet 추가. |

**스키마 변경 없음.** A는 `applyProject` 호출부만 변경(병합 프로젝트 전달).
E/F는 순수 추가.

## DB / 영속성 메모

본 작업은 **엔진/에디터 코드 변경**(모달 UI + 순수 변환 함수)이지 맵·이벤트·데모
콘텐츠 저작이 아니다 → AGENTS.md "DB 필수" 규칙의 예외 해당. 다만 데모 검증 시에는
부분 적용/컨텍스트 제안/단축키가 실제로 작동하는지 브라우저로 확인한다.
