# 맵 타일 표시 최적화 전후 — 2026-10-01

화면 주변 칸만 유지하고 겹치는 칸은 재사용한다. 공식 Container 일괄 등록과 기존 그리기 순서를 유지한다.

## 동일 조건 비교

| 항목 | 256 이전 | 256 이후 | 512 이전 | 512 이후 |
|---|---:|---:|---:|---:|
| 진입 동기 처리 (ms) | 5752.90 | 72.70 | 54200.80 | 142.50 |
| 추가 유지 JS heap (MiB) | 148.69 | 0.73 | 596.81 | 2.24 |
| 타일 객체 | 262144.00 | 3000.00 | 1048576.00 | 3000.00 |
| 이동 CPU/프레임 중앙값 (ms) | 23.20 | 2.10 | 77.10 | 2.00 |
| 이동 FPS | 33.57 | 60.03 | 11.75 | 60.03 |

## 지연과 남은 비용

- 256: 첫 postrender까지 116.7ms, 이동 CPU p95의 3회 중앙값 5.8ms, 모든 이동 샘플 중 최대 10.1ms.
- 512: 첫 postrender까지 189.2ms, 이동 CPU p95의 3회 중앙값 5.3ms, 모든 이동 샘플 중 최대 9.1ms.

첫 postrender는 초기 타일 창 생성 뒤 도착 카메라 창을 맞추는 첫 update를 포함한다. GPU 완료 시각은 아니다. 기준선에는 이 별도 지연 측정이 없어 동기 진입 시간만 전후 비교한다.

논리 배열 복제·타일 입력 해시·런타임 초기화는 크기에 따라 늘어난다. NPC/농지/설치물의 전역 시뮬레이션과 렌더링은 이 최적화의 대상이 아니다. 줌으로 보이는 칸이 늘면 표시 객체도 늘어난다.

## 검증

- 관련 5파일 54개 테스트, exit 0 (`unit-tests.log`).
- 앱 타입 검사 exit 0 (`typecheck.log`): NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck:app. 기본 Node heap 한도 시도는 OOM(exit 134).
- 크기별 3회 교대, 준비 실행 제외. 실제 플레이어 이동·전체 타일 재생성 없음·page/console error 0 확인.
- 런타임 차등 QA는 ../runtime-tile-window-20261001/SUMMARY.md 및 results.json. 카메라 없는 전체 맵 렌더와 RGBA 비교; 물의 실제 프레임 변화 별도 확인.

## 근거와 한계

- 개선 전: ../map-size-benchmark-20261001/raw-results.json 및 SOURCE-EVIDENCE.md (보존).
- 개선 후: raw-results.json (모든 샘플·환경·실행 소스 SHA-256), SUMMARY.md.
- 같은 Chromium 149/SwiftShader, 640×480 화면, 합본 타일 360의 쿼터 4개, 이벤트 0명. 공유 호스트의 다른 작업 부하는 통제하지 못했다. 소프트웨어 WebGL 수치이며 실제 하드웨어의 절대 FPS를 보장하지 않는다.
- heap은 32×32 시작 맵 대비 GC 후 유지 JS heap 증가분이다. 앱 전체 RAM/native/GPU 메모리가 아니다.
- 512는 지원 상한 256을 넘긴 실험 fixture다. 정본 프로젝트 저장이나 상한 변경은 하지 않았다.
- 재현: node scripts/qa/map-size-benchmark.mjs --out verify-shots/map-size-current
