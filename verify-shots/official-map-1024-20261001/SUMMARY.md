# 공식 1024×1024 맵 지원 — 2026-10-01

## 변경

`MAX_TOOL_MAP_DIMENSION`을 512 → **1024**로 올렸다. 편집기 생성창·선택·가장자리 확장,
조수 생성/크기변경·lint·공간 설계·마을 오브젝트 미리보기가 한 상수를 계속 사용한다.
1025는 거부하며 스키마/릴리스 버전은 바꾸지 않는다. 기존 512도 저장 호환을 검사했다.

## 기능 검사

| 명령 | 직접 확인한 결과 | 로그 |
|---|---|---|
| 핵심 4파일 (mapSizeGuard/mapEdgeGrow/mapCreateSpec/runtimeTileWindow), W1 | **52 통과 / exit 0** | core-tests.log |
| 공간/도구 경계 4파일, W1, 필터 지정 | **7 통과·131 건너뜀 / exit 0** | boundary-tests.log |
| 실제 생성창/actions/store/io 모듈 브라우저 probe | **exit 0, 오류 0** | results.json, browser-probe.log |
| typecheck:app (Node heap 8192MiB) | **exit 0** | typecheck-app.log |
| build:app (Node heap 8192MiB) | **exit 0, 1m 5s** | build-app.log |
| test:parity | **9파일·42 통과 / exit 0** | parity-tests.log |
| gates:barrel | **2401파일·55수출 / exit 0** | gates-barrel.log |
| gates:self-hosted | **4워크플로·10 runs-on / exit 0** | gates-self-hosted.log |

핵심 왕복은 **512와 1024 양쪽**에서 4개 타일 층 + 그림자의 전체 배열 길이와
마지막 셀 sentinel을 확인한다. 1024 생성·확장·편집기 허용, 1025 사전 거부,
1024 긴 이동에서 타일 객체 수 제한도 검사했다. 공간 설계의 512/1024 크기 재로드를 확인했다.

### 생성창 브라우저

`npm run dev:worktree`의 새 포트 9894 서버에서 독립 모듈 fixture를 실행했다.
`1024-dialog.png`와 `1024-created.png`를 직접 열어 입력과 재로드 결과를 확인했다.

- width input max: **1024**. 1025 입력 확인 → 창 유지와 상한 안내 → 1024 수정 후 실제 확인 버튼 실행.
- 생성/재로드 width=height=**1024**, lowerTiles=**1,048,576**개, 편집기 맵 선택 허용.
- 확인 버튼 동기 동작 **243.10ms**, 직렬화 **320.10ms**, 재로드 **372.30ms**.
- 직렬화된 전체 fixture 프로젝트 **50,800,849 bytes**. 이 수치는 맵 배열만의 바이트가 아니다.
- 브라우저 시각/저장 모듈 probe **1회** 수치로, 반복 평균이나 디스크/SQLite 저장 속도가 아니다.

## 성능

같은 조건의 실제 출하 player에서 512/1024 각 3회·정지/이동 각 600프레임 실측은
`../map-size-1024-20261001/SUMMARY.md`와 `VALIDATION.md`를 본다.
진입 동기 CPU **147.30 → 481.50ms**, 이동 CPU 중앙값 **2.10 → 2.10ms**, 이동 FPS **60.01 → 60.01**.
GC 후 총 JS heap **109.82 → 127.81MiB**. native/GPU 메모리는 제외된다.

## 범위와 남은 비용

코드와 최소 fixture 검사로, 정본 SQLite 프로젝트에 콘텐츠를 새로 쓰지 않았다.
브라우저 probe는 실제 생성창과 action/store/io를 사용하지만 **전체 편집기 셸·캔버스 부팅 검사**가 아니다.
1024 비평탄 높이 지형·많은 NPC·4층 밀집 맵의 성능은 이번 빈 바닥 실측이 보장하지 않는다.
특히 편집기 높이 붓은 기존 전체 CanvasTexture 경로가 남아 있어 16px 래스터 폭이 16,384px다.

더 넓은 구 테스트의 기존 16실패와 전체 게이트 기준선은 이전 512 증거를 참조한다.
이번에는 필요한 경계·왕복·타일 객체 수만 집중 실행했다. 전체 suite/gates는 실행하지 않았다.

## CI 기준선

기준 main은 `593ea9c6dc05e48d6319da79f6b36a932a5c31ef`다.
main ci-fast 실행 36863301421 / check-run 110372554887는 **self-hosted runner lost communication**으로 실패했다.
`main-ci-annotations.json`에 원문을 보존했다. 실패 원인을 코드 타입 오류로 추정하지 않는다.
빠른 CI 명령 5개(typecheck:app, gates:barrel, gates:self-hosted, test:parity, build:app)를
로컬에서 직접 확인했고 모두 exit 0이었다. 이 결과를 GitHub CI 통과로 부르지 않는다.
