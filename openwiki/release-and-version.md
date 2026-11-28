# 릴리스와 버전

**TL;DR** — 이 저장소에는 **네 개의 다른 버전 축**이 있다. 섞으면 "지금 몇 버전이지" 라는 질문에 답할 수 없게 된다.
릴리스 버전의 정본은 `package.json` 하나이고, 올리는 명령은 `npm run release` 하나다.
매 머지마다 올리지 않는다(실측 하루 머지 26건).

## 네 축을 구분한다

| 축 | 현재 값 | 무엇의 약속인가 | 정본 위치 |
|---|---|---|---|
| **앱 버전** | `0.1.0` | 도구 OPRN Studio 자체의 릴리스 | `package.json` → 빌드가 주입 |
| 프로젝트 문서 스키마 | `SCHEMA_VERSION` = 4 | 저장 파일 포맷 호환 | `src/project/types/base.ts`, `projects.schema_version` |
| 로컬 스토어 포맷 | 설계 중 | SQLite 레이아웃 | `docs/superpowers/specs/2026-09-15-oprn-local-sqlite-store-design.md` (`meta.format_version`) |
| 발행 게임 버전 | 자동 `1.0` → `1.1` … | **사용자가 만든 게임**의 릴리스 | 스토어 게임은 스토어 서버가 매긴다(`store_game_versions`). 발행 대화상자의 버전 칸은 비우면 자동, 적으면 그 번호 (`src/editor/panels/publishingDialog.ts`) |

앱 `0.1.0` 과 게임 `1.0` 은 다른 물건이다. 앱 버전을 올렸다고 사용자 게임 버전이 바뀌지 않는다.

### 스토어 「바로 플레이」 게임 판본 (2026-10-23)

- 올릴 때마다 판본이 자동으로 생긴다: 첫 판 `1.0`, 그다음 `1.1`, 「큰 갱신」이면 앞자리(`2.0`). 작가가 번호를 적으면 그 번호(지금까지보다 커야 한다).
  내용 해시(경로·파일 해시 목록의 sha256)가 마지막 판본과 같으면 판본을 만들지 않는다.
- 판본마다 내용 해시·시각·「무엇이 바뀌었나」(맵·이벤트·캐릭터 더함/바꿈/뺌 — `src/project/storeGameRelease.ts` `projectChangeSummary`, 글은 작가가 고친다)를 남긴다.
- 판본 폴더 `<게임 호스트>/<slug>/<판본>/` 는 한 번 쓰면 바뀌지 않는다(DB 트리거 + 디스크 원자 이름 바꾸기). 옛 판본도 계속 플레이할 수 있고, 「지금 판본」 되돌리기는 버튼 하나다.
- 세이브는 게임+판본 이름(`oprn-export:store:<slug>@<판본>`)에 둔다. 새 판본을 처음 열 때 옛 판본 세이브가 있으면 호환 안내와 함께 이어서 할지 묻는다(`src/player/storeGameHost.ts`).
- 서버 계약은 비공개 저장소 OpenRPGMaker-store `src/games.ts`, 데모 게시는 `npm run store:publish-game`(`openwiki/asset-store.md` 「바로 플레이 게임」).

## 릴리스 버전은 왜 매 머지가 아닌가

실측(2026-09-16): 지난 7일 머지 184건 = **하루 약 26건**, 전체 커밋 716건.
매 머지마다 버전을 올리면 하루에 26개 버전이 생긴다. 그러면:

- 숫자가 아무 약속도 하지 않는다(0.1.17 에서 고쳤는지 묻는 질문 자체가 의미를 잃는다).
- CHANGELOG 가 하루 26줄이 되어 아무도 안 읽는다.

그래서 숫자를 둘로 나눈다.

- **빌드 식별자**: 매 머지·빌드마다 자동. 아무도 관리하지 않는다. `0.1.0-dev.184+gddc7a88`
- **릴리스 버전**: 사람이 정한다. `npm run release` 만 올린다. 태그 `v0.1.0` 이 그 약속의 정체성이다.

## 빌드 식별자

계산 지점은 `scripts/lib/appVersion.mjs` 하나다. 빌드는 vite 플러그인(`appVersionPlugin()`)이
`__APP_VERSION__`·`__APP_VERSION_META__` 를 define 으로 주입하고, 앱은 `src/brand.ts` 에서 읽는다.

| 상태 | 라벨 |
|---|---|
| 태그가 현재 버전 그대로이고 그 위 커밋 없음 | `0.1.0` |
| 태그 이후 N커밋 | `0.1.0-dev.3+gddc7a88` |
| 태그가 아직 없음(저장소 전체 커밋 수를 쓴다) | `0.1.0-dev.5160+gddc7a88` |
| 추적 파일이 수정된 트리 | 위 라벨 + `.dirty` |
| git 을 못 쓰는 환경(tarball 등) | `0.1.0+nogit` |

보이는 곳 세 군데 — 값이 갈라지지 않게 한 계산을 공유한다.

- 도움말 모달의 `버전 …` 줄(툴팁에 커밋·기준 태그·빌드 시각)
- `window.__oprnVersion()` — 버그 리포트·헤드리스 도구용
- CLI: `npm run version:info` (`--json` 가능). 아티팩트 이름·CI 가 쓴다.

주입이 없는 번들(vitest 등)에서는 `0.0.0-nogit` 으로 떨어진다 — 죽지 않는다.

## 릴리스 절차

```bash
# 1. 기준선 확인. 릴리스 대상 파일에 미커밋 변경이 있으면 스크립트가 거부한다.
git status --porcelain -- package.json package-lock.json CHANGELOG.md

# 2. 노트 미리보기 (아무것도 쓰지 않는다)
npm run release -- --dry-run --minor --summary "로컬 SQLite 저장 첫 배포"

# 3. 자르기 — package.json·package-lock.json 범프 + CHANGELOG 항목 + 커밋 + 주석 태그
npm run release -- --minor --summary "로컬 SQLite 저장 첫 배포"

# 4. 사람이 확인하고 민다 (스크립트는 푸시하지 않는다)
# 본문은 CHANGELOG 의 그 절을 --notes-file 로 올린다. --notes-from-tag 를 쓰지 않는다 —
# git 주석 글자가 # 이라 `##`/`###` 제목이 태그 메시지에서 빠진다(실측 v0.412.0).
git push origin HEAD && git push origin v0.2.0
# npm run release 가 알려 주는 노트 파일 경로를 쓰거나:
gh release create v0.2.0 --title "v0.2.0" --notes-file /tmp/oprn-release-notes-v0.2.0.md
```

첫 릴리스는 범프 없이 현재 버전을 태그한다: `npm run release -- --first` (노트는 최근 300커밋까지).

**언제 올리나** — 사용자가 알아챌 약속이 바뀌었을 때만.

- 저장 포맷·스키마·업데이터 호환처럼 되돌리기 어려운 변화 → `--minor` (0.x 에서는 깨지는 변경이 MINOR 다)
- 그 외 수정·기능 → `--patch`
- `1.0.0` 조건: 로컬 SQLite 저장 + 데스크톱 패키징 + 업데이트 채널. 그 전까지는 정직하게 0.x.
- 되돌릴 때도 숫자는 내려가지 않는다 — 새 버전으로 다시 낸다.

## 데스크톱 산출물을 릴리스에 붙인다 (2026-09-16)

Electron 배포는 GitHub Release 에 바이너리를 붙이는 게 본류다. 이 저장소의 절차:

앱 아이콘(2026-09-28): 원본은 투명 배경의 도트 검 `design/app-icon/oprn-icon-sword.png` 한 장이고,
`python3 scripts/assets/build-app-icons.py` 가 `public/icons/` 의 파비콘·PWA·마스커블 아이콘과 `build/icon.png`·`build/icon-mac.png` 를
한 번에 다시 만든다. 판(배경)은 두 곳에만 깐다: 안드로이드 마스커블(런처가 모양대로 자른다)과 맥
(macOS 26 은 둥근 사각형이 아닌 아이콘을 회색 판에 줄여 넣는다). 빌더 설정의 `icon` 은 윈도우·리눅스용 `build/icon.png`,
`mac.icon` 은 `build/icon-mac.png` 를 가리킨다. 리눅스·윈도우 창 아이콘은 `electron/main/main.ts` 가 렌더러 번들의
`icons/pwa-512.png` 로 준다. 생성 파일을 손으로 고치지 말고 원본을 바꾼 뒤 스크립트를 다시 돌린다.

```bash
# 1. 패키지 빌드 (OS별 — 맥 dmg·zip 은 맥 호스트에서, 리눅스 AppImage 는 어디서나)
npm run electron:package            # → dist-packages/OPRN Studio-<version>.AppImage

# 2. 정식 릴리스 태그에 업로드 (npm run release → push → gh release create 를 마친 뒤)
gh release upload v0.3.0 dist-packages/OPRN\ Studio-0.3.0.*
```

- **프리릴리스 태그로 미리 보기**: 병합 전 브랜치의 도그푸딩 바이너리는 정식 태그에 붙이지 않는다
  (바이너리가 태그와 어긋난다). `v<version>-electron-preview.N` + `--prerelease` 로 올리고,
  정식 릴리스가 나오면 지운다. 실측: `v0.3.0-electron-preview.1`(PR #874, Linux AppImage 335MB).
- **AppImage 크기 참고**: production node_modules 를 asar 에 넣지 않는 설정(`files: ["dist/**", "dist-electron/**"]`)
  때문에 ~330MB 다. electron 본체가 대부분이다.
- **서명·자동 업데이트는 아직 없다**(`publish: null`, 설계서 비목표). 채널이 생기면 `electron-builder` 의
  publish 설정과 latest.yml 을 같이 도입한다.
- GitHub Release 파일 상한(2GB/파일) 안이므로 AppImage·dmg 모두 문제없다.
- README 다운로드는 버전이 없는 이름을 쓴다. `.github/workflows/desktop-release.yml` 이
  정식 `vX.Y.Z` 릴리스가 나오면 mdc2 `mdc2-heavy` 에서 AppImage·portable exe 를
  만들어 버전 파일과 함께 `OPRN.Studio-linux.AppImage`, `OPRN.Studio-windows.exe` 를
  같은 릴리스에 올린다(자산 4개, `scripts/lib/releaseAssets.mjs`). 주소는 `https://github.com/MovieHolic-Plex/OpenRPGMaker/releases/latest/download/`
  뒤에 그 이름이다. 버전 파일까지 자산 네 개가 있으면 빌드를 생략한다. 초안이면 검증 후 발행한다.
  Electron 다운로드와 예제 JSON 은 러너 공용 캐시(`~/.cache/oprn-desktop`, 홈 디스크가 부족하면 러너별 `_tool/oprn-desktop`)에 둔다.
  예제 굽기(`npm run bake:demos`, `scripts/content/bake-flagship-demos.mjs`)는 데모별 입력 해시 캐시(`v2/<id>-<sha256>`)를 쓰고
  `package-lock.json` 의 루트 버전 범프는 해시에서 제외해 릴리스 버전만 올린 판에서는 변하지 않은 데모를 다시 굽지 않는다(2026-11-27).
  캐시 미스 데모는 esbuild 코드 분할 번들(큰 JSON 은 디스크 직접 읽기)로 CPU·메모리 예산 안에서 병렬 굽기하고, BGM 도 캐시·병렬 받기를 쓴다.
  `desktop-release.yml` 은 Electron·렌더러 빌드, 세 패키지 타깃(AppImage·NSIS·Portable, 각 독립 출력·TMPDIR), 9개 자산 업로드(최대 4병렬 + 자산별 3회 재시도)를 병렬화하되
  초안 생성 → 업로드 → 9개 자산 이름·크기 검증 → 발행(최고 태그만 latest) 순서 계약은 그대로 유지한다.
  수동 복구에는 저장소 브랜치·태그 이름이나 기본 브랜치 이력의 SHA 를 `source_ref` 로 쓸 수 있다.
  **윈도우 zip 은 2026-11-23 에 버렸다**(app-size). zip 과 portable exe 가 둘 다 무설치 실행이라 같은 앱을
  1GB 씩 두 번 올렸다. 그 뒤 릴리스에서는 `releases/latest/download/OPRN.Studio-windows.zip` 이 404 다 — README 배지를 빼고,
  옛 릴리스(v0.416.0 까지)의 zip 은 그대로 남는다. 로컬 `scripts/release-desktop.mjs` 는
  `OPRN_DESKTOP_LOCAL=1` 일 때만 같은 일을 한다. macOS 패키지는 아직 없다.
- **윈도우 기본 다운로드는 NSIS 설치판이다 (2026-11-24, qa1124 항목 1).** portable exe 는 실행할 때마다 770MB 솔리드
  LZMA2 를 1.89GB·2,225개 파일로 풀고(리눅스 서버 코어에서 해제만 33초) 끝나면 지운다. 그동안 창이 없었다
  (splashImage 가 없으면 템플릿이 `SetSilent`). 그래서 릴리스는 윈도우 exe 를 둘 낸다:
  설치판 `OPRN.Studio-Setup-<버전>.exe`(고정 이름 `OPRN.Studio-windows-setup.exe`, README 단추) 와
  portable `OPRN.Studio.<버전>.exe`(고정 이름 `OPRN.Studio-windows.exe` 는 그대로 — 옛 링크·사이트 단추가 깨지지 않는다).
  자산 검사는 6개다. 설치판은 `oneClick`·사용자 폴더(`%LOCALAPPDATA%\Programs`, 관리자 불필요)·바로가기·설치 뒤 실행이고,
  portable 은 `build/portable-splash.bmp` 를 해제 중에 띄운다. 설치판 파일 이름은 워크플로가 `-c.nsis.artifactName` 으로도
  고정한다(옛 태그 트리를 다시 구워도 같은 이름이 나오게). 브랜치에서 형식만 확인하려면 `workflow_dispatch` 의
  `dry_run: true` 로 돌린다 — 만들기·형식 보고만 하고 올리기·발행·latest 확인은 건너뛴다.
  설정·프로젝트 폴더는 appId 기준이라 설치판과 portable 이 같은 것을 쓴다. 자동 업데이트는 여전히 없다.

### 윈도우 단일 exe 는 리눅스에서 만든다 (2026-09-22, 갱신 2026-10-10·2026-11-23)

`electron-builder.config.mjs` 의 `win.target` 은 NSIS 설치판과 NSIS portable 이고(2026-11-24) **둘 다 wine 없이 리눅스에서 빌드된다**.
electron-builder 가 `makensis`(nsis-3.0.4.1 · nsis-resources-3.4.1)를 내려받아 직접 돌리기 때문이다.
실측 2026-10-10: wine 미설치 상태에서 최소 프로브(electron 38.8.6)로 `Probe 1.0.0.exe`(84MB)와,
v0.185.0 에서 `OPRN Studio-0.185.0-portable.exe` 가 만들어졌다. wine 은 그 뒤 **실행 검증에만** 쓴다.
(옛 문장의 "NSIS 설치본을 넣으면 wine 이 필요해진다" 는 사실과 다르다 — 설치본(inno/nsis)과
portable 모두 패키징은 되고, wine 이 필요한 것은 만들어진 exe 를 리눅스에서 띄워 볼 때뿐이다.)

```bash
# 릴리스 커밋에 체크아웃한 워크트리에서 (버전이 package.json 에서 온다)
git worktree add -B win-build <경로> v<version>
npm run build:packaged && npm run build:electron   # dist/ 와 dist-electron/ 를 먼저 만든다
node <electron-builder>/out/cli/cli.js --config electron-builder.config.mjs --win --x64
# → release/OPRN Studio-<version>-win.zip
```

**검증은 wine 으로 창이 뜨는 것까지만 본다.** 실측(0.7.0):

```bash
sudo apt-get install -y --no-install-recommends wine64
WINEPREFIX=/tmp/oprn-wine /usr/lib/wine/wine64 wineboot --init
Xvfb :78 -screen 0 1400x900x24 &
DISPLAY=:78 WINEPREFIX=/tmp/oprn-wine /usr/lib/wine/wine64 "OPRN Studio.exe" --no-sandbox --disable-gpu
DISPLAY=:78 xwininfo -root -tree | grep -i oprn   # 1272x766 창이 잡히면 부팅 성공
```

- **픽셀 증거는 못 얻는다.** wine 의 GPU 컨텍스트 생성이 실패해(`Failed to create shared context for
  virtualization`) Xvfb 스크린샷이 1-bit 회색 빈 화면으로 나온다. `xwininfo` 의 창 크기와 로그로만
  판정하고, 화면 증거가 필요하면 실제 윈도우 머신에서 찍어야 한다.
- **`scripts/qa/verifyPackagedApp.mjs` 는 윈도우를 못 몬다.** 실행 경로가 `release/linux-unpacked/oprn`
  으로 박혀 있다. 윈도우는 위의 `xwininfo` + asar 추출 검사가 사실상 전부다.
- **asar 안을 직접 열어 확인하는 편이 빠르다.** 두 결함(시작 실패·번들 유출)은 여기서 잡혔다:
  `npx @electron/asar extract-file release/win-unpacked/resources/app.asar dist-electron/main.cjs`
  로 꺼내 `Invalid URL` 을 만들던 줄이 없는지, `dist/assets/main-*.js` 에서 dev 주소·키가 0건인지 본다.
- **빌드는 wine 설치 전에 끝난다.** 실측에서 zip 과 portable exe 는 wine 없이 만들어졌고, wine 은 그 뒤 실행 검증에만
  썼다. 그러니 wine 설치 실패가 빌드를 막지는 않는다.
- **단일 exe(portable)는 첫 실행 때 임시 폴더로 자동 해제한다.** 그래서 시작이 느리고 크다(≈0.8GB대).
  true single binary 가 아니라 NSIS 자동 해제 래퍼다. 2026-11-24 부터 기본 다운로드는 설치판이고 portable 은 보조다
  (위 «윈도우 기본 다운로드는 NSIS 설치판이다»). 폴더째 쓸 일이 있으면 로컬에서 `--win zip` 을 따로 준다.

### 리눅스 AI 워커는 네이티브 애드온 없이, 윈도 워커는 애드온과 같이 굽는다 (2026-11-26, 옛 방식은 2026-09-27)

앱의 채팅·Pi 실행은 `scripts/build-ai-worker.ts` 가 `Bun.build` 의 compile 로 만든 `dist-electron/oh-my-pi-worker[.exe]` 가 한다
(로그인은 Node 쪽 `aiAuthRuntime.ts` 라 워커 없이 된다). `build-electron.mjs` 와 ci-fast 가 같은 스크립트를 부른다.

- 리눅스: 우리 경로(Agent·전송·도구 호출)는 애드온 함수를 부르지 않는다(호출 기록기로 MVP 여러 판 0건, omp-to-pi 레인 2026-11-26). 그래서
  빌드 플러그인이 `native/loader-state.js` 의 `loadNative()` 를 빈 바인딩 `{}` 로 바꾸고 애드온(136MB)을 싣지 않는다. omp 를 올려 로더 모양이
  바뀌면 치환 수가 1이 아니어서 빌드가 멈춘다. 새 omp 기능이 애드온을 부르면 그 요청만 `… is not a function` 으로 실패한다.
- 윈도: **애드온이 필요하다.** omp 가 시작하자마자 `pi-natives/path` 의 `expandWindowsLongPath`(8.3 짧은 경로 펼치기)를 부르고, 그 함수는
  윈도에서만 애드온을 읽는다. 애드온 없이 구운 윈도 워커는 «does not export `expandWindowsLongPath`» 로 바로 죽었다(2026-11-26
  windows-worker-smoke, #5257 직후). 그래서 윈도 워커는 로더를 그대로 두고 `pi_natives.win32-x64-baseline.node`(138MB)를 워커 옆에 둔다.
  윈도 애드온은 리눅스 호스트의 `node_modules` 에 설치되지 않으므로(os 필터) `package-lock.json` 의 `resolved`·`integrity` 로 받아 검증하고
  `node_modules/.cache/oprn-pi-natives/` 에 캐시한다. lock 의 pi-natives 가 두 버전이면 빌드를 멈춘다(2026-11-04 윈도 사고).
  **리눅스 실측(호출 0건)을 윈도에 옮기지 않는다.** 워커·애드온을 바꾸면 윈도 워커를 실제 윈도에서 띄워 본다.
- 큰 JSON(64KB 이상, 번들 타일셋·참고문서 등 152개·148MB)은 실행 파일에 박지 않고 `dist-electron/worker-data/<저장소 상대 경로>` 에
  둔다. 빌드 플러그인이 그 import 를 `scripts/lib/workerData.ts` 의 `readWorkerJson()` 호출로 바꾸고, 워커는 **실행 파일 옆
  `worker-data`**(`dirname(process.execPath)`)에서 읽는다. 그래서 설치 폴더·portable 임시 폴더·AppImage 마운트 어디서든 실행 파일과 같이
  움직이고, 앱 자동 업데이트가 경로 환경 변수를 되돌려도(`APP_UPDATE_RUNTIME_PATH_ENV`) 따로 고칠 것이 없다. `OPRN_WORKER_DATA_DIR` 로
  바꿀 수 있다. bun 은 asar 를 못 읽으므로 builder 가 `dist-electron/worker-data/**` 를 `asarUnpack` 한다.
  파일이 없으면 워커가 한 줄(«조수 워커 자료를 읽지 못했습니다(파일이 없습니다): <경로>. 앱 설치가 깨졌을 수 있습니다 …»)을 남기고
  코드 78 로 끝나며, 호스트가 그 줄을 조수 오류로 보인다. 실측(2026-11-26): 리눅스 워커 341.2MB → 160.3MB, 윈도 347.3MB → 166.4MB,
  READY 6.9~7.5초 → 2.35~2.52초. 소스로 띄우는 워커(`bun scripts/oh-my-pi-worker.ts`)는 JSON 을 그대로 import 한다.
- 메인 프로세스의 프로젝트 코어(`dist-electron/project-core.cjs`)도 같은 폴더·같은 경로 규칙으로 큰 JSON 을 읽는다(`build-electron.mjs` 의
  `externalDataJson`, `join(__dirname, "worker-data", <경로>)`). Electron 의 fs 가 `app.asar/dist-electron/worker-data` 를 풀린 폴더로 이어 준다.
  그래서 번들 타일셋 JSON 이 코어·워커에 한 벌만 있다(코어 123MB → 5.1MB). 폴더는 `build-electron.mjs` 가 처음에 비우고 코어·워커가 채운다.
  렌더러(`dist/assets`)의 JSON 은 vite 가 따로 굽는 것이라 아직 따로 있다.
- 옛 방식(2026-09-27~11-26): `--compile` 이 런타임에 계산한 경로의 애드온을 따라가지 못해 워커가 시작하자마자
  `Failed to load pi_natives native addon` 으로 죽었고(«로그인은 되는데 채팅만 안 된다»), 애드온을 워커 옆에 두고 lock 의 tarball 로
  윈도 애드온을 받았다. 두 버전이 섞이면 윈도 워커가 `~/.omp/natives/<판>/` 을 찾다 죽은 일도 있었다(2026-11-04).
- `scripts/electron-builder.config.mjs` 는 워커와 애드온을 `asarUnpack` 하고, `linux.files`/`win.files` 로 다른 OS 의
  워커·애드온을 뺀다(각 약 340MB). **최상위 `files` 를 두지 않는다.** 최상위와 플랫폼
  `files` 는 별개 매처라 합집합이 된다 — 플랫폼 쪽 제외가 최상위 `dist-electron/**` 를 못 이겨 두 OS 에 워커
  4개가 다 실렸다. 반대로 제외 패턴만 주면 빌더가 `**/*` 로 읽어 저장소 전체를 싣는다(app.asar 4.9GB).
  그래서 OS 마다 공용 목록 `APP_FILES` 를 펼친 뒤 제외를 붙인다. 확인: `--linux dir --win dir` 뒤
  `*-unpacked/resources/app.asar.unpacked/dist-electron/` 에 리눅스는 워커 하나, 윈도는 워커와 애드온 둘만 있어야 한다.
- **두 번째 결함: 워커 스크립트 경로를 무조건 계산했다.** `scripts/lib/ohMyPiPiAi.mjs` 의 `startWorker()` 가
  `new URL("../oh-my-pi-worker.ts", import.meta.url)` 을 먼저 평가했는데, CJS 로 번들된 Electron 메인에서는
  `import.meta` 가 `{}` 라 던진다. 애드온을 고친 뒤에도 앱 채팅은 전부 500 `Invalid URL` 이었다. bun 으로 스크립트를
  띄우는 분기에서만 계산한다. **워커 단독 검증은 이 결함을 못 잡는다** — 앱 전체를 띄워야 한다(아래).
- 검증: 패키지에서 꺼낸 워커를 **빈 HOME** 으로 띄워 `READY <port>` 가 나오는지 본다. 개발 머신의
  `~/.omp/natives` 가 있으면 가짜 통과가 된다. 윈도우는 `wine` 으로 `oh-my-pi-worker.exe` 를 같은 방식으로 띄운다
  (`WINEPREFIX` 는 `/tmp` 바로 밑이면 "not owned" 로 거부된다 — `$HOME/.cache/...` 를 쓴다).
  앱 전체는 Playwright `_electron` 으로 `linux-unpacked/oprn` 을 띄워 렌더러에서
  `window.oprn.companionOrigin + "/v1/chat/completions"` 를 `x-oprn-companion-token` 헤더로 부른다.
  증거(2026-09-27): `verify-shots/desktop-ai-worker/` — wine exe READY·`/complete` 200, 앱 채팅 200.

### 필요할 때 받는 자산 (2026-11-23, app-size-2)

공용 초상(`assets/shared/portraits`)과 장소 내려받기(`assets/region-references/*.oprn.json`)는 데스크톱 패키지에 다 싣지 않는다.
`bake:demos` 다음에 `scripts/desktop-ondemand-assets.mjs` 가 그 파일을 `dist` 에서 빼고 `dist/ondemand-assets.json` 에
경로마다 크기·SHA-256 과 받을 곳(`raw.githubusercontent.com/MovieHolic-Plex/OpenRPGMaker/<빌드 커밋>/public/`)을 적는다.
앱의 `app://` 처리기는 없는 파일을 만나면 `electron/main/assetsOnDemand.ts` 로 받아 해시를 확인하고
`<userData>/asset-cache/<sha256>.<확장자>` 에 둔다(BGM 의 `bgmOnDemand.ts` 와 같은 캐시 코드). 렌더러 주소는 그대로다.

- 남기는 것: 예제 데모가 쓰는 초상 세트의 대사 감정 다섯 표정(base·happy·sad·angry·surprised)과 데모가 이름으로 부른 표정,
  데모가 가리키는 장소 파일, 그 커밋의 git blob 과 바이트가 다른 파일(받을 곳이 없다). 데모는 오프라인에서도 그대로 돈다.
- 받을 곳이 빌드 커밋에 묶이므로 **그 커밋이 공개 저장소에 푸시돼 있어야 한다**(스크립트가 아니면 경고한다). 릴리스는 태그 커밋이라 늘 맞다.
- 못 받으면(오프라인·해시 불일치) 404 로 그 그림만 빠진다. 장소 가져오기는 스냅숏으로 물러난다(`regionReferenceImport.ts`).

그다음 `scripts/desktop-png-optimize.mjs` 가 패키지에 남은 `dist` PNG 를 oxipng(고정 판, SHA-256 확인)로 무손실 재압축한다.
저장소 원본은 그대로다(그림 해시를 쓰는 관문과 웹 빌드가 원본을 본다). 2026-11-23 실측: 초상 밖 PNG 8,860장 188.0MB → 124.7MB, RGBA 화소 차이 0.

## 앱 자동 업데이트 (2026-11-24, app-auto-update)

데스크톱 앱이 GitHub 릴리스에서 스스로 새 판을 받는다. 코드는 `electron/main/appUpdate.ts`(메인)·
`electron/shared/appUpdate.ts`(판정)·`src/app/appUpdateChip.ts`(칩)이다.

- 공급자: `scripts/electron-builder.config.mjs` 의 `publish`(github). 앱은 `releases/latest`(Latest 표시 릴리스)의
  `latest.yml`(윈도 NSIS)·`latest-linux.yml`(AppImage)을 읽는다. 초안은 보이지 않으므로 「검증 뒤 발행」 순서와 맞다.
  electron-builder 는 늘 `--publish never` 로 부르고, 올리기는 릴리스 워크플로가 한다.
- 흐름: 켠 뒤 15초·15분마다 조용히 확인 → 뒤에서 받기 → 상단 칩 「v0.x 준비됨 · 다시 시작」 하나.
  누르면 조수가 끝나길 기다리고 창 닫기와 같은 저장(`src/main.ts` flushForClose)을 한 뒤 재시작한다.
  안 누르면 앱을 끌 때 설치한다. 설정 「일반·언어」 의 「자동 업데이트」 하나로 끈다. 재시작 뒤 바뀐 점을 토스트로 한 번.
- 수동 확인: 설정 「일반·언어」·「정보」 탭, 시작 화면 `⋯` 메뉴, 에디터 「프로젝트 → 도움말 → 업데이트 확인」, 에디터 가이드 버전 줄, ⌘K 「도움말: 업데이트 확인」 에서 언제든 `oprn:update.check` 로 즉시 확인할 수 있다. 자동 업데이트가 꺼져 있거나 `mode === "off"`(개발·맥 등)일 때도 GitHub 최신 릴리스와 비교해 결과를 알리고 다운로드·재시작으로 이어진다.
- 설치 형태: 윈도 NSIS 설치판·리눅스 AppImage 는 자동, portable exe 는 「새 버전 있음 · 내려받기」 링크만, 개발 실행·맥은 끔.
- AppImage 함정: `isForceRunAfter` 로 새 파일을 바로 띄우면 한 번만 실행 잠금 때문에 새 실행이 꺼진다. 설치만 하고
  `app.relaunch({ execPath: 새 파일 })` 로 이전 실행이 끝난 뒤 띄운다. 설치 확인용 실행(`APPIMAGE_EXIT_AFTER_INSTALL=true`)은
  `boot.ts` 가 바로 끝낸다. AppImage 이름에 공백이 있으면 gh 업로드가 점으로 바꿔 `latest-linux.yml` 과 어긋나므로
  `linux.artifactName` 을 `OPRN.Studio-${version}.${ext}` 로 고정했다. AppImage 의 차등 받기는 파일 안 blockmap 을 쓴다
  (별도 `.blockmap` 은 NSIS 만).
- 물려주는 환경 변수: electron-updater 는 새 AppImage·NSIS 설치기를 이 실행의 `process.env` 로 띄운다. 메인이 실행 중에 쓴
  `OPRN_OH_MY_PI_WORKER_BIN`·`OPRN_OH_MY_PI_WORKER_SCRIPT`·`OPRN_RENDERER_DIR` 는 `installAppUpdate` 가 켜질 때 값으로 돌린다
  (`APP_UPDATE_RUNTIME_PATH_ENV`). 안 돌리면 AppImage 새 판이 옛 마운트의 조수 워커·렌더러를 쓰고 옛 마운트가 풀리지 않는다
  (2026-11-26 v0.419→0.420 실측). 윈도 설치판은 설치 폴더가 같아 같은 경로의 새 파일을 가리켜 드러나지 않았다.
  e2e 가 새 판 `start` 기록의 물려받은 값이 없고 경로가 자기 `resourcesPath` 안인지 본다(`linux-click-own-paths`).
- 릴리스 자산: 0.420.0 부터 `latest.yml`·`latest-linux.yml`·`OPRN.Studio-Setup-<판>.exe.blockmap` 도 발행 전 필수다
  (`releaseAssets.mjs` `requiredUpdateAssets`, `UPDATE_FEED_SINCE` — desktop-release.yml 의 jq `feed()` 와 같은 판). 이름은 바꾸지 않고
  올린다(README 고정 이름과 겹치지 않는다). 그 전 판은 요구하지 않는다 — 옛 빌드 설정은 이 파일을 만들지 못한다.
- 검증: CI `app-update-e2e`(`scripts/qa/app-update-e2e.mjs`)가 실제 AppImage 0.0.1 → 로컬 generic 서버 → 0.0.2 교체·재시작과
  NSIS `latest.yml`·sha512·blockmap 을 본다. 실제 윈도 업데이트는 사람이 윈도에서 확인한다.

## 커밋 메시지가 릴리스 노트의 원고다

`npm run release` 는 `git log` 에서 노트를 만든다(`scripts/lib/releaseNotes.mjs`). 손으로 쓰는 노트는
릴리스마다 빠지고, 빠진 릴리스는 아무도 안 쓴다. GitHub 릴리스 본문과 CHANGELOG 는 같은 문자열이다.

- 맨 위 「주요 변경」: `feat`/`fix`/`perf`(및 깨지는 변경)에서 3–5줄을 고른다(깨지는 변경 → feat → fix → perf, PR 노트가 있는 것 우선)
- 그다음 사용자 섹션: 깨지는 변경 · `feat` 기능 · `fix` 수정 · `perf` 성능 · `revert` 되돌림
- 내부 섹션(`refactor` 정리 · `docs` 문서 · `test` 테스트 · `style` 스타일 · `build` 빌드 · `ci` CI · `chore` 잡무 · 기타)은 `<details>` 「개발」 안에 접는다
- `!` 를 붙이면(`feat(editor)!:`) "깨지는 변경" 섹션이 맨 앞에 서고 원래 섹션에도 남는다
- 머지 커밋과 `chore(release): …` 는 제외한다
- 규약을 안 따른 메시지도 버리지 않고 "기타" 로 싣는다 — 조용히 사라지는 변경을 만들지 않기 위해서다
- 같은 요약은 한 번만 싣는다(체리픽·리베이스 중복 방지)
- 커밋 제목에 `(#1234)` 가 있으면 그 PR 본문의 「릴리스 노트」/「Release notes」 절 첫 줄을 쓴다. gh 를 못 쓰거나 절이 없으면 제목으로 남긴다

사람이 「주요 변경」을 통째로 쓰려면 `--summary` 를 넘긴다(자동 요약을 덮어쓴다).

주석 태그는 `git tag -a -F` 에 `core.commentChar=;` 를 붙여 `##`/`###` 제목을 지킨다. GitHub 본문은
`--notes-from-tag` 가 아니라 CHANGELOG 절을 `--notes-file` 로 올린다.

## 아직 안 한 것

- **release-please(GitHub Actions)**: 이 저장소의 Actions 는 꺼져 있어(enabled=false) 쓸 수 없다. 대신 아래 로컬 자동화가 같은 의미를 한다 — 켜게 되면 그대로 쓸 수 있다.
  커밋 규약은 이미 있어 그대로 동작한다.
- **업데이터·채널**: 데스크톱 패키징 뒤. stable/beta/nightly 는 프리릴리스 태그(`0.2.0-beta.1`)로 가른다.
- **아티팩트 매니페스트의 도구 버전**: 내보낸 플레이어(sdk-manifest.json)에 아직 앱 버전이 안 들어간다.
- **CHANGELOG 링크**: 저장소 URL 이 정해지면 버전 제목에 compare 링크를 붙인다.

## 검증

```bash
npm run version:info                                  # 이 트리의 빌드 라벨
node scripts/run-vitest.mjs run test/releaseTooling.test.ts  # 라벨 규칙·범프·노트 생성
npm run release -- --minor --dry-run                   # 계획과 노트만 (파일 안 씀)
npm run build:app && grep -rhoE '0\.1\.0-dev\.[0-9]+\+g[0-9a-f]+' dist/assets | head -1
```

실제 릴리스 절차는 임시 저장소에서 먼저 돌려볼 수 있다(커밋·태그가 그 저장소 안에서만 만들어지므로 안전하다).

## 자동화 — 제안 PR 과 발행 타이머

수동 경로(`npm run release`)는 급할 때 쓰고, 평소에는 자동화가 "잊지 않게" 한다. 둘 다
`scripts/lib/releaseFiles.mjs` 를 공유하므로 산출물이 갈라지지 않는다.

```bash
npm run release:auto                 # ① 발행 + ② 제안 (멱등)
npm run release:auto -- --dry-run    # 계획만 (아무것도 쓰지 않음)
```

**① 발행** — 릴리스 PR 이 머지됐는데(= main 의 package.json 버전이 마지막 태그와 다르면)
그 커밋에 주석 태그를 만들고 GitHub Release 초안을 낸다. 본문은 CHANGELOG 의 그 절을 `--notes-file` 로 올린다.

**② 제안** — 마지막 태그 이후 커밋이 있으면 `release/next` 브랜치를 origin/main 에서 다시
만들어 범프 + CHANGELOG 항목을 커밋하고 PR 을 생성/갱신한다. 트리가 같으면 아무것도 하지
않으므로 매일 돌아도 조용하다. **머지하는 순간이 릴리스 결정**이다 — 이 스크립트는 사람이
머지하지 않으면 아무 릴리스도 내지 않는다.

범프 규칙(자동 제안): `feat` 와 깨지는 변경(`!`)은 MINOR, `fix`·`perf`·`refactor`·비규약
메시지는 PATCH, 문서·테스트·잡무만 쌓였으면 제안하지 않는다. 덮어쓰려면 `--kind`.

타이머(user systemd): `rpg-zzu-release.timer` → 하루 1회. 끄려면
`systemctl --user disable --now rpg-zzu-release.timer`. `--major`(1.0.0 선언)는 어느
경로에서도 사람만 한다.

검증: `node scripts/run-vitest.mjs run test/releaseTooling.test.ts`

## 발행 순서와 릴리스 담당 (2026-11-07)

**사고**: v0.408.0 이 자산 0개로 발행되어 `latest` 가 됐고, README 의
`/releases/latest/download/OPRN.Studio-windows.exe` 가 404 였다. 데스크톱 빌드는
`scripts/lib/piAgentRuntime.ts` 의 깨진 import 로 매번 실패했는데, **발행이 산출물보다 먼저**
일어났기 때문에 빌드 실패가 사용자에게 다운로드 실패로 바로 나갔다.

**순서는 이제 코드가 강제한다.** 사람이 지켜야 하는 규칙이 아니라 워크플로의 구조다:

1. `scripts/release-auto.mjs` 는 릴리스를 항상 **초안(`--draft`)** 으로만 만든다.
2. `desktop-release.yml` 이 산출물을 만들고 올린 뒤 **이름·크기 6개를 검증**한다.
3. 검증을 통과한 뒤에만 발행하고, 그 태그가 **가장 높은 버전일 때만** `make_latest` 한다.

업로드가 실패하면 초안으로 남는다 — `releases/latest` 는 계속 이전 정상 릴리스를 준다.
자산이 빈 채 발행된 릴리스는 `workflow_dispatch` 의 `source_ref` 로 **태그를 다시 쓰지 않고**
(`tag=v0.408.0`, `source_ref=main`) 다른 커밋의 트리로 채운다. 30분 스케줄이 자산이 모자란
가장 새 릴리스를 스스로 집으므로, 초안을 아무도 디스패치하지 않아 latest 가 비는 일도 없다.
단, 자산이 다 찬 더 새 정식 릴리스가 있으면 그 아래 판은 집지 않는다(2026-11-25): 설치판 도입 전 v0.418.0 을
매번 미완성으로 집어 그 태그 트리(nsis-wine-shim 없음)로 빌드하다 `spawn wine ENOENT` 로 예약 실행이 계속 실패했다.
옛 판을 채워야 하면 `workflow_dispatch` 에 `tag` 와 `source_ref=main` 을 준다.

**담당은 릴리스 레인 하나다.** 다음 파일을 만지는 변경은 그 레인이 맡는다 — 다른 레인이
고칠 일이 생기면 릴리스 레인에 넘긴다. 두 곳이 동시에 순서를 바꾸면 이 사고가 다시 난다.

- `.github/workflows/desktop-release.yml`
- `scripts/release.mjs` · `scripts/release-auto.mjs` · `scripts/release-desktop.mjs`
- `scripts/lib/release*.mjs` (특히 `releaseAssets.mjs` 의 6개 이름 계약)
- `.github/workflows/auto-release.yml` · `scripts/release-scheduled.mjs` · `scripts/ci-full-diff.mjs`

`desktop-release` 가 빨간 동안에는 새 버전을 발행하지 않는다. 초안이 쌓여도 `latest` 는 안전하다.

## 조건 기반 자동 릴리스 (2026-11-24 도입 · 2026-11-28 초고속 30분 자동 배포)

오너: «자동 주기 릴리즈 조건을 기반으로 해라 니추천대로»(2026-11-24) → «급하니까 30분 주기로 바꾸자»(2026-11-28).
`.github/workflows/auto-release.yml` 이 **30분마다**(매시 17분·47분) 호스티드 러너에서 `scripts/release-scheduled.mjs` 를 돌린다. 아래가 **모두** 맞을 때만 발행한다.
숫자는 `scripts/lib/releaseGate.mjs` 의 `AUTO_RELEASE_RULES` 한 곳에 있다.

| 조건 | 기준 |
|---|---|
| 사용자 체감 변경 | 마지막 발행 태그 이후 feat·fix 커밋 **1개 이상** (범위가 test·ci·docs 뿐인 것은 안 센다) |
| 간격 | 마지막 발행(`published_at`)에서 **30분(0.5시간) 이상** |
| 보류 | 열린 PR 에 `hold-release` 라벨 없음 |
| 하루 상한 | 최근 24시간에 만든 릴리스 **48판 미만** |
| 꼬임 방지 | 산출물 대기 중인 초안 없음, 열린 `release/next` PR 없음 |
| ci-full | 게이트 분리(`requireCiFull: false`) — 밤 1회 회귀 감시로 두고 릴리스 전에는 `ci-fast` + 필요 시 `app-update-e2e` 로 검증 |

안 맞으면 아무것도 쓰지 않고 그 실행의 요약과 아티팩트 `auto-release-decision`(JSON)에 이유만 남긴다.
맞으면 새 발행기를 만들지 않고 기존 경로를 탄다: `release-auto --skip-publish`(PR·사용자 말 CHANGELOG, PR 본문 GraphQL 일괄 조회) →
`ci-fast` 를 `release/next` 에 디스패치(GITHUB_TOKEN 푸시는 워크플로를 깨우지 않는다; `ci-related-tests` 는 각 기능 PR 머지 전에 이미 통과했으므로 버전 범프 전용 `release/next` 에서 중복 실행하지 않는다) →
직전 태그(`>= v0.420.0`) 이후 `electron/`·패키징·업데이트·의존성 변경이 있거나 최근 14일 내 통과 기록이 없을 때만
`app-update-e2e` 를 디스패치해 초록을 기다림 → `merge-pr.mjs`(`ci-fast` 확인 뒤 머지) →
`release-auto --skip-propose`(태그·초안) → `desktop-release` 디스패치(`OPRN_BAKE_DEMOS_CACHE_SCOPE=flagship` + 압축 레벨 1·12스레드, 검증 뒤 발행). 발행하거나 도중에 멈추면
이슈 «자동 릴리스 기록» 에 한 줄 남긴다(리드가 보는 한 곳).

판정만 보려면: `node scripts/release-scheduled.mjs --dry-run` (로컬, gh 인증) 또는
`gh workflow run auto-release.yml` (수동 실행의 기본이 건조 실행이다).

**ci-full 밤 1회 감시** (`scripts/ci-full-diff.mjs`, `.github/workflows/ci-full.yml`) 는 매일 새벽(UTC 17:17 = KST 02:17)에 돌아 깊이 2 이상 회귀를 잡는다.
`ci-full` 대조를 다시 릴리스 게이트로 켜야 하면 `AUTO_RELEASE_RULES.requireCiFull` 을 `true` 로 바꾼다.
손으로 대조하기: `node scripts/ci-full-diff.mjs [--tag vX.Y.Z] [--candidate <run>] [--baseline <run>] --out diff.json`.
저장소 Actions 설정이 GITHUB_TOKEN 의 PR 생성을 막으면 ① 단계에서 멈추고 이슈에 남는다.
`RELEASE_BOT_TOKEN` 시크릿이 있으면 그것을 쓴다.

검증: `node scripts/run-vitest.mjs run test/releaseAssets.test.ts` — 6개 이름·크기 0·옛 버전
이름·최고 버전 판정을 케이스로 고정한다.
