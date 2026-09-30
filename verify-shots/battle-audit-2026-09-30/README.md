# 전투 조사 증거 — 2026-09-30

종합 보고서: [2026-09-30-battle-adversarial-review.md](/home/main/.codex/worktrees/3852/rpg-zzu/docs/2026-09-30-battle-adversarial-review.md)

기준 HEAD: 0e0db9b5818814e9f27400c8fb2b54b619d59e8d / v0.41.0.

- `rules-probe.json`: 핵심 규칙/데이터 직접 재현 수치.
- `MATRIX.md`, `matrix.json`: 최종 화면 7개 케이스. 실패0/오류0은 자동 beat 결과이며 result 가림은 직접 시각/DOM 결함으로 별도 기록했다.
- `interactions/SUMMARY.md`, `interactions.json`: 추가5개 전부 reproduced=true/errors0.
- `motion/SUMMARY.md`, `pose-events.json`, contact sheets: 실시간48프레임. 구형 기대값2개 실패는 제품 버그 수에서 제외했다.
- `reviews/`: 독립3분야 적대 리뷰 + 독립 시각 검토.
- `repro/`: 실행 스크립트 보존 사본. 종합 보고서의 실행 위치/명령을 따른다.

## 즉시 확인할 화면

- 결과 가림: `retro-1024-settled/result-settled.png`, `retro-reduced/result-settled.png`.
- 비교군: `rm2000-control/result-settled.png`.
- 입력 중 AUTO: `interactions/input-auto-auto.png`.
- 연계기 준비 표시: `interactions/combo-menu-ready.png`, `combo-menu-reopened.png`.
- 몬스터 전투: `interactions/capture-cancel-root.png`, `capture-cancel-bag.png`; 취소의 실제 소유권/비용은 JSON으로 확인한다.
- 연속 공격/승리: `motion/ally-attack/contact-sheet.png`, `motion/enemy-attack/contact-sheet.png`, `motion/victory/contact-sheet.png`.

`result-revealed.png`는 실제로 결과 종료 후 필드다. `failure.png`는 초기 관찰 오류의 잔여 증거이며 최신 판정은 JSON과 종합 보고서를 따른다. canonical 프로젝트 DB와 제품 소스는 변경하지 않았다. 전체 테스트/게이트는 실행하지 않았다.
