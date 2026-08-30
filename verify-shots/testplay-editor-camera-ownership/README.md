# 시연 실행 후 «맵이 사라진» 결함 — RED/GREEN 증거 (2026-08-30)

재현 하네스: `node scripts/diag/repro-map-vanish.mjs --url http://127.0.0.1:<dev포트> --only walkFar`
부팅: `?freshProject=1` (예제 어드벤처, 시작 맵 100×100), 뷰포트 1440×900, chromium swiftshader.

절차: 편집기 부팅 → `mode-play`(테스트) → 게임에서 방향키 24회(→) + 12회(↓) → `test-play-window-close` → 편집 캔버스 재측정.

| 파일 | 무엇 |
|---|---|
| `red-1-before.png` | 테스트 전 편집 캔버스 (98,762 B) |
| `red-3-after-canvas.png` | 수정 전 복귀 직후 편집 캔버스 (41,031 B — 맵이 우하단 조각만 남음) |
| `red-4-after-full.png` | 수정 전 복귀 직후 편집기 전체 화면 |
| `green-3-after-canvas.png` | 수정 후 복귀 직후 편집 캔버스 (98,762 B — before 와 바이트 동일) |
| `green-4-after-full.png` | 수정 후 복귀 직후 편집기 전체 화면 |

기계가 읽는 단정은 픽셀이 아니라 엔진 카메라 값이다 —
`test/e2e/testplay-editor-camera-ownership.spec.ts` 가 `__oprnEditCamera()` 로 본다.
수정 전 같은 스펙: `scrollX` 기대 323 / 실측 1123 (800px 밀림) → 실패.
수정 후: before == during == after → 통과.
