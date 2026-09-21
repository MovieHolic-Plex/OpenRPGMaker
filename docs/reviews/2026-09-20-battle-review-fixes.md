# 전투 적대적 리뷰 후속 수정 — 2026-09-20

원본: [30인 리뷰](2026-09-19-battle-adversarial-review-30.md).
전체 78항목을 완료한 변경이 아니다. 현재 코드에서 확인한 데이터 오염·명령 오발동과
범위가 작은 입력/표시 결함을 우선 수정했다. 콘텐츠 프로젝트는 저작하지 않았다.

## 반영

| 원본 항목 | 수정 계약 |
|---|---|
| U06 동시 전멸 | 일반/Gen1 모두 파티 전멸을 승리보다 먼저 판정. 보상/승리 자동저장 차단 |
| A05·A01-3 M2 대상 폴백 | 적 HP/MP/상태 변경의 빈/없는 대상은 unsupported. 다른 적으로 대체하지 않음 |
| A01-3 M2 fields | 공통 shape와 저수준 도구에서 commandId/객체 fields 요구. 전투 파서는 잘못된 fields를 안전하게 거절 |
| A01-1·D05-1 트룹 수정 | enemyIds-only 패치는 상속 members를 교체. 나머지 패치는 수동 배치 유지 |
| A01-2 admission | 실제 로스터의 누락 적을 BATTLE_ENEMY_MISSING으로 보고. 숨은 멤버 포함 |
| D02-1 M2-092 | 리치 폼의 target=actor + actorId, 기존 직접 id/party 형식을 함께 해석 |
| U02-1 내부 로그 노출 | eventLogs→director 덮어쓰기 제거. 대사는 기존 eventPause/DialogueUI로 표시 |
| U03-1·2 입력 | F/Shift repeat 차단, AUTO/스킵 분기보다 먼저 Shift 조합 기록 |
| U11-2 레벨업 | HP 0인 액터의 최대 HP만 성장. 묵시적 소생 제거 |
| U11-1 타이머 | timerActivityWrites를 추가해 set/start/stop을 복귀 커밋에서 runtimeTimers에도 반영 |
| D08·D09 문서 일부 | 실제 CSS 매니페스트/레이어·포켓몬 리프 경로·액션 데모 맵 id 교정, 상태이상/액션 전투 진입표 추가 |

M2 참조의 저작/삭제 가드 전체 확장, AUTO/배속 상태 표시, 적 ATB 예고, underfill·대형 적
진형, 포획/hidden 적 종결 정책, 엔진 분해·receipt·CI·성능 변경은 남겨 두었다.
특히 hidden 적 종결 정책은 숨은 증원/Gen1 대기 로스터를 함께 판단해야 하므로 단순한
승리 술어 교체를 채택하지 않았다. 기존 UI 계약이 제거한 버튼 바도 복원하지 않았다.

## 확인 범위

- 회귀 사례 추가: `test/battleReviewIntegrity.test.ts`, `test/dbToolsIntegrity.test.ts`,
  `test/battleRewardsToSession.test.ts`, `test/gen1RuntimeExactIntegration.test.ts`.
- **tests, vitest, gates, typecheck는 실행하지 않았다.** 세션 AGENTS.md의 명시적 실행 제한을 따랐다.
  테스트 코드를 추가했다는 사실은 통과 증거가 아니다.
- `git diff --check`로 공백 오류를 확인했다.
- 별도 Vite player QA 서버 + Chromium에서 `player.html`과 export-store shim을 사용했다.
  `battle-v3.json`의 격리된 단위 QA 사본에 wait/flag 페이지를 추가하고 실제 키보드로
  전투 진입 → 방어 → 이벤트 → 명령 복귀를 관측했다. 외부 네트워크는 차단했다.
  편집기 셸과 원격 프로젝트 저장은 사용하지 않았다.

| 브라우저 관측 지점 | 관측값 |
|---|---|
| 방어 후 wait/flag 종료 | phase=actorCommand, busy=false, 메시지 `주인공은 무엇을 할까?` |
| F 최초 / 반복 keydown | 두 번 모두 auto=true, speed=1.8 |
| F 해제 후 다시 누름 | auto=false |
| Shift+Z 연출 스킵 | 일시 speed=5.0 → 연출 종료 후 speed=1.8 |
| 브라우저 pageerror | 0건 |

[이벤트 후 명령 화면](evidence/2026-09-20-battle-review-after-event.png).
위 관측은 메시지/입력 경로만 확인하며 전체 전투 UI·저해상도 배치 검증을 뜻하지 않는다.
