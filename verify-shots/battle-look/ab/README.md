# 조수 전투 화면 선택 A/B (2026-10-02)

qa:game gen(gemini-3.8-flash, 새 프로젝트 마법사와 같은 경로)으로 같은 기획을 단계마다 여러 번 만들게 하고, 각 판이 저장한 `system.battleLook` 을
`verify-shots/battle-ui-default/probe.mjs` 로 출하 런타임에서 찍었다. 그림은 판마다 t1500 한 장(640×480). 기획 JSON 은 `.tmp/brief-*.json`(gitignore) — 형식은
`scripts/qa-game/briefs/ember-mine-jrpg.json`.

| 단계 | 판 | 꾸밈 고름 | 블라인드 심판 기준 어울림 | 못 끝낸 판 | 맵 칠하기 거절(PAW) 난 판 |
|---|---|---|---|---|---|
| 고치기 전 main 2ce42d3 | 12 | 2 | 1 | 0 | 기록 없음 |
| #1849 조수 지시 | 12 | 9 | 9 | 2 (계획만 하고 멈춤) | 10 |
| #1858 계획→실행 이음매 | 12 | 11 | 10 | 1 (PAW 거절로 맵 0) | 12 |
| #1874 「현대」 판정 수정 | 9 (SF·코미디·청춘 포함) | 9 | 9 (1순위 5) | 0 | 0 |

- 심판: 조수가 무엇을 골랐는지 모르는 별도 에이전트가 기획서 6개와 프리셋 그림 12장만 보고 고른 답 — `judge.json`.
- 그림 이름: `pixel`·`gold`·`ink-*`·`parch*` = 고치기 전·#1849 판(같은 꾸밈은 한 장), `fix-*` = #1858, `v3-*` = #1874.
- 시각화 재생성: `python3 gen_viz.py`(qa-runs 와 /tmp/bws/ab-results.json 이 있는 기계에서만).
