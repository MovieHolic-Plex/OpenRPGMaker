# 높이 지형(relief) — 편집기·런타임 지도 (2026-10-01 통합)

`map.relief`(단·경사로·벽면 장식·양식)를 **한 렌더러**(`src/project/relief/render.ts`)가 그리고, 편집기(`EditScene`)와 게임(`PlayScene`)이
같은 들림 표(`screen.ts`)로 타일·캐릭터를 올린다. 저장 필드 모양과 렌더러 r2/r3 변경 이력은 [runtime-project-schema.md](runtime-project-schema.md) 「높이 지형」,
편집기 붓 경로는 [editor-pre-edit-routing.md](editor-pre-edit-routing.md) 「높이 붓」, 조수 도구는 [editor-ai-tools.md](editor-ai-tools.md) 「절벽 높이 도구」.

이 페이지는 **로컬 브랜치 `agent/r3-relief-stairs` 의 엔진·편집기·도구·테스트를 main 위로 통합**한 결과의 지도다. 바이옴 시트·콘텐츠 맵은 가져오지 않았다(맨 아래).

## 파일 지도

| 층 | 파일 | 하는 일 |
|---|---|---|
| 데이터 | `relief/types.ts` | `ReliefData{levels, ramps?, wallDecor?, style?}`, 격자 변환 |
| 편집 | `relief/edit.ts` | `normalizeRelief`(불러오기·0~9 경사로), `resizeRelief`, `brushRelief`(main 의 8방식), `carryReliefExtras`(조수 도구가 경사로·장식·양식을 잇는다) |
| 걷기 | `relief/walk.ts` | `reliefAllowsStep`(단 차·경사로 축·옆구리), `reliefSlopes`(경사로 덩어리 → 렌더 사각형), `reliefBridgeMask`, `hasRelief` |
| 들림 | `relief/screen.ts` | `reliefLiftField`/`cellLift`/`pointLift`(단 → 칸 들림, relief 객체당 한 번 계산), `reliefPaintsCell`, `reliefRenderOptions`, `reliefSignature`, `reliefRowStrips`(줄 띠 자르기), `reliefTileSlotChangedCells`(편집기 부분 갱신) |
| 그림 | `relief/render.ts` · `styles.ts` · `rampArt.json` | 절벽·경사로·계단·다리 판 그리기, 양식(`RELIEF_STYLES`, 칩셋 id → 양식 `reliefStyleForTileset`), 경사로 도트 |
| 띠 텍스처 | `player/reliefStrips.ts` | 그림을 줄마다 윗면(under)·벽(over) 띠로 잘라 페이지 텍스처 몇 장에 쌓는다. 편집기는 `reuseKeys` 로 같은 크기 캔버스를 고쳐 쓴다 |
| 런타임 | `player/playSceneRelief.ts` | 띠·벽면 장식 배치, depth 규칙, 캐릭터 들림(`installReliefSpriteLift`), 카메라 위 확장(`reliefTopOverhangPx`) |
| 런타임 연결 | `playSceneMapRuntime.ts` | `renderTiles` 가 `renderReliefLayer` 를 먼저 부르고, `placeMapTileImage`·`renderShadow` 가 들린 칸 타일을 올린다. 타일 서명(`reliefSignature`)에 relief 가 들어간다 |
| 편집기 연결 | `EditScene.ts` · `editSceneRender.ts` · `editSceneEventMarkers.ts` | 절벽 컨테이너(`reliefLayer`)에 띠와 들린 하층 타일을 줄 depth 로 섞는다. 이벤트 그림은 이벤트 레이어에서만, 들림만큼 올린다 |
| 통행 | `project/collision.ts` | `canMove` 마지막 조건 `reliefAllowsStep` (→ `canMoveFootprint`·도달성·NPC 길찾기가 모두 이걸 지난다) |
| 크기 변경 | `project/mapLayers.ts` | 복제·`remapExtraLayers` 가 `ramps`·`wallDecor`·`style` 을 같이 옮긴다 |

## depth 규칙(런타임, `playSceneRelief.ts` 머리말)

맵 줄 Y 의 모든 것은 그 줄에 발을 둔 same 캐릭터 바로 밑에 모인다:
윗면 띠(-0.5) < 들린 하층 타일(-0.4) < 들린 그림자(-0.38) < 들린 ○ 상층(-0.35) < 벽 띠(-0.3) < 벽면 장식(-0.29) < 캐릭터(0).
그래서 줄 Y 의 절벽은 북쪽 줄 캐릭터를 가리고 남쪽 줄 캐릭터에게는 가려진다. ★ 수관(`alwaysAbove`)과 솔리드 × 상층은 제자리(컨테이너·원래 depth).
편집기는 같은 순서를 `Y × EDIT_RELIEF_ROW_DEPTH(10) + 줄 안 순서(윗면 0 < 타일 1~3 < 벽 7 < 장식 8)` 로 쓴다.

캐릭터 들림은 **그리는 프레임에만** 얹는다(`postupdate` 에서 올리고 `render` 에서 되돌림). `sprite.y` 는 접지선이라 depth·`Math.floor(y/칸)` 역산·트윈이 그대로 맞는다.
말풍선·이모트·위치 칩은 `spriteReliefLiftPx` 만큼 올려 머리 위에 붙인다.

## 편집기 성능 계약 (main 의 높이 붓 렉 수정을 지킨다)

- 높이 붓은 포인터 표본마다 `{relief:true}` 를 낸다 → `editSceneRenderPlan` 이 `kind:"relief"` → `scheduleReliefRender`(굽기 비용의 2배 간격 스로틀).
- 스로틀 한 번의 일: ① `syncReliefLiftedTiles` — 이전 relief 와 지금 relief 를 비교해 **들림이 바뀐 칸만**(`reliefTileSlotChangedCells`) `redrawCells` 로 다시 올린다(맵 전체 `redraw()` 를 하지 않는다. 증분 렌더를 못 쓰는 상태면 전체 재그림으로 물러난다). ② `renderReliefLayer` — 띠 재굽기(키: relief 서명).
- 띠 텍스처: 줄 띠는 줄마다 크기가 달라 페이지 크기가 바뀌므로, 편집기 모드(`reuseKeys`)에서는 폭을 그림 폭에, 높이를 256px 눈금에 맞춰 키우고 같은 크기면 캔버스를 비우고 프레임만 다시 단다(옛 단일 캔버스 재사용의 의도를 지킨다). 런타임은 `reuseKeys` 없이 예전처럼 매번 새로 만든다.
- **퇴행 가능성(실측 안 함):** 100×100 맵의 띠 굽기(약 400ms)는 그대로이고, 거기에 들림이 바뀐 칸(+ 8방 이웃·같은 칸 상층) 재그림이 더해진다. 큰 산을 한 번에 깎는 붓에서 한 번의 스로틀 일이 더 길어진다.

## 러프 붓·지형지물 막대 (2026-10-03)

- 「높이」 기본은 러프 붓. S/M/L/XL 반지름 2/4/6/9칸, 기본 M·상한 4단. 올리기·내리기는 누르고 있는 동안 350ms마다 한 단씩, 산·골짜기는 한 번에 봉우리·바닥을 만든다. Shift로 시작한 스트로크는 정밀 붓(한 단·작은 원), 우클릭은 반대 방식이다.
- 방식 아이콘 8개·크기·상한·윗면 풀·절벽 양식·지형지물은 `panels/reliefToolbar.ts`의 캔버스 아래 막대에 모인다. 아이콘은 공통 1.2초 지연 툴팁을 쓴다. CSS는 `@layer map`과 공용 토큰을 따른다. 좁은 캔버스에서는 막대가 접힌다.
- D로 여는 비모달 지형지물 팝업: 경사로·계단 / 벽면 / 나무 / 바위·덤불 / 다리. 머리줄을 끌면 캔버스 안에서 옮겨진다. Esc는 툴팁 → 선택한 지형지물 → 팝업 순서로 닫으며 Phaser의 화면 밀기 전환보다 먼저 소비한다. 다른 모달·입력창 단축키 소유권은 존중한다.
- `reliefDoodads.ts`의 계획 하나가 고스트와 배치를 함께 판정한다. 북쪽 오르막은 폭 2·길이 단 차+1칸. 다리는 같은 높이의 두 둑 사이 낮은 틈에 폭 2칸을 놓고 `levels`와 `ramps=9`를 함께 쓴다. 바닥 deck 키트가 있는 칩셋에서만 다리 선택지를 제공하고 그 키트를 반복해 널판을 입힌다. 기존 경사로·상층 소품을 가로지르지 않는다.
- 스트로크를 떼면 작은 섬·구멍·1칸 폭 돌기를 같은 되돌리기 단계 안에서 정리한다. 되돌리기와 씬 종료는 성장 타이머만 취소하고 정리 편집을 덧붙이지 않는다. 절벽 양식 변경도 되돌릴 수 있다.
- 기본 흙벽은 색 램프가 둘뿐이다. 다리 밑면은 두 번째 램프를 쓰며, 바이옴 양식의 세 번째 강조색을 무조건 읽지 않는다(`render.ts`, `reliefStyle.test.ts`). 렌더 서명은 띠 생성 성공 후에 기록한다.
- 화면 확인은 `scripts/capture/capture-relief-toolbar.mjs` → `verify-shots/relief-rough-brush/continued/`. 브리지 없는 메모리 fixture이며 정본 맵 저장의 근거가 아니다.

## 기본 계단의 돌 디딤판 (2026-10-03 수정)

높이 막대의 계단 배치가 기본 흙벽 양식에서 잔디·흙벽을 반복한 사다리처럼 보였다.
`reliefPaintsCell`은 모든 일반 계단(코드 5~8)의 바닥을 렌더러에 맡긴다. 별도의 바이옴 판 계단 양식이 없으면
`render.ts`의 독립 돌 팔레트로 실제 계단 기하의 디딤판·챌면·층계참 아래를 그린다. 낮은 끝의 0단 디딤판도 불투명하게 그린다.
경사로 도트·윗면 그늘·잔디 턱이 돌 면을 다시 덮지 않는다. 계단 둘레는 네모로 맞춰 접합부의 대각선 깎임을 피한다.
돌 팔레트를 덧붙여도 다리 밑면의 팔레트 선택은 원래 절벽 팔레트 개수로 판단한다.

단 수·들림·걷기와 저장 필드는 유지한다. `smoothStairs`·`carvedStairs` 바이옴 양식은 각각 기존 비탈·판 계단 경로를 쓴다.
그림 재현은 `scripts/capture/render-relief-stairs.mts`, 실제 클릭 배치는 `scripts/capture/capture-relief-stairs.mjs`다.
증거는 `verify-shots/relief-stairs-fix/`에 둔다. `reliefStyle.test.ts`에 기본 계단의 바닥 소유권·돌색·0단 발치 불투명 계약을 추가했다(미실행).

## 알려진 한계 · 결정이 필요한 것

- **걷기 규칙은 켜는 스위치가 없다.** `relief` 를 가진 맵(경사로 없이 높이만 칠한 옛 맵 포함)은 단 차이를 건너지 못한다. 편집기에서는 「높이」 막대 → 지형지물 → 경사로·계단으로 절벽 아래에 `ramps` 를 깐다(북쪽 오르막만). 다리 탭은 같은 높이의 두 둑을 잇는다.
- **클릭 이동(`playScenePointerMove.pointerTile`)·전투 필드 배치(`battleOnField`)는 들림을 모른다** — 들린 칸을 클릭하면 그림 위치와 칸이 어긋난다.
- 붓의 산·골짜기·다듬기는 `levels` 만 바꾼다. 단이 바뀐 칸의 `ramps`·`wallDecor` 는 그대로 남는다(조수 `sculpt_relief` 는 `carryReliefExtras` 로 걸러 잇는다).
- 새 relief 를 칠할 때 `style` 은 자동으로 정해지지 않는다(`reliefStyleForTileset` 은 스크립트·테스트만 쓴다). 편집기 「높이」 막대의 절벽 양식 select 로 손으로 고른다(높이가 있어야 켜진다).
- 러프 붓(기본)은 1차 스케치용이라 한 번 누르면 수십~수백 칸이 바뀐다. 「윗면 풀」의 원래 타일 기억은 세션 메모리다 — 새로고침 뒤 0단으로 내려도 길은 안 돌아온다. 세션 안의 Ctrl+Z는 맵 스냅샷으로 복원한다. 내리기를 되돌린 다음 다시 내릴 때도 원래 바닥 기록을 유지한다.
- 이벤트 위치 표시(마커·클릭 칸)는 들지 않는다. 그림만 들린다.

## 검증 도구 (이 브랜치에 들어온 것)

- 단위: `test/reliefLift.test.ts`(들림 표·줄 띠·서명), `reliefWalk.test.ts`(canMove·도달성), `reliefStyle.test.ts`(양식·정규화), `reliefPersistence.test.ts`(저장·패키지·웹 내보내기).
- 구조 검사기: `scripts/content/lib/relief-check.mjs`(`checkRelief`) — 얇은 벽·계단 양옆·층계참·다리 판·도달 오류 코드(목록은 runtime-project-schema 의 r3 항목).
- 양식 견본: `vite-node scripts/content/relief-style-sheet.mts [out.png]`(작은 지형을 모든 양식으로).
- 경사로 도트 재생성: `node scripts/content/build-relief-ramp-art.mjs`(`tiledata/relief-art/*.png` → `rampArt.json`).
- 게임 화면: `scripts/qa/runtime/relief.scenario.mjs` + `relief-fixture.mts`(출하 플레이어 경로). **픽스처는 콘텐츠 카탈로그(r3 브랜치의 fantasy-500 catalog.json, 15MB)를 읽는다 — 이 통합에는 넣지 않았다.** `RELIEF_CATALOG=<경로>` 로 지정한다
  (`git show agent/r3-relief-stairs:tiledata/fantasy-500/catalog.json > .omo/runtime-qa/fantasy-500-catalog.json` — 읽기 전용 추출). 그 맵은 정글 시트(r3 에서 4590칸으로 확장)를 쓰므로 main 의 시트(3900칸)에서는 일부 칸이 비어 보일 수 있다 — 걷기·들림·가림 판정이 목적이다.
- 편집기 화면: `scripts/qa/relief-editor-capture.mjs <픽스처.json> <출력.png>`(vite 개발 서버를 직접 띄운다 — 워크트리에서는 `VITE_CACHE_DIR` 를 따로 줘라).

## 가져오지 않은 것 (브랜치 `agent/r3-relief-stairs` 에 남아 있다)

바이옴 시트(`public/assets/atlas-biomes/*`, `src/assets/atlasBiome*.json`)·시트 칸 수 확장(3900→4590)·사막·툰드라·늪·초원·소금평원 콘텐츠 맵과 저작·저장·QA 스크립트·바이옴 참고문서·버들항 자산.
초원 필드 저작 규칙(0행 높이·돌계단 폭 2·밧줄 다리 폭 2·꾸밈 비율)과 시각 QA 지적(계단이 사다리로 읽힘, 남북 다리가 벽에 깐 판자로 읽힘, 통나무 턱 계단이 판자로 읽힘, 골짜기 바닥 깊이가 안 보임)은
r3 브랜치의 biome-grassland 문서(openwiki 아래)에 있다 — 엔진 수정 때 참고하되, 그 문서는 EasyRPG 계열 시트 전제라 그대로 옮기지 않았다.
