# 런타임 QA — feature16-player

**이 파일을 먼저 읽어라.** PNG 는 아래 표에서 "즉시 확인" 으로 표시된 것만 열어라.
전량 열람은 컨텍스트 낭비다.

- 시각 검토: 별도 판정 필요 — 실행 비트 통과는 공간 구성·물체 식별·게임 경험의 합격을 뜻하지 않습니다.
- 게이트: 통과 (비트 9개 중 0개 실패)
- 열어야 할 샷: 0개 / 전체 샷 6개
- 런타임 에러: 없음
- 프로젝트: verify-shots/runtime-qa/_fixtures/feature16-player.json
- 시드: 1 / 뷰포트: 960×720

| 비트 | 의도 | 상태 | 샷 | 볼 이유 |
|---|---|---|---|---|
| field | — | 통과 | — | — |
| filtered-inventory | Real keyboard: Esc → items → last controls → usable types. Equipment is hidden, never removed. | 통과 | 02-filtered-inventory.png | 시각 확인 대기 |
| sorted-inventory | — | 통과 | 03-sorted-inventory.png | 시각 확인 대기 |
| equipment-filter | — | 통과 | 04-equipment-filter.png | 시각 확인 대기 |
| restore-inventory | — | 통과 | — | — |
| settings | Esc system group opens device options using visible semantic buttons. | 통과 | 06-settings.png | 시각 확인 대기 |
| settings-changed | — | 통과 | 07-settings-changed.png | 시각 확인 대기 |
| shop-entry | — | 통과 | — | — |
| shop | Split shop shows real buy/sell tabs; upgrade/exchange placeholders are removed. | 통과 | 09-shop.png | 시각 확인 대기 |
