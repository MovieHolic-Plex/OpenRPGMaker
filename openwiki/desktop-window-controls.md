# 데스크톱 창 컨트롤 (제목줄·창 단추)

2026-10-14. Electron 앱 창의 최소화·최대화/복원·전체화면·닫기와 창 끌기. 브라우저·팀 페이지에는 없다.

## 한눈에

| 플랫폼 | 창 옵션 | 오른쪽 위 | 왼쪽 위 |
|---|---|---|---|
| Windows | `frame: false` | 전체화면 · ─ · ▢/❐ · ✕ (닫기 호버 빨강, 46px 칸) | — |
| Linux | `frame: false` | Windows 와 같은 순서·기호 (36px 둥근 칸) | — |
| macOS | `titleBarStyle: "hiddenInset"` + `trafficLightPosition` | 없음 (OS 신호등이 있다) | 신호등 + 렌더러가 비운 여백 82px |

- 창은 `fullscreen: true` 로 뜬다(기존 동작 유지). 전체화면 단추로 1280×800 창 모드로 나온다. 최소 창 크기 1100×600.
- Windows 는 `titleBarOverlay`(OS가 단추를 그림)와 DOM 단추를 비교해 **DOM 단추**를 골랐다. 이유: ① 전체화면 단추를 같은 줄에
  둘 수 없다(오버레이는 OS 세 개 고정) ② 라벨·툴팁·i18n·테마 토큰을 우리가 통제 ③ 이 저장소 Linux 에서도 같은 코드가
  실제로 검증된다. 대가: Windows 11 「스냅 레이아웃」(최대화 단추 호버 팝업)이 없다 — 필요하면 Windows 만
  `titleBarOverlay` 로 바꾸되 전체화면 단추는 별도 자리에 남겨야 한다.
- 팀 참여 창(`electron/main/teamWindow.ts`)은 원격 페이지·프리로드 없음 → 기존 OS 제목줄 그대로, 우리 단추 없음.

## 코드 지도

| 위치 | 역할 |
|---|---|
| `electron/shared/windowControl.ts` | 동작 이름 `toggle-fullscreen｜minimize｜toggle-maximize｜close`, `WindowState`, `windowChromeFor(platform)` — 메인·프리로드·렌더러가 같은 표를 본다 |
| `electron/shared/channels.ts` | `windowControl`(invoke), `windowFullscreen`(기존), **`windowState`**(조회 invoke + 변화 push, 같은 이름) |
| `electron/main/main.ts` | `chromeOptions`, 동작 검증(`isWindowControlAction` 밖의 값은 `false`), maximize/unmaximize/restore/minimize/enter·leave-full-screen → `windowState` push |
| `electron/main/directoryDialog.ts` | 폴더 선택 대화상자를 살아 있는 앱 창에 붙인다. 파일 메뉴는 스플래시·팀 창이 아니라 그 창을 고른다 |
| `electron/preload/index.ts` | `oprn.platform`(동기), `oprn.windowState()`, `oprn.onWindowState(cb)` |
| `src/app/windowChrome.ts` | `desktopWindowChrome()` — 브릿지가 없으면 `null`(브라우저·팀) |
| `src/start/windowControls.ts` | 단추 마운트(`src/main.ts`·`startScreen.ts` 가 `mountWindowControls()` 호출, 한 번만 단다) |
| `src/styles/shell/window-controls.css` | 단추·여백·끌기 영역. **레이어 밖(unlayered)** — 시작 화면과 편집기는 `@layer` 순서가 달라서 |
| `scripts/qa/window-controls.mjs` | 실제 Electron + xdotool 실측(아래) |

## 계약

- **닫기는 우회하지 않는다.** `close` 동작은 `window.close()` 이고 `installCloseFlow` 가 가로채 flush → ack → destroy 한다
  (미저장 flush 가 먼저). 편집기에서 `flushBeforeClose` 수신 1회 실측. 시작 화면은 열린 세션이 없어 바로 닫힌다.
- **폴더 선택 대화상자는 앱 창에 붙인다.** 시작 화면 「폴더 열기」·파일 메뉴는 `electron/main/directoryDialog.ts` 가 살아 있는 편집기 창을 부모로 넘긴다. 부모 없이 열면 모달이 아니어서 전체화면 창 뒤로 가고, 시작 화면은 그동안 바빠 보인다. 포커스가 스플래시·팀 창이어도 파일 메뉴는 그 창이 아니라 앱 창을 쓴다. 열기에 실패하면 메시지 상자를 띄운다.
- **전체화면에서 「이전 크기로」** 는 전체화면만 벗어난다(그 전 창 크기/최대화 상태로 복귀). 최대화 단추 아이콘은
  최대화 **또는** 전체화면이면 ❐(복원), 아니면 ▢. 전체화면 단추는 `aria-pressed`.
- 상태는 단추 밖에서도 바뀐다(끌기 영역 더블클릭·키·창 관리자) → 렌더러는 클릭 결과를 추측하지 않고 `onWindowState` push 만 믿는다.
- `body` 클래스: `has-window-chrome` · `window-chrome-{win32|linux|darwin}` · `has-window-buttons`(오른쪽 단추 있음) ·
  `is-window-fullscreen` · `is-window-maximized`. CSS 변수 `--window-inset-right`(win ≈199px, linux ≈167px) /
  `--window-inset-left`(mac 82px, 전체화면이면 0).
- 라벨: 한국어 원문 `전체화면` `전체화면 해제` `최소화` `최대화` `이전 크기로` `닫기` `앱 창` → en/ja/zh 카탈로그에 있다.
  툴팁은 `attachDelayedTooltip` 을 직접 붙인다(롤아웃 표에 넣지 않았다 — 라벨이 상태에 따라 바뀌어 정적 표에 안 맞는다).
  `title` 은 달지 않는다(네이티브 팝업과 겹침).

## 화면별 여백·끌기 (여기가 어긋나기 쉽다)

- **편집기 톱바** `.oprn-menu-bar.studio-bar`: 오른쪽 패딩에 `--window-inset-right`. 톱바가 1280px 에서 이미 빠듯해서
  **압축 구간을 하나씩 일찍** 켠다(`window-controls.css` 의 1439/1299px 블록 — `studio-bar.modern.css` §12 의 사본이다.
  기준을 고치면 같이 고친다). 옛 톱바 전체화면 단추(`.oprn-window-control`)는 단추가 생기면 `display:none`(한 곳에서만 보이게).
- **시작 화면** `.ln-top`/`.ln-brand`(편집기 덮는 컨셉 피드는 `.cf-top`): 같은 방식. mac 은 레일 맨 위를 44px 내린다.
- **큰 모달 머리줄**(데이터베이스·리소스 관리자·테스트 플레이·조수 크게 보기·이벤트 편집기): 창 단추(z 10000)가 그 위에
  뜨면 모달의 자기 닫기 단추를 가로챈다 — 실측으로 `database-modal-close` 가 1280px 에서 안 눌렸다. 그래서 머리줄 오른쪽을
  단추 폭만큼 비운다(2000px 이하). **새 큰 모달을 만들면 QA 의 「가림」 검사에 더한다.**
- 모달이 열리면 톱바의 끌기 영역을 끈다(크로미움은 끌기 영역을 층 순서와 무관하게 모아 모달 단추를 먹는다). 단 데이터베이스
  모달은 미리 읽어 두려고 `visibility:hidden` + `aria-hidden` 으로 늘 떠 있으므로 `:not([aria-hidden="true"] *)` 로 거른다.
- 전체 화면 인터뷰의 `.ci-controls` 는 `margin-top: 36px`.

## 실측 (이 저장소 Linux, xvfb + xfwm4, Electron 44.7.0)

실행: `Xvfb :77 …` + `xfwm4 --compositor=off` 후
`DISPLAY=:77 ELECTRON_BIN=<electron> OPRN_QA_PROJECT=<폴더> OUT=<출력> node scripts/qa/window-controls.mjs start|editor|platforms|i18n`.
빌드는 `vite build` + `node scripts/build-electron.mjs`. Electron 바이너리는 `~/.cache/electron` 의 zip 을 풀어 쓴다.
xdotool 의 **실제 X 클릭**으로 눌러서 Chromium 의 끌기 영역·히트 테스트까지 밟는다(Playwright 클릭은 그걸 우회한다).

**검증되지 않은 것:** 실제 Windows 렌더(DPI·ClearType·Win11 스냅 레이아웃), 실제 macOS 신호등 위치·fullscreen 호버 동작.
이 둘은 body/nav 클래스를 바꾼 시뮬레이션과 코드 검토뿐이다.
