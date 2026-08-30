# 테스트 플레이 회복력 실브라우저 QA

- 대상: http://127.0.0.1:9852/ (편집기 셸, 톱바 mode-play)
- 시각: 2026-08-29T22:26:13.094Z

| 케이스 | 판정 | 결과 | 캔버스 색 | 복구 패널 | pageerror | console.error |
|---|---|---|---|---|---|---|
| valid-project | **PASS** | 플레이 화면이 ready 까지 도달했다 | 2947 | 없음 | 0 | 4 |
| broken-project | **FAIL** | 막다른 길: 부팅이 실패했는데 복구 패널이 없다 (outcome=boot-failed) | 2505 | 없음 | 1 | 7 |

## valid-project — PASS

- 결과: 플레이 화면이 ready 까지 도달했다
- 캔버스 distinct color: 2947
- 스크린샷: `verify-shots/testplay-resilient-RED/valid-project.png`
- console.error:
  - `Failed to load resource: net::ERR_CONNECTION_REFUSED`
  - `Failed to load resource: the server responded with a status of 400 (Bad Request)`
  - `Failed to load resource: net::ERR_CONNECTION_REFUSED`
  - `Failed to load resource: net::ERR_CONNECTION_REFUSED`

## broken-project — FAIL

- 결과: 막다른 길: 부팅이 실패했는데 복구 패널이 없다 (outcome=boot-failed)
- 캔버스 distinct color: 2505
- 스크린샷: `verify-shots/testplay-resilient-RED/broken-project.png`
- pageerror:
  - `Cannot read properties of undefined (reading 'width')`
- console.error:
  - `Failed to load resource: net::ERR_CONNECTION_REFUSED`
  - `Failed to load resource: the server responded with a status of 400 (Bad Request)`
  - `Failed to load resource: net::ERR_CONNECTION_REFUSED`
  - `[error-trap] 잡히지 않은 예외 — TypeError: Cannot read properties of undefined (reading 'width') — http://127.0.0.1:9852/src/player/playSceneCamera.ts:6:44 {kind: exception, stack: TypeError: Cannot read properties of undefined (re…/node_modules/phaser/dist/phaser.min.js:1:563814), source: http://127.0.0.1`
  - `Failed to load resource: net::ERR_CONNECTION_REFUSED`
  - `Failed to load resource: net::ERR_CONNECTION_REFUSED`
  - `[play-boot] [play-boot] stage=timeout fail map=map-does-not-exist-1788042274497 timeout {kind: play-boot, stage: timeout, ok: false, mapId: map-does-not-exist-1788042274497, elapsedMs: 35988}`
