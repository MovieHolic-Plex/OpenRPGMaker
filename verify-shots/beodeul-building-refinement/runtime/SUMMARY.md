# 런타임 QA — beodeul-architecture

**이 파일을 먼저 읽어라.** PNG 는 아래 표에서 "즉시 확인" 으로 표시된 것만 열어라.
전량 열람은 컨텍스트 낭비다.

- 시각 검토: 별도 판정 필요 — 실행 비트 통과는 공간 구성·물체 식별·게임 경험의 합격을 뜻하지 않습니다.
- 게이트: 통과 (비트 9개 중 0개 실패)
- 열어야 할 샷: 3개 / 전체 샷 9개
- 런타임 에러: 없음
- 프로젝트: output/beodeul-building-refinement/reloaded-project.json
- 시드: 1 / 뷰포트: 1024×768

| 비트 | 의도 | 상태 | 샷 | 볼 이유 |
|---|---|---|---|---|
| title | — | 통과 | — | — |
| village-start | SQLite 재로드한 3/4 민가 5채와 교회 마을 | 통과 | 02-village-start.png | 시각 확인 대기 |
| house-1 | bd-house-village-cream의 문 앞까지 길로 도보 이동 | 통과 | 03-house-1.png | 시각 확인 대기 |
| house-2 | bd-house-village-brick의 문 앞까지 길로 도보 이동 | 통과 | 04-house-2.png | 즉시 확인: 아치창·통일 벽돌·기초·옆벽 |
| house-3 | bd-house-village-stone의 문 앞까지 길로 도보 이동 | 통과 | 05-house-3.png | 시각 확인 대기 |
| house-4 | bd-house-village-sage의 문 앞까지 길로 도보 이동 | 통과 | 06-house-4.png | 시각 확인 대기 |
| house-5 | bd-house-village-ochre의 문 앞까지 길로 도보 이동 | 통과 | 07-house-5.png | 시각 확인 대기 |
| church | bd-house-village-church의 문 앞까지 길로 도보 이동 | 통과 | 08-church.png | 즉시 확인: 교회 지붕 윗면·첨탑 면·석조 옆벽·문 앞 연결 |
| well-return | 우물 마당으로 도보 복귀 | 통과 | 09-well-return.png | 시각 확인 대기 |

## 전체 시각 확인

- **즉시 확인:** `overview-player.png` — 같은 실제 플레이어의 카메라만 축소해 전체 5채와 교회를 확인한다.

시각 검토 완료: 아치창 집/교회 문 앞/전체 카메라 PNG를 직접 열었다.
지붕 윗면·후퇴한 옆벽·앞벽 기초·각 건물의 한 문과 실제 플레이어가 보인다.
전체 카메라가 처음에는 고정 배율로 양옆을 잘랐으므로 시작 2비트만 다시 열어 뷰포트 맞춤 배율로 교체했다.
자세한 근거는 `overview/SUMMARY.md`. 임의 축소 배율은 타일 경계선을 드러내므로 정수 전체 렌더는 상위 `village-overview.png`다.
