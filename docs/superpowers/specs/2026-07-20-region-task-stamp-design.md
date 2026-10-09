# 영역 작업 박스 — '스탬프로 만들기' 추가

- 작성일: 2026-07-20
- 관련 이전 작업: `2026-07-06-region-ai-task-design.md`(영역 AI 작업 모달),
  `structureKitModel.ts`(학습된 구조 킷 → 팔레트 스탬프 경로)

## 목적

우클릭 드래그 / 좌클릭 선택으로 여는 **영역 작업** 박스에 **스탬프로 만들기**
보조 동작을 추가한다. AI 작업은 그대로 주 동작으로 유지하고, 스탬프는 한 번의
클릭 흐름으로 **(1) 타일셋에 영구 저장 + (2) 현재 페인트 브러시로 즉시 활성화**
까지 한 번에 끝낸다.

## 배경 — 이미 존재하는 조각

- `regionTaskModal.ts` 의 `openRegionTaskModal({mapId, region, anchor?})` 가 영역
  작업 박스를 연다. 현재 actions 행은 단일 `[실행]` 버튼(AI 전용).
- 진입 경로 2개: 우클릭 드래그 → 포인터 근처 팝오버(`regionRightDrag.ts`),
  좌클릭 선택 → 캔버스 우하단 "AI" FAB 칩(`selectionActionChips.ts`).
- `StructureKitDef`(`src/project/types/base.ts:256`) 유니언이 이미 양 레이어 표현을
  지원: `SectionStructureKitDef.rows: StructureKitRow[]` 에서
  `StructureKitRow = { tiles: number[]; upperTiles?: number[] }`.
- `StructureKitLearnedFrom = "user-paint" | "builtin-parametric"` 유니언이
  2026-07-20에 추가됨 — 본 작업의 저장 경로는 `"user-paint"` 에 부합.
- `paletteStampFromKit(kit)`(`structureKitModel.ts:116`) 이 킷 → `PaletteStamp`
  변환을 담당(section/house 모두). `TilePaintEngine.applyPaletteStamp` 가 브러시
  적용을 담당 — 신규 페인트 경로 불필요.
- `makeStructureKitShelf` 의 "내 스탬프" 선반(`structureKitShelf.ts`)이
  `tileset.structureKits` 를 읽어 자동 표시·재사용한다.

즉 "제로부터 신규"가 아니라 **모달 actions 행에 보조 버튼을 하나 더 달고, 영역
직사각형 → `SectionStructureKitDef` 변환 순수 함수만 추가**하면 된다.

## 결정 사항 (확정 — 브레인스토밍 Q1~Q4)

- **동작(Q1)**: 저장 + 즉시 브러시 활성화. 한 번의 클릭 흐름이 저장+사용 시작까지
  끝낸다. 저장소는 기존 `tileset.structureKits`("내 스탬프" 선반) 재사용.
- **내용(Q2)**: 타일만. 양 레이어(lower + upper) 통째로. 이벤트는 미포함.
- **레이아웃(Q3)**: 하단 보조 버튼 추가. AI 작업 흐름(textarea+추천+실행+비교)은
  그대로, actions 행을 2버튼으로 확장. 모달 구조 변경 최소.
- **이름 UX(Q4)**: 인라인 전환. `[스탬프로 만들기]` 클릭 → 버튼 자리가 텍스트
  필드로 교체. Enter=저장, Esc=취소.

## 세부 결정 (안전한 기본값으로 에이전트 결정)

- **스택 다중 오버레이**: v1 미지원. 한 셀에 상위 타일이 여러 개 쌓인 경우
  무시하고 `map.upperTiles[idx]` 단일 값만 저장. 현재 `topTileInStack`/
  `tileStackAt`(`mapOverlayTiles.ts`)이 stub(항상 undefined/empty 반환)이라
  스택 저장소는 사실상 미사용 상태 — 단일 값이 정본이다. 한계는 비목표에 명시.
- **기본 이름**: 자동 증가 `스탬프 {w}×{h} #{N}`. 영역 중심 타일 라벨 같은 복잡한
  추론은 배제(결정성 + 단순함). N은 해당 타일셋의 기존 `structureKits` 중
  `learnedFrom === "user-paint"` 인 것의 개수+1. 사용자는 "내 스탬프" 선반에서
  나중에 이름 변경 가능.
- **영역 크기 상한**: 32×32. 초과 시 토스트 경고 후 진행(차단 아님). 너무 큰
  스탬프는 브러시로 찍기 어렵지만, 사용자 선택을 존중.
- **빈 영역**: 영역 내 모든 셀이 lower=0 이고 upper 도 0/undefined 인 경우
  (빈 맵 영역) 저장 비활성화 + 안내.

## 아키텍처

```
region {x,y,w,h} + map.tilesetId
  ↓ extractSectionKitFromRegion(project, mapId, region, {id, name})
  ↓   for r in 0..h-1:
  ↓     row.tiles[c]    = map.lowerTiles[(y+r)*map.width + (x+c)]   // 행 stride 는 map.width
  ↓     row.upperTiles[c] = map.upperTiles[(y+r)*map.width + (x+c)] ?? 0  (0 → -1 = 비움)
  ↓   → SectionStructureKitDef { kind:"section", rows, learnedFrom:"user-paint", ... }
  ↓
  ↓ store.update(proj => {
  ↓   tileset = proj.tilesets[map.tilesetId]
  ↓   tileset.structureKits = [...(tileset.structureKits ?? []), kit]
  ↓ })  // scope:"database" — 맵 캔버스 재그리지 않음
  ↓
  ↓ editorState.set({
  ↓   activePaletteStamp: paletteStampFromKit(kit),
  ↓   activeStampId: null,
  ↓   activeStructureStampId: null,
  ↓   tool: "paint",
  ↓ })
  ↓
  ↓ closeRegionTaskModal()
  ↓ toast(`'${name}' 스탬프 저장 — 이제 맵에 찍어보세요`)
```

### 구성요소(각 1책임)

1. **`extractSectionKitFromRegion(project, mapId, region, {id?, name?})`** — 순수 함수.
   대상 맵·타일셋을 찾아 `SectionStructureKitDef` 를 만든다. store 의존 없음(유닛
   테스트 대상). 영역이 맵 밖이거나 맵/타일셋이 없으면 `null`.
2. **`defaultStampName(tileset, region)`** — 순수 함수. `스탬프 {w}×{h} #{N}` 생성.
   N = `learnedFrom==="user-paint"` 킷 수+1.
3. **`saveRegionAsStamp({mapId, region, name})`** — 위 두 함수 + store.update +
   editorState.set + toast 를 묶은 오케스트레이션. 모달 버튼 핸들러가 호출.
   성공 시 저장된 `kit` 반환, 실패 시 토스트 후 `null`.
4. **`regionTaskModal.ts` actions 행 확장** — `[실행]` + `[스탬프로 만들기]`.
   스탬프 버튼 클릭 → 인라인 입력필드(상태 머신) → Enter 시 `saveRegionAsStamp`.
   - `running === true`(AI 실행 중) → 스탬프 버튼 비활성화.
   - `activePending`(AI 제안 대기 중) → 스탬프 버튼 비활성화.

### 인라인 입력필드 상태 머신

```
idle:    [스탬프로 만들기] 버튼 표시
         ↓ click (running==false 일 때만)
editing: 버튼 자리 → <input> + [✓] + [✕]
         기본값: defaultStampName(tileset, region)
         ↓ Enter / [✓]   → saveRegionAsStamp → (성공시) closeRegionTaskModal
         ↓ Esc  / [✕]   → idle 로 복귀(변경 없음)
         ↓ focusout(다른 곳 클릭) → idle 로 복귀(취소). 단 [✓]/[✕] 버튼 클릭은
                          mousedown preventDefault 로 blur 방지 — click 이 정상 발화.
```

## 에러 / 경계

- 맵·타일셋 없음 / 영역이 맵 밖 → 스탬프 버튼 비활성화 + title 툴팁으로 이유.
- 빈 영역(모두 lower=0) → 저장 시도 시 토스트 "영역이 비어 있습니다" + 취소.
- 영역 32×32 초과 → 토스트 경고 후 진행(차단 아님).
- AI 실행 중 / pending 대기 중 → 스탬프 버튼 비활성화(AI 흐름 보호).
- 동일 서명 중복: v1은 자동 중복 제거하지 않음(사용자가 명시적으로 만드는
  스탬프이므로). 향후 `structureKitSignature` 로 중복 경고 추가 여지.

## 테스트

- `test/regionStampCreate.test.ts`(신규, 순수 함수):
  - `extractSectionKitFromRegion`: 3×3 잔디+울타리 영역 → rows 양 레이어 정확성.
  - upper 가 0/undefined 인 셀 → `upperTiles[c] = -1`.
  - 영역 밖 좌표 / 맵 없음 / 타일셋 없음 → `null`.
  - `defaultStampName`: 빈 structureKits → `스탬프 3×3 #1`; 기존 2개 → `#3`.
  - 큰 영역(33×33) → 여전히 변환은 성공(경고는 UI 레이어 책임).
- `test/regionTaskModalStamp.test.ts`(신규, fakeDom):
  - `[스탬프로 만들기]` 클릭 → 입력필드 전환 + 기본값 채워짐.
  - Enter → `store.update` 호출(structureKits 추가) + `editorState.activePaletteStamp`
    설정 + 박스 닫힘 + toast.
  - Esc → idle 복귀 + store 변경 없음.
  - `running=true` 주입 → 버튼 `disabled`.
  - 빈 영역 → 저장 시도 차단 + toast.
- 게이트: `npm test`(기준선 유지+추가) · `npm run build` 0.

## 비목표(v1)

- **스택 다중 오버레이**: 한 셀에 상위 타일 2개 이상은 최상단 1개만 저장.
  현재 스택 저장소 자체가 stub이라 실질적 한계 아님.
- **이벤트 포함**: 영역 안 이벤트는 스탬프에서 제외. 향후 "타일+이벤트 프리팹"
  확장 여지(신규 컬렉션 또는 StructureKitDef 확장 필요).
- **다른 타일셋으로 저장**: 항상 현재 맵의 `tilesetId` 에 종속. 타일 인덱스 의미가
  타일셋마다 다르기 때문.
- **중복 서명 자동 제거**: 사용자 명시적 생성이므로 v1에서는 허용.
- **슬라이스/회전/플립**: 저장된 그대로만 찍힘(기존 PaletteStamp 한계와 동일).

## 파일 임팩트 요약

| 파일 | 변경 |
|---|---|
| `src/editor/regionStampCreate.ts` | **신규** — `extractSectionKitFromRegion` + `defaultStampName` + `saveRegionAsStamp`. |
| `src/editor/panels/regionTaskModal.ts` | **수정** — actions 행 2버튼화 + 인라인 입력필드 상태 머신. 공개 시그니처 변경 없음. |
| `test/regionStampCreate.test.ts` | **신규** — 순수 함수 유닛 테스트. |
| `test/regionTaskModalStamp.test.ts` | **신규** — 모달 통합(fakeDom). |
| `openwiki/editor-workflows.md` | **수정** — 우클릭 드래그 / 영역 작업 섹션에 스탬프 경로 추가. |

## DB / 영속성 메모

본 작업은 **엔진/에디터 코드 변경**(모달 UI + 순수 변환 함수)이지 맵·이벤트·데모
콘텐츠 저작이 아니다 → AGENTS.md "DB 필수" 규칙의 예외 해당. 다만 데모 검증 시에는
스탬프 저장 → 프로젝트 저장 → 재로드 1회로 "내 스탬프" 선반에 남아있는지 확인한다.
