# 런타임 QA — interview-handoff

**이 파일을 먼저 읽어라.** PNG 는 아래 표에서 "즉시 확인" 으로 표시된 것만 열어라.
전량 열람은 컨텍스트 낭비다.

- 시각 검토: 별도 판정 필요 — 실행 비트 통과는 공간 구성·물체 식별·게임 경험의 합격을 뜻하지 않습니다.
- 게이트: 실패 (비트 5개 중 4개 실패)
- 열어야 할 샷: 4개 / 전체 샷 5개
- 런타임 에러 1건
- 프로젝트: output/qa/interview-e2e/runtime-project.json
- 시드: 1 / 뷰포트: 1024×768

| 비트 | 의도 | 상태 | 샷 | 볼 이유 |
|---|---|---|---|---|
| title | 저장된 AI 타이틀이 내보내기 플레이어에서 열린다 | 통과 | 01-title.png | 시각 확인 대기 |
| opening | 새 게임에서 시네마틱 오프닝으로 들어간다 | 실패 | 02-opening.png | 게이트 실패 — 즉시 확인 |
| field | 오프닝 건너뛰기 → 실제 시작 맵과 스프라이트 | 실패 | 03-field.png | 게이트 실패 — 즉시 확인 |
| neighbor | AI가 저장한 이웃 NPC 첫 대사를 읽는다 | 실패 | 04-neighbor.png | 게이트 실패 — 즉시 확인 |
| choices | 첫 대사를 넘기면 두 선택지가 표시된다 | 실패 | 05-choices.png | 게이트 실패 — 즉시 확인 |

## 실패 상세

### opening
- op waitFor 실패: page.waitForFunction: Timeout 30000ms exceeded.
- testid 누락: cinematic-sequence

### field
- op waitForRuntime 실패: page.waitForFunction: Timeout 30000ms exceeded.
- 런타임 훅 없음 — 상태를 읽을 수 없다(mapId 확인 불가)
- 런타임 훅 없음 — 상태를 읽을 수 없다(x 확인 불가)
- 런타임 훅 없음 — 상태를 읽을 수 없다(y 확인 불가)
- playerSprite: 텍스처가 로드되지 않았다(없음) — resourceId=없음

### neighbor
- op face 실패: page.evaluate: QA scene did not become ready
- testid 누락: dialogue-box

### choices
- op pressUntil 실패: pressUntil: Enter 12회 뒤에도 runtime-choices 가 present 가 되지 않았다
- testid 누락: runtime-choices
- visibleText: runtime-choices 노드가 DOM 에 없다(기대 "반갑게 인사한다")

## 런타임 에러

- `QA scene did not become ready`
