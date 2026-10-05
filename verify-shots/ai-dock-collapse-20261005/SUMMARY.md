# AI 대화 창 접기 — 2026-10-05

실제 Chromium 편집기 UI에서 **15개 검사 통과**, 브라우저 오류 0건.

## 실측

| 1600px 화면 | AI 도크 | 팀 창 | 지도 영역 |
|---|---:|---:|---:|
| 모두 펼침 | 416px | 300px | 538px |
| AI 창 접음 | 44px | 300px | 910px |
| 둘 다 접음 | 44px | 44px | 1166px |

1024px에서 둘 다 접으면 지도 영역은 590px이다.

## 확인

- 같은 입력·대화 DOM 및 입력 문장, 커서 선택 3~8 유지.
- 접힌 대화는 숨기고 inert 처리; 복원 버튼에 포커스 이동.
- Enter로 복원하고 접기 버튼으로 포커스 복귀.
- 작업 상태 갱신이 접힌 창을 자동으로 펼치지 않음.
- 팀 창 및 왼쪽 도구 선택과 독립적.
- 새로고침 후 두 접힘 선택 복원.
- 공개 `openAiAssistantPanel()`은 AI 창만 펼침.

## 증거와 범위

`report.json`, `01-expanded.png`, `02-ai-collapsed.png`, `03-restored-input.png`,
`04-both-collapsed.png`. `ai-dock-collapse.mp4`는 같은 화면의 실제 녹화에서
초기 로딩을 잘라 만든 로컬 영상이다.

팀 상태·대화 한 줄·복원 상태는 UI 배치 확인용으로 주입했다. 모델 호출 및 정본 콘텐츠
쓰기는 없다. 처음 실행에서 누락 import와 숨겨진 버튼 CSS를 발견해 수정했고, 이후
로딩 시간 제한을 만났다. 개발 서버 재시작 후 최종 실행이 15개를 모두 통과했다.
화면 캡처 전 1px 왕복 resize로 Chromium의 이전 화면 잔상을 제거한다.
AGENTS.md의 세션 제한에 따라 gates, Vitest, 전체 typecheck는 실행하지 않았다.

재실행: `QA_BASE_URL=http://127.0.0.1:9861 node scripts/qa/ai-dock-collapse.mjs`
