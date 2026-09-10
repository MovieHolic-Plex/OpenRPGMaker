# Quickstart — 코딩 에이전트의 첫 10분

이 페이지는 "무엇을 읽어라" 목록이 아니라 **이 저장소에서 헤매지 않는 방법**이다. 위에서부터 순서대로 쓰면 된다.
사람용 개요는 `README.md`, 영역별 상세는 `openwiki/INDEX.md` 로 좌표를 잡아 필요한 절만 읽는다.

## 0. 여기서 에이전트가 실제로 헤매는 이유 (실측 2026-08-30)

| 사실 | 그래서 벌어지는 일 | 대응 |
|---|---|---|
| 위키가 41쪽 약 1MB(약 27만 토큰) | "해당 영역 페이지를 읽어라" 를 따르면 코드 한 줄 보기 전에 예산이 3만 토큰 날아간다 | `openwiki/INDEX.md` 의 절 좌표로 잘라 읽는다 |
| 7쪽이 읽기 도구 상한 50KB 초과 | `read` 가 **조용히 잘려서** 못 본 절을 "위키에 없다" 로 착각한다 | 잘리는 쪽 목록은 INDEX 상단에 있다. `grep -n` → `offset` 순서로 접근 |
| 9쪽에 EUC-KR 모지바케 68줄 | 지시문이 `誘몃씪踰?` 처럼 깨져 읽을 수 없다 | 그 줄의 **파일 경로만** 믿고 의미는 소스에서 확인. 복원 불가 |
| `src` 1,579파일(편집기만 602) · 코드+CSS 약 79.5만 줄 | 이름만 보고 파일을 찾다가 턴을 태운다 | 아래 3절 기능→파일 표에서 진입점을 먼저 고른다 |
| 전체 `npm run typecheck` 는 기준선부터 빨간불(test/ 타입 에러) | 자기 변경이 만든 실패와 원래 있던 실패를 구분 못 한다 | `npm run typecheck:app` 과 `npm run gates` 만 게이트로 쓴다 (2절) |
| 워크트리에 `node_modules` 가 없을 수 있다 | `npm run typecheck` 가 **전역 tsc 7** 로 떨어져 `baseUrl has been removed` 같은 가짜 설정 오류를 뱉는다 | 1절에서 워크트리를 먼저 보정한다 |

## 1. 환경 — 여기가 틀리면 이후 전부 헛수고

```bash
ls -d node_modules && ls .env.local && grep '^DEV_SERVER_PORT=' .env.local
```

세 개가 다 나와야 정상이다. 하나라도 없으면 **워크트리 보정을 먼저 한다** (본 저장소에서 실행):

```bash
cd /home/main/z-project/rpg-zzu
npm run wt -- adopt <이름> --path <워크트리 절대경로>   # node_modules 정션 + .env* 복사 + 고유 포트 배정
```

- `git worktree` 는 추적 파일만 체크아웃한다. `node_modules`(수 GB)와 gitignored `.env.local` 은 따라오지 않는다.
- `npm run wt create <name>` 로 만든 워크트리는 이 세 가지가 이미 되어 있다. `.herdr/`·`.claude/worktrees/` 처럼
  **다른 도구가 만든 워크트리는 보정이 안 되어 있다** — 실측: 이 문서를 쓴 워크트리가 그랬다.
- 보정 없이 실행하면 증상이 오해를 부른다: `npx tsc` 가 전역 TypeScript 7 을 잡아 `tsconfig.json` 의 `baseUrl` 을
  "제거된 옵션" 이라고 하고, vitest 는 아예 없다. **저장소 설정이 깨진 게 아니다.**
- 다른 워크트리의 tsconfig 를 본 저장소 tsc 로 `-p` 로 겨누는 우회는 쓰지 마라. 실측: 그렇게 하면 모듈 해석이
  실패해 유령 오류 2,879건이 나온다(정상은 0건). 도구는 **그 워크트리 안에서** 돌린다.
- 포트는 워크트리마다 다르다(본 저장소가 9999 `--strictPort` 를 점유). 개발 서버는 `npm run dev:worktree`.
- 병렬 워크트리는 `node_modules/.vite` 최적화 캐시도 공유한다. 서버 시작 시 `VITE_CACHE_DIR`에
  워크트리 전용 경로나 고유 임시 경로를 지정하라 (`vite.config.ts`가 지원). 공유 캐시의 재최적화가
  겹치면 동적 모듈 로딩이 실패해 빈 화면이 나올 수 있다. QA용 임시 캐시는 서버 종료 후 정리한다.

콘텐츠(맵·이벤트·데모) 작업이면 `.env.local` 의 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` /
`VITE_SUPABASE_PROJECT_ID` 가 있어야 하고, 저장+재로드까지 증명해야 끝이다 — 루트 `AGENTS.md` 의 하드 룰.

## 1a. Mac novice launcher / private setup (Phase 1, 2026-09-06)

This path is for a person's own downloaded checkout, **not** agent worktree adoption above.
Do not copy a maintainer's `.env.local` or use a maintainer project. It requires manually
installed **Node.js 24 LTS including npm**, a writable extracted folder, and the owner's
already provisioned Supabase access plus an **existing application project id**.

- Double-click `Start RPG Maker.command`, or in Terminal type `/bin/bash ` and drag that
  file into the window, then press Return (works when ZIP extraction lost the executable bit).
  Optional: `chmod +x "Start RPG Maker.command"`. Do not disable Gatekeeper or use sudo.
- Terminal equivalents, from the checkout: `npm run setup:local` creates private settings;
  `npm run mac:launch` sets up if missing and launches. The `.command` resolves its own folder,
  including spaces/Unicode, regardless of the current working directory.
  실행 명령은 `npm run mac:launch` 하나로 통일합니다. 설정 질문과 오류·복구 안내는 한국어로 표시됩니다.
- The wizard masks the anon/publishable key and performs a bounded read-only GET against
  `rpg_zzu.projects`. Use an HTTPS Supabase **origin**, or HTTP loopback for a local service.
  Admin/service-role/database credentials, URL credentials, redirects and remote HTTP are rejected.
  It does not create projects, run migrations, or write to Supabase.
- Existing `.env*` files are never rewritten. New `.env.local` uses exclusive creation with mode
  `0600`, a server-only `SUPABASE_ANON_KEY`, and proxy mode. Failure/cancellation writes nothing.
  `.env.development*` and shell overrides take precedence in Vite; setup refuses to silently write
  shadowed settings. Existing/incomplete `.env.local` needs private correction by its owner,
  followed by a restart. Do not paste keys into command arguments, chat, screenshots or issues.
- `npm ci` runs **only** when `node_modules` is absent. Existing or broken installs are preserved;
  recovery is to move the broken folder aside yourself and run `npm ci`. No system tools are installed.
- The launcher owns only `http://127.0.0.1:9999/?project=<encoded-existing-id>`, with a strict port,
  TLS disabled and Vite's `configLoader: "runner"`. It opens the browser only after its own listen
  succeeds. A collision does not open/reuse/kill the other server or choose another port.
  Browser-open failure prints the same URL; `npm run mac:launch -- --no-open` supports headless QA.
- Keep the Terminal open; Ctrl-C stops the owned server. Bookmark the same origin and project id.
  Online saving depends on Supabase availability; export JSON for a separate backup.
  Bun is optional for editing and Node provider login, but needed for AI completions along with a
  configured provider. `npm start` is the separate production preview, not this novice launcher.
- Linux verification does **not** establish Finder/macOS behavior. The narrow
  `.github/workflows/mac-onboarding.yml` job is dormant while Actions are disabled.

## 1b. 전체 BGM은 Release 팩으로 설치

그림·효과음·기본 BGM 3곡은 Git에 있지만, 전체 281곡(약 1.304 GB)은
비공개 [bgm-v1 Release](https://github.com/MovieHolic-Plex/rpg-zzu/releases/tag/bgm-v1)에서 따로 받는다.
`npm ci` 뒤 `gh auth login` + `npm run bgm:install` + `npm run bgm:verify`.
gh가 없으면 Release의 `rpg-zzu-bgm-v1.tar`를 받아
`npm run bgm:install -- --archive "/받은/파일/경로"`를 실행한다. 약 5 GB 여유 공간 권장.
기존 설치가 정상이면 재실행은 다운로드하지 않는다. 자동 실행/설정 마법사에는 다운로드를 붙이지 않았다.
로컬 재생은 `VITE_BGM_CDN_BASE`를 비워야 한다. 워크트리에 복사된 env의 CDN 값이
로컬 설치보다 우선할 수 있다. 음악 리소스 선택 창의 「전체 받기」도 같은 검증 설치기를 쓴다.
Vite dev/preview는 설치 후 선택 창을 다시 열면 목록·재생이 갱신되며 재빌드가 필요 없다.
정적 배포·내보내기는 설치 후 빌드해야 파일이 포함된다. 원격 설치는 서버 전용
`RPG_ZZU_BGM_INSTALL_REMOTE=1` opt-in과 서버 재시작이 필요하다(기본은 루프백만 허용).
SHA-256 검증·손상 복구·잠금 복구·관리자 제작 명령은 `openwiki/bgm-catalog.md`.

## 2. 검증 — 무엇이 진짜 게이트인가

| 명령 | 무엇을 재나 | 기준선 (실측) | 언제 쓰나 |
|---|---|---|---|
| `npm run typecheck:app` | `src` 만 (`tsconfig.app.json`) | **0 에러 / exit 0** — 초록 | 코드 바꿨으면 항상 |
| `npm run typecheck` | `src` + `test` 전체 | **빨간불** (`test/` 타입 에러 다수, exit 2) | 게이트로 쓰지 마라. 자기가 만진 테스트 파일만 눈으로 확인 |
| `npm test` | Vitest 유닛/계약 | 약 **23,376건**(2,185 파일) 중 **실패 431건** (2026-09-11 실측), 머신 부하에 비례해 흔들림. 워커 힙은 스크립트가 8GB 로 깐다 | 관련 파일만 지정해 돌린다: `npm test -- test/<name>.test.ts` |
| `npm run gates` | typecheck:app + vitest + css + surface 를 **기준선과 비교** | `.omo/gates-baseline.json` (추적 파일) | 변경 마무리. 새로 생긴 실패만 회귀로 본다 |
| `npm run gates -- --only css` | CSS 예산·그래프·라이브 클래스 | 수 초 | 스타일만 만졌을 때 |
| `npm run qa:runtime` | 게임 화면(출하 플레이어 `player.html`) 스크린샷 QA | `verify-shots/runtime-qa/<시나리오>/SUMMARY.md` | 런타임 UI 변경 |
| `npm run test:e2e` | Playwright 편집기 표면 | 워크트리에서는 dev 서버가 조용히 안 뜨는 함정 있음 → `openwiki/testing.md` | 편집기 UI 변경 |

규칙 세 개만 지키면 된다.

1. **파이프를 거친 종료 코드는 증거가 아니다.** `tsc | tail` 은 tail 의 0 을 돌려준다. `npm run gates` 는
   그래서 `spawnSync` 의 status 를 직접 본다.
2. **기준선 대비 새 실패만 회귀다.** 저장소 기준선이 이미 빨간불이라 "전부 초록" 을 요구하면 게이트가 무용지물이 된다.
3. **테스트 실패 수가 실행마다 흔들리면 부하 탓이다.** 같은 커밋에서 실패 170/187/195/203 이 관측됐다.
   한산할 때 다시 재고, 흔들리는 테스트를 "고쳤다" 고 보고하지 마라.

## 3. 어디를 고치나 — 기능 → 진입 파일

사용자 문장에서 곧바로 진입점으로 가는 표다. 최근 6주 변경 빈도 상위와 라우팅 페이지를 합쳐 실측으로 만들었다.
파일을 열기 전에 이 표에서 한 줄을 고르고, 그 영역의 함정은 `openwiki/editor-pre-edit-routing.md` /
`openwiki/runtime-pre-edit-routing.md` 에서 확인한다.

| 요청 | 진입 파일 |
|---|---|
| 맵에 타일이 잘못 찍힌다 / 브러시·도형·되돌리기 | `src/editor/EditScene.ts`, `src/editor/tileActions.ts`, `src/editor/TilePaintEngine.ts` |
| 맵 렌더·빈 칸 체커·레이어 겹침 | `src/editor/editSceneRender.ts` |
| 타일 팔레트·칩셋 그리드·스탬프 | `src/editor/panels/tilePalette.ts`, `src/editor/chipsetTileRender.ts`, `src/editor/tilePaletteStamp.ts` |
| 오토타일·지형 연결 | `openwiki/autotiles.md` → `src/assets` 의 autotile 모듈 |
| 맵 목록·트리·드래그·썸네일 | `src/editor/panels/mapList.ts`, `src/project/mapTree.ts`, `src/editor/panels/mapThumbnail.ts` |
| 맵 속성(BGM·배경·인카운터·스폰) | `src/editor/panels/mapProps.ts`, `src/editor/actions.ts` |
| 이벤트 편집기 창 구조 | `src/editor/panels/eventEditor/modal.ts`, `src/editor/panels/eventEditor/content.ts` |
| 이벤트 명령 목록·미리보기·삽입 | `src/editor/panels/eventEditor/` 의 `commandList.ts` · `commandPreview.ts` · `commandPicker.ts` |
| 특정 명령의 입력 폼 | `src/editor/panels/eventEditor/commandBody*.ts` (16개, 명령군별) |
| 이벤트 페이지 조건·속성 | `src/editor/panels/eventEditor/pageProps.ts`, `src/editor/eventPages.ts`, `src/editor/eventActions.ts` |
| 이벤트가 게임에서 다르게 동작한다 | `src/player/interpreter/`, `src/player/interpreter/commandCatalog.ts` |
| 데이터베이스 창·탭·레코드 편집 | `src/editor/panels/database.ts`, `src/editor/panels/databaseSystemView.ts`, `src/editor/databaseActions.ts` |
| DB 레코드 스키마·필드 | `src/project/types/database.ts`, `src/project/databaseRecordModel.ts`, `src/project/io/shapeDatabaseFields.ts` |
| AI 조수 패널 UI·도크·컴포저 | `src/editor/panels/aiChatPanel.ts`(3,400줄), `src/editor/panels/aiComposer.ts`, `src/editor/panels/aiPanelLayout.ts`, `src/editor/panels/aiProposalCard.ts` |
| AI 스튜디오(장면 레일·모니터·브리핑·덱) | `src/editor/panels/aiStudioShell.ts`, `src/styles/database/tabs-b-assistant-panel/08-studio-mode-start-screen.css` (설계 `docs/superpowers/specs/2026-09-03-ai-studio-console-design.md`) |
| AI 턴·툴 호출·컨텍스트 | `src/ai/assistantSession.ts`(5,433줄 — 클래스만 남았다), `src/ai/session/*`(순수 표면 14모듈), `src/ai/llmClient.ts`, `src/ai/contextBuilder.ts`, `src/ai/approvalPolicy.ts` |
| AI 툴 추가·수정 | `src/editor/tools/toolRegistry.ts` + `src/editor/tools/*` |
| 우클릭 영역 작업(AI 로 영역 채우기) | `src/editor/panels/regionTaskModal.ts`, `src/editor/regionTask/*` |
| 저장·불러오기·자동저장·원격 지속성 | `src/project/store.ts`, `src/editor/saveActions.ts`, `src/project/supabaseProjectSync.ts` |
| 프로젝트 JSON 스키마·마이그레이션 | `src/project/types/project.ts`, `src/project/io/shape.ts`, `src/project/io/references.ts` |
| 기본 프로젝트·샘플 콘텐츠 | `src/project/defaults/defaultProject.ts`, `src/editor/content/` |
| 세이브 슬롯·이어하기 | `src/player/saveSlots.ts`, `src/player/saveSlotValidation.ts` |
| 런타임 세션 상태(스위치·변수·진행) | `src/project/session.ts` |
| 플레이 화면 부팅·모드 전환 | `src/app/mode.ts`, `src/player/player.ts`, `src/player/createPlayGame.ts`, `src/main.ts` |
| 전투 규칙·턴·보상 | `src/battle/runtime.ts`, `src/battle/types.ts` |
| 전투 화면 DOM·스킨 | `src/player/battleFieldDom.ts`, `src/styles/runtime/battle/`, `src/styles/runtime/battle-skins/` |
| 대화창·문장 표시 | `src/player/dialogue.ts`, `src/player/dialoguePresentation.ts`, `src/player/dialoguePagination.ts` |
| 톱바·메뉴·모드(초보/표준/전문가)·용어 | `src/editor/panels/menu.ts`, `src/editor/editorUiMode.ts`, `src/editor/uiCopy.ts` |
| 좌측 레일·도크·레이아웃 | `src/editor/workspace/leftDockPanels.ts`, `src/editor/panels/editor.ts` |
| 테스트 플레이 창 | `src/editor/panels/testPlayModal.ts` |
| 색·토큰·크림 셸 | `src/styles/tokens.css`, `src/styles/index.css` |
| 웹 게임 내보내기 | `src/project/webExport.ts`, `vite.player.config.ts` |
| 커뮤니티 사이트(공유) | `community-site/` + `openwiki/community-site.md` |

두 가지 경계만 어기지 마라. **편집기는 저작 데이터(`project`)를, 런타임은 세션 상태(`session`)를 만진다.**
그리고 `src/styles` 는 표현만 소유한다 — 동작을 CSS 로 우회하지 않는다.

## 4. 위키를 읽는 법

- 목차·크기·절 좌표: `openwiki/INDEX.md` (`npm run openwiki:index` 로 재생성, `--check` 로 최신 여부 검사).
- 소유 경계·사전 읽기 순서·데스크톱 UI 진상: `openwiki/PROJECT_WIKI.md` — 이 장의 모판이 되는 페이지다.
- 영역 진입 전 함정 목록: `openwiki/editor-pre-edit-routing.md`, `openwiki/runtime-pre-edit-routing.md`.
- 검증·증거 규약: `openwiki/testing.md`. 병렬 에이전트·워크트리: `openwiki/agent-worktrees.md`.
- 위키 유지: 구조 검사는 `npm run openwiki:verify`, 좌표 재생성은 `npm run openwiki:index`.
- 페이지는 대부분 **날짜가 붙은 실측 기록**이다. 같은 주제에 여러 날짜가 있으면 **최신 날짜가 정본**이고,
  소스와 어긋나면 소스가 이긴다 — 고친 뒤 그 페이지도 같은 변경에서 갱신한다.
- 문서가 이름을 부르는 파일이 없을 수도 있다(실측 60여 건, 정확한 목록은 INDEX). 대개 의도적으로 삭제된 모듈의 기록이다.
  `git log --diff-filter=D -- '*<파일명>'` 로 삭제 커밋을 확인하면 30초에 끝난다. 목록은 INDEX 에 있다.

## 5. 끝났다고 말할 수 있는 조건

- 코드 변경: `npm run typecheck:app` 초록 + 관련 테스트 통과 + `npm run gates` 가 **새 실패 0**.
- UI 변경: 실제 표면 증거(스크린샷/Playwright). 편집기는 `test/e2e` + `scripts/capture-*`, 게임 화면은 `npm run qa:runtime`.
- 콘텐츠 변경: Supabase 저장 후 **재로드 성공**과 project id 보고. 로컬 fixture·export JSON 은 완료가 아니다.
- 문서·위키에 영향을 주는 변경: 해당 `openwiki/*.md` 를 같은 변경에서 고친다.
