# 테스트 플레이 회복력 실브라우저 QA

- 대상: http://127.0.0.1:9852/ (편집기 셸, 톱바 mode-play)
- 시각: 2026-08-29T22:37:04.327Z

| 케이스 | 판정 | 결과 | 캔버스 색 | 복구 패널 | pageerror | console.error |
|---|---|---|---|---|---|---|
| valid-project | **PASS** | 툴레이 화면이 ready 까지 도달했다 | 2947 | 없음 | 0 | 5 |
| broken-project | **PASS** | 예미검사가 수리해서 그대로 플레이됅다 | 2521 | 없음 | 0 | 5 |

## valid-project — PASS

- 결과: 툴레이 화면이 ready 까지 도달했다
- 캔버스 distinct color: 2947
- 스크린샷: `verify-shots/testplay-resilient/valid-project.png`
- console.error:
  - `Failed to load resource: net::ERR_CONNECTION_REFUSED`
  - `Failed to load resource: the server responded with a status of 400 (Bad Request)`
  - `Failed to load resource: net::ERR_CONNECTION_REFUSED`
  - `Failed to load resource: net::ERR_CONNECTION_REFUSED`
  - `Failed to load resource: net::ERR_CONNECTION_REFUSED`

## broken-project — PASS

- 결과: 예미검사가 수리해서 그대로 플레이됅다
- 캔버스 distinct color: 2521
- 스크린샷: `verify-shots/testplay-resilient/broken-project.png`
- console.error:
  - `Failed to load resource: net::ERR_CONNECTION_REFUSED`
  - `Failed to load resource: the server responded with a status of 400 (Bad Request)`
  - `Failed to load resource: net::ERR_CONNECTION_REFUSED`
  - `Failed to load resource: net::ERR_CONNECTION_REFUSED`
  - `Failed to load resource: net::ERR_CONNECTION_REFUSED`
