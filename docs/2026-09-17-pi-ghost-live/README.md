# 밑그림이 Pi 경로로 돌아왔다 — 눈 증거 (2026-09-17)

재현: `npm run dev -- --port 9174` 를 띄운 뒤 `BASE=http://127.0.0.1:9174 node scripts/capture-pi-ghost-live.mjs`.
실 LLM 없음 — `/v1/agent/run` 을 페이지 안에서 NDJSON 으로 대본화하고 `done` 직전에 스트림을 붙잡는다.
대본은 `paint_tiles` 가 10×6 = 60칸을 칠한 것으로 한다.

| 그림 | 경계 | 고스트 |
| --- | --- | --- |
| `01-during-turn.png` | 턴 도중 (`done` 전) | 칸 60 · 마커 1 · 칩 1 · 실행 중 도구 `paint_tiles` |
| `01b-during-turn-canvas.png` | 같은 순간, 조수 데크를 접은 채 | 같음 — 캔버스에 깔리는 타일과 「타일을 칠하는 중 · 60/60 셀」 칩이 보인다 |
| `02-awaiting-review.png` | 검토 대기 | 칸 60 — 사용자가 적용·버리기를 고르는 동안 남는다 |
| `03-discarded.png` | 버린 뒤 | 칸 0 · 마커 0 · 칩 0 |

수치는 `probe.json` 에 그대로 있다(페이지에서 고스트 스토어를 직접 읽은 값 + DOM 마커·칩 개수).

데크가 캔버스를 덮는 것은 별건이다 — `[data-testid="ai-deck"]` 는 펼치면 760×819 까지 큰다.
`01b` 는 그 가림을 걷어낸 같은 순간이다.

고침 전 상태는 `test/e2e/pi-ghost-live.spec.ts` 로 확인한다: `aiPiAgentCommand` 의
`ghost.handleEvent(event)` 한 줄을 지우면 「경계 1」의 마커 단언에서 `element(s) not found` 로 죽는다.
