# 세계 생성 규칙 (DB 「맵 → 생성 규칙」 탭)

AI 가 마을을 깔 때 쓰는 **물·숲·길 수치와 낱말 판정**을 프로젝트 데이터로 끌어낸 층이다.
전에는 이 숫자들이 `villageTerrainPass.ts` 안의 상수였고, 저자가 "호수를 더 크게" 를
원하면 코드를 고쳐야 했다.

## 소유 경계

| 파일 | 소유 |
|---|---|
| `src/project/worldGenRules.ts` | 스키마 · 기본값 · 정규화 · 계산 헬퍼 · 내장 낱말 규칙 |
| `src/project/worldGenPresets.ts` | 예시 프리셋(완결된 규칙 묶음) |
| `src/editor/panels/databaseWorldGenView.ts` | DB 탭 UI |
| `src/editor/panels/worldGenPreview.ts` | 칩셋 타일로 그리는 미리보기 |
| `src/styles/database/world-gen.css` | 탭 스타일 (`--db-studio-*` 토큰만) |

저장 위치는 `project.system.worldGen` (옵트인). **생략하면 예전 하드코딩과 완전히 같은
동작**이다 — `test/worldGenRules.test.ts` 가 기본값 대 예전 상수를 1:1로 못 박는다.

## 절대 하지 말 것 — 미리보기 전용 계산식

`worldGenPreview.ts` 는 마스크를 `buildTerrainConstraintMasks`, 수면 모양을
`cellsInFillShape`(fill_region 본체), 나무 수를 `coniferCountFor` / `broadleafCountFor`
로 구한다. 미리보기 안에 근사식을 새로 만들면 **저자가 본 그림과 실제로 깔린 맵이
갈라진다.** 새 수치를 미리보기에 노출하려면 먼저 `worldGenRules.ts` 에 헬퍼를 만들고
시공기와 미리보기가 그 헬퍼를 함께 쓰게 하라.

예외는 길·광장 한 겹뿐이다. `villageRoadCells` 는 시공기의 도로 배치를 재현하지 않는
**톤 스케치**이고, 그 사실이 함수 주석에 적혀 있다. 이 경계를 넓히지 마라.

## 낱말 규칙 (자연어, 정규식 금지)

`WorldGenKeywordRule` = `words`(부분 일치) + `exceptWords`(오탐 차단) + `landmarks`.
내장 규칙 9개는 예전 `inferRequirementsFromQuery` 의 정규식을 낱말 목록으로 옮긴 것이며
판정이 같다(테스트가 강촌/호수/항구/장터/강원/도시 케이스를 고정한다).

저자가 내장 규칙을 손대면 **같은 id 로 저자 규칙이 생겨 그 자리를 덮는다**
(`resolveWorldGenKeywordRules`). 내장 배열은 변하지 않으므로 「기본값으로 되돌리기」
한 번이면 원래 판정으로 돌아온다. 저작 UI 에 정규식 입력을 절대 넣지 마라 — 초보 저자가
대상이고, 코드 작성을 요구하지 않는 것이 이 탭의 설계 전제다.

## 수치가 통과하는 경로

`system.worldGen` → `resolveWorldGenRules()` → 아래 전부:

- `villageTerrainPass.ts`: `buildTerrainConstraintMasks` (강 띠·호수 지름·숲 깊이·방향),
  `applyTerrainPassFromMasks` (수면 모양·나무 수·간격·자연스러움).
  숲 **밀도**는 모델이 넘긴 `requirements.forestDensity` enum 이다. 쿼리 정규식은 없다.
- `villageRequirements.ts`: `inferRequirementsFromQuery` (낱말→랜드마크, 방향 기본값),
  `styleHintsFromRequirements` (길·광장·마당·테두리 나무)
- `villagePlan.ts`: `normalizeVillagePlan`
- `villageSession.ts`: `stepWater` / `stepForestConifer` / `stepForestBig` / `plant_tree_clusters`
- `village/builder.ts`, `village/pipeline.ts`: 툴 진입점

**2026-08-30 통일:** 멀티턴 세션의 숲 단계는 예전에 `면적/12`(침엽수)·`min(12, 면적/28)`
(활엽수)로 단일 패스(`면적/10`·`min(10, …)`)와 달랐다. 이제 둘 다 규칙 헬퍼를 쓰므로
DB 값 하나가 두 경로를 지배한다. 세션 경로에서 나무 수가 예전과 다르면 이것이 원인이다.

## 새 규칙 항목을 추가할 때

1. `WorldGenRules` 에 옵셔널 필드 + `DEFAULT_WORLD_GEN_*` 에 예전 값 + `WORLD_GEN_BOUNDS`
   에 슬라이더 경계를 함께 넣는다(경계는 정규화와 UI 의 단일 출처다).
2. `resolveWater` / `resolveForest` / `resolveRoad` 에 클램프를 추가한다. 조용히 삼키지 말고
   최소/최대 역전은 끌어올린다.
3. 계산 헬퍼를 만들고 **시공기와 미리보기 양쪽**에서 쓴다.
4. `test/worldGenRules.test.ts` 에 기본값 = 예전 값, 규칙 변경 → 마스크 변화, 쓰레기 값 →
   기본값 케이스를 추가한다.
5. 탭에 컨트롤을 붙인다. 비율은 `ratioField` 로 **%** 로 보여준다 — `0.14` 는 저자에게
   아무 뜻도 전달하지 않는다.

## 필수 랜드마크 하드 게이트 (2026-09-04)

첫 plan의 필수요소는 warning이 아니라 실패다. 실측(타일 카운트) 기준이며 자기신고가 아니다:

| 랜드마크 | 빌더 게이트 | look 평가 |
|---|---|---|
| river/lake/harbor | 수역 ≥30/25칸 (`landmark-water-missing`) | 동일 |
| forest | 나무 ≥15칸 (`landmark-forest-missing`) | 나무 ≥20칸 + 2×2군락 ≥3 |
| market | 장터 소품 ≥3칸 (`landmark-market-missing`, decor 켜짐) | 광장소품 ≥3 또는 소품 ≥10 |
| farm | 빌더 제외 — 조경(대형맵 전용)에 묶여 기본 50×50 달성 불가 | 경작지 ≥20칸 지적 + `place_farmland` fix |
| 금지선 | 직선 폴백에도 집/수역 침범 잔존이면 실패 (`road-forbidden-residual`) | — |

계수 정본: `countWaterCells`·`countTreeCells`·`countMarketCells`·`countFarmlandCells`
(`villageEvaluate.ts` — 빌더와 평가가 공유). farm 제외 사유: 농촌= farm+forest 콤보에서
forest 밴드 나무가 밭 자리를 막아 80×80에서도 경작지 0칸이 실측됐다.

## 검증

```bash
npx vitest run --configLoader bundle test/worldGenRules.test.ts test/villageBuilder.test.ts test/villageTerrainBounds.test.ts
```

`villageBuilder.test.ts` 가 회귀 그물이다 — 기본값을 건드리면 강촌/호수/돌길 케이스가 깨진다.

## 마을 설계서 (2026-09-05)

설계서의 자연 정책이 fixed면 공유 system.worldGen을 변경하지 않고 물·숲 수치를 합성해 시공한다. 테마 문장의 수역·숲 추론보다 설계서의 명시값이 우선한다. 상세 계약과 경계는 [마을 설계서](village-design.md).
## 저장·편집 검토 수정 복구 (2026-09-05)

`normalizeSystemRecords`가 `worldGen`을 보존하고 `normalizeWorldGenRulesForStorage`로 저작된 키만 정규화한다. 생략된 그룹과 필드에 현재 기본값을 펼쳐 저장하지 않으며, 기존 프로젝트에서 규칙 자체가 없으면 계속 생략한다. 로드는 `validateSystem`에서 그룹 객체·낱말 배열·선택 불리언 모양을 먼저 검사한다. `test/worldGenRules.test.ts`는 희소 저장 왕복, 범위 보정, 잘못된 컨테이너 거부를 검증한다.

숫자 입력의 undo 병합 키는 그룹과 필드별로 나뉜다. 방향·모양·길 선택 및 낱말 규칙 토글/지형 변경은 각각 이산 스냅샷이다. 규칙 토글에는 `<규칙 이름> 규칙 쓰기` 접근성 이름을 제공한다. 탭 재진입은 예시 섹션과 미리보기 문장을 초기화하며, 사이드바 사용자 규칙 개수에서 내장 규칙 덮어쓰기는 제외한다. 최신 타일셋 폴더와 세계관 내비게이션은 유지한다. 실제 undo 계약은 `test/databaseWorldGenView.test.ts`, 브라우저 증거는 `test/e2e/worldgen-review-recovery.spec.ts`와 `verify-shots/worldgen-review-recovery/`에 있다.

미리보기 나무 수는 산포 성공 수가 아닌 엔진 헬퍼의 **목표** 수로 표시한다. 기본 타일셋이 없으면 빈 캔버스 대신 상태 안내를 표시하며, 이미지가 늦게 로드되어도 분리된 캔버스에는 그리지 않는다. 시공기·숲 알고리즘은 이 복구에서 변경하지 않는다.
