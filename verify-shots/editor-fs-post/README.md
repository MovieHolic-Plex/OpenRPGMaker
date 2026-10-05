# 앱 전체화면 「축소」 결함 수정 — 증거

사용자 보고: "앱이 전체화면으로 들어간 다음 축소가 안됨.. 오른쪽 상위 버튼" (2026-10-05).

## 원인

`electron/main/main.ts` 가 창을 `fullscreen: true`(네이티브 전체화면)로 띄운다. 편집기 상단바
오른쪽 「전체화면」 버튼(`src/editor/panels/menu.ts` renderFullscreenButton)은 **브라우저
Fullscreen API**(`document.documentElement.requestFullscreen`/`exitFullscreen`)만 썼다 —
이 창에서는 `document.fullscreenElement` 만 바뀌고 **창 크기는 그대로**여서 「축소」가 되지 않았다.
(시작 화면의 「화면 전환」 은 네이티브 창 컨트롤을 써서 정상 동작했다.)

## 수정

- 상단바 버튼은 데스크톱 브릿지(`window.oprn.windowControl`)가 있으면 시작 화면과 같은 네이티브
  창 컨트롤로 토글하고, 없으면(브라우저·팀 페이지) 기존 브라우저 경로를 그대로 쓴다.
- 전체화면 상태 동기화: 네이티브 전체화면은 `fullscreenchange` 를 일으키지 않으므로
  IPC `oprn:window.fullscreen`(조회 + `enter/leave-full-screen` 푸시)을 더해 아이콘(`aria-pressed`)이
  F11·메뉴 등 버튼 밖 변경에도 맞는다.

## 검증 (실화면)

Xvfb + 창 관리자(xfwm4 — 베어 Xvfb 는 WM 이 없어 창 크기가 안 변한다). 편집기를 실제 프로젝트 위에서 띄우고
`[data-testid="window-fullscreen"]` 를 두 번 클릭했다.

| 단계 | isFullScreen | 창 크기 | aria-pressed |
|---|---|---|---|
| 시작 | true | 1280×1024 | true |
| 클릭 1 (축소) | **false** | **1280×800** | false |
| 클릭 2 (확대) | true | 1280×1024 | true |

- `editor-fs-pre/` — 수정 전. 클릭 후에도 창이 1280×1024 그대로였다(축소 안 됨).
- `editor-fs-post/` — 수정 후. 클릭 1 에 창이 1280×800 으로 줄고, 클릭 2 에 복원됐다.
- 저장소 QA 스크립트 `scripts/qa/maker-fullscreen-electron.mjs`(시작 화면 「화면 전환」 회귀) — `passed: true`.
- `tsc --noEmit -p tsconfig.app.json` 통과, `vite build`·`electron:build` 통과.
- 로직 검증(vite-node 스크래치): 브릿지 토글·aria 동기·브라우저 폴백 7/7 PASS.
