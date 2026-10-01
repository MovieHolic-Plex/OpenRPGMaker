# 전투 B 묶음 — 힘 모으기·게이지 밀기·변신·소환 + 재생 오라 (2026-10-01)

재현: `bash verify-shots/retro-btl-b/run.sh` (출하 player.html, 녹화 하네스). 헤드리스 규칙 프로브: `node_modules/.bin/vite-node --script verify-shots/retro-btl-b/probe.mts`.

| 녹화 | 스킬 | 결과 |
|---|---|---|
| transform | 너구리 「둔갑」 | 「바위 둔갑에 걸렸다」 줄에 맞춰 이끼 골렘 그림으로 바뀜, FRM 배지. PASS |
| charge | 용인 「화염 브레스」(모으기 1) | 예고 줄 + 「화염 브레스 · 1」 띠만, 다음 차례 -165/-163/-158. PASS |
| telegraph | 적 외눈 광선(`--enemy-skill`) | 적 3마리 머리 위 띠 → 다음 차례 피해. PASS |
| gauge | 시간 화살(-40) | 「슬라임의 행동이 늦춰졌다!」. PASS |
| regen | 꽃향기(재생) | 초록 숨쉬기·반짝이 두 겹, 원색 유지. PASS |
| summon | 불의 정령 → 업화, 거인의 주먹 → 흙 골렘 | 칸 windup>move>attack>recover, 대상 앞까지 이동, 첫 착탄에 맞춰 공격. PASS |
| summon-djinn | 지니 정령 소환 → 이끼 골렘 | 같음, 원형 범위 3마리 피해. PASS |
| summon-king | 백수의 왕 → 사자 | 같음, 필살기 컷인 뒤 다단. PASS |

프로브: gauge·strict 양쪽에서 적 메테오 「준비한다! (2턴 뒤)」 → 「힘을 모으고 있다… (1턴)」 → 피해. 아군 기합 베기 예고 → 다음 차례 발동, 모으는 중 메뉴 0회. 게이지 밀기 적 게이지 100 → 40.
기믹 검사기: 직업 124 · 스킬 992 · 오류 0 · 경고 2(기존 오탐). tsc(app) 통과. 단위 테스트·게이트는 돌리지 않았다(워크트리 규칙).
