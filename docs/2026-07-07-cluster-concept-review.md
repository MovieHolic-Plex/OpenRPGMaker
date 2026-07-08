# 2026-07-07 클러스터 개념 비판 리뷰 — "배지는 약속하고, 엔진은 모른다"

- 작성: Claude (비판적 리뷰어, 읽기 전용 세션)
- 대상: rpg-zzu 타일 팔레트 클러스터(`tileGroups` + `patternGrammar` + `rules`) 개념 전반
- 방법: 코드 경로 추적 + 실브라우저 검증(Playwright chromium, `http://127.0.0.1:9988/?freshProject=1`, 정적 dist) + 관련 유닛 테스트 실행(11 파일 50건 전부 통과)
- 증거: `evidence/cluster-review/` (스크린샷 22장 + probe 로그 4종)
- 제외(기확정, 별도 워커 수리 중): 기본 타일셋 rules 미시드, scatter_object 침엽수 1×1 취급

## 결론 요약

클러스터는 **하나의 개념이 아니라, 서로를 모르는 6개의 병렬 메커니즘**이다. 팔레트 배지(`3×3`/`애니`/`9분할`/`세로 확장`)가 약속하는 동작 중 수동 페인트에서 실제로 일어나는 것은 흙길 오토타일 하나뿐이고, 그마저 `patternGrammar` 덕분이 아니라 **별도 엔진(`AutotileGroup.variantMap`)이 우연히 같은 타일을 다루기 때문**이다. 규칙(hard/medium/soft)은 소비자마다 다른 의미로 읽고, 기본 타일셋에서는 규칙·문법을 편집해도 **다음 로드에서 코드 정의로 전부 되돌아간다**.

집계: **치명 0 · 높음 3 · 중간 5 · 낮음 4** (+ 정상 확인 4)

## 0. 개념 지도 — 같은 질문("이 타일들은 어떻게 붙는가")에 6개의 답

| # | 메커니즘 | 정의 위치 | 소비자 | 다른 메커니즘 인지 |
|---|---|---|---|---|
| 1 | `tileGroups[].patternGrammar` | `src/project/types/base.ts:124-158`, `src/project/tilesetHarness/combinedTownGroups.ts` | 팔레트 배지, AI 샘플 렌더(`groupSampleBuilder`), `scatter_object` 풋프린트, AI 분류 도구 | 없음 |
| 2 | `AutotileGroup.variantMap` (진짜 페인트 셰이핑) | `src/project/defaults/autotileGroups.ts` | 수동 연필/채우기/지우개 (`src/editor/tileActions.ts:200-210`) | 없음 |
| 3 | 호수 4분할 렌더 (하드코딩) | `src/project/defaults/lakeAutotile.ts`, `src/editor/chipsetTileRender.ts:48-49` | 에디터/플레이 렌더러만 | 없음 |
| 4 | `ClusterRule` (hard/medium/soft) | `src/project/types/base.ts:92-100` | lint(`clusterRuleValidators`), AI `paint_tiles` 동반 확장(`clusterRulePlacement.ts:33`), scatter 소프트 벌점(`placementScoring.ts`) | 부분(2번 회피용 예외만) |
| 5 | House harness kits | `src/editor/houseKit.ts` | `build_house_kit`, `build_village`, showcase defaults | 클러스터 어휘와 분리된 유일한 집 구조 문법 |
| 6 | 타일 스탬프 휴리스틱 (문자열 매칭) | `src/editor/tileStampBrushes.ts:99-146` | 팔레트 스탬프 | 그룹 이름/설명을 **키워드로** 훑음 |

흙길은 1번과 2번에 **이중 정의**되어 있고(같은 타일, 다른 스키마, 링크 없음), 물은 1번(문법)과 3번(렌더)에 정의되어 있으며 서로 무관하다. 침엽수는 어디에도 없다(기확정 결함).

## 1. 결함 목록

### [높음-1] patternGrammar는 수동 페인트에 대해 죽은 약속 — 배지와 실동작 불일치 (실측)

팔레트 클러스터 카드의 배지는 `patternGrammar.kind`를 그대로 노출하지만(`src/editor/panels/tilePaletteClusters.ts:81,175`), 타일 클릭은 `onSelectTile(단일 tileId)`뿐이고 수동 페인트 경로(`src/editor/tileActions.ts:23-33`)는 `patternGrammar`를 한 줄도 읽지 않는다.

freshProject 실측 (probe-log.txt, 02~12번 스크린샷):

| 그룹(배지) | 조작 | 기대(배지의 약속) | 실측 |
|---|---|---|---|
| 흙길 오토타일(3×3) | 421 몸통 2×2 페인트 | 모서리 자동 셰이핑 | ✅ `[390,392,450,452]` — 유일하게 동작. 단, 근거는 patternGrammar가 아니라 `DEFAULT_ROAD_AUTOTILE_GROUP` |
| 흰 집 벽 확장(9분할) | 46(중앙) 1칸 페인트 | 최소 3×3 벽 조립(minWidth/minHeight=3) | ❌ 알몸 중앙 칩 1개만 배치(`12-crop-lower-area-3x.png` 우상단 주황 칩) |
| 애니메이션 물(애니) | 120 몸통 3×3 페인트 | — | 데이터는 120 그대로(문법 미관여), 렌더는 하드코딩 호수 시스템이 처리(§중간-4) |
| 나무 소품(단일 배지) | 260 페인트 | (배지대로면 단일) | 260 상단부 고아 배치 — 스택 개념 자체가 스키마에 없음 |
| 사선 지붕(장식) | 374 페인트 | 상위 겹침 | ✅ upper=374, lower 보존 |

`vertical_expandable`/`horizontal_expandable`을 쓰는 번들 그룹은 **0개**다 — "세로 확장" 배지는 기본 프로젝트에서 아예 등장하지 않는다(브리핑의 "침엽수 숲 군락[세로 확장]"은 현 빌드에 존재하지 않음, 나무는 "나무 소품[단일]"). 즉 스키마의 9개 kind 중 수동 편집기에서 의미를 갖는 것은 사실상 0개이고, `event_required_object`·`source_rect`·`overlay_detail`은 페인트/배치 어느 경로에서도 동작 코드가 없다(라벨·프롬프트 문자열로만 존재).

**판정**: 클러스터의 핵심 사용자 접점(팔레트→페인트)에서 개념이 성립하지 않는다. AI 도구 전용 메타데이터가 사용자 UI에 동작 약속처럼 노출된 상태.

### [높음-2] 기본 타일셋의 클러스터 편집은 전부 휘발 — 로드 시 하네스 재시드가 덮어씀

`applyCombinedTownHarness`는 로드마다 `harness-combined-town-` 접두사 그룹을 **통째로 버리고 코드 정의로 재생성**한다:

- `src/project/tilesetHarness/combinedTown.ts:45-51` — `current.filter((g) => !g.id.startsWith(PREFIX))` 후 코드 정의 append
- 호출 경로: `store.load()` → `normalizeCurrentProject()`(`src/project/store.ts:107,342-354`) → `ensureBundledTilesets` → `ensureTilesetHarnesses`

따라서 `set_cluster_rule`(rules), `set_group_layout`(patternGrammar), `set_group_junction/overlay`, `delete_tile_group`으로 하네스 그룹에 가한 변경은 **다음 프로젝트 로드에서 전부 소실/부활**한다. 실측으로 AI 모달을 통해 나무 소품에 `vertical_expandable` 문법 저장 성공을 확인했는데(`23-ai-modal-accepted.png`, ai-probe-log.txt `GROUP-AFTER-ACCEPT`), 이 결과물이 살아남을 수 없는 구조다. 테마팩 쪽(`themePacks.ts:96-103`)은 `source==="bundled-default"`인 팩 그룹만 교체하지만, `set_cluster_rule`은 `source`를 바꾸지 않으므로 결과는 동일하다.

**판정**: 클러스터 생명주기(생성→감사→수리)의 저장 반쪽이 없다. 기확정 결함(rules 미시드)의 이면이며, 시드를 넣어도 사용자가 고친 것을 지키지 못하면 같은 문제가 재발한다.

### [높음-3] 규칙 의미론 분열 — lint는 "셀", 배치는 "인스턴스"

- `spacing`: lint는 그룹 타일이 깔린 **모든 셀 쌍의 맨해튼 거리**를 검사한다(`src/project/lint/clusterRuleValidators.ts:137-158`, 좌표 수집은 `groupCoords` 189-198). 다중 타일 클러스터(나무 1×2, 벽 3×3 — 클러스터의 존재 이유)는 자기 자신의 인접 셀이 거리 1이므로 **minGap≥2 규칙을 스스로 즉시 위반**한다. 반면 scatter는 사각형 간 갭으로 계산한다(`placementTools.ts:267-269`).
- `count`: lint는 셀 수(`coords.length`), scatter 벌점은 배치 인스턴스 수(`placementScoring.ts:45-48`). 2칸짜리 오브젝트 10개 = lint 20 vs 배치 10. `max=10` 규칙은 배치기가 지켰다고 믿은 직후 lint에서 터진다.
- 유닛 테스트는 전부 1칸짜리 "인스턴스"로만 검증해 이 분열을 가리고 있다(`test/clusterRuleValidators.test.ts:96-123`).

**판정**: hard 규칙이 커밋 게이트(error)까지 물려 있으므로, 다중 타일 그룹에 spacing/count hard 규칙을 넣는 순간 정상 맵의 저장이 막히는 설계 결함.

### [중간-1] 소비자별 규칙 집행 불일치 — 같은 hard 규칙을 누구는 지키고 누구는 무시

- AI `paint_tiles`: hard adjacency를 동반 타일 확장으로 **집행**(`src/editor/tools/clusterRulePlacement.ts:33-81`, `mapTools.ts:199`)
- 수동 연필: 동일 규칙 **완전 무시**(`tileActions.ts`에 규칙 참조 없음) — 규칙이 있어도 침엽수 상단만 찍힌다
- `scatter_object`: hard는 벌점 루프에서 skip, adjacency는 벌점 0(`placementScoring.ts:14,27-29`) — hard/adjacency 규칙이 배치 선택에 영향 없음, 사후 lint에만 걸림

동일 데이터에 대해 집행/무시/사후검출 3가지 계약이 공존한다. "hard=커밋 차단"이라는 모달 경고(실측 `31-rule-proposal.png`)와 실제 편집기 동작 사이의 기대 격차가 크다.

### [중간-2] autotile 폴백이 타일셋을 가리지 않음 — 타 칩셋 인덱스 오염 경로

`autotileGroupsForTileset`은 `tileset.autotileGroups`가 없으면 **어떤 타일셋이든** combined-town 인덱스 기반 흙길/모래 그룹을 반환한다(`src/project/defaults/autotileGroups.ts:89-92`). 실측 export에서 **모든 번들 타일셋의 `autotileGroups`가 undefined**임을 확인했다(probe-log.txt `AUTOTILE-GROUPS-FIELD`). 던전/실내 칩셋에서 인덱스 421/424 부근 타일을 칠하면 의미 무관 셰이핑(390/450… 대입)이 발동한다. (코드 경로 검증; 브라우저 재현은 미수행)

### [중간-3] 물 클러스터의 문법·렌더 이중 진실

"애니메이션 물 오토타일"의 `patternGrammar`(`combinedTownGroups.ts:72-86`)는 top/left/bottom/topLeft(OUTER_CORNER 겸용)만 정의 — 우변·나머지 코너 누락. 실제 렌더는 이 문법을 읽지 않고 `isDefaultTilesetTexture && isLakeAutotileTile` 하드코딩 4분할 시스템이 처리한다(`chipsetTileRender.ts:48-49`). 실측: 물 3×3 페인트 시 데이터는 전부 120, 렌더는 가장자리+애니메이션 정상(`09-crop-water-4x.png`, 프레임 diff bbox 확인). **동작은 하지만 클러스터 정의를 고쳐도 렌더는 변하지 않는 장식 스키마**이며, 업로드 타일셋에는 이식 불가.

### [중간-4] render_group_sample 검증이 라이트 모델을 연쇄 실패시킴 (실측)

클러스터 AI 모달 실측 중 모델이 `render_group_sample`을 2회 연속 실패(`patternGrammar.kind가 올바르지 않습니다`, ai-probe-log.txt LOG-TEXT2). 원인: 도구 스키마가 `patternGrammar: {type:"object", additionalProperties:true}`로만 선언되어 유효 kind enum이 모델에 전달되지 않고(`groupSampleTool.ts:89`), 에러 메시지도 유효 값 목록을 알려주지 않는다(`groupSampleTool.ts:212`). 전/후 비교 미리보기(모달의 핵심 UX)가 이 지점에서 자주 죽을 것.

### [중간-5] 규칙 감사 패널 접근성/죽은 코드

- `installRuleAuditPanelAutoMount`(`ruleAuditPanel.ts:56-63`)는 **프로덕션 어디서도 호출되지 않는다**(호출자는 `test/ruleAuditPanel.test.ts`뿐). 실측에서도 좌측 팔레트에 `rule-audit-panel` 부재. 실제 노출은 타일 툴바 "규칙 감사" 드롭다운뿐(`rpgMakerTileToolbarMenus.ts:71-88`) — 열기 전에는 위반이 배지 숫자로만 보인다.
- 부수 적발: `EditScene`이 갱신하는 `cursor-position`/`cursor-lower`/`cursor-upper` 노드는 어떤 코드도 생성하지 않는다(`EditScene.ts:983-990`, setter는 1411-1415에서 조용히 no-op). 이 testid에 의존하는 기존 e2e 헬퍼(`test/e2e/rm2k3-map-editor.spec.ts:62`, `rpg-zzu-editor-layout.spec.ts:46-48`)는 현 빌드에서 성립 불가 — 본 리뷰도 이 때문에 좌표 캘리브레이션을 우회 구현했다.

### [낮음-1] 클러스터 카드가 문법 형상을 무시한 8열 flow

9분할 그룹이 8+1열로, 3×3 오토타일(10타일)이 8+2열로 렌더된다(`01-palette-clusters.png`). `tileGroupGridColumns`는 `sourceRect`가 있어야만 열을 맞추는데(`tilePaletteClusters.ts:109-116`) 하네스 그룹은 sourceRect가 없다. patternGrammar의 parts(topLeft…bottomRight)로 3열 배열이 가능함에도 사용하지 않는다 — 공간 구조를 보여주는 것이 클러스터 뷰의 존재 이유라는 점에서 아쉬운 불일치.

### [낮음-2] 미분류 355/480 (74%)

기본 타일셋에서 그룹+라벨로 커버되는 타일이 26%뿐(실측 `UNCATEGORIZED: 미분류 355`). 클러스터 뷰의 기본 화면 대부분이 "미분류" 접이식 더미다.

### [낮음-3] suggest_group_from_range 추론 폭 부족

3×3이면 무조건 `autotile_3x3`(벽 9분할과 구분 불가), `animated_terrain` 추론 경로 없음, 2×2 등은 `source_rect`로 뭉갬(`rangeClassifyTools.ts:158-164`). role 추론이 라벨 문자열 정규식 의존(171-179)이라 미라벨 타일셋(=미분류 74%)에서는 대부분 terrain으로 수렴.

### [낮음-4] 스탬프 브러시의 키워드 결합

`tileStampsForTile`이 그룹 이름/설명에서 "road/dirt/흙길/모래" 문자열을 찾아 스탬프를 켠다(`tileStampBrushes.ts:99-146`). 그룹 개명(예: "황톳길")만으로 기능이 꺼지는 취약한 결합이며, patternGrammar/role이라는 구조화 정보를 두고 자연어를 파싱한다.

## 2. 정상 확인 (실측)

1. 흙길 3×3 오토타일 수동 셰이핑: 2×2 페인트 → `[390,392,450,452]` 정확 (`10-crop-road-4x.png`)
2. 물 렌더: 가장자리 4분할 + 애니메이션 프레임 변화 확인 (`09-crop-water-4x.png`, 07↔08 diff)
3. 클러스터 AI 모달 end-to-end (lite=gemini-3.1-flash-lite): 킥오프 → 샘플 이미지 스테이지 렌더 → 자연어 요청 → `set_group_layout` 제안 → 수락 → 프로젝트 반영, hard 규칙 시 이중 경고(제안 배너+confirm) 정상 (`20~23`, `31~32`). 단 [중간-4] 실패 후 자가 복구에 의존했고, 3회 중 1회는 제안 없이 종료(라이트 모델 변동성, rule-lifecycle-log3).
4. `set_cluster_rule` 파라미터 검증(범위/타입/min>max 거부)과 규칙 저장, 규칙 감사 드롭다운 렌더("규칙 위반 없음" 빈 상태 포함) 동작. 유닛 테스트 11파일 50건 통과.

부수 관찰: 이전 세션의 맵 편집 락이 남아 fresh 세션이 조용히 읽기 전용이 되고 페인트가 무시됐다(`05-map-lock-readonly.png`). 리뷰 중 가장 많은 시간을 앗아간 함정으로, 페인트 무시가 토스트 한 줄뿐이라 자동화/사용자 모두 알아채기 어렵다.

## 3. 테스트 커버리지 평가

- **잘 됨**: 단위 수준은 촘촘하다 — validator 분기(`clusterRuleValidators.test.ts`), 오토타일 그룹의 adjacency/spacing 면제(`autotileClusterRules.test.ts`), scatter의 원자 배치/보호셀/결정성(`scatterObject.test.ts`), 샘플 빌더 형상(`groupSampleBuilder.test.ts`).
- **구멍 1 (통합)**: "팔레트 배지 ↔ 수동 페인트" 계약을 검증하는 테스트가 0개다. [높음-1]이 전부 통과 상태로 존재하는 이유.
- **구멍 2 (생명주기)**: `set_cluster_rule 저장 → store.load → 규칙 생존` 왕복 테스트가 없다. [높음-2]를 잡을 수 있는 유일한 형태의 테스트.
- **구멍 3 (의미론)**: 규칙 테스트가 전부 1칸 그룹이라 다중 타일 클러스터의 spacing 자기위반/count 셀-인스턴스 불일치([높음-3])가 은폐된다.
- **구멍 4 (e2e)**: 클러스터 관련 e2e가 없고, 있어도 `cursor-position` 헬퍼가 깨져 있어([중간-5]) 신뢰 불가.

## 4. 권고 우선순위

1. **단일 진실 결정** (아키텍처): patternGrammar를 "실행 가능한" 스키마로 승격하든지(수동 페인트가 vertical/nine_slice/autotile을 읽어 동반 배치·셰이핑), 아니면 배지를 "AI 전용 힌트"로 강등해 UI 약속을 없애라. 흙길의 이중 정의(patternGrammar ↔ AutotileGroup)는 한쪽을 파생물로 만들 것.
2. **하네스 재시드에 3-way 병합**: 재시드 시 기존 그룹의 `rules`/`patternGrammar`/사용자 필드를 보존(merge)하거나, 사용자 편집 시 `source:"user"` 승격 + 재시드 제외. [높음-2]와 기확정 rules 시드 수리가 함께 가야 한다.
3. **규칙 의미를 "인스턴스" 기준으로 통일**: lint가 연결 성분(또는 그룹 풋프린트) 단위로 spacing/count를 계산하도록. 수리 전까지 다중 타일 그룹에 spacing hard 규칙 생성은 AI 프롬프트에서 차단 권고.
4. paint_tiles의 hard 동반 확장을 수동 연필/scatter에도 적용(또는 최소한 페인트 직후 인라인 경고).
5. autotile 폴백에 `isCombinedTownTileset` 가드 추가 (1줄 수준).
6. `render_group_sample` 스키마에 kind enum 명시 + 에러 메시지에 유효 값 나열.
7. e2e 위생: `cursor-position` 계열 statusbar 셀 복구(또는 헬퍼 교체), 클러스터 배지-페인트 계약 e2e 1본 추가.

## 부록: 증거 파일

`evidence/cluster-review/`
- `00-initial-editor.png` 초기 에디터 / `01-palette-clusters.png` 클러스터 뷰(배지·8열 flow)
- `02,10` 흙길 셰이핑 / `03,07,08,09` 물 페인트·렌더·애니 프레임 / `11,12` 벽·나무·지붕 고아 배치
- `05-map-lock-readonly.png` 스테일 락 읽기 전용 함정
- `20~23` 클러스터 AI 모달 e2e(set_group_layout) / `31~36` 규칙 생성·경고·감사 패널
- `probe-log.txt`(팔레트/페인트 실측 원시 데이터), `ai-probe-log.txt`, `rule-lifecycle-log*.txt`

재현 요점: 팔레트 `클러스터` 탭에서 46(흰 집 벽 중앙) 선택 → 캔버스 1클릭 → 단일 칩만 배치(9분할 미동작). `260` 선택 → 1클릭 → 상단부만 배치. 흙길 421 2×2 → 셰이핑 정상.
