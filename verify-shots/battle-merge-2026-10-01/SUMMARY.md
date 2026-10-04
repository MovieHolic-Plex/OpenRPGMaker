# 最新 main 통합 재확인

기준 main: `1a221eae6`(v0.43.2). 전투 충돌 4개 통합 후 직접 엔진/데이터 프로브와 출하 `player.html`을 확인했다.

- 기존 엔진 버그 재현 조건: 모두 false (`rules-probe.json`).
- 추가 방어·감정·영구 스톱·cast 라우팅: fixed=true (`extra-rules.json`).
- 양방향 기본 연출·동명이인·적 특수기·배우/적 프로젝트 연출: 6개 fixed=true, page errors=0 (`interactions/interactions.json`).
- 즉시 확인: `interactions/record-actor-after.png`, `interactions/enemy-record-after.png`. 두 화면 직접 확인: 측면 전투/창 배치와 배우·적 식별 유지. 이 샷은 연출 종료 뒤 모습이며 FX 자체의 판정 근거는 DOM 관측값이다.
- 연출 레코드의 모든 손잡이 값을 브라우저로 정량 검증했다고 주장하지 않는다.
- vitest/gates/전체 typecheck 미실행. 정본 프로젝트 쓰기 없음.
- 재현: `repro/`를 저장소 root의 `.omo/battle-merge-3852/`로 복사한다. fixture 생성 뒤 `AUDIT_CASES=crosskind,same-name,enemy-crosskind,enemy-special,record-actor,enemy-record node .omo/battle-merge-3852/interaction-probe.mjs`.
