# 런타임 QA — life-full

**이 파일을 먼저 읽어라.** PNG 는 아래 표에서 "즉시 확인" 으로 표시된 것만 열어라.
전량 열람은 컨텍스트 낭비다.

- 시각 검토: 별도 판정 필요 — 실행 비트 통과는 공간 구성·물체 식별·게임 경험의 합격을 뜻하지 않습니다.
- 게이트: 통과 (비트 10개 중 0개 실패)
- 열어야 할 샷: 0개 / 전체 샷 10개
- 런타임 에러: 없음
- 프로젝트: test/fixtures/life-full.project.json
- 시드: 18 / 뷰포트: 1024×768

| 비트 | 의도 | 상태 | 샷 | 볼 이유 |
|---|---|---|---|---|
| field-start | 새 게임 → 농장 시작. 기력 100, 씨앗 3, 수확물 없음 | 통과 | 01-field-start.png | 시각 확인 대기 |
| till-plot | 밭(4,5)로 내려가 괭이(손 슬롯 1)로 실제 경작 | 통과 | 02-till-plot.png | 시각 확인 대기 |
| sow-seed | 감자 씨앗(손 슬롯 5)으로 실제 파종 — 씨앗이 하나 줄어야 한다 | 통과 | 03-sow-seed.png | 시각 확인 대기 |
| water-plot | 물뿌리개(손 슬롯 3)로 실제 급수 | 통과 | 04-water-plot.png | 시각 확인 대기 |
| sleep-day1 | 침대(3,3) 조사 → 안내문 → 확인 → sleepUntilMorning. 하루가 실제로 넘어가고 물 준 작물이 자란다. 앞 판에서 mapId 만 단정했더니 잠들지 않았는데도 통과했다 — 여기서는 작물 growthDays 로 하루 전환 자체를 단정한다 | 통과 | 05-sleep-day1.png | 시각 확인 대기 |
| water-day2 | 이틀째 급수 — 감자는 stages [1일,1일] 이라 하루 더 자라야 수확기가 된다 | 통과 | 06-water-day2.png | 시각 확인 대기 |
| sleep-day2 | 다시 수면 → 이틀째 전환. 작물이 수확기(growthDays 2)가 된다 | 통과 | 07-sleep-day2.png | 시각 확인 대기 |
| harvest-potato | 수확기 작물을 실제로 수확 → 감자 1개, 밭이 비고 농사 XP | 통과 | 08-harvest-potato.png | 시각 확인 대기 |
| ship-potato | 상태 메뉴(Escape) → 생활 원장 출하 탭에서 수확한 감자를 실제로 출하함에 넣는다. 출하 투입은 월드 오브젝트가 아니라 원장 메뉴가 소유한다(lifeLedger.ts:depositShipping) | 통과 | 09-ship-potato.png | 시각 확인 대기 |
| open-record-group | 레일은 접힌 그룹으로 렌더된다(실측 덤프: record-menu 가 관문이고 life-ledger 는 그룹을 연 뒤에 나타난다). 실제 그룹 항목을 눌러 펼친다 | 통과 | 10-open-record-group.png | 시각 확인 대기 |
