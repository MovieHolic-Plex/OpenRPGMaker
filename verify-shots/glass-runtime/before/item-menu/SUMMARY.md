# 런타임 QA — item-menu

**이 파일을 먼저 읽어라.** PNG 는 아래 표에서 "즉시 확인" 으로 표시된 것만 열어라.
전량 열람은 컨텍스트 낭비다.

- 게이트: 통과 (비트 9개 중 0개 실패)
- 열어야 할 샷: 0개 / 전체 샷 6개
- 런타임 에러: 없음
- 프로젝트: test/fixtures/projects/item-runtime-qa-v3.json
- 시드: 1 / 뷰포트: 1024×768

| 비트 | 의도 | 상태 | 샷 | 볼 이유 |
|---|---|---|---|---|
| title | — | 통과 | — | — |
| field-start | 새 게임을 시작하고 실제 아이템 효과가 보이도록 파티 전원의 HP와 MP를 낮춘다 | 통과 | — | — |
| status-menu-open | 필드에서 취소 키로 상태 메뉴를 연다 | 통과 | — | — |
| hp-before-100-item-list | 아이템 기능에 들어가 회복약 사용 전 주인공 HP 100/514를 확인한다 | 통과 | 04-hp-before-100-item-list.png | 시각 확인 대기 |
| hp-after-150-item-list | 회복약을 주인공에게 사용해 HP가 100에서 150으로 오른 결과를 확인한다 | 통과 | 05-hp-after-150-item-list.png | 시각 확인 대기 |
| mp-before-5-item-list | 마력약 사용 전 주인공 MP 5/43을 확인한다 | 통과 | 06-mp-before-5-item-list.png | 시각 확인 대기 |
| mp-after-35-item-list | 마력약을 주인공에게 사용해 MP가 5에서 35로 오른 결과를 확인한다 | 통과 | 07-mp-after-35-item-list.png | 시각 확인 대기 |
| party-hp-before-100-item-list | 연대의 물약 사용 전 나머지 세 파티원의 HP 100/514를 확인한다 | 통과 | 08-party-hp-before-100-item-list.png | 시각 확인 대기 |
| party-hp-after-160-item-list | 연대의 물약을 사용해 주인공 HP가 150에서 210, 나머지는 100에서 160으로 함께 오른 결과를 확인한다 | 통과 | 09-party-hp-after-160-item-list.png | 시각 확인 대기 |
