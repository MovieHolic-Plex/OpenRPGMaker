# 데이터베이스 '구조물' 편집기 · export/import 설계

- 날짜: 2026-08-28
- 브랜치: `worktree-db-structures-editor`
- 상태: 승인됨 (섹션 ①~⑤ 대화 승인 완료)

## 목적

데이터베이스 '구조물' 탭을 **읽기 전용 진열대에서 편집 가능한 어휘집으로** 바꾼다.
구조물은 사람이 모양을 만들어 이름 붙이면 AI 가 그 이름으로 골라 맵에 시공하는 어휘다.

```
사람: 모양을 만들고 이름 붙이고 부위를 찍고 배치 규칙을 쓴다   → 어휘 등록
 AI : 이름으로 고르고 위치만 정해 찍는다                        → 어휘 사용
파일: 그 어휘집을 프로젝트 밖으로 주고받는다                      → 어휘 공유
```

---

## 1. 현재 상태와 결함

### 1.1 구성

| 파일 | 역할 | 줄 수 |
|---|---|---|
| `src/editor/panels/structureKitDbTab.ts` | 탭 렌더 전부 (레일·표·인스펙터·비즈니스 로직) | 865 |
| `src/editor/panels/structureKitDbSources.ts` | 원본(source) 모델 — DOM 없음 | 157 |
| `src/editor/harnessSuggestion/structureKitActions.ts` | store 접점 (등록·이름변경·삭제) | 57 |
| `src/editor/harnessSuggestion/structureKitModel.ts` | 순수 변환 (패턴↔킷↔스탬프) | 229 |
| `src/editor/harnessSuggestion/kitRender.ts` | 2D 캔버스 타일 렌더 | — |
| `src/editor/harnessSuggestion/builtinHouseStructureKits.ts` | 내장 집 9종 (가상 킷) | 26 |
| `src/editor/interiorObjectCatalog.ts` | 실내 오브젝트 카탈로그 (코드 상수) | — |

### 1.2 원본 3갈래의 편집 가능성

| 원본 | 실제 타입 | 데이터 위치 | 지금 가능한 것 |
|---|---|---|---|
| 내장 건물 | `HouseStructureKitDef` | 코드 상수 (가상) | 없음 |
| 실내 오브젝트 | `InteriorObjectDef` | 코드 상수 | 없음 (인스펙터에 액션 0개) |
| 내가 저장한 구조물 | `SectionStructureKitDef` | `tileset.structureKits[]` | 이름 변경, 삭제, 부위 삭제, 입구 자동추정 |

### 1.3 확인된 결함

1. **거짓 카피** — `structureKitDbTab.ts:751` 이 *"이 래스터를 드래그하면 부위가 붙습니다"* 라고 안내하지만
   이 파일에 pointer/mouse 핸들러가 **하나도 없다**. 출하된 거짓말.
2. **가짜 저장 버튼** — `structureKitDbTab.ts:786` 의 `[지금 저장]` 은 `toast()` 만 부르고 아무것도 저장하지 않는다.
3. **생성 경로 부재** — 구조물을 만드는 길이 "맵에서 영역 선택 → 구조물로 저장" 하나뿐. DB 안에서 신규·복제 불가.
4. **틀린 잠금 축** — `structureKitDbTab.ts:588` 이 `learnedFrom === "builtin-parametric"` 으로 편집을 잠근다.
   잠금의 진짜 이유는 "어떻게 만들어졌나" 가 아니라 "프로젝트 데이터에 있나" 다.
   이대로면 내장 집을 내보낸 파일을 가져왔을 때 **프로젝트 데이터인데 이름 변경도 삭제도 안 되는 유령 킷**이 생긴다.
5. **AI 메타데이터 부재** — `TileGroupMetadata` 에는 `description`·`placementRules`·`role`·`origin` 이 있고
   `upsert_tile_group` 이라는 AI 도구까지 있는데, `StructureKitDef` 에는 하나도 없다.
   AI 는 이름만 보고 "있는 그대로 깔" 수밖에 없다.
6. **무조건 3회 반복** — `structureKitTools.ts:236` 에서 `repeat` 기본값이 3 이고,
   `structureKitModel.ts:158` 의 `structureKitRepeatable()` 은 `kind === "section"` 이면 무조건 true 를 준다.
   내가 저장한 구조물은 전부 `section` 이므로 **우물·간판·동상도 가로로 3개 이어 찍힌다.**
7. **export/import 전무** — 구조물 단위 파일 입출력이 없다. `menu.ts` 의 프로젝트 전체 내보내기만 존재.

### 1.4 AI 접점의 현재 모습

| 도구 | AI 가 넘기는 것 | AI 가 받는 것 |
|---|---|---|
| `stamp_structure_kit` | `mapId`, `kitId`\|`kitName`, `origin`, `repeat` | 부위의 절대좌표 |
| `list_structure_kits` | `mapId` (선택) | section → **`rows` 타일 행렬 전체** / house → `{houseKitId, wings}` **만** |

`contextBuilder.ts` 가 넘기는 한 줄:

```
타일 그룹 :  - [그룹 통나무벽/wall] 타일 306,307,308 — 규칙: 2단 벽 타일 위에 가로로 반복 배치
구조물    :  - 우물 (kit_a3f2, 3x3 단면, user-paint)
```

---

## 2. 확정된 결정

| # | 결정 | 대안 |
|---|---|---|
| 1 | 편집 깊이 = **래스터까지** (타일 페인트 · 크기 조절 · 부위 자유 편집 · 신규 · 복제) | 부위만 / 카탈로그 포크까지 |
| 2 | 다른 칩셋 파일 가져오기 = **경고 후 허용** (대조 미리보기 + 확인) | 엄격 차단 / 의미 기반 재매핑 |
| 3 | 파일 단위 = **한 포맷, 항상 배열** (낱개=원소 1개) | 낱개만 / 앨범 통째만 |
| 4 | 복제 범위 = **모든 행에서 복제 가능** (내장·실내 포함). 내보내기는 내 구조물만 | 내 구조물만 / 내장만 |
| 5 | AI 메타 작성 = **AI 초안 + 사람 승인** | 사람만 / 스키마만 먼저 |
| 6 | 편집기 위치 = **전용 다이얼로그** (DB 모달 위 중첩) | 인스펙터 제자리 확장 / 4열 모드리스 |

### 결정 6 의 근거 (치수)

`harness-suggestion.css:297` 에서 인스펙터는 `width: 352px` 고정, 패딩 제외 324px.
내장 집 9×8 을 현재 인스펙터의 `scale: 3` 으로 그리면 **432px** — 들어가지 않는다.
scale 2 로 낮춰도 288px 라 타일 팔레트를 둘 자리가 없다.
DB 모달 안 다이얼로그는 이미 관례다 (`openGraphicDialog`, `openDatabaseResourcePickerDialog`).

---

## 3. 데이터 모델

### 3.1 복제 = 굽기(bake)

무엇을 복제하든 결과는 언제나 `SectionStructureKitDef` 다.

| 원본 | 굽는 방법 |
|---|---|
| `HouseStructureKitDef` | `expandHouseStructureKit()` → 셀 목록 → `rows[]` |
| `InteriorObjectDef` | `object.cells` → `rows[]` |
| `SectionStructureKitDef` | 그대로 복사 |

**이것은 손실이 아니다.** 파라메트릭 조절은 원래 구조물 탭의 일이 아니라 `build_house_kit`
(`houseKitTools.ts`) 의 일이고 그 도구는 그대로 남는다. 그 도구의 파라미터 표면
(`kitId`·`wings`·`door`·`doorEvent`·`interior`·`ownerName`·`windows`·`fence`·`banner`·`chimney`)
은 오히려 `HouseStructureKitDef` 타입이 담는 것보다 넓다.

앨범의 "내장 건물" 9종은 파라메트릭 편집기가 아니라 **진열대**다 —
`builtinHouseStructureKits.ts:11` 이 `DEFAULT_WINGS = [{x:0,y:0,w:9,h:8}]` 을 하드코딩해
9가지 재질을 기본 크기로 보여줄 뿐이며, 지금도 층수·굴뚝을 조절하는 UI 는 없다.

굽기는 오히려 AI 가독성을 **높인다**: `list_structure_kits` 는 section 킷에 `rows` 를 통째로 주고
house 킷에는 `{houseKitId, wings}` 만 주므로, house 킷은 AI 가 모양을 볼 수 없다.

실내 오브젝트를 복제하면 `role`·`snap`·`themes` 는 **버린다.** 이 메타는 실내 방 생성
파이프라인의 문법이고 사본은 그 문법에 등록되지 않는다. 복제 시 안내한다:
*"사본은 그림만 가져옵니다 — AI 실내 방 채우기는 원본 카탈로그만 씁니다."*

### 3.2 편집 잠금 판정 교체

```
지금:  isBuiltin  = kit.learnedFrom === "builtin-parametric"
바꿈:  isEditable = (앨범 엔트리의 source === "user")
```

`albumEntries()` 가 이미 각 행에 `source` 를 붙여준다 (`structureKitDbSources.ts:46`).
새 계산이 아니라 이미 있는 사실을 쓰는 것이다. `learnedFrom` 은 잠금에서 손을 떼고
계보 표시 전용으로 강등된다. 결함 1.3-④ 가 이 교체로 해소된다.

### 3.3 `learnedFrom` 에 값 추가

```ts
export type StructureKitLearnedFrom = "user-paint" | "builtin-parametric" | "db-authored";
```

| 값 | 표시 | 언제 |
|---|---|---|
| `user-paint` | 붓질에서 학습 | 맵 영역 선택 → 구조물로 저장 (기존) |
| `builtin-parametric` | 내장 파라메트릭 | 가상 킷만 (기존) |
| `db-authored` | 데이터베이스에서 작성 | 신규 · 복제 · 가져오기 (추가) |

필수 필드에 값만 늘리는 것이라 기존 프로젝트 파일은 그대로 유효하다.
`list_structure_kits` 와 `contextBuilder.ts:322` 가 이 값을 AI 에게 그대로 넘기고 있어
"붓질에서 학습" 이라는 거짓 계보를 흘리지 않게 된다.

### 3.4 AI 메타데이터 부착

`TileGroupMetadata` / `TileAiMetadata` 의 필드명을 **그대로** 쓴다. AI 가 이미 그 단어들을 읽고 있다.

```ts
export interface StructureKitAiMeta {
  /** 이게 무엇인지. TileGroupMetadata.description 과 같은 이름. */
  description: string;
  /** 어디에 어떻게 놓는지. TileGroupMetadata.placementRules 와 같은 이름. */
  placementRules: string;
  /** 검색·매칭용. TileAiMetadata.tags 와 같은 이름. */
  tags?: string[];
  /** 분류. TileGroupRole enum 재사용 (building|castle|fence|roof|terrain|water|wall|prop). */
  role?: TileGroupRole;
  /**
   * 가로로 이어 찍어도 되는지.
   * TileAiMetadata 는 "auto"|"center"|"fixed"|"repeat" 4값이지만 "center" 는 구조물에 뜻이 없어 2값으로 줄인다.
   * undefined 는 현재 동작(kind === "section" → 반복)을 유지 — 하위 호환.
   */
  repeatability?: "repeat" | "fixed";
  /** 제로 부트스트랩 규약. 자동 경로는 절대 "user" 로 만들지 않는다. */
  origin?: "user" | "ai";
  confidence?: "high" | "medium" | "low";
}
```

`StructureKitDef` 에 `ai?: StructureKitAiMeta` 로 optional 부착.

**`origin` 은 함부로 `"user"` 로 만들지 않는다.** `types/base.ts:126` 에 못이 박혀 있다:

> v3 승인 보캐뷸러리(원칙 0 Zero-Trust Perception): 사용자 명시 수락으로 커밋될 때만 `"user"` 가 된다.
> **어떤 자동 경로도** 이 값을 `"user"` 로 만들지 않는다(제로 부트스트랩).

| 경로 | `origin` |
|---|---|
| 편집기에서 사람이 직접 입력하거나 AI 초안을 수락 | `"user"` |
| AI 가 채움 (수락 전) | `"ai"` |
| 파일에서 가져오기 | **파일에 적힌 값을 그대로 보존.** 가져오기 확인창의 체크는 "이 파일을 받겠다" 이지 "이 설명을 내가 보증한다" 가 아니다 |

### 3.5 AI 가 받는 것의 변화

```
전 :  - 우물 (kit_a3f2, 3x3 단면, user-paint)

후 :  - 우물 (kit_a3f2, 3x3, prop, 한 채 완결)
        설명: 돌담을 두른 두레우물. 지붕과 도르래가 있다.
        배치: 마을 광장 중앙이나 집 3채 이상 모인 곳. 물가·숲에는 놓지 말 것. 사방 1칸 여백 필요.
```

그리고 `stamp_structure_kit` 이 `repeatability: "fixed"` 를 보면 `repeat` 를 무시하고 1회만 찍는다.
지금 집 킷에만 적용된 규칙(`structureKitTools.ts:114`)을 데이터로 일반화하는 것이며, 결함 1.3-⑥ 을 해소한다.

### 3.6 크기 조절 규약

| 상황 | 규약 |
|---|---|
| 늘림 | 새 칸은 `TILE.EMPTY`(-1). 부위 불변 |
| 줄임 — 부위가 새 경계 안 | 그대로 |
| 줄임 — 부위가 경계에 걸침 | 클램프 |
| 줄임 — 부위가 완전히 밖 | 삭제 |

`resizeKit()` 은 `{ kit, clamped: number, dropped: number }` 를 반환하고 호출부가 토스트로 보고한다:
*"부위 1개 잘림, 1개 삭제"*. 조용히 사라지게 두지 않는다.

### 3.7 신규 생성

`[+ 새 구조물]` 을 누르면 시작점을 고르는 작은 선택이 뜨고, 고른 즉시 편집기가 열린다.

1. **빈 킷** — 지금 앨범 타일셋에 `3×3`, 이름 `"새 구조물"`, `learnedFrom: "db-authored"`
2. **집 킷으로 시작** — `stampFootprintHouseKit()` 을 스크래치 맵에 한 번 실행해
   (`expandHouseStructureKit()` 이 이미 쓰는 경로) 그 결과를 굽고 편집 시작점으로 삼는다.
   재질 9종 중 하나와 폭·높이를 고르게 한다.
   이 갈래는 `DEFAULT_TILESET_ID` 앨범에서만 노출한다 — 집 킷은 `combined_town` 문법이다.

복제본 이름은 `"통나무집 사본"`, 이미 있으면 `"통나무집 사본 2"`.

---

## 4. 파일 포맷

### 4.1 규칙: 파일에 들어가는 순간 사진이 된다

파일 포맷은 `section` 킷만 담는다. 집 킷을 내보내면 그 자리에서 전개해 `rows` 로 담는다 (§3.1 과 같은 규칙).

- 포맷이 한 종류라 파서·검증이 하나
- 받는 쪽에서 항상 편집 가능하고 AI 가 항상 모양을 읽을 수 있음
- 받는 프로젝트에 그 `houseKitId` 가 있는지 걱정할 필요 없음

### 4.2 스키마

```jsonc
{
  "format": "rpgzzu-structure-kits",   // 프로젝트 파일과 구분하는 판별자
  "version": 1,
  "exportedAt": "2026-08-28T09:12:00.000Z",
  "tileset": {
    "id": "easyrpg_chipset_combined_town",   // 칩셋 경계 판정의 근거
    "name": "합본 마을 · EasyRPG (CC0)"       // 경고 문구에 쓸 사람용 이름
  },
  "kits": [
    {
      "id": "kit_a3f2", "kind": "section", "name": "우물",
      "width": 3, "height": 3,
      "rows": [ { "tiles": [ ... ], "upperTiles": [ ... ] } ],
      "parts": [ { "id": "pt_1", "kind": "entrance", "dx": 1, "dy": 1, "w": 1, "h": 3 } ],
      "learnedFrom": "db-authored",
      "createdAt": "2026-08-28T09:00:00.000Z",
      "ai": {
        "description": "돌담을 두른 두레우물. 지붕과 도르래가 있다.",
        "placementRules": "마을 광장 중앙이나 집 3채 이상 모인 곳. 물가·숲 금지. 사방 1칸 여백.",
        "tags": ["우물", "물", "마을"],
        "role": "prop",
        "repeatability": "fixed",
        "origin": "user",
        "confidence": "high"
      }
    }
  ]
}
```

파일명 — 낱개 `우물.rpgzzu-kit.json` / 묶음 `합본마을-구조물-12개.rpgzzu-kit.json`.
이중 확장자라 브라우저는 JSON 으로 열고 사람은 종류를 안다.

내장 칩셋 9종은 `easyrpg_chipset_*` 로 id 가 고정이므로, 같은 칩셋이면 프로젝트가 달라도
타일 번호의 뜻이 같다. 칩셋 경계 판정이 신뢰할 수 있는 근거를 갖는 이유다.

### 4.3 내보내기

**대상은 `내가 저장한 구조물` 뿐이다.** 내장 건물·실내 오브젝트는 모든 프로젝트에 코드 상수로
이미 있으므로 주고받을 이유가 없다. 읽기 전용 행을 고르면 내보내기 버튼 자리에
`[내 구조물로 복제]` 가 있어 자연스럽게 유도된다.

다운로드 구현은 `menu.ts:763` 의 패턴을 그대로 쓴다. 그 코드에 과거 결함 3가지가 주석으로 박혀 있다:

1. `store.flush()` reject → 함수 전체 중단 (다운로드 없음)
2. anchor 를 DOM 에 안 붙이고 `click()` → 일부 환경에서 시작 안 됨
3. `click()` 직후 동기 `revokeObjectURL` → fetch 전에 URL 무효화

이미 값을 치른 버그다. `menu.ts` 안에 두 번 중복돼 있고 이번이 세 번째 사용처이므로
`src/util/downloadBlob.ts` 로 뽑아 셋이 공유한다.

### 4.4 가져오기 — 3단 게이트

| 단계 | 검사 | 실패하면 |
|---|---|---|
| ① 파일 | JSON 파싱, `format` 판별자, `version` 범위, `kits` 가 배열 | `StructureKitFileError` → 토스트. 창 안 뜸 |
| ② 킷 하나하나 | `kind==="section"`, `width`/`height` 양수, `rows.length===height`, `rows[i].tiles.length===width`, 타일 번호 정수 | **그 킷만** 회색 처리 + 이유 표기. 나머지는 가져올 수 있음 |
| ③ 칩셋 경계 | 파일 `tileset.id` vs 지금 앨범 | 대조 미리보기 + `[취소] [그 앨범으로] [그래도]` |

파일 하나에 킷 12개 중 1개가 깨졌다고 12개가 다 죽지 않도록 ②를 킷 단위로 격리한다.
검증은 `project/io/guards.ts` 의 `requireRecord` 계열을 그대로 쓰고,
오류 타입은 `project/io/errors.ts` 의 `ProjectFormatError` 와 같은 모양으로 만든다.

`version` 이 지원 범위보다 **높으면** 거부하고 *"이 파일은 더 새 버전의 편집기에서 만들어졌습니다"* 로
안내한다. 조용히 필드를 버리지 않는다.

### 4.5 충돌 정책

| 충돌 | 처리 |
|---|---|
| **같은 모양** (`structureKitSignature` 일치) | 목록에 `이미 있음` 배지 + 기본 체크 해제. 굳이 체크하면 사본 생성. `registerStructureKit` 이 이미 쓰는 서명 규약 재사용 |
| **같은 id, 다른 모양** | `kit_${randomUuid()}` 로 새 id 발급 (`registerStructureKit` 과 같은 규약). id 는 AI 가 조회로 얻는 값이라 사람이 외울 필요 없음 |
| **같은 이름, 다른 모양** | `우물 (2)` 로 자동 개명 + `이름 중복` 배지. AI 가 `kitName` **부분 일치**로 찾으므로 같은 이름 둘은 조회를 불안정하게 만든다 |

---

## 5. 화면

### 5.1 표 — 체크박스 한 열 추가

```
 ☐  이름                        크기    부위·테마
────────────────────────────────────────────────
    🏠 통나무집                  9×8     부위 없음      ← 내장, 체크칸 빔
    🛏 침대                      2×3     침실 · 여관     ← 실내, 체크칸 빔
 ☑  ⛲ 우물                      3×3     자리           ← 내 것
 ☑  🪵 울타리                    5×1     부위 없음
 ☐  🌉 다리                      7×2     입구 ×2
────────────────────────────────────────────────
 2개 선택됨                          [ 선택 내보내기 ]
```

체크박스는 `내가 저장한 구조물` 행에만 나타난다 — 내보낼 수 있는 게 그것뿐이고,
동시에 "이게 내 것" 이라는 시각 신호가 된다.
푸터는 선택이 없으면 지금처럼 `12개`, 선택이 생기면 `2개 선택됨 [선택 내보내기]`.

행 클릭 = 인스펙터 표시, 행 더블클릭 = 편집기 열기 (내 구조물만).

### 5.2 도구줄 — 힌트칩을 버튼으로 교체

```
지금:  [🔍 이름, 부위 검색      ]  [맵에서 영역 선택 → 구조물로 저장]
바꿈:  [🔍 이름, 부위 검색  ]  [+ 새 구조물] [가져오기] [앨범 내보내기]
```

힌트칩의 문구는 빈 상태 안내(`structureKitDbTab.ts:213`)에 이미 똑같이 있어 중복이다.
`[앨범 내보내기]` 는 체크된 행이 있으면 `[선택 내보내기]` 로 라벨만 바뀐다 — 드롭다운을 만들지 않는다.

### 5.3 인스펙터 — 요약과 액션으로 물러남

**삭제:**

| 지금 | 왜 |
|---|---|
| `"이 래스터를 드래그하면 부위가 붙습니다"` (`:751`) | 거짓말. 이 파일에 pointer 핸들러가 0개 |
| `[지금 저장]` (`:786`) | `toast()` 만 부르고 저장하지 않음. DB 모달은 이미 `store.update()` 즉시 반영이라 *"안 누르면 안 저장되나?"* 하는 없는 불안만 만든다 |
| 부위 목록의 `[부위 삭제]` | 편집기로 통일. "삭제는 인스펙터, 추가는 편집기" 는 이상하다 |

**유지·이동:**

- 이름 인라인 편집 — 유지 (자주 쓰고 이미 작동)
- 부위 목록 — 읽기 전용. 편집은 `[편집]` 한 클릭
- `[문에서 입구 추정]` — 편집기의 부위 패널로 이동
- AI 메타 요약 추가 — 설명 첫 줄 · 분류 · 반복 여부 · `미승인` 배지

**액션 줄:**

```
내 구조물   :  [편집]★  [복제]  [내보내기]  [팔레트에서 쓰기]  [삭제]
내장 건물   :  [내 구조물로 복제]★  [팔레트에서 쓰기]
실내 오브젝트:  [내 구조물로 복제]★  [팔레트에서 쓰기]
```

실내 오브젝트에는 지금 액션이 하나도 없다. `object.cells` → `PaletteStamp` 변환은 이미 있는
모양이라 `[팔레트에서 쓰기]` 를 붙이는 건 거의 공짜다.

### 5.4 편집기 다이얼로그

```
┌─ 우물 편집 ─────────────────────────────────────── [×] ─┐
│                                                          │
│  ┌──────────────────────┐  ┌ [모양] │ AI 메타 ────────┐ │
│  │                      │  │ 도구 [칠][지우][부위▭]   │ │
│  │    래스터 캔버스       │  │ 레이어 [하층]▪[상층]     │ │
│  │    (배율 자동)         │  │                        │ │
│  │                      │  │ ┌─ 타일 팔레트 ──────┐ │ │
│  │                      │  │ │ ▦▦▦▦▦▦▦▦        │ │ │
│  └──────────────────────┘  │ │ ▦▦▦▦▦▦▦▦        │ │ │
│   폭 [3 ▾]  높이 [3 ▾]      │ └──────────────────┘ │ │
│                             │                        │ │
│                             │ 부위 (2)  [문에서 추정] │ │
│                             │  ① 입구 (1,1) 1×3  ✎ ✕│ │
│                             │  ② 창문 (0,0) 1×1  ✎ ✕│ │
│                             └────────────────────────┘ │
│                                            [ 닫기 ]     │
└──────────────────────────────────────────────────────────┘
```

**저장 버튼이 없다.** 모든 편집은 `store.update()` 로 즉시 반영되고, DB 모달을 취소하면
`createDatabaseModalDirtySession` 이 통째로 롤백한다 (열릴 때 스냅샷 + 히스토리 마커).
이 모달의 기존 규약이며, 방금 제거한 가짜 `[지금 저장]` 과 같은 오해를 새로 만들지 않기 위함이다.

**타일 팔레트는 `renderTilePalette()` 를 재사용하지 않는다.** 그 함수는 `editorState` 의 전역 브러시를
바꿔서, 구조물 편집 중 타일을 고르면 맵 붓이 같이 바뀐다. 대신 순수 헬퍼
`tilesetTileBackgroundStyle(tileset, tile, size)` (`tilesetImage.ts:74`) 로 격자를 직접 그린다 —
팔레트가 이미 쓰는 것과 같은 시트·좌표 규약이다.

**부위 그리기** 는 도구 모드다. 캔버스에서 드래그하면 사각형이 생기고 종류(입구·창문·간판·자리)를
고르는 팝오버가 뜬다. 인스펙터가 지금 거짓으로 약속하는 그 동작을, 약속한 자리가 아니라
실제로 되는 자리에 만든다.

**배율** 은 캔버스 영역의 사용 가능 폭에서 유도한다:
`scale = clamp(floor(사용가능폭 / (width × TILE_SIZE)), 1, 4)`.
`TILE_SIZE` 는 `assets/bundled.ts` 의 16. 9×8 킷은 다이얼로그 폭에서 scale 3(432×384px)이 나온다.

**AI 메타 탭** 은 `[✨ AI 초안 받기]` 버튼과 §3.4 의 필드 폼, 그리고 `[초안 수락 — 내가 보증]` 버튼을 갖는다.
수락 전에는 `미승인` 배지가 붙고 `origin: "ai"` 로 남는다.
`tilesetAiMappingRules` 가 이미 쓰는 제안→승인 패턴을 따른다.

초안 요청은 기존 `ai/llmClient.ts` 경로를 쓰고, 프롬프트에 넣는 것은 이것뿐이다:

- 킷 크기와 `rows` 타일 행렬
- 각 타일의 `describeChipsetTile(tile)` 라벨 (`label` · `aiLabel` · `tags`) — 모델이 타일 번호를 추측하지 않게 한다
- 타일셋 이름과 기존 킷 이름 목록 (이름 중복 회피용)

응답은 §3.4 의 필드 모양으로 강제하고, 파싱에 실패하면 폼을 비운 채 토스트로 알린다.
초안은 **절대 자동 저장하지 않는다** — 폼에 채워질 뿐이고, 수락을 눌러야 `store.update()` 가 일어난다.

### 5.5 진입점 전체

| 어디 | 무엇 |
|---|---|
| 도구줄 | `+ 새 구조물` · `가져오기` · `선택/앨범 내보내기` |
| 표 체크박스 | 내보내기 대상 (내 구조물만) |
| 표 행 클릭 / 더블클릭 | 인스펙터 / 편집기 |
| 인스펙터 액션 | 편집 · 복제 · 내보내기 · 팔레트 · 삭제 |
| 맵 영역 선택 → `구조물로 저장` | 기존 경로 그대로 유지 |

---

## 6. 파일 분해

`structureKitDbTab.ts` 는 이미 865줄이고 렌더와 비즈니스 로직(`autoEstimateEntranceParts`,
`saveKitParts`)이 섞여 있다. 여기에 기능 5개를 더 얹으면 1,500줄이 된다.

| 파일 | 상태 | 역할 |
|---|---|---|
| `panels/structureKitDbTab.ts` | 축소 | 조립만 — 레일·표·인스펙터 배치 |
| `panels/structureKitInspector.ts` | 신규 | 읽기 인스펙터 + 액션 버튼 |
| `panels/structureKitEditorDialog.ts` | 신규 | 편집기 다이얼로그 셸 (모양/AI 메타 탭) |
| `panels/structureKitImportDialog.ts` | 신규 | 가져오기 확인창 |
| `harnessSuggestion/structureKitRasterModel.ts` | 신규 | **DOM 없음** — 칸 계산·페인트·크기조절·부위 CRUD·굽기·복제 |
| `harnessSuggestion/structureKitFile.ts` | 신규 | **DOM 없음** — 파일 포맷·직렬화·검증·가져오기 계획 |
| `harnessSuggestion/structureKitActions.ts` | 확장 | store 접점 — 신규·복제·래스터 저장·크기조절·부위 CRUD |
| `util/downloadBlob.ts` | 신규 | `menu.ts` 의 다운로드 3-버그 회피 패턴 공용화 |
| `project/types/base.ts` | 수정 | `StructureKitAiMeta`, `learnedFrom` 값 추가 |
| `editor/tools/structureKitTools.ts` | 수정 | `repeatability` 반영, 응답에 `ai` 포함 |
| `ai/contextBuilder.ts` | 수정 | 설명·배치규칙·반복 여부 출력 |

---

## 7. 테스트

### 7.1 도구가 정한 제약

`vitest.config.ts:12` 는 `environment: "node"` 이고 테스트는 손으로 만든 `FakeElement`(515줄)를 쓴다.

```ts
// fakeDom.ts:206
getContext(): null { return null; }          // 캔버스 2D 컨텍스트 없음

// fakeDom.ts:308
getBoundingClientRect(): DOMRect {
  return { bottom: 0, height: 0, left: 0, right: 0, top: 0, width: 0, x: 0, y: 0, ... };
}                                            // 전부 0
```

유닛 테스트로는 캔버스에 그려진 것을 검증할 수 없고 화면 좌표도 전부 0 이다.
따라서 **칸 계산은 rect·scale 을 인자로 받는 순수 함수여야 한다.**
`event.clientX - rect.left` 를 내부에서 읽는 코드를 쓰면 fakeDom 에서 항상 (0,0) 이 나와 테스트가 무의미해진다.
(`setPointerCapture`/`hasPointerCapture` 스텁은 이미 있으므로 포인터 UI 자체는 fakeDom 이 예상하고 있다.)

### 7.2 순수 계층 API

```
structureKitRasterModel.ts
  cellAtPoint(rect, scale, clientX, clientY) → { cx, cy } | null
  paintCell(kit, cx, cy, layer, tile)        → kit'
  resizeKit(kit, w, h)                       → { kit', clamped: number, dropped: number }
  addPart / updatePart / removePart          → kit'
  bakeToSection(houseKit | interiorObject)   → SectionStructureKitDef
  duplicateKit(kit, 기존이름들)                → kit'

structureKitFile.ts
  serializeStructureKitFile(tileset, kits)   → string
  parseStructureKitFile(text)                → { file, perKitDiagnostics[] }
  planImport(file, 대상타일셋, 기존킷들)        → ImportPlan
```

`planImport` 가 모든 판정(칩셋 일치·서명 중복·이름 충돌·킷별 검증)을 미리 끝내고 계획을 반환하므로,
가져오기 확인창은 그 계획을 그리기만 한다. 대화상자 없이 충돌 정책 전부를 테스트할 수 있다.

### 7.3 3층

| 층 | 도구 | 무엇 |
|---|---|---|
| 순수 | vitest (node) | 위 두 모듈 전부 |
| DOM 계약 | vitest + `FakeElement` | 표·인스펙터 — 기존 `test/structureKitDbTab.test.ts`(426줄) 방식 확장 |
| 실제 상호작용 | playwright `test/e2e/` | 편집기에서 클릭해 칠하기, 다운로드 발생, 파일 선택 후 가져오기 |

### 7.4 반드시 넣을 회귀 테스트

1. **거짓 카피 부재** — 인스펙터 텍스트에 `"드래그하면 부위가 붙습니다"` 가 없다.
   그리고 편집기 캔버스에는 실제 `pointerdown` 리스너가 있다
2. **가져온 킷이 잠기지 않는다** — `learnedFrom: "builtin-parametric"` 인 킷을 가져와도
   이름 변경·삭제 버튼이 노출된다 (§3.2 잠금 축 교체의 회귀 방지)
3. **`repeatability: "fixed"` 는 repeat 를 무시한다** — `stamp_structure_kit` 에 `repeat: 5` 를 줘도 1회만 찍힌다
4. **제로 부트스트랩** — 가져오기가 `origin` 을 자동으로 `"user"` 로 올리지 않는다
5. **크기 축소 손실 보고** — `resizeKit` 의 `clamped`·`dropped` 개수가 실제와 일치한다
6. **AI 컨텍스트 확장** — `contextBuilder` 출력에 `description`·`placementRules`·반복 여부가 실린다
7. **부분 손상 파일** — 킷 12개 중 3개가 깨진 파일로 `planImport` 를 호출하면
   유효한 9개는 가져올 수 있고 3개는 각자의 이유를 달고 남는다

---

## 8. 하위 호환

| 항목 | 영향 |
|---|---|
| `StructureKitDef.ai` | optional — 기존 프로젝트 그대로 유효 |
| `learnedFrom: "db-authored"` | 유니언에 값 추가 — 기존 값들 그대로 유효 |
| `repeatability: undefined` | 현재 동작(`kind === "section"` → 반복) 유지 |
| 잠금 축 교체 | `source` 는 `albumEntries()` 가 이미 계산 중 — 저장 데이터 변화 없음 |
| 맵 영역 선택 → 구조물로 저장 | 경로·동작 불변 |
| `list_structure_kits` 응답 | 필드 추가만 — 기존 필드 유지 |

---

## 9. 구현 순서

의존 관계가 순서를 정한다. 각 단계는 그 자체로 출하 가능한 상태에서 끝난다.

### 1단계 — 진실 회복 (다른 단계에 의존하지 않음)

- 거짓 카피 제거 (`:751`), 가짜 `[지금 저장]` 제거 (`:786`)
- 잠금 축 교체: `learnedFrom` → `source` (§3.2)
- 실내 오브젝트 인스펙터에 `[팔레트에서 쓰기]` 추가
- 회귀 테스트 ①②

이 단계만으로도 출하 가치가 있고, 나머지 전부의 토대가 된다.

### 2단계 — 순수 계층

- `structureKitRasterModel.ts` 전부 (§7.2)
- `learnedFrom: "db-authored"` 추가
- 해당 유닛 테스트 전부, 회귀 테스트 ⑤

DOM 없이 로직을 먼저 고정한다.

### 3단계 — 편집기 다이얼로그

- `structureKitInspector.ts` 분리 → `structureKitDbTab.ts` 축소
- `structureKitEditorDialog.ts` (모양 탭: 페인트·레이어·크기·부위)
- `[+ 새 구조물]` · `[복제]` 진입점
- DOM 계약 테스트 + e2e

### 4단계 — AI 메타

- `StructureKitAiMeta` 타입, 편집기의 AI 메타 탭, 초안→승인 흐름
- `structureKitTools.ts` 의 `repeatability` 반영 및 응답 확장
- `contextBuilder.ts` 출력 확장
- 회귀 테스트 ③④⑥

**5단계보다 먼저여야 한다.** 파일 포맷이 `ai` 필드를 담으므로 타입이 먼저 굳지 않으면
포맷 v1 을 내보낸 직후 v2 로 올려야 한다.

### 5단계 — 파일 입출력

- `util/downloadBlob.ts` 추출 (`menu.ts` 의 두 사용처도 함께 이관)
- `structureKitFile.ts` (직렬화·검증·`planImport`)
- `structureKitImportDialog.ts`, 표 체크박스 열, 도구줄 버튼
- 회귀 테스트 ⑦ + e2e (다운로드 발생, 파일 선택 후 가져오기)
