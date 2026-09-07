# AI 조수 UI 수정 검증

[원 조사](2026-09-06-ai-assistant-ui-audit.md)의 F1–F10을 수정했다. 원 보고서는 당시 상태를 보존하며, 이 문서는 수정 방식과 재현·검증 근거를 기록한다.

## 수정 계약

| 항목 | 수정 | 근거 |
|---|---|---|
| F1 팝오버 잘림 | `aiComposer`가 기존 `anchoredPopupPosition`으로 뷰포트 안 좌표를 계산하고 레일 기준으로 환산한다. 열려 있는 내용·데크 크기, 창 크기와 스크롤에 맞춰 재배치한다. | 전체 기록의 세 팝오버 y=97, hit-test 성공. 긴 대화 메뉴 y=227..505, 실제 내보내기 클릭 성공. |
| F2 기록 접기 | 접기 전에 전체 기록 상태를 해제한다. | 데크 숨김, 복원 버튼 표시 및 복원 확인. |
| F3 기록→스튜디오 | 스튜디오 진입 시 `is-history-open`도 제거해 두 표면이 공존하지 않게 한다. | 이전 데크 숨김과 실제 `편집기로` 클릭 성공. |
| F4 기록 닫기 | 메뉴 액션의 강제 `true`를 제거하고 두 메뉴의 표시 라벨·`aria-expanded`를 함께 갱신한다. | 가시 메뉴 재클릭으로 float 복귀. |
| F5 스튜디오 열 접기 | 저장하는 펼침 너비와 CSS가 소유하는 현재 열 너비를 분리한다. | 두 열 52px, 모니터 712→1260px. 펼침·저장 너비·키보드·드래그·초기화 회귀 확인. |
| F6 설정 반영 | 현재 패널이 설정 문맥을 등록해 톱바와 패널 진입점 모두 같은 콜백·루트를 사용한다. | 글자 large와 자율성 max가 현재 패널·컴포저에 즉시 반영된다. 기존 농도 반영도 유지된다. |
| F7 모달 포커스 | 최상위 모달의 실제 Tab 경계를 계산하고 opener를 복원한다. 설정 저장으로 톱바 버튼이 교체되는 경우도 처리한다. | settings/history 순환·복원, 중첩 select의 첫 Escape, 패널 메뉴 opener, 교체된 톱바 회귀. |
| F8 설정 항목 차이 | 등록된 패널의 대기 화면 절을 모든 설정 진입점에 제공한다. | 두 경로에서 map-first / ink-only / quiet-gold 반영. |
| F9 빈 내보내기 | 메뉴와 숨은 버튼이 같은 내보내기 함수를 호출한다. disabled 버튼의 `.click()`에 의존하지 않는다. | 빈 대화 안내 표시, 비어 있지 않은 대화의 실제 파일 다운로드 성공. |
| F10 유휴 리사이즈 | 명시한 사용자 폭을 compact 기본값보다 우선하고 실제 데크 크기로 ARIA를 동기화한다. | 방향키·80px 드래그·입력 포커스·재로드 후 크기와 접근성 값 일치. |

## RED → GREEN

구현 전에 각 원인을 실패로 확인했다. CSS 문자열의 존재나 문구를 고정하는 대신 실제 상태·계산된 스타일·DOM 동작을 검사했다.

| 범위 | RED | GREEN 채널 |
|---|---|---|
| F1 | 현재 main에서 메뉴 y=-227 | 실제 편집기 좌표·hit-test·클릭 |
| F2/F3/F4 | `aiPanelChrome`: 상태가 false여야 하는데 true; 브라우저 데크가 계속 visible | 같은 단위 테스트 및 실제 전환 |
| F5 | default/saved 열이 252/400, 316/464로 남음 | 실제 스타일시트 cascade 테스트 2개 및 실제 grid 측정 |
| F6/F8 | topbar parity 3개 실패: font/session/temperature | 두 진입점 단위 테스트 및 실제 설정 조작 |
| F7 | 기존 포커스 15개, 숨은 메뉴 opener 1개, 교체된 topbar opener 1개 실패 | native DOM 회귀 및 실제 키보드 |
| F9 | native DOM에서 toast가 null | 같은 테스트 및 실제 빈/비어 있지 않은 내보내기 |
| F10 | 실제 모듈+CSS seam에서 저장 488px, 표시 480px | 실제 페이지의 크기·ARIA·저장 검증 |

FakeDom의 `.click()`은 native disabled 동작을 보존하지 않아 F9를 놓쳤다. 새로 작성했던 무효 검사를 사용하지 않고 Happy DOM 기반 테스트로 대체해 실제 RED를 확인했다.

## 실제 브라우저

전용 서버 `29843`과 별도 Chromium 프로필을 사용했다. 다른 워크트리의 `19841` 서버는 사용하거나 종료하지 않았다. 최종 검증 전 서버를 재시작해 이전 Vite 모듈과 새 소스가 섞이지 않게 했다.

```sh
DEV_SERVER_PORT=29843 DEV_SERVER_NO_TLS=1 E2E_FREEZE_DEV_SERVER=1 \
  npm run dev:worktree -- --port 29843

TMPDIR=/dev/shm/rpg-ai-ui-tmp DEV_SERVER_PORT=29843 \
  E2E_STATIC_RELAY=1 E2E_RETRIES=0 AI_UI_PHASE=green \
  PLAYWRIGHT_JSON_OUTPUT_NAME=output/evidence/ai-ui-fixes/e2e-results.json \
  npx playwright test test/e2e/ai-ui-audit-fixes.spec.ts \
  --project=chromium --reporter=list,json \
  --output /dev/shm/rpg-ai-ui-final-results
```

자동 회귀는 `blankProject=1`의 실제 편집기, 수동 확인은 `freshProject=1`의 예제 마을에서 실행했다. 두 경로 모두 UI 검증용 임시 프로젝트이며 원격 게임 콘텐츠를 저작하지 않았다. LLM 응답은 읽기 전용 fixture로 공급했고 전송·중단·복원·다운로드는 실제 UI를 통과했다.

정적 GET 중계는 이 호스트의 Chromium 네트워크 문제를 피하기 위한 것이다. UI 응답을 변경하지 않으며, 테스트 서버의 설정된 origin에서 가져온 원본 내용을 전달한다. 실제 모델 품질이나 OAuth 변경을 검증했다는 뜻은 아니다.

## 증거

- [수동 패널·스튜디오 실측](../../output/evidence/ai-ui-fixes/manual-root.json)
- [긴 대화·포인터 내보내기](../../output/evidence/ai-ui-fixes/manual-conversation.json)
- [설정·포커스 RED/GREEN](../../output/evidence/ai-ui-fixes/manual-settings.json)
- [실제 전송 중단](../../output/evidence/ai-ui-fixes/manual-abort.json)
- [스크린샷과 최종 실행 결과](../../output/evidence/ai-ui-fixes/README.md)

이미지 입력을 지원하지 않는 모델 환경이어서 픽셀을 보고 검토했다고 주장하지 않는다. PNG는 실제 캡처이며, 판정은 계산된 기하·focus·hit-test·실제 입력 결과에 근거한다.

## 최종 검증 및 정리

- 브라우저 매트릭스: `test/e2e/ai-ui-audit-fixes.spec.ts` **PASS 24/24, exit 0**
  (1440x900 12건 + 1024x768 12건, F1–F10 전 항목). 중단했던 이전 실행과 환경 오류는
  최종 PASS로 집계하지 않는다.
- `npm run build`: **PASS, exit 0** (app 1,527 / player 562 / standalone 564 모듈).
- `npm run typecheck:app`: **PASS, exit 0**.
- `npm run gates -- --json`: typecheck·css 통과. vitest/surface 실패는 기준선에 이미
  포함된 항목(테스트 기준선 98개 실패 파일, surface 기준선 축의 동일 eventEditor
  baseline)이며, 변경 관련 16개 파일 175개 테스트는 직접 실행에서 전부 통과한다.
- 정리: 검증 서버(29842/29843), 격리 브라우저 프로필·컨텍스트, sparse 작업 트리
  2개, 작업 임시 디렉토리를 모두 종료·삭제했다. 다른 워크트리와 서버는 건드리지
  않았다.
