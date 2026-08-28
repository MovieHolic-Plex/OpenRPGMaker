# 2026-08-28 첫 실행 감독 브리핑(editor-welcome) 적대적 리뷰

- 생성일: 2026-08-28
- 기준 브랜치/커밋: `fix/database-modal-uiux` @ `83b2826a`
- 대상: `src/editor/editorWelcome.ts`, `src/styles/shell/editor-welcome.css`, `src/editor/welcomeGenrePresets.ts`
- 실측 환경: `http://localhost:9999/?forceWelcome=1`, Playwright headless Chromium, `localStorage.oprn:editor-welcome-dismissed` 제거 후 진입
- 증거: `verify-shots/welcome-adversarial/` — 뷰포트별 스크린샷 6장, `metrics.json`(레이아웃 실측), `a11y-probe.json`(키보드·해제·중복 온보딩 실측)
- 재현 스크립트: `scripts/tmp-welcome-adversarial-shots.mjs`, `scripts/tmp-welcome-a11y-probe.mjs`

## 범위 선언 — 모바일은 대상 아님

390×844에서 스테이지가 1379px로 넘치고 제목·입력창이 뷰포트 위로 빠져 클릭 불가인 현상을 실측했으나, **모바일 레이아웃은 제품 범위가 아니므로 결함으로 취급하지 않는다.** 기록만 남긴다: 좁은 폭에서 캔버스 rect 고정 때문에 스테이지가 뷰포트를 벗어나고 `stage`/`briefing` 모두 `overflow-y: visible`이라 어떤 스크롤도 먹지 않는다. 추후 모바일을 지원하기로 결정하면 이 항목이 최우선 블로커가 된다. 아래 결함 목록은 전부 데스크톱/태블릿 폭에서 재현된 것이다.

---

## 1. 치명 — 온보딩 표면이 두 개, 서로 다른 질문을 동시에 던진다

- 근거: `768x1024.png`, `a11y-probe.json > competingOnboarding`
- 브리핑이 열린 상태에서 조수 독이 그대로 살아 있다. 실측 `520×620`, `opacity: 1`, 블러 없음, 스크림 위에 렌더.
- 조수 독: **이 맵에 무엇을 둘까요** + 자체 길/NPC 칩 + **빈 맵이에요. 아래 중 하나를 누르면 바로 시작합니다.**
- 브리핑: **어떤 게임을 만들까요?** + 자체 프롬프트 입력창 + 카드 5장.
- 결과적으로 입력창 2개, "아래 중 하나를 누르세요" 지시 2개가 동시에 뜨고 내용이 서로 모순된다. 첫 실행 사용자가 어디에 뭘 쳐야 하는지 판단할 근거가 없다.
- `body`에 `director-briefing-open`이 붙는 것은 확인했다(`bodyClass: "… editor-ui-beginner director-briefing-open"`). 이 클래스로 독을 억제하는 규칙이 없는 것이 원인.
- 조치: `director-briefing-open` 동안 조수 독/커맨드바를 숨기거나 비활성화한다. 브리핑을 닫을 때 독이 다시 뜨도록 복구 경로도 같이 확인한다.

## 2. 치명 — 모달이라고 선언만 하고 모달 동작이 전부 없다

`editorWelcome.ts:438-439`에 `role`, `aria-modal="true"`, `aria-labelledby="editor-welcome-title"`가 있으나 대응 동작이 없다.

- **Escape 무반응**: `a11y-probe.json > escape.overlayStillMounted: true`. 키다운 핸들러는 `promptInput`의 것(`editorWelcome.ts:361`)뿐이고 Escape 처리가 없다.
- **포커스 트랩 없음**: `tabTrap.firstEscapeAt: 14`. Tab 15번째에 포커스가 스크림 뒤 `oprn-menu-item`, `authoring-task-btn`으로 빠진다. 랩도 없다. 키보드·스크린리더 사용자는 시각적으로 비활성인 크롬에 갇히고 브리핑으로 돌아올 경로가 없다.
- **스크림 클릭 해제 없음**: `scrimClick.overlayStillMounted: true`. `editorWelcome.ts:469`의 스크림은 `aria-hidden`만 달려 있고 핸들러가 없다.
- 결과적으로 유일한 탈출구가 빈 맵으로 시작 하나인데, 실측 히트 영역이 `73×17`, 폰트 12px이다. WCAG 2.2 AA 최소 타깃(24×24)에 미달.
- 조치: Escape 핸들러 + 포커스 트랩(첫/마지막 포커서블 랩) + 스크림 클릭 해제를 추가하고, 스킵 버튼 히트 영역을 최소 24×24 이상으로 키운다.

## 3. 중대 — 카드 5장이 전부 동일한 하드코딩 라벨

- 근거: `editorWelcome.ts:421` — `text: "빈 프로젝트 시스템 설정"`이 카드 루프 안에서 상수로 렌더된다. `aria-label`만 `${card.label} 빈 프로젝트 시스템 프리셋 적용`으로 구분된다.
- 화면상 버튼 5개의 보이는 문자열이 완전히 같아서, 어떤 장르의 시스템 프리셋인지 눈으로 구분할 수 없다.
- 768px 폭에서는 각 라벨이 2줄로 줄바꿈된다(`starterLineCount: [2,2,2,2,2]`, `starterWraps: [38,38,38,38,38]`).
- 카드 bottom은 818로 동일한데 스타터 top이 `774/780/780/774/774`로 어긋나 행이 깨져 보인다. 카드 본문 높이 차이가 그대로 버튼 위치로 전이된다.
- 조치: 라벨에 장르를 넣거나(예: `모험 마을 시스템`) 카드 라벨과 결합해 표시하고, 카드 본문을 고정 높이 또는 `align-items: end` 그리드로 묶어 스타터 버튼 baseline을 맞춘다.

## 4. 경미 — 프롬프트 입력창 포커스 링이 평상시와 구분 불가

- 근거: `a11y-probe.json > contrastAndTargets.inputBoxShadowWhenBlurred: "rgba(74, 87, 214, 0.45) 0px 0px 0px 2px"`
- blur 상태에서도 2px 보라 링이 유지되므로 포커스 여부를 시각적으로 알 수 없다.
- 조치: 평상시는 중립 보더, `:focus-visible`에서만 강조 링을 주도록 분리한다.

## 5. 문제없음으로 확인된 항목

명암비는 기준을 넉넉히 통과한다. 이 부분은 손대지 않아도 된다.

| 요소 | 색 | 크기 | 스테이지 대비 |
| --- | --- | --- | --- |
| `.editor-welcome-skip` | `rgb(98,110,137)` | 12px | 5.11:1 |
| `.editor-welcome-template-blurb` | `rgb(71,85,105)` | 11px | 7.58:1 |
| `.editor-welcome-card-inspiration` | `rgb(71,85,105)` | 11px | 7.58:1 |

---

## 수정 순서 제안

1. 조수 독 억제 (치명-1) — 첫 실행 혼란의 직접 원인, 변경 범위가 작다.
2. Escape + 포커스 트랩 + 스크림 해제 + 스킵 타깃 확대 (치명-2).
3. 스타터 라벨 구분 + 카드 baseline 정렬 (중대-3).
4. 입력창 포커스 링 분리 (경미-4).

모바일 레이아웃은 범위 외로 두고 진행한다.
