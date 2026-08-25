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
- **얇은 런(폭/높이 1칸)은 12칸에 전용 타일이 없다** — 렌더 시 8×8 쿼터 합성으로 해결: 가로 런 = N변 윗절반+S변 아랫절반, 세로 런 = W변 왼절반+E변 오른절반, 끝 캡 = 코너 열 절반+변 열 절반. `terrainQuarterAutotile.ts` 의 킷이 내장 그룹 11종 전체를 커버한다(2026-07-17 확장, 원래 모래·흙길 전용이었음). 저장 타일은 변/코너 그대로고 합성은 렌더 전용. 외딴 아트는 통짜 렌더 유지.
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
- **던전 칩셋의 물도 같은 시스템이다** (`easyrpg-chipset-dungeon`, `chipsetAnimation.ts`). 어두운 못·지하수를 깔 때 참고:
  - `120/150/180/210` = 깊은 물, 각각 가로 3프레임 3fps. 통행 `x`. 실측 rgb(8,69,146).
  - `0/30/60/90` = 동굴 물웅덩이(흙 기슭), `3/33/63/93` = 석조 수로.
  - `125/155/185/215` 는 **블록이 아니라 폭포 세로 4프레임 루프**(`WATERFALL_VERTICAL_STRIPS`)다. 세로 4칸 기둥으로 오해해 쌓으면 상자 네 개가 포개진 그림이 된다.
  - 물 구역에는 9슬라이스 블록이 없다(`dungeonTerrainBlockRoles()` 에 물 블록이 없다). 물가 선은 **물을 통짜로 깔고 둘러싼 눈·흙 쪽 9슬라이스 테두리**가 그린다.
  - `427`(`푸른 발광 심연`)은 물이 아니다 — 몸통 픽셀이 순검정(`#000000`)이라 호수가 아니라 나락으로 읽힌다. 어두운 수면이 필요하면 깊은 물 120 을 쓴다.
  - `313` 은 얼음판이 아니라 **눈밭(설원 블롭) 몸통**이다. 물 위에 뜬 얼음판은 얼음판 블록(몸통 `70`)으로 깐다.
  - 실측 근거: `src/project/defaults/iceGrandPlain64.ts` (얼음 대평원 64×64 의 못·부빙), 검사 `test/iceGrandPlain64.test.ts`.

## 3-1. 던전 칩셋 절벽(빙암) — 벽은 두 행이다

얼음/설산 절벽을 쌓을 때 반드시 지킬 실측 사실. 정본은 사용자 저작 맵
`rpg-zzu-dungeon-theme-gallery / map_g_ice_grand` 이고, 아래 수치는 칩셋 픽셀 직독 + 그 맵 전수 감사 결과다.

- **절벽 한 겹의 벽은 `373 ↓ 403` 두 행이다.** 373 과 403 은 행 0~13 이 224/224 픽셀(RGBA 전 채널) 동일한
  **같은 벽 그림**이고, 403 만 행 14~15 에 밑동 하이라이트를 얹었다. 이음 불일치 23.
- **285/315 를 절벽 몸통으로 쓰지 말 것.** 의미표 이름이 `푸른 광석 암반`이고 평균 밝기 42 로 벽면보다 30% 어둡다.
  373/403 사이에 끼우면 벽 가운데가 어두운 띠로 끊긴다(`285 ↓ 403` = 40 · `285 → 375` = 77).
  정본 맵의 285 사용 횟수는 **0** 이다(373 = 52회, 403 = 50회, 285 세로 스택 = 0회).
- **대각 빙벽 캡·밑동은 방향이 있는 조각이다.** 벽이 붙는 쪽이 반대면 이음이 통째로 깨진다:
  `373 → 286` = 37 인데 `286 → 373` = **161**, `287 → 373` = 32 인데 `373 → 287` = **145**,
  `346 → 403` = 8 인데 `403 → 346` = **156**, `347 → 67` = 21 인데 `347 → 403` = **172**.
  몸통 316/317 은 방향이 없다(`316 ↔ 373` = 0/27). 그래서 대각 열의 세로 자리는 **면(face)별로** 달라야 한다 —
  왼쪽 면은 한 행 올려 몸통을 벽 상단 행에 두고, 오른쪽 면은 캡을 벽 상단 행에 둔다.
- **대각 밑동 아래 행은 눈이어야 한다.** 정본 검증기의 `*-base-needs-snow-support` 와 픽셀(`346 ↓ 67` = 9)이 같은 결론이다.
  즉 겹은 3행을 잡지만 벽인 것은 위 두 행이고 세 번째 행은 눈 바닥이다.
- **계단 375·376·377 은 가로 3칸 한 벌**이다(`375 → 376` = 8). 세로 자기 반복은 84~90 이지만 그것은 발판 단차의
  윤곽이고 **정본 맵도 `376 ↓ 376` 을 16칸 쓴다** — 결함이 아니다. 다만 계단 측면에 285 를 붙이면 깨진다(70·77).
- **절벽 상단 바로 위 행은 343 이 맞다(평지 립).** 절벽 위가 평지로 읽히려면 위 대지의 바닥 행을 343 으로 깐다:
  `97(눈 9슬라이스 남변) ↓ 373` = **173** 인데 `343 ↓ 373` = **38** · `343 ↓ 374` = 30 · `343 ↓ 372` = 42 이다.
  위에서 343 으로 들어오는 이음도 `67 ↓ 343` = 2 로 좁다. **단 대각 캡 위에는 놓지 않는다**
  (`343 ↓ 286` = 168 · `343 ↓ 287` = 162). 절벽 칸 **자신**을 343 으로 바꾸면 통행 `o` 라 구멍이 뚫린다 —
  립은 절벽이 아니라 위 대지의 바닥이다(`CLIFF_LIP` vs `FORBIDDEN_CLIFF_LIP` 둘 다 343 이며 자리가 다를 뿐이다).
- **여러 칸을 잡는 소품은 발자국 통째로 놓는다.** 의미표가 발자국을 이름에 적어 둔다:
  `261/291` = `회색 바위 첨탑(1×2)` · `320/321/350/351` = `대형 수정 군집(2×2)`.
  1×1 타일 풀로 흩으면 종유석이 한 칸만 놓이는 조각 배치가 된다. `315` 는 소품이 아니다(role = wall).
- **이 맵에는 물을 놓지 않는다.** `427` 은 순검정이라 나락으로 읽히고, 깊은 물 `120` 으로 바꿔도
  얼음 대평원에 맞지 않다는 판정을 받았다. 남쪽 대평원은 눈밭 + 얼음 바닥 패치다(`BANNED_WATER_TILES` 가 부재를 고정).
- 구현·검사: `src/project/defaults/iceGrandPlain64.ts` (`CLIFF_HEIGHT` = 3 · `CLIFF_WALL_ROWS` = 2 ·
  `MEASURED_CLIFF_FACTS` · `CLIFF_ORE_ROCK` · `CLIFF_LIP` · `FLOOR_PROP_SHAPES` · `BANNED_WATER_TILES`),
  `test/iceGrandPlain64.test.ts`, e2e `test/e2e/ice-plain-64-wall-look.spec.ts`.
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
- 저장된 합본 마을 맵의 변형 정합: `src/project/combinedTownAutotileAudit.ts` + `npm run audit:combined-town-autotiles`. 기본 명령은 읽기 전용이며, 멤버 셀마다 `autotileNeighborMask`/`autotileVariantForMask` 로 기대 변형을 계산한다. 호수 쿼터와 잔디 240은 제외. `--write --confirm-write=combined-town-autotiles` 만 변경된 행을 `saveProjectToSupabase` 로 저장하고 재로드 해시를 증명한다. 회귀는 `test/combinedTownAutotileAudit.test.ts`.
