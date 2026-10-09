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
  다만 `npm run dev:worktree` 는 `node_modules` 가 없으면 **스스로 보정을 먼저 돌린다**(2026-09-25,
  `scripts/dev-server.mjs` — `scripts/agent-worktree.mjs adopt --path` 를 그대로 부른다).
  그래서 dev 서버를 띄우는 것만으로 끝나고, 정션이 생기므로 `npx tsc`·vitest 도 같은 실행에서 함께 정상이 된다.
  dev 서버를 안 띄우고 보정만 하려면 위 `npm run wt -- adopt` 를 직접 쓴다.
- 보정 없이 실행하면 증상이 오해를 부른다: `npx tsc` 가 전역 TypeScript 7 을 잡아 `tsconfig.json` 의 `baseUrl` 을
  "제거된 옵션" 이라고 하고, vitest 는 아예 없다. **저장소 설정이 깨진 게 아니다.**
- 다른 워크트리의 tsconfig 를 본 저장소 tsc 로 `-p` 로 겨누는 우회는 쓰지 마라. 실측: 그렇게 하면 모듈 해석이
  실패해 유령 오류 2,879건이 나온다(정상은 0건). 도구는 **그 워크트리 안에서** 돌린다.
- 포트는 워크트리마다 다르다(본 저장소가 9999 `--strictPort` 를 점유). 개발 서버는 `npm run dev:worktree`.
- 병렬 워크트리는 `node_modules/.vite` 최적화 캐시도 공유한다(`node_modules` 가 메인으로의 심링크). vite 캐시 해시에
  root 가 들어가 체크아웃마다 서로 재최적화해 덮고, 겹치면 동적 모듈 로딩이 실패해 빈 화면이 나올 수 있다.
  `npm run dev`·`dev:worktree`·`dev:keep`·playwright webServer 는 공유 `node_modules` 를 보면 `<체크아웃>/.vite-cache/dev`
  를 **자동으로** 쓴다(`scripts/lib/viteCacheDir.mjs`, 배너에 `[dev] vite 캐시 …` 로 찍힌다). vite 를 직접 부를 때만
  `VITE_CACHE_DIR` 에 그 체크아웃 안 경로나 고유 임시 경로를 직접 준다. QA용 임시 캐시는 서버 종료 후 정리한다.

콘텐츠(맵·이벤트·데모) 작업은 프로젝트 폴더 또는 팀 호스트와 project id를 확인하고,
SQLite 정본에 저장+재로드까지 증명해야 끝이다 — 루트 `AGENTS.md` 의 하드 룰.
LegacyDb 설정은 과거 데이터 이관에만 필요하다. 제거 현황은 `openwiki/storage-retirement.md`.

## 팀 SQLite 호스트 (2026-09-18)

현재 Electron과 `npm run serve:project`, `npm start`는 로컬/서버 SQLite 정본을 사용한다.
`npm start`에는 기존 SQLite 폴더를 `OPRN_PROJECT_DIR` 또는 `--project-dir`로 지정한다.
`npm run preview`는 저장 브리지 없는 정적 미리보기다.
팀 초대·호스팅·백업·충돌 처리 절차는 `openwiki/team-project-host.md`.
아래 과거 Mac launcher/LegacyDb 설정 설명을 새 팀 호스트의 필수 설정으로 적용하지 않는다.

## 1a. Mac / 개인 로컬 실행 (2026-09-21)

Node.js 24 LTS와 npm을 설치하고, 본인에게 쓰기 권한이 있는 체크아웃에서 실행한다.
`Start RPG Maker.command` 또는 `npm run mac:launch`는 SQLite 저장 브리지가 있는 로컬 호스트를 연다.
처음에는 프로젝트 폴더를 선택한다. 기존 `project.sqlite` 폴더는 열고, 없는 새 폴더는 초기화한다.
기존 일반 폴더에는 빈 프로젝트를 덮어 만들지 않는다.

- `npm run setup:local`: 개인 경로를 `.oprn-local.json`(0600, gitignored)에 저장한다.
  기존 `.env*`나 프로젝트 데이터를 덮어쓰지 않는다.
- `npm run mac:launch -- --project-dir /path/to/project --no-open`: 경로를 명시하고 브라우저 자동 열기를 생략한다.
  경로 우선순위는 명령 인자 > `OPRN_PROJECT_DIR` > 개인 설정이다.
- 의존성 폴더가 없을 때만 `npm ci`를 한다. 실행 전 렌더러와 저장 브리지를 빌드한다.
- 호스트 주소는 `http://127.0.0.1:9999/`다. 포트 충돌 시 기존 서버를 재사용하거나 종료하지 않는다.
  브라우저는 자체 호스트 시작 성공 후에만 연다. Ctrl-C로 종료한다.
- 저장에 외부 DB 계정이나 API 키가 필요하지 않다. AI 연결은 별도 설정이다.
- 공유 팀 호스트는 [team-project-host.md](team-project-host.md)를 따른다.

## 1b. 전체 BGM은 Release 팩으로 설치

그림·효과음·기본 BGM 3곡은 Git에 있지만, 전체 281곡(약 1.304 GB)은
공개 [bgm-v1 Release](https://github.com/MovieHolic-Plex/OpenRPGMaker/releases/tag/bgm-v1)에서 따로 받는다.
`npm ci` 뒤 `gh auth login` + `npm run bgm:install` + `npm run bgm:verify`.
gh가 없으면 Release의 `rpg-zzu-bgm-v1.tar`를 받아
`npm run bgm:install -- --archive "/받은/파일/경로"`를 실행한다. 약 5 GB 여유 공간 권장.
기존 설치가 정상이면 재실행은 다운로드하지 않는다. 자동 실행/설정 마법사에는 다운로드를 붙이지 않았다.
로컬 재생은 `VITE_BGM_CDN_BASE`를 비워야 한다. 워크트리에 복사된 env의 CDN 값이
로컬 설치보다 우선할 수 있다. 음악 리소스 선택 창의 「전체 받기」도 같은 검증 설치기를 쓴다.
Vite dev/preview는 설치 후 선택 창을 다시 열면 목록·재생이 갱신되며 재빌드가 필요 없다.
정적 배포·내보내기는 설치 후 빌드해야 파일이 포함된다. 원격 설치는 서버 전용
`OPRN_BGM_INSTALL_REMOTE=1` opt-in과 서버 재시작이 필요하다(기본은 루프백만 허용).
환경 변수 이름은 2026-09 에 `RPG_ZZU_*` 에서 `OPRN_*` 로 바뀌었다. 옛 이름도 이번 릴리스까지는 경고 한 줄과 함께 그대로 읽힌다(`scripts/lib/oprnEnv.mjs` 가 새 이름으로 옮겨 준다).
SHA-256 검증·손상 복구·잠금 복구·관리자 제작 명령은 `openwiki/bgm-catalog.md`.

## 1c. 오프닝 이미지 팩

추가 스틸은 `npm run stills:install` + `npm run stills:verify`로 설치한다.
Git에는 카탈로그·검색어·해시만, 그림은 `stills-v1` Release에 둔다.
오프닝 편집과 AI `list_opening_media`가 같은 목록을 사용한다.
제작·복구·CDN/내보내기 계약은 [opening-still-pack.md](opening-still-pack.md).

## 2. 검증 — 무엇이 진짜 게이트인가

**워크트리·세션 에이전트는 이 표의 명령을 스스로 실행하지 마라.** `npm run gates` / `npm test` / vitest / 전체 typecheck /
`git stash` 는 감독자 전용이거나, 사용자가 **이 세션에서** 돌리라고 명시한 때만이다.
정본: `AGENTS.md` «워크트리·세션 에이전트는 gates / vitest / stash 금지».

| 명령 | 무엇을 재나 | 기준선 (실측) | 언제 쓰나 |
|---|---|---|---|
| `npm run typecheck:app` | `src` 만 (`tsconfig.app.json`) | **0 에러 / exit 0** — 초록 | 코드 바꿨으면 항상 |
| `npm run typecheck` | `src` + `test` 전체 | **빨간불** (`test/` 타입 에러 다수, exit 2) | 게이트로 쓰지 마라. 자기가 만진 테스트 파일만 눈으로 확인 |
| `npm test` | Vitest 유닛/계약 **전체** | 약 **21,894건**(2,093 파일) 중 실패 83건, **1,715 s(28분 35초)** (2026-09-14 실측, 이 박스는 공유라 loadavg 49~71 — 한산하면 더 짧다). 워커 힙은 스크립트가 8GB 로 깐다 | 최종 게이트에서만. 반복 중에는 쓰지 마라 |
| ↑ **워커 수가 시간을 지배한다** | 40파일·301케이스 고정 실측 (2026-09-16) | **W1 121.7s / W2 70.4s / W4 51.0s / W8 41.0s / W16 39.3s / W32 41.1s** — 8에서 포화. 케이스 수·통과 수는 모든 워커 수에서 동일(301 passed) | 게이트(`verify-gates.mjs`)는 `--maxWorkers=8` 을 명시한다. 32로 올려도 이득 없고, vitest 가 ~9.4GiB 로 OOM-kill 된 전례가 있다 |
| `npm run test:changed` | HEAD 대비 **import 영향만** (`--changed`) | **254 s**(454 파일, 변경 6건) ↔ **1,247 파일에서 30분 초과 미완**(변경 3건 — 코어 모듈이면 전파가 전부에 가깝다) | 편집 중 반복. 잎 모듈을 만졌을 때만 이득 |
| `npm test -- test/<name>.test.ts` | 파일 지정 | **16 s** (고정비 ≈16 s: 워커 스폰 + 앱 모듈 그래프) | 방금 만진 파일 하나 |
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
| 몬스터 수집(포켓몬류) 몬스터 그림·스타터·진화형 스프라이트 | **하네스** `npm run harness -- monster-collect-species status` → `openwiki/harnesses/monster-collect-species.md` (손으로 그리지 않는다) |
| 새 하네스 만들기 / 하네스 목록 | `openwiki/harnesses/README.md`, `src/harnesses/INDEX.md`, `src/harnesses/_core/registry.ts` |
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
| 저장·불러오기·자동저장·원격 지속성 | `src/project/store.ts`, `src/editor/saveActions.ts`, `src/project/persistence/electronRepository.ts`, `electron/main/dispatch.ts` |
| 프로젝트 JSON 스키마·마이그레이션 | `src/project/types/project.ts`, `src/project/io/shape.ts`, `src/project/io/references.ts` |
| 기본 프로젝트·샘플 콘텐츠 | `src/project/defaults/defaultProject.ts`, `src/editor/content/` |
| 세이브 슬롯·이어하기 | `src/player/saveSlots.ts`, `src/player/saveSlotValidation.ts` |
| 런타임 세션 상태(스위치·변수·진행) | `src/project/session.ts` |
| 플레이 화면 부팅·모드 전환 | `src/app/mode.ts`, `src/player/player.ts`, `src/player/createPlayGame.ts`, `src/main.ts` |
| 전투 상태이상 추가·해제·턴 경과 | `openwiki/state-system.md`, `src/battle/battleStates.ts`, `src/project/types/database.ts` |
| 실시간 액션 전투·필드 스폰 | `openwiki/runtime-action-combat.md`, `src/player/playSceneActionCombat.ts`, `src/player/playSceneFieldSpawns.ts` |
| 전투 규칙·턴·보상 | `src/battle/runtime.ts`, `src/battle/types.ts` |
| 전투 화면 DOM·스킨 | `src/player/battleFieldDom.ts`, `src/styles/runtime/battle/`, `src/styles/runtime/battle-skins/` |
| 대화창·문장 표시 | `src/player/dialogue.ts`, `src/player/dialoguePresentation.ts`, `src/player/dialoguePagination.ts` |
| 톱바·메뉴·용어 (편집 모드는 2026-09-27 삭제) | `src/editor/panels/menu.ts`, `src/editor/uiCopy.ts` |
| 좌측 도크·레이아웃 | `src/editor/workspace/leftDockPanels.ts`, `src/editor/panels/editor.ts` |
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
- 콘텐츠 변경: SQLite 정본 저장 후 **재로드 성공**과 project id·저장 대상 보고. 로컬 fixture·export JSON 은 완료가 아니다.
- 문서·위키에 영향을 주는 변경: 해당 `openwiki/*.md` 를 같은 변경에서 고친다.
