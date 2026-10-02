# 조수가 RM2003 전투 명령을 실제로 쓰는가 (2026-10-02~03)

기획: `scripts/qa-game/briefs/rm2003-party-commands.json` — 쌍검 레온(이도류), 「훔치기」가 따로 있는 카이,
「기도」를 고르면 '토마는 두 손을 모아 기도했다…' 문장이 나오고 파티가 회복되는 토마.
`npm run qa:game -- gen --brief … --out qa-runs/rm2003-r<n>` (실제 모델, 판당 약 10분, 3판 병렬).

| 판 | 코드 | 배우별 메뉴(battleCommandIds) | 이도류(두 무기) | 기도 명령 | 기도 문장 | 검사 |
| --- | --- | --- | --- | --- | --- | --- |
| r1 | main a9080b6d59 | 3/3 배우 | ✓ | kind:skill (전체 회복 스킬) | ✗ (스킬엔 문장 칸 없음) | 막힘 1(빈 맵, 무관) |
| r2 | main | 3/3 | ✓ (직업도 이도류) | kind:skill | ✗ | 막힘 0 |
| r3 | main | 3/3 | ✓ | kind:skill | ✗ | 막힘 0 |
| r4 | + upsert_database_utility 설명 보강 | 3/3 | ✓ | **kind:commonEvent** | ✓ text + recoverAll | 막힘 0 |
| r5 | 〃 | 3/3 | ✓ | **kind:commonEvent** | ✓ text + changeActorHp ×3 | 막힘 0 |
| r6 | 〃 | 3/3 | ✓ | **kind:commonEvent** | ✓ text + recoverAll | 막힘 0 |

- 배우별 명령·이도류는 지시 없이도 6/6.
- 「명령을 고르면 문장」은 설명 보강 전 0/3 → 뒤 3/3. 보강 문장: 대사·여러 효과가 필요하면 commonEvent, 스킬에는 사용 문장 칸이 없다,
  공통 이벤트를 먼저 만든다, 특정 배우만이면 upsert_actor.battleCommandIds.
- r4 프로젝트로 헤드리스 전투(턴 전투, 3명 모두 명령 선택): 토마 「기도」 → 문장 「토마는 두 손을 모아 간절히 기도했다…」 정지 → 확인 →
  파티 HP 5 → 최대치로 회복(그 뒤 적 공격으로 토마 41/100).
- PAW 거절(`Pixel Art World 칩셋만`)·`plan_execution_rekick` 0건.
