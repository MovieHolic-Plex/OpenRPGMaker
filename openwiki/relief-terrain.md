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
| 걷기 | `relief/walk.ts` | `reliefAllowsStep`(단 차·유효 층계참·옆구리), `reliefSlopes`(완전한 축 방향 통로만 병합), `invalidateReliefSlopes`, `reliefBridgeMask`, `hasRelief` |
| 들림 | `relief/screen.ts` | `reliefLiftField`/`cellLift`/`pointLift`(타일 중심), `footLift`(물리 발 좌표), `reliefPickPoint`(보이는 윗면/벽 화소), `reliefRenderOptions`, `reliefSignature`, `reliefRowStrips`, `reliefTileSlotChangedCells` |
| 원본 바닥 | `editor/reliefGroundSurface.ts` · `mapTileDrawCore.ts` | 현재 칩셋의 하층·겹침·2층·그림자·autotile을 16px 셀로 합성해 윗면/경사로에 투영. 작은 셀 캐시와 셀 서명으로 부분 갱신 |
| 그림 | `relief/render.ts` · `styles.ts` · `rampArt.json` | 절벽·경사로·계단·다리 판 그리기, 양식(`RELIEF_STYLES`, 칩셋 id → 양식 `reliefStyleForTileset`), 경사로 도트. `window` 옵션(잘라 낸 격자를 절대 좌표 무늬로 굽기), `reliefPadPx`(굽지 않고 pad 계산) |
| 부분 굽기 | `relief/window.ts` | `reliefGrids`(다듬은·깎은 높이, relief·단 서명마다 한 번), `planReliefPatch`(바뀐 칸 → 창·덮어쓸 사각형, pad 가 바뀌면 버퍼 밀기 + 맨 위 띠), `applyReliefPatch`. 전체 굽기와 화소 일치를 `scripts/check-relief-window.mts` 가 확인한다 |
| 띠 텍스처 | `player/reliefStrips.ts` | 그림을 줄마다 윗면(under)·벽(over) 띠로 잘라 페이지 텍스처 몇 장에 쌓는다(런타임). `reliefFieldOf` 는 「높이가 있는가」를 relief 객체마다 한 번만 잰다 |
| 편집기 띠 | `editor/reliefLiveStrips.ts` | 전체 그림 버퍼를 들고 붓질마다 바뀐 창만 다시 굽고, 띠를 (줄, 윗면/벽, 256px 열 묶음) 텍스처로 나눠 덮어쓴 사각형에 걸린 것만 다시 올린다 |
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

**이동 중 바닥 가림 수정(2026-10-04):** 바닥 띠의 depth는 칸 남쪽 끝이다. same 캐릭터의 연속 발 y를 그대로 depth로 쓰면
자기 바닥보다 뒤로 가서 하반신이 지워진다. 그리는 동안만 발이 속한 줄(`ceil(y/칸−epsilon)−1`)의 띠 위로 정렬하고
같은 줄 캐릭터 사이의 발 y 순서는 작은 소수로 유지한다. `above` 우선순위는 그대로다. below·체공 그림자도 같은 주인 줄에
맞추며, 들림 0인 아랫땅도 실제 바닥 띠가 있으므로 정렬한다. 렌더 후 y와 depth를 함께 되돌린다. 남쪽의 높은 지형은 계속 캐릭터를 가린다.

## 편집기 성능 계약 (2026-10-03 부분 굽기)

- 높이 붓은 포인터 표본마다 `{relief:true}` 를 낸다 → `editSceneRenderPlan` 이 `kind:"relief"` → `scheduleReliefRender`(굽기 비용의 2배 간격 스로틀).
- 스로틀 한 번의 일: ① `syncReliefLiftedTiles` — 들림이 바뀐 칸만(`reliefTileSlotChangedCells`) `redrawCells`. ② `renderReliefLayer` → `ReliefLiveStrips.sync`.
- `sync` 는 **바뀐 칸 둘레 창만** 굽는다(`relief/window.ts`). 화면 화소 (sx, sy) 는 같은 열·맵 줄 sy-pad..sy 만 칠하고, 뒤 패스는 24px 안 이웃만 읽는다는
  사실로 창과 덮어쓸 사각형을 잡는다. 빈 맵에 처음 칠할 때도 평지 그림에서 창으로 시작한다. 전체 굽기로 물러나는 경우: 맵 크기·절벽 양식이 바뀜,
  창 넓이 합이 맵의 60% 넘음, 칸 크기가 바뀜.
- 띠는 (줄, 윗면/벽, 256px 열 묶음)마다 캔버스 텍스처 하나. 덮어쓴 사각형에 걸린 띠만 다시 올리고, 붓질 중에는 상자가 넓어지기만 한다(전체 굽기 때 꼭 맞춘다).
  캔버스는 `willReadFrequently` — Phaser 캔버스 텍스처가 만들 때 부르는 `getImageData` 가 GPU 되읽기로 멈추지 않게.
- **무늬 원점(`PATTERN_BIAS`)**: 벽 덩이·흙벽 조각·둑 몸통·판 계단 줄눈의 세로 좌표는 화면 y 가 아니라 땅 기준(화면 y − pad + 224)이다. 전에는 맵 어딘가의
  최고 단이 바뀌어 pad 가 바뀌면 온 맵 절벽 무늬가 다시 뽑혔다(붓질 한 번에 모든 벽이 깜빡임). pad 224(최고 단 14)인 맵은 예전 그림과 화소 하나 다르지 않다.
  그래서 pad 가 바뀌면 버퍼를 밀고 맨 위 경계 띠만 다시 굽는다.
- 진단: `window.__oprnEditReliefStats()` = 굽기 방식별 횟수(full·window·same·clear), `window.__oprnEditReliefRebuild()` = 띠를 버리고 전체 굽기(창 굽기 화면과 비교용).
- 실측(2026-10-03, 기본 100×100 마을, swiftshader, 부하 걸린 머신): 같은 세 번 드래그에서 긴 멈춤 최대 2.0~2.5초 → 0.25~0.8초(첫 붓의 JIT 예열이 가장 길다).
  창 굽기 한 번은 node 기준 중앙값 약 32ms(반지름 2 붓, 6단 언덕).
- 붓질 중 `refreshAuthoringJourney` 는 프로젝트 참조 점검을 다시 돌리지 않는다 — 칠하기마다 store 세대가 올라 문서 키가 늘 달라져, 키만 보고 표본마다 점검을 돌리던 것을 막았다.

## 지형 설치 확장 (2026-10-03)

[지형 설치 도구](terrain-placement-tools.md)가 현재 계약이다. 네 방향 경사로 폭 2/4/6, 두 둑 클릭 다리,
밀도 군집·선택·이동·복원, 높이를 유지하는 표면 붓, 강 붓, 시작점 통행 미리보기를 실제 막대에 연결했다.
아래 러프 붓 기록의 고정 폭·북쪽 전용·한 번 클릭 다리는 이 확장으로 대체됐다.

## 러프 붓·지형지물 막대 (2026-10-03)

- 「높이」 기본은 러프 붓. S/M/L/XL 반지름 2/4/6/9칸, 기본 M·상한 4단. 올리기·내리기는 누르고 있는 동안 350ms마다 한 단씩, 산·골짜기는 한 번에 봉우리·바닥을 만든다. Shift로 시작한 스트로크는 정밀 붓(한 단·작은 원), 우클릭은 반대 방식이다.
- 방식 아이콘 8개·크기·상한·윗면 풀·절벽 양식·지형지물은 `panels/reliefToolbar.ts`의 캔버스 아래 막대에 모인다. 아이콘은 공통 1.2초 지연 툴팁을 쓴다. CSS는 `@layer map`과 공용 토큰을 따른다. 좁은 캔버스에서는 막대가 접힌다.
- D로 여는 비모달 지형지물 팝업: 경사로·계단 / 벽면 / 나무 / 바위·덤불 / 다리. 머리줄을 끌면 캔버스 안에서 옮겨진다. Esc는 툴팁 → 선택한 지형지물 → 팝업 순서로 닫으며 Phaser의 화면 밀기 전환보다 먼저 소비한다. 다른 모달·입력창 단축키 소유권은 존중한다.
- `reliefDoodads.ts`의 계획 하나가 고스트와 배치를 함께 판정한다. 북쪽 오르막은 경사로 폭 4·계단 폭 2·길이 단 차+1칸. 다리는 같은 높이의 두 둑 사이 낮은 틈에 폭 2칸을 놓고 `levels`와 `ramps=9`를 함께 쓴다. 바닥 deck 키트가 있는 칩셋에서만 다리 선택지를 제공하고 그 키트를 반복해 널판을 입힌다. 다른 경사로·상층 소품을 가로지르지 않는다.
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

## 연속 경사로 — 계단과 구분 (2026-10-03 사용자 정정)

사용자가 원한 언덕 통로는 계단이 아니라 경사로다. 「경사로」는 코드 1(북쪽), `ReliefSlope.steps`가 없고
들림은 낮은 끝에서 높은 끝까지 연속 보간한다. 폭 4칸·길이 단 차+1칸으로 배치하고, 「계단」은 별도의 폭 2칸 선택지다.

기본 양식도 `reliefPaintsCell`이 비탈 칸의 하층 바닥 타일을 걷는다. 모든 매끈한 비탈을 `overSlope` 띠로 보내
주변 타일이 다시 덮지 않게 한다. 바이옴 도트가 있으면 기존 그림을 쓰고, 없으면 `paintNaturalRamps`가 현재 윗면·벽
팔레트로 닳은 흙과 풀 가장자리를 한 면으로 칠한다. 주기적인 가로 결을 없애 계단처럼 읽히지 않게 했다.
0단 발치도 불투명하며 경사로 둘레 한 칸은 네모로 맞춰 절벽 접합부가 대각선으로 잘리지 않게 한다.

기존 북쪽 계단 위에 「경사로」를 클릭하면 같은 절벽의 통로를 한 번의 편집으로 교체한다. 낮은 단·높은 단·길이가
같고 기존 통로 전체가 새 폭 안에 들어올 때만 허용한다. 다른 방향·다리·더 큰 통로 일부를 덮는 배치는 거부한다.
`levels`·통행 규칙·저장 형식은 유지하고 `ramps`만 선택한 종류로 쓴다. 자동 데이터 변환은 없다.

화면 재현은 `scripts/capture/render-relief-slope.mts`와 `scripts/capture/capture-relief-slope.mjs`다.
기존 계단 교체는 후자에 `RELIEF_CAPTURE_REPLACE=1`을 준다. `verify-shots/relief-slope-fix/SUMMARY.md`에
실제 편집기 1~4단·교체·되돌리기 근거를 둔다. `reliefStyle.test.ts`에 단 없는 기하·연속 들림·불투명 면 계약을
추가했으며 AGENTS의 제한에 따라 로컬 테스트 스위트는 실행하지 않았다.

## 발 접지·클릭·바닥 접합 수정 (2026-10-04)

- 경사로 표기의 연결 덩어리를 큰 사각형으로 채우지 않는다. 낮은 층계참 → 같은 방향/낮은 높이의 연속 칸 → 높은 층계참을 가진 통로만 인정한다. 나란한 통로도 시작/끝/높이가 같은 경우만 병합한다. 옆구리 진입, 다른 경사로로 가로질러 이동, 끊긴 경사 표기는 막는다.
- 캐릭터는 타일 중심 들림을 보간하지 않고 `footLift`로 실제 `sprite.x/y` 발 좌표의 연속 기하를 읽는다. 타일·상층 그림은 기존 중심 좌표를 쓴다. 클릭은 `camera.worldView`를 사용해 줌 원점을 보정하고, 작은 렌더 창의 화소 소유권(`reliefPickPoint`)으로 보이는 윗면을 고른다. 절벽 벽 클릭은 목표 칸이 아니다.
- `ReliefRenderOptions.ground`가 있으면 실제 원본 칩셋 바닥을 윗면·비탈·대각선 접점과 풀 턱에 투영한다. 바닥 없는 헤드리스 호출은 기존 절차적 팔레트가 대체한다. 원본 바닥의 kind=0 띠는 전부 under로 배치하며 하층/2층/그림자를 별도로 중복해서 그리지 않는다. 계단/다리 밑면의 전용 그림은 유지한다.
- 북·동·서 외곽선과 안쪽 턱은 실제 바닥 무늬에 지형 명암을 곱한다. 바깥 흙 둑은 `kind=1` 벽으로 분리해서 바닥 재질 투영에 지워지지 않는다.
  기본 흙벽도 `RELIEF_DEFAULT_RIM`의 북쪽 뒤 둑을 가진다. 재질 없이 그리는 `reliefPickPoint`도 같은 둑/벽 경계를 쓴다.
  지도 밖 여백에 걸친 둑은 윗단 주인 `src`를 받아 띠에 남는다.
  최상단 외곽선은 전체 그림 `sy+oy=0` 경계에서만 그리며 부분 창의 상단에 가짜 선을 만들지 않는다.
- 바닥 변경도 relief 부분 굽기를 예약한다. autotile 이웃까지 셀 변경 창을 넓힌다. 높이 유무가 처음 바뀌면 기존 바닥 객체도 함께 갱신한다. 비활성 하층의 투명도/색조는 under 띠에도 적용한다.
- 미리보기 계획은 `copyRelief`와 수심 배열을 복사한다. 미리보기 중 원본 높이/경사/수심을 바꾸면 Undo와 캐시가 함께 깨진다. 배열을 직접 저작하는 도로 연결은 `invalidateReliefSlopes`를 호출한다.
- 재현: `scripts/capture/inspect-terrain-seams.mts` + `terrain-seam-sheets.py`의 세 SQLite QA 지도 접점 1,186곳(가려진 접점 포함)의 윗면/발치 시트 전량 검토. `capture-terrain-seams-runtime.mjs`는 출하 `player.html`에서 네 방향 키보드/클릭 왕복·옆구리 차단·실제 AI 원본 집 3채 문 앞 이동을 기록한다. `capture-terrain-seams-editor.mjs`는 실제 패키지 에디터에서 원본 선택·부분 바닥 갱신/전체 굽기 일치·폭 2칸 도로·저장/Undo/재로드를 확인한다. 상세 근거와 범위는 `verify-shots/terrain-seams/SUMMARY.md`.
- **발 좌표 오차 0은 몸이 보인다는 증거가 아니다.** 앞선 접점/발 위치 QA가 하반신 가림과 북쪽 외곽선 소실을 놓쳤다.
  `capture-terrain-body-rims.mjs`는 실제 출하 플레이어에서 걸음 중 WebGL 스냅샷과 해당 애니메이션 프레임의 불투명 하반신 화소를 비교하고,
  높은 앞 지형의 가림도 별도로 확인한다. `inspect-terrain-rim-surfaces.mts`는 재로드한 버들항 재질로 28개 양식(기본 포함)의
  부분/전체 RGBA·주인 줄·띠 일치를 비교한다. 렌더 fixture는 사본이며 SQLite 지도에는 쓰지 않는다. 근거: `verify-shots/terrain-body-rims/SUMMARY.md`.

## 알려진 한계 · 결정이 필요한 것

- **걷기 규칙은 켜는 스위치가 없다.** `relief` 를 가진 맵(경사로 없이 높이만 칠한 옛 맵 포함)은 단 차이를 건너지 못한다. 편집기에서는 「높이」 막대 → 지형지물 → 경사로·계단으로 절벽 아래에 `ramps` 를 깐다(네 방향 자동 접합). 다리 탭은 같은 높이의 두 둑을 잇는다.
- **전투 필드 배치(`battleOnField`)는 아직 들림을 모른다.** 일반 게임 클릭 이동은 위 화소 선택 경로를 쓴다.
- 붓의 산·골짜기·다듬기는 `levels` 만 바꾼다. 단이 바뀐 칸의 `ramps`·`wallDecor` 는 그대로 남는다(조수 `sculpt_relief` 는 `carryReliefExtras` 로 걸러 잇는다).
- 새 relief 를 칠할 때 `style` 은 자동으로 정해지지 않는다(`reliefStyleForTileset` 은 스크립트·테스트만 쓴다). 편집기 「높이」 막대의 절벽 양식 select 로 손으로 고른다(높이가 있어야 켜진다).
- 러프 붓(기본)은 1차 스케치용이라 한 번 누르면 수십~수백 칸이 바뀐다. 「윗면 풀」의 원래 타일 기억은 세션 메모리다 — 새로고침 뒤 0단으로 내려도 길은 안 돌아온다. 세션 안의 Ctrl+Z는 맵 스냅샷으로 복원한다. 내리기를 되돌린 다음 다시 내릴 때도 원래 바닥 기록을 유지한다.
- 이벤트 위치 표시(마커·클릭 칸)는 들지 않는다. 그림만 들린다.

## 검증 도구 (이 브랜치에 들어온 것)

2026-10-04 실제 AI 고지 집 캡처에서 2,048칸을 넘는 지도만 상층 집이 절벽 아래로 사라지는 문제가 드러났다.
`editSceneRender.ts`의 lazy 청크 사전이 바닥/상층에 같은 x,y 키를 써서 상층을 바닥 부모에 넣고 있었다.
키를 lower/upper별로 나누고, 청크/타일 컬링은 들린 화면 행을 사용한다. 화면 창의 원본 행도 최대 들림만큼 더 읽는다.
증분 교체는 이전의 실제 부모에서 타일을 제거한다. `EditScene.ts` 청크 컬링도 층 접두사를 해석한다.
`test/editSceneRender.test.ts`에 같은 청크의 두 층이 서로 다른 부모를 쓰는 회귀를 추가했으며 로컬 Vitest는 실행하지 않는다.

- 조수의 실제 높이 그림: `src/editor/reliefMapView.ts`가 같은 renderRelief/줄 띠/들림 표를 제공한다.
  `src/ai/toolImageRenderer.ts`와 `scripts/qa-game/render.mts`가 하층·절벽·들린 상층을 합성하며
  `mapVisualEvidence.ts`는 relief 변경도 시각 검토 대상으로 잡는다. relief 그림 65,536칸 초과는 작은 영역을 요청한다.
- 조수 경사로/집 연결: `src/editor/tools/terrainTools.ts`, 계약은 `editor-ai-tools.md` 「지형 설계·고지 집·실제 통행」.
  실제 모델 결과와 출하 플레이어의 통행 근거: `verify-shots/terrain-assistant-live/SUMMARY.md`.

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
