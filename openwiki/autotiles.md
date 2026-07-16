# Autotiles (지형 자동 성형)

combined_town 칩셋의 지형 오토타일 정본 가이드. 붓·`fill_region`·`lay_path`·마을 하네스(`src/editor/tools/village/`)·DB 타일셋 위저드가 전부 이 체계 위에서 동작한다. **기계 정본은 코드다** — 이 문서는 개념·카탈로그·포인터를 제공하고, 수치가 갈리면 코드와 `test/builtinAutotileGroups.test.ts` 가 이긴다.

## 1. RM2K식 3×4 템플릿 블록 문법

지형 하나 = 시트 위 **3열×4행 블록**. 앵커(블록 좌상단 인덱스) `T` 와 행폭 `R=30` 으로 11개 역할이 결정된다:

```
T열:    [외딴 점 T]   [(미사용 변형)]  [오목 코너 T+2]
T+R:    [NW T+30]     [N T+31]        [NE T+32]
T+2R:   [W T+60]      [몸통 T+61]     [E T+62]
T+3R:   [SW T+90]     [S T+91]        [SE T+92]
```

- **외딴 점**: 사방이 비연결일 때. **오목 코너**: 4방향 직교가 모두 연결인데 대각이 빠질 때(정본 RM2K는 8×8 쿼터 4장 합성 — 우리 엔진은 통짜 근사, `RESOURCE_SLICING` 의 subcell 8×8 이 그 흔적).
- 공식 구현: `templateBlockFromAnchor()` (`src/project/defaults/autotileGroups.ts`) ↔ 위저드 `buildTemplateGroup("rm2k-3x4")` (`src/editor/panels/tilesetAutotileTemplates.ts`) — 두 구현은 테스트로 상호 대조된다.
- 변형 출력은 `AutotileGroup.variantMap` (8비트 이웃 비트마스크 N=1·E=2·S=4·W=8·NE=16·SE=32·SW=64·NW=128 → 256키, `buildEdgeCornerInnerVariantMap`).

## 2. 지형 앵커 카탈로그 — 4행 밴드 × 열 0/3/6/9 격자

시트(480칩, 30열×16행)의 지형 블록은 규칙적인 격자다. 정본 상수: `TERRAIN_TEMPLATE_ANCHORS` (`autotileGroups.ts`).

| 밴드(행) | 열 0 | 열 3 | 열 6 | 열 9 |
|---|---|---|---|---|
| 0~3 | 0 호수 물가 (물·쿼터) | 3 석축 수로 (애니 스트립) | 6 눈 `builtin_snow` | 9 짙은 수풀 `builtin_undergrowth` |
| 4~7 | 120 물 몸통 (물·쿼터) | 123 폭포 (물·애니) | 126 경작지 `builtin_farmland` | 129 포석 `builtin_cobble` |
| 8~11 | 240 잔디 — **기본 바닥, 승격 금지** | 243 키큰 풀 `builtin_tall_grass` | 246 석축 단(석판) `builtin_stone_court` | 249 석축 단(자갈) `builtin_gravel_court` |
| 12~15 | 360 흙길 `builtin_dirt_road` | 363 모래 `builtin_sand` | 366 어둠(석축 테) `builtin_darkness` | 369 어둠(짙은 테) `builtin_darkness_deep` |

주의 사항:

- **240 잔디는 절대 오토타일 그룹으로 승격하지 말 것.** `TILE.GRASS = 240` — 맵 기본 바닥 그 자체라 그룹 멤버로 만들면 전 맵이 성형 대상이 된다. 잔디는 `grass-autotile` 문법 그룹(combinedTownGroups.ts) 전담.
- 273/333 은 잔디가 아니라 **키큰 풀(243 블록)의 NW/SW 모서리**다 (2026-07-17 오분류 교정).
- 246/249(석축 단)·366/369(어둠)는 **통행 불가** — 각각 `stoneWall`·`darkWallBody` 분류(chipsetMapping.ts `isSolidChipsetTile`)를 유지한다. 성곽 성벽 밴드·던전 어둠 둘레 그리기용.
- 밴드 윗줄 가운데 칸(T+1: 361·364·244 등)은 그룹 비소속 낱개 변형 타일.
- **밴 타일**: 411·412·413·443 (용도 미확정, `BANNED_STONE_TILES`).

## 3. 물 계열 — 오토타일 그룹이 아닌 별도 시스템

| 대상 | 시스템 | 코드 |
|---|---|---|
| 호수(0~2열 전체) | 8×8 쿼터 합성 + 3fps 애니 | `lakeAutotile.ts`, `chipsetAnimation.ts` |
| 폭포(3~5열 4~7행, 기준 93·123·153·183·213) | 통타일 3프레임 애니 | `chipsetAnimation.ts` |
| 석축 수로(3~5열 0~2행, 기준 3·33·63) | 통타일 3프레임 애니 (2026-07-17 배선) | `chipsetAnimation.ts` |

- 애니 규약: 기준 타일 `T` 부터 가로 3프레임(T, T+1, T+2), FPS 3. `ANIMATED_WATER_BASE_TILES` 에 기준 타일을 추가하면 프레임 타일들이 자동으로 물 분류(통행 불가·모래 connect 대상)에 편입된다.
- 커스텀 타일셋의 물 애니는 `TilesetDef.animationStrips` 데이터 모델 사용(렌더 연동은 진행 중 — `chipsetTileRender.ts:170`·`playSceneMapRuntime.ts:257` 의 `isDefaultTilesetTexture` 가드 교체 예정).

## 4. 오토타일 등록 경로 3가지

1. **내장 승격** — `DEFAULT_AUTOTILE_GROUPS` (`autotileGroups.ts`) 에 `templateBlockGroup(id, name, anchor)` 한 줄. 마을 하네스 등 코드가 의존할 지형은 이 경로. 의미 라벨(`tileSemanticsCombinedTown.ts`)과 통행성(`chipsetMapping.ts`)도 함께 배선할 것.
2. **DB 위저드** — DB→타일셋→구성→"템플릿에서 만들기": RM2K 3×4 / 3×3 / 3×2 / 애니메이션 물, 앵커 번호 하나로 생성. 커스텀 타일셋의 유일한 경로이자 사용자용.
3. **API** — `addAutotileGroupFromTemplate` (`tilesetActions.ts`). 첫 커스텀 그룹 추가 시 내장 그룹 전체가 tileset 에 승계된다(내장 흙길/모래가 죽는 회귀 방지 규약 — 절대 생략 금지).

등록만 하면 붓(`shapeTerrainAfterLowerEdit`)·`fill_region`(vocab 겹침 최대 그룹)·`lay_path` 가 자동으로 성형한다. 추가 배선 불필요.

## 5. 검증

- `test/builtinAutotileGroups.test.ts` — 앵커 카탈로그↔그룹 등록 대조, 내장 그룹 멤버 상호 배타, 위저드 공식 상호 대조, 수로 애니·물 분류.
- `test/autotileTemplates.test.ts` — 위저드 순수 계산 + 내장 폴백 승계.
- `test/villageBuilder.test.ts` — 포석 돌길 성형·길 침범 훅.
- 실물 확인은 Playwright(`.claude/skills/verify` 레시피): 물/지형을 깔고 캔버스 스크린샷.
