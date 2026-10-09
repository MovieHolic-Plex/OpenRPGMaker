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
| 발행 게임 버전 | 기본 `1.0` | **사용자가 만든 게임**의 릴리스 | 발행 대화상자 "게임 버전" (`src/editor/panels/publishingDialog.ts`) |

앱 `0.1.0` 과 게임 `1.0` 은 다른 물건이다. 앱 버전을 올렸다고 사용자 게임 버전이 바뀌지 않는다.

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
git push origin HEAD && git push origin v0.2.0
gh release create v0.2.0 --title "v0.2.0" --notes-from-tag
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
- README 다운로드는 버전이 없는 이름을 쓴다. `scripts/release-desktop.mjs` 가 버전 파일과 함께
  `OPRN.Studio-linux.AppImage`, `OPRN.Studio-windows.zip` 을 같은 릴리스에 올린다. 주소는
  `https://github.com/MovieHolic-Plex/OpenRPGMaker/releases/latest/download/` 뒤에 그 이름이다.
  macOS 패키지는 아직 없다.

### 윈도우 zip·단일 exe 는 리눅스에서 만든다 (2026-09-22, 갱신 2026-10-10)

`electron-builder.config.mjs` 의 `win.target` 은 zip 과 NSIS portable 이고 **둘 다 wine 없이 리눅스에서 빌드된다**.
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
  true single binary 가 아니라 NSIS 자동 해제 래퍼다. zip 은 그대로 남긴다 — 폴더째 쓰는 사람과 자동화가 그 경로에 있다.

### 데스크톱 AI 워커는 네이티브 애드온을 옆에 둔다 (2026-09-27 실측)

앱의 채팅·Pi 실행은 `bun build --compile` 로 만든 `dist-electron/oh-my-pi-worker[.exe]` 가 한다(로그인은
Node 쪽 `aiAuthRuntime.ts` 라 워커 없이 된다). 워커는 `@oh-my-pi/pi-natives` 의 Rust 애드온을 **런타임에 계산한
경로로** require 하므로 `--compile` 이 따라가 싣지 못한다. v0.17.x 까지는 애드온이 빠져 워커가 시작하자마자
`Failed to load pi_natives native addon` 으로 죽었고, 증상은 «로그인은 되는데 채팅만 안 된다» 였다.

- `scripts/build-electron.mjs` 가 `pi_natives.<linux-x64|win32-x64>-baseline.node` 를 워커 옆에 둔다. 로더는
  컴파일된 실행 파일의 폴더(execDir)를 후보로 보고, AVX2 가 있어도 modern 다음 후보로 baseline 을 집는다.
- 윈도우 애드온은 리눅스 호스트의 `node_modules` 에 설치되지 않는다(os 필터). `package-lock.json` 의
  `resolved`·`integrity` 로 tarball 을 받아 검증하고 `node_modules/.cache/oprn-pi-natives/` 에 캐시한다.
- `scripts/electron-builder.config.mjs` 는 애드온을 `asarUnpack` 하고, `linux.files`/`win.files` 로 다른 OS 의
  워커·애드온을 뺀다(각 150~200MB). **최상위 `files` 를 두지 않는다.** 최상위와 플랫폼
  `files` 는 별개 매처라 합집합이 된다 — 플랫폼 쪽 제외가 최상위 `dist-electron/**` 를 못 이겨 두 OS 에 워커
  4개가 다 실렸다. 반대로 제외 패턴만 주면 빌더가 `**/*` 로 읽어 저장소 전체를 싣는다(app.asar 4.9GB).
  그래서 OS 마다 공용 목록 `APP_FILES` 를 펼친 뒤 제외를 붙인다. 확인: `--linux dir --win dir` 뒤
  `*-unpacked/resources/app.asar.unpacked/dist-electron/` 에 자기 OS 워커와 애드온 둘만 있어야 한다.
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

## 커밋 메시지가 릴리스 노트의 원고다

`npm run release` 는 `git log` 에서 노트를 만든다(`scripts/lib/releaseNotes.mjs`). 손으로 쓰는 노트는
릴리스마다 빠지고, 빠진 릴리스는 아무도 안 쓴다.

- 섹션: `feat` 기능 · `fix` 수정 · `perf` 성능 · `refactor` 정리 · `docs` 문서 · `test` 테스트 ·
  `style` 스타일 · `build` 빌드 · `ci` CI · `revert` 되돌림 · `chore` 잡무
- `!` 를 붙이면(`feat(editor)!:`) "깨지는 변경" 섹션이 맨 앞에 서고 원래 섹션에도 남는다
- 머지 커밋과 `chore(release): …` 는 제외한다
- 규약을 안 따른 메시지도 버리지 않고 "기타" 로 싣는다 — 조용히 사라지는 변경을 만들지 않기 위해서다
- 같은 요약은 한 번만 싣는다(체리픽·리베이스 중복 방지)

사람이 쓸 자리는 `--summary` 한 줄이다.

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
그 커밋에 주석 태그를 만들고 GitHub Release 를 낸다. 태그 본문은 CHANGELOG 의 그 절이다.

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
