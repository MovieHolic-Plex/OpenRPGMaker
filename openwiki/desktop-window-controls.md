# 데스크톱 창 컨트롤 (제목줄·창 단추)

2026-10-14. Electron 앱 창의 최소화·최대화/복원·전체화면·닫기와 창 끌기. 브라우저·팀 페이지에는 없다.

## 한눈에

| 플랫폼 | 창 옵션 | 오른쪽 위 | 왼쪽 위 |
|---|---|---|---|
| Windows | `frame: false` | 전체화면 · ─ · ▢/❐ · ✕ (닫기 호버 빨강, 46px 칸) | — |
| Linux | `frame: false` | Windows 와 같은 순서·기호 (36px 둥근 칸) | — |
| macOS | `titleBarStyle: "hiddenInset"` + `trafficLightPosition` | 없음 (OS 신호등이 있다) | 신호등 + 렌더러가 비운 여백 82px |

- 창은 `fullscreen: true` 로 뜬다(기존 동작 유지). 전체화면 단추로 1280×800 창 모드로 나온다. 최소 창 크기 1100×600.
  아직 한 번도 보이지 않은 창을 앞으로 가져올 때(두 번째 실행·macOS open-file 이 스플래시 뒤의 창을 집음)도 `electron/main/windowShow.ts` 의 처음 보이기 순서를 쓴다. 이미 보였던 창은 사용자가 빠져나온 전체화면을 다시 켜지 않는다.
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
| `electron/main/main.ts` | `chromeOptions`, 동작 검증(`isWindowControlAction` 밖의 값은 `false`), maximize/unmaximize/restore/minimize/enter·leave-full-screen → `windowState` push, 닫기 저장·Quit 처리, 아직 안 보인 창을 앞으로 가져올 때 전체화면 |
| `electron/main/windowShow.ts` | 숨은 창을 처음 보이는 순서(macOS 는 보인 뒤 전체화면, 그 밖은 전체화면 뒤 보이기) |
| `electron/shared/closeFlow.ts` | 자동 저장 결과와 확인 대화상자의 버튼 판정 |
| `electron/main/directoryDialog.ts` | 폴더 선택 대화상자를 살아 있는 앱 창에 붙인다. 파일 메뉴는 스플래시·팀 창이 아니라 그 창을 고른다 |
| `electron/shared/folderSwitch.ts` | 파일 메뉴가 다른 폴더로 넘어가기 전에 보는 저장 결과. 미저장이 남으면 거절 |
| `electron/preload/index.ts` | `oprn.platform`(동기), `oprn.windowState()`, `oprn.onWindowState(cb)` |
| `src/app/windowChrome.ts` | `desktopWindowChrome()` — 브릿지가 없으면 `null`(브라우저·팀) |
| `src/start/windowControls.ts` | 단추 마운트(`src/main.ts`·`startScreen.ts` 가 `mountWindowControls()` 호출, 한 번만 단다) |
| `src/styles/shell/window-controls.css` | 단추·여백·끌기 영역. **레이어 밖(unlayered)** — 시작 화면과 편집기는 `@layer` 순서가 달라서 |
| `scripts/qa/window-controls.mjs` | 실제 Electron + xdotool 실측(아래) |

## 계약

- **닫기와 Quit은 같은 저장 절차를 거친다.** 제목줄 X는 `window.close()`를 호출한다. 파일 → 종료와 Ctrl+Q는 Windows·Linux에서, 앱 메뉴 → 종료와 Cmd+Q는 macOS에서 `before-quit`을 거친다.
  시작 화면은 그대로 닫힌다. 편집기는 4초 안에 저장이 끝나면 바로 닫힌다. 실패하거나 시간이 지나면 네이티브 창 하나에서 「저장 / 저장 안 함 / 취소」를 묻는다.
  「저장」은 최대 30초 동안 다시 시도하고 실패하면 안내한 뒤 편집 창을 유지한다. 대화상자가 열린 동안 추가 닫기 요청은 무시한다.
  저장 확인을 마친 창은 `destroy()`로 닫는다. 늦은 저장 응답은 요청 번호로 구별한다.
- **2026-11-19 닫기 수정 원인.** 이전 절차는 닫자마자 창을 숨긴 다음 최대 60초 뒤 저장 응답 없이 강제로 닫았다. 연결이 끊겼거나 응답이 늦으면 변경이 사라질 수 있었다.
  저장 오류 때에는 Quit을 취소한 뒤 별도로 「저장하지 않고 닫기」를 물어 macOS에서 앱이 남을 수 있었다. Windows·Linux 파일 메뉴에는 Quit 항목도 없었다.
  이벤트 초안은 기존 로컬 금고에 기록하고, 몬스터 소재 편집기의 적용 전 변경은 명시적으로 「저장」을 골랐을 때 적용한다. 브라우저의 `beforeunload`와 에디터의 새로고침 경로는 별도로 동작한다.
- **보기 메뉴의 새로고침은 저장한 뒤에 한다.** 데스크톱은 창 닫기를 메인이 처리하려고 `beforeunload` 저장을 건너뛴다. 그래서 기본 보기 메뉴의 Reload(`Ctrl/Cmd+R`)·Force Reload 는 렌더러만 다시 읽어 메모리의 맵 편집을 버렸다. 이제 프로젝트가 열려 있으면 닫기와 같은 `store.flush()` 가 끝난 뒤에만 새로고침한다(`electron/shared/reloadFlow.ts`). 저장이 충돌하거나 아직 더러우면 창을 그대로 두고 이유를 알린다. 개발자 도구의 새로고침도 미저장이면 같은 저장을 거친다. 시작 화면(세션 없음)과 편집기 스크립트가 뜨기 전은 저장할 편집이 없어 바로 새로고침한다.
- **Quit은 열린 편집기 창을 한꺼번에 확인한다.** 취소하면 창들이 열린 채 남고, 확인을 마치면 창을 닫고 앱을 종료한다.
  테스트 플레이는 편집기 내부 모달이다. 네이티브 하위 창은 Quit을 막지 않는다. macOS에서 창 하나만 닫으면 앱은 남는다.
- **폴더 선택 대화상자는 앱 창에 붙인다.** 시작 화면 「폴더 열기」·파일 메뉴는 `electron/main/directoryDialog.ts` 가 살아 있는 편집기 창을 부모로 넘긴다. 부모 없이 열면 모달이 아니어서 전체화면 창 뒤로 가고, 시작 화면은 그동안 바빠 보인다. 포커스가 스플래시·팀 창이어도 파일 메뉴는 그 창이 아니라 앱 창을 쓴다. 열기에 실패하면 메시지 상자를 띄운다.
- **파일 → 새 프로젝트는 빈 폴더만 받는다.** `electron/main/newProjectDir.ts` 의 `acceptMenuFolder(..., "new")` 가 시작 화면과 같이, 파일이 있는 폴더에는 `project.sqlite` 를 만들지 않고 오류 창을 띄운다. 「폴더 열기」는 저장소가 없는 폴더도 연다.
- **파일 메뉴로 다른 폴더를 열면 먼저 저장한다.** 새 프로젝트·폴더 열기는 대화상자에서 고른 뒤, 그 창의 편집기가 저장 요청을 받을 준비가 됐으면 flush 가 끝나고 미저장 변경이 없을 때만 폴더를 바꾼다(`electron/shared/folderSwitch.ts`). 저장이 실패하거나 시간이 넘으면 경고만 띄우고 이 프로젝트를 그대로 둔다. 시작 화면(열린 세션 없음)과 편집기 부팅 전(아직 저장할 변경이 없음)은 바로 연다. macOS 에서 창을 모두 닫아도 앱이 남으면 파일 메뉴가 창을 하나 만든 다음 대화상자를 연다.- **전체화면에서 「이전 크기로」** 는 전체화면만 벗어난다(그 전 창 크기/최대화 상태로 복귀). 최대화 단추 아이콘은
  최대화 **또는** 전체화면이면 ❐(복원), 아니면 ▢. 전체화면 단추는 `aria-pressed`.
- 상태는 단추 밖에서도 바뀐다(끌기 영역 더블클릭·키·창 관리자) → 렌더러는 클릭 결과를 추측하지 않고 `onWindowState` push 만 믿는다.
- `body` 클래스: `has-window-chrome` · `window-chrome-{win32|linux|darwin}` · `has-window-buttons`(오른쪽 단추 있음) ·
  `is-window-fullscreen` · `is-window-maximized`. CSS 변수 `--window-inset-right`(win ≈199px, linux ≈167px) /
  `--window-inset-left`(mac 82px, 전체화면이면 0).
- 라벨: 한국어 원문 `전체화면` `전체화면 해제` `최소화` `최대화` `이전 크기로` `닫기` `앱 창` → en/ja/zh 카탈로그에 있다.
  툴팁은 `attachDelayedTooltip` 을 직접 붙인다(롤아웃 표에 넣지 않았다 — 라벨이 상태에 따라 바뀌어 정적 표에 안 맞는다).
  `title` 은 달지 않는다(네이티브 팝업과 겹침).

## 최근 프로젝트 열기와 관리

- 시작 화면 홈의 「모두 보기」에서 최근 프로젝트를 이름·경로로 검색하고 마지막으로 연 시각 또는 이름으로 정렬한다. 사라진 폴더는 「찾을 수 없음」으로 남아 목록에서 제거할 수 있다. 임시 작업은 필요한 경우에만 표시한다. 최근 목록은 `userData/recent-projects.json`에 최대 100개를 보관한다.
- 데스크톱 파일 메뉴 「최근 프로젝트」는 기존 창을 앞으로 가져오거나 새 창을 연다. 편집기의 프로젝트 메뉴 「열기…」는 최근 목록과 OS 폴더 선택을 제공하며, 같은 창에서 바꿀 때는 기존 저장 확인을 거친다.
- 시작 화면의 「이름 바꾸기」는 문서 제목만 바꾼다. 「복제」는 마지막 저장 시점의 SQLite와 폴더 파일을 형제 폴더(「사본」, 「사본 2」 등)에 복사하고 새 저장 ID로 등록한다. 내용과 게임 제목은 그대로 복사된다. 「목록에서 제거」는 최근 목록만 바꾸고, 「삭제」는 네이티브 확인 후 OS 휴지통으로 이동한다.
- 파일 작업은 메인 프로세스에서 최근 목록에 등록된 실제 SQLite 폴더만 받는다. 앱에 포함된 자료는 보호하고, 이름 변경과 삭제 전에 프로젝트 또는 하위 프로젝트를 사용 중인지 검사한다. 번들 예제는 별도 선반의 `?demo=` 진입점으로 열고, 편집용 사본을 저장한 사용자 폴더만 최근 목록에 넣는다. HTTP 호스트에는 OS 파일 관리 IPC를 노출하지 않는다.

## 렌더러 종료 후 복구

- 처음 표시된 앱 창에서 렌더러가 비정상 종료되면 메인 프로세스가 사유와 종료 코드를 기록한다. 같은 `webContents.id`의 SQLite 세션을 유지한 채 편집기 문서를 다시 불러온다. 편집기 부팅은 정본을 읽고 프로젝트별로 저장된 이벤트 초안을 복원한다.
- 문서를 다시 불러온 뒤 그 창에 한국어 네이티브 안내를 띄운다. 자동 재로드는 창마다 최근 60초에 두 번까지이며, 초과하거나 재로드가 실패하면 종료 사유를 안내한다. 닫기 처리가 진행 중이면 기존 닫기 절차가 우선한다. 응답 없음은 로그에 기록한다.

## 화면별 여백·끌기 (여기가 어긋나기 쉽다)

- **편집기 톱바** `.oprn-menu-bar.studio-bar`: 오른쪽 패딩에 `--window-inset-right`. 톱바가 1280px 에서 이미 빠듯해서
  **압축 구간을 하나씩 일찍** 켠다(`window-controls.css` 의 1439/1299px 블록 — `studio-bar.modern.css` §12 의 사본이다.
  기준을 고치면 같이 고친다). 옛 톱바 전체화면 단추(`.oprn-window-control`)는 단추가 생기면 `display:none`(한 곳에서만 보이게).
- **시작 화면** `.ln-top`/`.ln-brand`(편집기 덮는 컨셉 피드는 `.cf-top`): 같은 방식. mac 은 레일 맨 위를 44px 내린다.
- **큰 모달 머리줄**(데이터베이스·리소스 관리자·테스트 플레이·조수 크게 보기·이벤트 편집기): 창 단추(z 10000)가 그 위에
  뜨면 모달의 자기 닫기 단추를 가로챈다 — 실측으로 `database-modal-close` 가 1280px 에서 안 눌렸다. 그래서 머리줄 오른쪽을
  단추 폭만큼 비운다(2000px 이하). **새 큰 모달을 만들면 QA 의 「가림」 검사에 더한다.**
- **테스트 플레이 전체 화면**은 제목 막대가 30px 인데 창 단추는 48px(`--window-caption-height`)라, 단추 아래쪽이 게임 위를 덮었다.
  그 칸을 누르면 게임 메뉴가 아니라 최소화·닫기가 눌린다. `has-window-buttons` 일 때 전체 화면 제목 막대를 단추 높이로 키워
  게임은 단추 아래에서 시작한다(`window-controls.css`).
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
