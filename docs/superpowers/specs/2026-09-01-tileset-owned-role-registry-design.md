# 타일셋 소유 역할 레지스트리 — 설계

작성일: 2026-09-01

## 문제

에디터의 AI가 무엇을 참조하는지 추적한 결과, 타일 의미론의 진실이 두 갈래로 갈라져 있다.

| | 위치 | 사람이 고칠 수 있나 | 누가 읽나 |
|---|---|---|---|
| A. 코드 시맨틱 테이블 | `src/project/defaults/tileSemantics*.ts` 9파일 / 346 entries / ~3,856줄 | 아니오 (소스 수정만) | `resourceSearch.ts:187`, `tileMetadataTools.ts:184`, 벤치마크 |
| B. 프로젝트 데이터 | `TilesetDef.tileGroups` / `tileMeta` / `passability` | 예 (UI·AI 툴) | `approvedVocabulary()` → AI 프롬프트 |

`tileSemanticsCombinedTown.ts:3-4`가 이 분리를 자백한다.

> `tileset.tileMeta[]와는 별개로 관리되는 검색 전용 데이터다... 나머지 다수는 여기에서만 라벨을 제공한다`

사용자가 UI에서 라벨을 고쳐도 `get_tile_info`·리소스 검색은 여전히 코드 라벨을 본다.

추가로 역할 어휘 자체가 두 벌이며 상당수가 동의어다.

```
base.ts:80   TileGroupRole    building castle fence roof terrain water wall prop
base.ts:240  PaletteSlotRole  ground   path   wall  water decor   roof  boundary furniture
```

`terrain`/`ground`, `fence`/`boundary`, `prop`/`decor`가 같은 개념의 다른 단어이고, 그룹 어휘에는 `path`가 없어 흙길 그룹이 `role: "terrain"`으로 뭉뚱그려져 있다(`combinedTownGroups.ts:32`).

세 번째 어휘도 있다. 시맨틱 테이블 9파일은 enum에 매이지 않은 **43종 자유 문자열**을 쓴다(`awning` `barrel` `chest` `cliff` `ladder` `lava` `stairs` `statue` …). 본 스펙은 앞의 두 enum을 통합하며, 43종의 사상은 후속 스펙에서 다룬다(문서 말미 참조).

## 목표

타일셋을 1급 소유자로 삼아, 역할·재료·생성 파라미터를 사람이 데이터베이스 UI에서 설정할 수 있게 한다. 새 칩셋을 꽂아도 코드 수정 없이 마을이 지어지는 것이 성공 기준이다.

## 확정된 결정

| 축 | 결정 |
|---|---|
| 소유 모델 | 하이브리드 — 프로파일 시드 + 타일셋 오버라이드 |
| 역할 스키마 | 능력 플래그로 분리 (역할 = 이름, 행동 = capability) |
| 규칙 깊이 | 파라미터 + 재료만. 배치 알고리즘은 코드 유지 |
| AI 권한 | 읽기 + 제안·승인 (`origin: "user"` 계약 재사용) |
| 어휘 | 두 벌을 하나로 통합. 최종 9종 |
| 수치 소유자 | 타일셋 (칩셋 스케일에 종속되므로) |

### 수치가 타일셋 종속인 근거

```
grammarProfiles.ts:51-53
// MODERN-EXTERIORS — 480칩 틀(30×16)은 유지하되 내용은 3×4 템플릿 블록이 아니라
// 하단 7~8행 건물 스탬프(8×8/6×8) + 0행 바닥/도로 스탬프다.
```

`HOUSE_MARGIN = 2`는 combined_town의 3×4 블록 기준 숫자이며 8×8 스탬프 칩셋에서는 의미가 다르다. 어촌·산촌 같은 변형은 `tileset.villagePresets[]` 배열의 원소로 표현하므로 타일셋 복제가 필요 없다.

## 접근: A안 — 어댑터 우선

매 단계가 항상 green이며 언제든 멈출 수 있다.

```
A-1  roleCapabilities(tileset, roleId) 조회 함수 도입.
     내부는 기존 enum 상수 표. 동작 변화 0. 순수 리팩터.
A-2  15개 분기를 하나씩 조회 함수로 이관. 분기당 커밋 1개.
A-3  role: string 개방 + 오버라이드 + 마이그레이션 + DB 탭.
```

B안(단번 전환)을 택하지 않은 이유는 타입 에러가 16곳에서 동시에 터지고 `TileGroupJunctionRule.withRole` 같은 연쇄가 섞여 회귀 원인 특정이 어렵기 때문이다. C안(병행 필드)은 진실을 두 갈래로 영구 고착시켜 이번 개편의 동기와 정면으로 충돌한다.

---

## ① 역할·능력 스키마

능력 어휘는 15개 분기에서 귀납했다.

| 능력 | 타입 | 대체하는 분기 |
|---|---|---|
| `layerHome` | `lower\|upper\|perCell` | `groupSampleBuilder.ts:174`, `buildPaletteCore.ts:93` |
| `sampleAs` | `nineSlice\|verticalPair\|roof\|single` | `groupSampleBuilder.ts:54,59,60` |
| `expectedPassage` | `passable\|solid` (선택) | `tilesetPaletteLint.ts:104,106,115` |
| `requiresPatternGrammar` | `boolean` | `aiPreviewContracts.ts:432` |
| `autotile` | `boolean` | `tileVocabulary.ts:259` |
| `terrainTag` | `number` (선택) | `combinedTown.ts:349` |
| `needsBackdrop` | `boolean` | `groupSampleBuilder.ts:199` |

### 제외: `turnGuide.ts:60`

`group.role === "prop" | "terrain" | "water" | "fence"` 분기가 있어 `scatterable` 능력을 검토했으나 **능력에 넣지 않고 이관 대상에서도 제외한다.**

이 분기는 행동 게이트가 아니다. `formatMaterialLabelHint()`(`turnGuide.ts:41-74`)가 프롬프트에 넣는 **한 줄짜리 형식 예시**의 이름을 고르는 휴리스틱이다.

```
- 소품·지형 material 라벨 예(place_props/fill_region — 가방·그룹 id 금지, 미합의는 목업 확인):
  침엽수(prop), 나무 상자(prop), 흙길 오토타일(terrain), ...
```

목적은 "그룹 id 말고 라벨 문자열을 써라"(`tileVocabulary.ts:5`)를 실물 예시로 가르치는 것이며, 재료 카탈로그 자체는 `approvedVocabulary()`(`contextBuilder.ts:250`)가 따로 싣는다. 이 필터가 틀려도 예시가 덜 대표적일 뿐 AI가 쓸 수 있는 재료는 줄지 않는다.

역할로 표현할 수도 없다. 시맨틱 어휘 43종을 9종으로 접으면 `tree`·`plant`·`rock`은 흩뿌려도 되고 `chest`·`sign`·`statue`·`bed`는 안 되는데 **전부 `prop`으로 접힌다.** 실제로 `turnGuide.ts:61`에 이미 `/tree|bush|flower|fence|path|water|road|box/i` 정규식 폴백이 붙어 있는 것이 역할만으로 부족했다는 증거다.

산포를 정말 막고 싶다면 그것은 `scatter_object`(`placementTools.ts:227`)에 검증을 넣는 별개 기능 요청이다. 현재 그 도구는 역할을 보지 않으므로 침대도 흩뿌려진다.

신규 파일 `src/project/types/roles.ts`:

```ts
export interface RoleCapabilities {
  layerHome: "lower" | "upper" | "perCell";
  sampleAs?: "nineSlice" | "verticalPair" | "roof" | "single";
  expectedPassage?: "passable" | "solid";
  requiresPatternGrammar?: boolean;
  autotile?: boolean;
  terrainTag?: number;
  needsBackdrop?: boolean;
}

export interface TileRoleDef {
  id: string;
  label: string;
  caps: RoleCapabilities;
  origin?: "user" | "ai";
  source?: "bundled-default";
}
```

`origin`/`source`를 그대로 쓰는 이유는 `isTrustedGroupSource()`(`tileVocabulary.ts:58`)의 승인 판정을 역할에도 물려받기 위해서다.

`TileGroupJunctionRule.withRole`은 `TileGroupRole` → `string`으로 넓히고, 검증은 "레지스트리에 있는 id인가"로 바뀐다.

### 최종 역할 9종

```
building  castle  fence  path  prop  roof  terrain  wall  water
```

`furniture`는 `prop`에 병합한다. 7개 능력 중 두 역할을 가르는 값이 하나도 없고, "벽에 붙는다" 같은 배치 제약은 이미 `PlacementZone`(`base.ts:123-135`)이 킷·그룹 단위로 담당하기 때문이다(`base.ts:118-119` 주석 참조).

"실내 가구"라는 구분은 태그(`TileGroupMetadata.tags` / `TileAiMetadata.tags`)로 유지한다. 역할은 엔진이 어떻게 다룰지를, 태그는 사람과 AI가 어떻게 찾을지를 정한다.

---

## ② 프로파일/오버라이드 해석

### 2단 해석

```
roleCapabilities(tileset, roleId)
   1) tileset.roleOverrides[roleId]                            ← 사용자 오버라이드 (부분)
   2) getGrammarProfile(tileset.grammarProfile).roles[roleId]  ← 시드 기본값
   ⇒ 능력 필드 단위 병합
```

병합 단위는 레코드 전체가 아니라 **능력 필드 하나하나**다. 레코드 교체 방식이면 "wall은 다 같은데 통행성만 다르다"를 표현하려 7개 능력을 다시 써야 하고, 나중에 능력이 추가될 때 사용자 데이터가 조용히 낡는다.

### 스키마 변경

```ts
// grammarProfiles.ts — layerHomeByRole(1컬럼) 을 roles(8컬럼) 로 대체
export interface GrammarProfile {
  readonly id: string;
  readonly label: string;
  readonly supportedPatternKinds: readonly GrammarPatternKind[];
  readonly roles: Readonly<Record<string, TileRoleDef>>;
  readonly autotileNeighborhood: 4 | 8;
}

// types/base.ts — TilesetDef 에 추가
  roleOverrides?: Record<string, Partial<RoleCapabilities>>;
  suppressedRoleIds?: string[];
  materialSets?: MaterialSetRecord[];
  villagePresets?: VillageLayoutPresetRecord[];
```

`suppressedRoleIds`는 `suppressedHarnessGroupIds`(`combinedTown.ts:76`)와 같은 계약이다. 역할 추가는 `roleOverrides`에 프로파일에 없는 id를 넣는 것으로 되며, 이때만 `layerHome`이 필수다(폴백 불가).

### 출처 추적

```ts
roleCapabilitySources(tileset, roleId): Record<keyof RoleCapabilities, "override" | "profile" | "default">
```

DB 탭 배지 전용이다. 읽기 경로(15개 분기)는 사용하지 않는다.

### 유보: 사용자 저작 프로파일(3단)

프로파일 층의 존재 이유는 "여러 타일셋이 규칙을 공유"인데, 이 저장소는 타일셋이 칩셋 이미지와 사실상 1:1이다(시맨틱 테이블 9개 ≈ 칩셋 9개). 공유 수요가 실재하지 않는데 3단 해석을 깔면 "지금 값이 어디서 왔나"가 3배로 어려워진다. `GrammarProfile`이 id 기반 레지스트리이므로 나중에 `project.grammarProfiles[]`를 병합 소스로 추가하는 건 언제든 가능하다. 이음매는 열어 두되 지금 짓지 않는다.

---

## ③ 생성규칙 데이터 모델

### 재료 해석

교체 기전은 이미 있다 — `patternGrammar.parts[]`가 파트 역할을 갖고 있다(`base.ts:215`, `combinedTownGroups.ts:57-67`).

```ts
// 지금
const FENCE_TOP_LEFT = 378;                    // village/constants.ts

// 목표
resolveMaterial(tileset, "fence", "topLeft")   // → number[]
```

### 재료 세트

던전 테마(용암/석재/얼음)와 집 키트 6종은 같은 것이다 — 둘 다 "이 역할들에 어떤 구체 타일을 쓸지"의 이름 붙은 묶음이다.

```ts
interface MaterialSetRecord {
  id: string;                                          // "blue-stone" | "용암동굴"
  label: string;
  bindings: Record<string, Record<string, number[]>>;  // roleId → partRole → tileIds
  origin?: "user" | "ai";
  source?: "bundled-default";
}
```

### 대상 인벤토리

| 대상 | 현재 | 이후 |
|---|---|---|
| `village/constants.ts:62-152` 타일번호 | 상수 15+ | `resolveMaterial()` |
| `village/constants.ts` 수치 | `HOUSE_MARGIN` `PLAZA_WIDTH` `DEFAULT_ROAD_WIDTH` 등 | `tileset.villagePresets[]` |
| `YARD_THEMES`(10) `YARD_STYLE_POOLS`(5) | 상수 | `materialSets` |
| `dungeonRoomPipeline.ts:38-62` THEME | 상수 3종 | `materialSets` |
| `interiorRoomPipeline.ts` 타일번호 | 상수 | `resolveMaterial()` + `interiorRoomKinds`(이미 타일셋 소유) |
| `houseKit.ts` `HOUSE_KITS` | 상수 6종 | `materialSets` |
| `houseTemplateCatalog.ts` | 상수 34종 | 형태이므로 재료 아님 → `VillageHouseTemplateRecord`(이미 존재) |
| `tileSemantics*.ts` 9파일 | 검색 전용 별도 진실 | `tileMeta` 시드로 강등 — **후속 스펙**(본 스펙은 전제조건만) |

### 코드로 남는 것

- 배치 알고리즘 (`plan → build → critique` 파이프라인)
- `VILLAGE_RANGE`(`authoringData.ts:33`) — 값이 아니라 가드레일
- `forestDensity.ts` 밀도→패킹 변환 함수

---

## ④ 마이그레이션·시드 계약

### 시드 3상태

`interiorRoomKinds`(`base.ts:476-478`)의 계약을 모든 신규 필드에 적용한다.

| 상태 | 의미 | 동작 |
|---|---|---|
| `undefined` | 아직 시드 전 | 하네스가 기본값을 심는다 |
| 값 있음 | 사용자 소유 | 건드리지 않는다 |
| `[]` / `{}` | 사용자가 지웠음 | 다시 심지 않는다 |

부분 억제는 `suppressedRoleIds`가 맡는다.

### 어휘 치환표

| 구 값 | 신 값 | 근거 |
|---|---|---|
| `ground` | `terrain` | 동의어 |
| `boundary` | `fence` | 동의어 |
| `decor` | `prop` | 동의어 |
| `furniture` | `prop` | 능력 차이 없음(①) |
| `path` | `path` | 신규 정식 역할 |
| 나머지 8종 | 그대로 | |

### 정규화 절차

진입점은 `ensureCombinedTownHarness()`(`combinedTown.ts:65`)다. 여기에 역할 정규화를 붙인다.

```
1. tileGroups[].role, tileMeta[].role   → 치환표 적용
2. TileGroupJunctionRule.withRole       → 치환표 적용
3. palettePresets[].slots[].role        → 치환표 적용
4. project.villagePresets[]             → 해당 타일셋으로 이동, 프로젝트 필드 제거
```

4번의 이동 대상은 프리셋의 `templateIds[]`가 참조하는 타일셋으로 정한다. 참조가 없으면 프로젝트 기본 타일셋으로 보내고 경고를 남긴다.

### 1회 변환 후 저장

읽기 시점 변환이 아니라 마이그레이션 후 저장이다. 읽기 시점 변환으로 두면 구 어휘가 영원히 살아남아 이번에 없애려던 두 갈래 문제가 재발한다. 안전망은 마이그레이션 전 프로젝트 스냅샷 1개이며 실패 시 통째로 되돌린다.

---

## ⑤ 데이터베이스 UI

```
TILESET_FOLDER_TAB_IDS (database.ts:140)   5개 → 8개
  tilesets            통행             (기존)
  tilesetAutotile     오토타일 설정     (기존)
  tilesetUnlabeled    미분류 모아보기   (기존)
  structureKits       구조물           (기존)
  tilesetSpaces       공간 종류         (기존)
  tileRoles           타일 역할         신규
  materialSets        재료 세트         신규
  villages            마을             세계 그룹에 그대로 두되 타일셋 폴더로 편입
```

`villages`는 `TAB_GROUPS`의 세계 그룹(`database.ts:135`)에 이미 있다. 바뀌는 것은 `TILESET_FOLDER_TAB_IDS`(`:140`)에 추가되어 타일셋 자식 폴더 안으로 들어가는 것과, 렌더러가 `project.villagePresets` 대신 선택된 타일셋의 `villagePresets`를 읽는 것이다.

선례는 이미 둘 있다 — `structureKits`(`database.ts:473`)와 `tilesetSpaces`(`:468`)가 타일셋 소유 배열을 렌더하는 탭이다.

**`tileRoles` 탭** — 행 = 역할, 열 = 능력 7개. 셀마다 출처 배지(프로파일 시드 / 타일셋 오버라이드 / 사용자 정의)를 달며 `roleCapabilitySources()`가 먹인다. 시드 역할은 끄기(`suppressedRoleIds`)만 되고 삭제는 안 된다.

**`materialSets` 탭** — 집 키트·던전 테마·마당 테마가 합류한다. 편집기는 `역할 → 파트역할 → 타일` 3단 선택이다.

**`worldGen` 탭은 건드리지 않는다.** 라벨이 "생성 규칙"이지만 실제 내용은 `project.system.worldGen.keywords`(`database.ts:471`)로 별개 데이터다. 라벨 개명은 이번 범위 밖으로 두되 혼동 위험으로 기록해 둔다.

---

## ⑥ AI 제안·승인 경로

새 기전을 만들지 않고 기존 3단 판정을 재사용한다(`tileVocabulary.ts:8-11`, `:569`).

| 행위 | 경로 |
|---|---|
| 읽기 | `approvedVocabulary()`가 역할 능력도 함께 실어 프롬프트로 보냄 |
| 제안 | `propose_tile_vocabulary` 확장 — 역할·재료세트도 제안 대상 |
| 저장 | AI 제안은 `origin: "ai"`. 사용자 수락 시 `origin: "user"` |
| 사용 | `resolveVocabForBuild()`의 `approved / soft / missing` 판정을 역할에도 적용 |

`soft`(미합의) 역할로 시공하면 차단하지 않고 그린 뒤 목업 확인을 받는다. 기존 재료 정책과 동일하다.

`author_house`의 `kitId` enum이 `ALL_HOUSE_KIT_IDS` 상수(`houseKit.ts:21`) 대신 해당 타일셋의 `materialSets`에서 런타임 생성된다. 사용자가 만든 키트가 자동으로 AI 선택지가 되며, `stamp_structure_kit` 차단(`d749af8d`)의 원래 의도인 "저수준 스탬프 대신 고수준 파사드로 라우팅"은 그대로 지켜진다.

---

## ⑦ 테스트 전략

**A-1** — 유일한 합격 기준은 "아무것도 안 바뀌었다"이다. `roleCapabilities()`가 기존 두 enum 표와 모든 입력에서 같은 값을 내는지 전수 검증한다.

이 시점의 역할 집합은 통합 후 9종이 아니라 **구 어휘 13종**이다(`TileGroupRole` 8 + `PaletteSlotRole` 8 − 공유 3). 통합은 A-3의 마이그레이션에서 일어나므로, A-1 테스트는 13종 × 능력 7개 = 91칸을 덮어야 한다. 9종으로 줄어드는 것은 A-3 이후의 상태다.

**A-2** — 분기 하나당 커밋 하나. 각 커밋은 해당 분기를 덮는 기존 테스트가 green이어야 넘어간다. 덮는 테스트가 없는 분기는 먼저 특성화 테스트를 쓰고 이관한다.

**A-3**
- 구 스키마 픽스처(`defaults/fixtures/dew-village-demo.json`) → 마이그레이션 → 신 스키마 왕복 검증
- 치환표 4쌍 전수
- 시드 3상태(`undefined` / 값 / `[]`) 각각의 재시드 동작

**판정 방식** — 공유 머신이므로 실패 수는 의미가 없다. 기준선 워크트리를 두고 실패 집합의 차집합으로 판정한다. dev 서버 포트는 명령에 명시적으로 박는다.

---

## 범위 밖

- 절차 조립(파이프라인 단계 순서를 데이터로) — 미니 DSL이 필요한 별도 프로젝트
- 사용자 저작 생성기(스크립트·노드 그래프)
- 사용자 저작 프로파일(3단 해석)
- `worldGen` 탭 라벨 개명
- `PlacementZone` / `TileGroupLayer` enum 개방 — 이번 축과 무관

## 후속 스펙: 시맨틱 테이블 강등

`tileSemantics*.ts` 9파일(346 entries / ~3,856줄)의 `tileMeta` 강등은 **별도 스펙으로 분리**한다. 본 스펙은 강등 대상임을 확정하고 전제조건만 심는다.

분리하는 이유는 성격이 다르기 때문이다. 본 스펙은 구조를 바꾸고, 강등은 데이터를 사상한다. 그리고 그 사상이 자명하지 않다 — 시맨틱 테이블은 **43종의 세 번째 역할 어휘**를 쓴다.

```
awning banner barrel bed building chest cliff coast crate decoration door empty
fence floor furniture gate ice ladder lava machine mountain path pillar plant
prop rock roof rope sand shelf ship sign snow stairs statue structure terrain
torch tree wall water window forest
```

절반은 자명하다(`barrel`·`crate`·`torch` → `prop` + 태그). 나머지 절반은 판단이 필요하다.

| 시맨틱 role | 쟁점 |
|---|---|
| `stairs` `ladder` `gate` | 통행 특성이 특이하다. 계단 246은 겉보기 통행 가능인데 실제 불가(`tileSemanticsCombinedTown.ts:29`) |
| `cliff` `mountain` `coast` | 절벽은 `wall`처럼 막고 해안은 `terrain`이다 — 통행이 갈린다 |
| `lava` `ice` `snow` | 데미지·미끄럼 특성이 있으면 `terrain` + 태그로 부족할 수 있다 |
| `ship` `machine` | 이벤트성 오브젝트라 타일 역할이 맞는 그릇인지 불명 |
| `empty` | 삭제 대상 |

### 본 스펙이 심어야 할 전제조건 2가지

1. **통합 역할 9종 확정** — 사상 목적지가 있어야 한다. A-3 완료가 선행 조건이다.
2. **소비처 3곳에 `tileMeta` 우선·시맨틱 폴백 순서 심기** — `resourceSearch.ts:187`, `tileMetadataTools.ts:184`, `benchmark/groundTruth.ts`. 이 순서가 먼저 들어가면 346개를 한 번에 옮길 필요 없이 **칩셋 한 개씩** 점진 이관이 가능하다.

2번은 A-3 범위에 포함한다. 강등 자체는 포함하지 않는다.
