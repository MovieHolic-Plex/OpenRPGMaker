# 기본 높이 계단의 돌 디딤판 — 2026-10-03

## 사용자 지적과 원인

PR #1925의 기본 흙벽 양식 계단이 잔디·흙벽을 반복한 사다리처럼 보였다. 당시 칸 수와 배치만 확인해 이 시각 문제를 놓쳤다.
일반 계단의 바닥을 `reliefPaintsCell`이 렌더러에 맡기지 않아 잔디 타일이 계단 그림을 덮었고, 기본 계단은 땅·흙벽 팔레트를 그대로 썼다.

## 즉시 확인

- `editor-3-levels-canvas.png`: 실제 편집기 클릭 배치 후. 돌 디딤판·챌면이 3단 절벽의 윗면에서 아래 평지까지 이어진다.
- `editor-1-levels-canvas.png`: 낮은 1단 절벽과 0단 발치의 연결.
- `engine-3-levels.png`: 공용 렌더러의 그림을 4배 확대했다. 새 그림을 따로 그린 시안이 아니다.
- 수정 전 화면은 `../relief-rough-brush/continued/03-stairs-canvas.png`.

## 실제 편집기 관측

`npm run dev:worktree`의 9833 포트에서 `node scripts/capture/capture-relief-stairs.mjs`로 조작했다.
40×28 메모리 fixture, 기본 버들항 칩셋, 절벽 양식 미지정, 폭 2칸 계단이다.

| 절벽 높이 | 배치된 계단 칸 | 렌더 디딤 수 | undo | redo |
| --- | --- | --- | --- | --- |
| 1단 | 4 | 4 | 원래 ramps 복원 | levels·ramps 일치 |
| 2단 | 6 | 6 | 원래 ramps 복원 | levels·ramps 일치 |
| 3단 | 8 | 8 | 원래 ramps 복원 | levels·ramps 일치 |
| 4단 | 10 | 10 | 원래 ramps 복원 | levels·ramps 일치 |

브라우저 pageerror 0개. 원시 관측은 `editor-observations.json`, 공용 렌더러 재현은 `render-relief-stairs.mts`와 `engine-observations.json`이다.
첫 브라우저 시도는 페이지 로딩에서 네트워크 오류로 완료되지 않았다. 직접 로컬 연결로 다시 실행한 위 캡처는 네 높이 모두 완료했다.

## 변경 범위와 확인 한계

공용 렌더러가 일반 계단을 독립 돌 팔레트로 그리고, 하층 타일·경사로 도트·잔디 턱이 그 면을 덮지 않게 했다.
0단 발치도 불투명하게 그린다. 높이·들림·걷기·저장 필드는 바꾸지 않았다. 바이옴 전용 비탈·판 계단은 기존 경로를 쓴다.
편집기와 플레이어는 같은 `reliefPaintsCell`·`renderRelief`를 사용한다. 이번 실제 브라우저 조작은 편집기 화면이다.

정본 프로젝트 콘텐츠를 수정하지 않았다. fixtures는 코드 확인용이다. AGENTS.md 실행 제한에 따라 gates·vitest·전체 typecheck는 실행하지 않았다.
`reliefStyle.test.ts`의 기본 계단 바닥 소유권·돌색·발치 불투명 회귀 계약은 추가만 했고 미실행이다.
