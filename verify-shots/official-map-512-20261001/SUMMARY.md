# 공식 맵 최대 크기 512×512 — 2026-10-01

## 적용

- 공통 상한 `MAX_TOOL_MAP_DIMENSION = 512`.
- 새 맵 입력·생성/확장·AI 맵 도구·lint·편집기 맵 선택이 같은 상한을 쓴다.
- 공간 설계/조수 공간 스키마/공간 캔버스 및 마을 오브젝트 기준 크기도 공통 상한을 쓴다.
- 513 이상은 기존 거부 경로를 유지한다. 저장 데이터 구조와 버전은 바꾸지 않는다.
- 런타임 타일 객체는 카메라 주변에만 유지한다. 전체 논리 배열, 저장 크기, NPC/길찾기 비용은 내용과 면적에 따라 늘어난다.

## 검증

- 핵심 4파일 50개 테스트: 실제 프로세스 exit 0, `core-tests.log`.
  `npm test -- test/mapSizeGuard.test.ts test/mapEdgeGrow.test.ts test/mapCreateSpec.test.ts test/runtimeTileWindow.test.ts --maxWorkers=1 --minWorkers=1`
- 공간 설계/구 도구 경계 4파일 6개 테스트: 실제 프로세스 exit 0, `boundary-tests.log` (131개는 이름 필터로 제외).
  `npm test -- test/spatialSchema.test.ts test/spatialBindingProjection.test.ts test/generateMap.test.ts test/toolsMapManagement.test.ts -t '512×512|unbounded size|oversized extent|지원 상한 초과' --maxWorkers=1 --minWorkers=1`
- 앱 타입 검사: 실제 프로세스 exit 0, `typecheck.log`.
  `NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck:app`
- 실제 편집기 생성창/action/store/io 모듈 독립 브라우저 검사: exit 0, `results.json`/`editor-ui.log`.
  입력 max=512, 513 거부, 512×512 생성, 편집기 선택 허용, serialize/deserialize 후 262,144칸 보존.
  `node scripts/qa/official-map-size.mjs` (새 `npm run dev:worktree` 서버, 검사 중 HMR 편집 금지).
- 전체 편집기 셸 부팅 검사는 브라우저 종료로 미완료다. 이 UI 증거는 독립 모듈 검사이며 캔버스/붓/undo 성능 실측을 대신하지 않는다.
- 정본 프로젝트 콘텐츠 저장 없음: 코드 변경과 독립 테스트 fixture만 사용했다.

## 즉시 확인

- `512-dialog.png`: 실제 생성창의 가로·세로 512 입력.
- `512-created.png`: 실제 생성·재로드 값.

## 성능·플레이어 화면 증거

상한 변경 전에 동일한 런타임 코드로 측정한 자료는 보존한다:

- `../map-size-optimized-20261001/COMPARISON.md`: 512 진입 동기 CPU 54,200.8→142.5ms, 이동 CPU 중앙값 77.1→2.0ms, 타일 객체 1,048,576→3,000.
- `../runtime-tile-window-20261001/SUMMARY.md`: 전용 player.html에서 16/32px, 이동/순간이동/전환/줌/타일 수정 8장 모두 전체 렌더와 픽셀 차이 0. 물 실제 틱 확인.
- `../map-size-optimized-20261001/VALIDATION.md`: 최적화 시점의 별도 54개 테스트와 타입 검사.

당시 512는 상한 256을 우회한 실험 fixture였다. 이번 변경부터 공식 저작 상한 512다.
성능 수치는 동일 640×480 Chromium/SwiftShader의 빈 필드이며 모든 콘텐츠/사용자 하드웨어의 FPS를 보장하지 않는다.

## 실패·재확인 기록

- 넓은 8파일 검사: 170 passed / 16 failed (`broad-tests.log`).
- 수정하지 않은 main `c7de9b0b7`의 실패 후보 검사: 같은 16개 실패 재현 (`baseline-main.log`, exit 1).
  - 구 generate_map 테스트 10개 및 mapSizeGuard 생성기 2개: 현재 기본 beodeul_city에 해당 생성 프로필 없음.
  - mapManagement 4개: 기본 잔디 번호 기대값 240/실제 737, 이벤트 오류 경로의 페이지 정규화 차이.
  - 변경된 크기 경계 검사에는 생성기 지원 칩셋을 명시했다. 무관한 기본 칩셋/이벤트 동작은 수정하지 않았다.
- 6파일 검사: 148 assertions passed, 보고 RPC `onTaskUpdate` 시간 초과 2건으로 exit 1 (`large-focused-tests.log`). 단일 워커에서도 재현돼 초록으로 세지 않았고, 변경에 필요한 검사를 작은 묶음으로 재실행했다.
- 전체 로컬 게이트/전체 스위트는 실행하지 않았다. PR의 저장소 CI 결과는 PR에서 확인한다.

## CI 지연 시 로컬 확인

기존 main CI(run 36853844683, head `c7de9b0b7`)는 자체 호스팅 러너가 GitHub와 연결이
끊겨 실패했다(`main-ci-annotations.json`). PR 첫 실행(run 36856373573)도 같은 러너 연결
끊김으로 종료됐다(`pr-ci-annotations.json`). 같은 빠른 레인의 명령은 로컬에서 확인했다.
GitHub CI 전체가 초록이라는 뜻은 아니다. CI의 Node heap은 6GB, 로컬 타입/빌드 검사는 8GB다.

- `npm run build:app`: exit 0, `build-app.log` (Node heap 8GB, 1m 6s).
- `npm run gates:barrel`: exit 0, `barrel.log` (2,400파일/55수출).
- `npm run gates:self-hosted`: exit 0, `self-hosted.log` (4워크플로/10실행 위치).
- `npm run test:parity`: 9파일 42개 테스트 모두 통과, 실제 프로세스 exit 0, `parity-tests.log`.

첫 parity 실행은 41 passed / 1 failed였다(`parity-before-fix.log`). 실패는 기존 목록이
`src/battle/runtime.ts#elementalDefenseIds`를 가리킨 것이며, 실제 소비자는 이미
`src/battle/battleElementModifiers.ts`에 있었다. 기존 main의 테스트 검사기/전투 소스가
같고 옛 소비자 주소가 해석되지 않는다는 SHA/판정 증거는 `parity-consumer-baseline.json`이다.
소비자 주소만 바로잡고 상태(planned-T4), 커버리지 래칫, 전투 구현은 바꾸지 않았다.
