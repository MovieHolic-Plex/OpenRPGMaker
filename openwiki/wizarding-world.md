# 마법 학교 번들 타일셋 (wizarding_world · 해리포터풍)

해리포터풍 게임 생성에 필요한 그림 전부(고딕 성채 공용 벽·바닥·문, 12공간 기물, 학생·교수·생물 걷기 칩, 마법 효과)를
**코드 손 도트 조각**으로 그려, 독립 검수를 통과한 것만 공용 번들로 굽는다. 새 프로젝트가 처음부터 갖고, 기존 프로젝트는 로드할 때 심긴다.
슈퍼하네스 해리포터 데모(지팡이 가게·마법약 교실, PR #2269)의 승인된 native 조각 168개가 화풍 기준이자 첫 재료다.

## 식별자

| 항목 | 값 |
|---|---|
| 타일셋 id | `wizarding_world` |
| 텍스처 키 | `tex_wizarding_world` |
| 계열 | `oprn-wizard` (라벨 "마법 학교(해리포터풍)", `src/project/tilesetFamily.ts`) |
| 시트 | 16px 칸, 48열 |
| 번들 소유 접두 | 키트·오토타일·참고문서 `wz-`, 타일 그룹 `wz:` |
| 팔레트 | 해리포터 테마 42색(`wzlib.PAL`)만, 알파 0/255 |
| 캐릭터 시트 | `public/assets/generated/charsets/Wizarding<N>.png` (288×256, 8명/장, 24×32·3프레임×4방향, 행 위·오른쪽·아래·왼쪽). 자원 id `oprn-charset-wizarding<n>`, 그룹 "Wizarding" |

## 현재 굽기 (2026-10-07)

조각 699(native 168 포함) · 오토타일 6 · 움직이는 칸 101 · 키트 636 · 칸 2,508(53행) · 인물·생물 35명(`Wizarding1`~`5`) · 참고문서 17용도·문서 64·그림 97 · 장소 18곳(빌더가 지은 16판 + 빌더에 없는 장면 2: 눈 덮인 우체국 골목·숲 가장자리) · 검수 거절 0.

2026-10-07 기숙사 침실(모듈 `dorm`, 조각 9): 사주식 침대 초록(열림·닫힘 상태 묶음 `dorm-bed-green`)·붉은, 학용품 트렁크, 협탁, 옷장, 서는 거울, 초록 깔개, 초록 벽등. 빌더 변형 `shared.dorm`(기본 18×14 → 가구에 맞춰 18×12): 침대가 북벽에 머리를 대고 한 줄(사이 협탁·발치 트렁크, 30% 닫힌 커튼), 옆벽 옷장·그 곁 거울, 가운데 깔개, 벽등·뱀 깃발.

2026-10-07 사용자 지적 「바닥 색이 엉망」「벽과 바닥 구분이 안 된다(우체국 안)」「통행이 확실하냐」「공간이 너무 좁다」「조수가 실제 게임을 구현할 수 있어야」 에 따라: 성채 바닥을 어두운 청회색 판석으로 다시 그리고(벽면 106 대 바닥 68) 붉은 통로 깔개·양탄자를 더했고, 우체국 안(회벽/널마루)·시계탑(파란 격자 제거)·허니듀크 지하(어두운 판석)를 고쳤다. 모듈 예제 17장 중 통행이 한 덩이인 것은 5장뿐이었다 — 장소는 이제 빌더 결과로 게시한다.

## 공간 (wzlib.SPACES)

성채 공용(shared — 변형 corridor 복도·common 휴게실·dorm 기숙사 침실) · 부엉이 탑 · 마법약 교실 · 시계탑 · 지팡이 가게 · 도서관 · 온실 · 병동 · 허니듀크 지하 창고 · 호그스미드 우체국(눈 마을) ·
금지된 숲 길·마차 · 검은 호수 보트 창고 · 퀴디치 경기장. 모든 실내 예제는 `castle_kit` 의 공용 id(`CONTRACT.md` 4절: 북벽 1×4, 서·동 1×1, 남벽 1×2, 문 3상태, 계단, 포석 오토타일)를 쓴다.

## 파일

| 경로 | 역할 |
|---|---|
| `scripts/content/wizarding/CONTRACT.md` | 화풍 규칙·등록 API·자기 검사 루프·공용 id 표. **조각을 그리기 전에 읽는다** |
| `scripts/content/wizarding/wzlib.py` | 42색 램프 `K(재질,단)`, 캔버스 `Cv`, 등록 `REG`, 블롭 47종 합성, 검사, 검수 시트 |
| `scripts/content/wizarding/pieces/<모듈>.py` | 조각 모듈(18개 + native). `_` 로 시작하는 파일은 모듈 도우미(굽기에서 제외, 불러오기 경로에는 있다) |
| `scripts/content/wizarding/orders/*.md` | 모듈별 작업 주문·공통 읽기 예산(`common.md`)·검수자 규약(`review.md`) |
| `tiledata/wizarding/review/<모듈>.judgments.json` → `.verdict.json` | 독립 검수 판정 → `seal_verdict.py` 가 조각 해시에 봉인 |
| `tiledata/wizarding/pins.json` | 자리 키 핀(덧붙이기 전용 칸 번호) |
| `tiledata/wizarding/bake-report.json` | 채택·거절 목록(거절 이유 포함) |
| `src/assets/wizardingWorldTileset.json` · `wizardingWorldSheet.json` · `public/assets/wizarding-world/wizarding-world-chipset.png` | 굽기 산출물(손 편집 금지) |
| `src/assets/wizardingWorldReferences.json` + `public/assets/wizarding-world-references/*.png` | AI 참고문서(이미지 바이트 없음) |
| `src/assets/wizardingCharsets.json` · `wizardingCharsets.ts` | 캐릭터 시트 목록·외형 의미(조수가 외형으로 고른다) |
| `src/project/defaults/wizardingWorld.ts` | `createWizardingWorldTileset` · `ensureWizardingWorldTileset` · `ensureWizardingWorldReferences` (jpCity.ts 와 같은 갱신 규칙: `wz-` 항목만 번들 소유, 저자 항목 보존) |
| `src/project/wizardingPlaceReferences.ts` + `src/project/regionReferences/wz-*.json` + `public/assets/region-references/wz-*` | 「장소」 완성 예제(공간별) |

배선: `bundled.ts`(항목·칸 수), `bundledChipsetGeometry.ts`(열 수), `defaultAssets.ts`(`ensureBundledTilesets`·`bundledEasyRpgTilesetBase`), `tilesetFamily.ts`,
`tilesetHarness/combinedTown.ts`(제외), 캐릭터는 `charsetCatalog.ts`·`generatedAssetResourceResolver.ts`·`resourceReferenceValidation.ts`·`charsetSemantics.ts`,
장소는 `regionReferences.ts`·`regionReferenceSnapshots.ts`, 테스트 `test/bundledTilesetIdParity.test.ts`.

## 굽기 순서 (한 번에)

```bash
python3 scripts/content/wizarding/bake_wz.py            # 검수 PASS·해시 일치 조각만 → 시트·정의·키트·애니메이션·캐릭터 시트 (--dry 로 모듈별 채택 수만)
python3 scripts/content/wizarding/bake_refs_wz.py       # 참고문서 (wz-start · wz-space-<공간> · wz-characters · wz-effects · wz-check)
npx tsx --tsconfig tsconfig.app.json scripts/content/wizarding/export_spaces.ts   # 실제 build_wizarding_space 경로로 15판×시드 1~3 짓기·통행 한 덩이 확인 → tiledata/wizarding/spaces/*.json
python3 scripts/content/wizarding/render_spaces.py --mark  # 그림 + 독립 통행 검사(4층 모두 통행이어야 걷는 칸), 갇힌 칸은 /tmp/wzspaces 에 빨강
python3 scripts/content/wizarding/publish_places_wz.py  # 빌더 공간 + KEEP_EXAMPLES(거리·숲 가장자리) → 장소. 통행이 갈린 것(WZ-ISLAND)은 게시하지 않고 옛 wz- 게시물은 지운다
python3 scripts/content/wizarding/viz_wz.py             # ~/claude-viz/wizarding-world.html (사용자 확인 페이지)
```

## 검수 흐름

1. 작업자(서브에이전트)가 모듈을 그리고 `pieces/<모듈>.py` 실행으로 기계 검사 0 + 시트를 직접 보고 메모.
2. 독립 검수자가 `orders/review.md` 기준으로 판정 → `seal_verdict.py <모듈>`. **판정 이유 문장이 그대로면 옛 해시를 유지**하므로, 판정 뒤 그림이 바뀐 PASS 조각은 굽기에서 빠진다.
3. FAIL 은 수정 작업자가 그 id 만 고친다(PASS 조각 해시 불변 확인).
4. 재검수는 얇게: `recheck_sheet.py <모듈>` 이 지난 FAIL id 만 한 장(`review/<모듈>-recheck.png`)으로 그리고, 재검수자는 그 한 장과 옛 FAIL 이유만 보고 판정을 고쳐 봉인한다
   (2026-10-07 사용자: 검수가 너무 무거워 토큰이 바닥 — 한 바퀴 이후로는 이 얇은 확인만, 그래도 FAIL 이면 그 조각은 빠진다).
5. 사용자는 `http://mdc-server:18301/wizarding-world.html` 한 장에서 싫은 것을 짚는다. 고친 조각은 다시 판정·봉인 후 굽는다.

## 조수 공간 빌더

조수가 이 칩셋으로 **실제 게임 맵**(방·야외 한 장)을 만드는 길은 `build_wizarding_space` 한 번이다. 키트를 하나씩 찍는 것(`stamp_object`)이나
공간 예제(12×9 안팎, 걸을 수 있는 칸이 갈린 것이 있다)를 가져오는 것은 이 길을 대신하지 않는다.

| 경로 | 역할 |
|---|---|
| `scripts/content/wizarding/space_recipes.py` → `src/assets/wizardingSpaceSpec.json` | 13공간(`wzlib.SPACES`) 레시피: 크기(최소·기본·최대), 바닥(1×1 조각 또는 오토타일 + 섞기), 러너, 벽 묶음, 문 조각, 가구 목록, 덧그림, NPC 걷기 칩 추천. 굽기 정의에 없는 id 는 경고하고 뺀다(굽고 다시 돌린다) |
| `src/editor/wizarding/builder.ts` | 순수 조립기 `buildWizardingSpace(input, tileset, spec)` |
| `src/editor/tools/wizardingSpaceTools.ts` | `list_wizarding_spaces`(읽기) · `build_wizarding_space`(쓰기) |

- **레이아웃 세 가지.** `room`(실내 + 퀴디치 경기장): 벽 묶음 고리(북 1×4 리듬·서/동 세로 반복·남 1×2, 모서리 없으면 n/s), 북쪽 문 = 묶음의 열린 문 키트(2칸이 없으면 1칸 둘),
  남쪽 문 = `doorS`(성채 `wz-castle-door-s`) 또는 벽 틈, 동·서 문 = 벽 틈. `forest`(마차 승차장): 숲 바닥 + 가운데 흙 공터(`wz-nat-dirt` 오토타일) + 문마다 길, 테두리 나무.
  `lake`(보트 창고): 위 자갈 땅 · 물가 한 줄 · 얕은 물 두 줄 · 깊은 물, 보트 창고 + 진수대, 부두(남쪽 문은 맵 끝까지 이어지는 부두).
- **층.** 1층 바닥·물·F/X 조각, 2층 밟는 덧그림(러너·깔개·얼룩), 3층 벽·가구, 4층 벽에 건 물건(`wallTop` 0~3)·탁상 소품(`with` 짝).
  벽에 거는 가구는 벽 칸 위 4층에 그려 통행은 벽이 정한다. 아래층만 있는 칸(계단 등)을 벽 줄에 찍으면 그 칸의 벽을 걷어낸다.
- **통행.** 가구 후보마다 엔진 규칙 `passabilityOf`(위층부터 ★ 건너뛰기)로 주 출입구 안쪽 칸에서 BFS 한다. 조각이 덮지 않은 걸을 칸이 갈리거나,
  출입구 접근칸(문 칸 + 안쪽 두 줄)·러너를 덮거나, 앞서 놓은 가구의 앞 칸(벽 쪽 가구는 옆 칸)이 끊기면 그 후보를 버린다.
  마지막 불변식: 걸을 칸 한 덩이, 모든 `doorCells`·`spawn` 이 그 안. 조각 안에만 갇힌 ★ 칸(벽에 건 서가 윗줄)은 `pockets` 로만 센다.
- **바닥·벽 밝기 관문.** `space_recipes.py` 는 실내 공간(변형 포함)마다 바닥(1×1 조각·오토타일 255 칸·섞는 타일)과 북벽 벽면(n 키트 둘째 줄부터)의
  평균 밝기를 표로 찍고, 차가 35 미만이면 사양을 쓰지 않고 멈춘다. 사용자 지적 「벽과 바닥이 구분 안 된다」의 대응이다.
  그래서 휴게실·마법약·도서관·온실·부엉이 탑은 어두운 슬레이트 `wz-castle-floor-flag`, 병동은 `wz-castle-floor-oak` 를 쓰고,
  부엉이 탑은 밝은 부엉이 벽 대신 성채 석벽 + 부엉이 창 리듬(벽 묶음 `owlcastle`)이다. 공간 고유 바닥은 관문을 넘을 때만 쓴다.
- **흩뿌리기 금지 · 배치 방식.** `grid` = 큰 가구(연회 탁자·병상·서가·약 솥·온실 작업대·횃대)를 가운데 통로(러너)를 두고 좌우 대칭 열로,
  위에서부터 줄 단위로 채운다(쌍은 좌우가 같이 들어가야 하고 `alt` 로 일부를 다른 그림으로, `rowsFrom:"north"` 는 벽에 붙여 시작).
  `beside` = `near` 키트 옆에 2~4개 덩이(화분은 작업대 옆, 물그릇은 횃대 옆, 자루는 우편함 옆). `edge` = 벽에 붙은 2~4개 덩이.
  덧그림도 `near` 가 있으면 그 키트 곁에만 덩이로(배설물·깃털은 횃대, 얼룩은 솥, 고사리는 숲 나무, 노는 보트 창고).
  홀로 선 1×1(`free`/`center`)은 방마다 2개까지. grid 는 자리가 모자라도 한 줄이라도 들어가면 경고하지 않는다.
- **방 구조(2026-10-07 「방 구조가 허접」 대응).**
  - 남벽은 윗면(천장 끝) 한 줄만(`capSouth` → `southRows` 1): 3/4 시점에서 방 남벽의 정면·창은 보이지 않는다. 아래에 창 달린 벽 정면이 있으면 건물 단면처럼 보였다. 이때 남쪽 문은 바닥 틈이다. 온실(낮은 벽돌 담)·우체국(징두리)·경기장(울타리)은 그대로.
  - **줄이기:** 실내에서 `height` 를 주지 않으면, 줄 배치 가구(grid·center·free)가 끝나는 줄 아래로 통로 3줄만 남기고 남벽을 당겨 한 번 더 짓는다. 가구 수는 처음 넓이로 센다(줄면 개수가 줄고 또 줄어드는 되먹임 방지). 「공간이 남으면 그건 공간이 너무 큰 것」.
  - grid 는 `gapX`·`gapY` 를 따로 받는다 — 도서관 서가는 `gapX 0` 으로 이어 붙은 책장 줄(통로 1줄)이 되고, 그 밑에 열람 탁자 grid 가 이어진다(grid 줄은 위에서 한 칸씩 내려가며 들어가는 첫 줄을 찾는다).
  - `vary`: 덩이마다 탁상 소품 묶음 하나를 고른다(연회 탁자·열람 탁자) — 모든 탁자에 같은 소품이 찍히던 것.
  - 약 솥 6~8, 병상은 북벽 한 줄(4~6), 기본 크기 축소(시계탑 18×15·과자점 지하 18×14·휴게실 20×14, 도서관은 탁자 자리 때문에 24×20 → 줄여서 24×19).
- **결정론.** 같은 `seed`·인자 = 같은 맵. `density` sparse/normal/full 이 레시피 `count` 사이 값을 고르고 넓이로 늘린다. 레시피 최소에 못 미치면 경고 `FURNITURE_SHORT`.
- **맵 대상.** `mapId` 가 빈 맵이면 칩셋을 바꿔 그 맵에, 그린 맵이면 `overwrite:true` 필요. `mapId` 없으면 `create_map` 도구 경로로 새 맵(맵 트리·BGM·시작 맵).
  오류(`WIZARDING_ISSUE_CODES`)가 하나라도 있으면 맵을 만들거나 바꾸지 않는다. 칩셋 계열 검사는 실행기(`toolRunner`)가 한다.
- **배선.** `toolRegistry.ts`(tile) · `capabilityEscalation.ts`(짝 승격) · `toolCapabilityIndex.ts`(레시피 `wizarding`) · `workItemOutcome.ts`(맵 만드는 도구) ·
  `proposalCompleteness.ts`(실내 도구) · `intentDeclaration.ts`(의도 도구) · `scripts/lib/piTeamRuntime.ts`(첫 장소 도구) · `docs/tool-catalog.md` · 스킬 `interior-room-authoring` 9번.
- **확인(2026-10-07).** 13공간 + shared 변형 2(corridor·common) × 시드 1~3, 기본 크기·auto 가구: 전부 한 덩이·출입구 도달·오류 0(엔진 `passabilityOf` 로 따로 BFS).
  밝기 관문 최소 차 37.7(성채 슬레이트 바닥 68.5 대 성채 벽 106.3).
  레시피를 고치면 `space_recipes.py` 를 다시 돌리고 같은 검사를 한다.

## 통행 관문 WZ-ISLAND

`bake_refs_wz.py` 의 구조 검사와 `publish_places_wz.py` 는 걸을 수 있는 칸(모든 층이 통행)을 4방향 덩이로 세어, 가장 큰 덩이 밖의 칸을 `WZ-ISLAND`(갇힌 주머니)로 본다.
장소 게시는 이것이 0 이어야 한다. 실측: 예전 모듈 예제 17장 중 12장이 걸렸다(병동 18칸이 7덩이, 도서관·온실·부엉이 탑 등).

## 조수 실경로 시험 (qa:game, 기획 `scripts/qa-game/briefs/wizarding-school.json`)

| 판 | 걸린 시간 | 도구 호출 | 맵 | 결과 |
|---|---|---|---|---|
| 빌더 전(`qa-runs/wz-base`) | 1303s | 253 | 16×16~20×16 5장 | 낱칸 칠하기, 시작 칸 막힘·참고문서 거부 반복, 부엉이 탑 벽이 무너짐. 엔딩 도달 |
| 빌더 1판(`wz-builder`) | 521s | 95 | 24×17~30×22 5장 | 연회 탁자·약 솥·서가가 열로, 전부 도달. 엔딩 도달. 시작 맵 재건축이 시작 칸을 막아 커밋 거부 1회, NPC 는 EasyRPG 칩 |
| 빌더 2판(`wz-builder2`) | 347s | 75 | 같음 | NPC 전원 Wizarding 칩. 교수를 1칸 문 바로 앞에 세워 자동 플레이 막힘(blocker 1) |
| 빌더 3판(`wz-builder3`, 아래 수정 뒤) | 428s | 80 | 12×24~30×22 5장 | blocker 0, 자동 플레이 엔딩 도달, NPC 8명 전원 Wizarding 칩, 문 앞 막힘 없음 |

고친 것: 시작 맵을 다시 지으면 시작 칸을 spawn 으로 옮긴다 · Wizarding 인물 검색어(마법약 교수·호그와트 학생·부엉이 관리인·간호사…, `wizardingCharsets.ts` `wizardingTags`) ·
결과에 `keepClear`(문 앞 두 칸)와 「비워 둘 것」 문장 · 헤드리스 칩 미리보기가 못 읽는 시트 하나로 전체 실패하던 것(`scripts/qa-game/render.mts`).

## 스토어 공개본

- 공식 팩 「마법 학교 — 고딕 성채·교실·숲·호수」(운영 판본 5). 원작 이름은 `WIZARDING_SCRUB` 로 바꿔 싣는다(그리핀도르→붉은 사자 기숙사 등, 영문 id 는 그대로). 캐릭터 35칸 설명이 `content.characters` 로 같이 가서 스토어로 넣은 프로젝트에서도 조수가 생김새로 고른다.
- 스토어 사본 타일셋은 id 가 `store_…` 로 바뀌므로 `build_wizarding_space` 는 못 쓴다 — 편집기에는 번들이 기본으로 있으므로 그쪽을 쓴다.

## 한계

- 탈것(마차·보트·세스트랄)은 프로젝트 데이터로 갈아탈 수 없어 정적 키트다. 큰 생물은 캐릭터 시트(24×32 고정)로 못 넣는다.
- 움직이는 칸은 `animationStrips`(baseTile + 가로 연속 프레임). 장소 스냅숏에는 baseTile 만 칠해져 있다.
- 장소 예제에는 이벤트(사람)가 없다. 사람은 Wizarding 시트로 이벤트를 따로 둔다.
