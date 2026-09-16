# 두 껍데기 동등화(P4.5) 실행 계획 — 앱과 웹이 같은 정본을 같은 기능으로 쓴다

**목표.** 정본은 사용자가 고른 폴더의 `project.sqlite` 하나다(확정, 2026-09-16). Electron 앱과 브라우저 탭이 **같은 정본**을 쓰는 것까지는 끝났다(`oprn-serve` + 공용 미들웨어). 이 단계는 **기능 차이를 없애고** 맥 dmg로 내보낸다.

**근거 문서.** `docs/superpowers/specs/2026-09-15-oprn-local-sqlite-store-design.md` §7(셸)·§8(P4~P6).
**현재 브랜치.** `electron/p4-renderer-wiring` (main 기준).

## 지금 실측된 차이

| 항목 | Electron 앱 | 웹(로컬 서버) |
|---|---|---|
| 정본 접근 | IPC `window.oprn` | HTTP + 토큰 |
| AI 동반 서비스 | 있음(루프백 + `app://oprn` CORS) | 있음(같은 미들웨어) |
| 백업 만들기 | 있음(렌더러 프로젝트 메뉴, I1) | 있음(같은 메뉴) |
| 폴더 보기·내보내기 | 내보내기 있음 / 폴더 보기 **없음** | 내보내기 있음 / 폴더 보기 **없음** |
| 활동 미러 2종 | 있음(I3, 연 프로젝트 폴더 기준) | 있음(I3, 같은 본체) |
| 동기 커밋 조회 | **없음**(I2에서 삭제) | 없음 |
| 시작 화면·네이티브 대화상자 | 있음 | 없음(서버 실행 시 폴더 고정) |
| 닫기 절차 | flush 보장(10초 유예) | beforeunload 경고 |
| 토큰 잠금 | 없음 | 없음 |

## 증분 (각 증분은 커밋 하나, 끝났다는 증거가 붙는다)

- **I1. 백업 만들기를 렌더러 UI로.** OS 메뉴가 아니라 편집기 UI에 둔다 — 그래야 앱과 웹이 **동시에** 얻는다. 포트에 `backup?()` 을 뚫고 프로젝트 메뉴(`src/editor/panels/menu.ts`)에 붙였다. 파일을 가진 어댑터(앱·로컬 서버)만 구현하고 Supabase·메모리는 `undefined` 라 메뉴가 사유를 띄운다.
  - 증거: `menu-project-backup` 항목, `electronRepository.backup()` → 브리지 `project.backup`, `test/serve/localServer.test.ts` + `test/persistence/electronRepository.test.ts` 에서 HTTP·IPC 양쪽으로 `backups` 경로가 돌아온다.
  - **남은 것**: 폴더 보기(`shell.showItemInFolder`)는 미착수 — Electron 전용이라 웹은 비활성 표시가 필요하다.
- **I2. 동기 커밋 조회 삭제(완료).** 당초 계획은 "`peekTip`을 비동기 캐시로 바꾼다"였는데, 실측해보니 **`peekTip`의 호출자가 프로덕션에 0곳**이었다(포트 선언·어댑터 셋·픽스처·계약 테스트뿐). 그래서 캐시로 바꾸는 대신 `peekTip`·`commits.listSync`·`oprn:commits.listSync` 채널을 통째로 지웠다. AI 도구 `list_project_commits` 의 동기 XHR 은 브리지가 아니라 Supabase PostgREST 를 직접 보는 별개 경로라 영향이 없다(그리고 그 도구는 이미 브라우저 PostgREST 전용으로 게이트돼 있다).
  - 증거: `grep -rn 'peekTip\|listSync\|commitsListSync' src electron test` → **0건**. Electron 스모크에서 `bridge.commits.listSync` 프로브를 제거하고 통과. 두 껍데기의 브리지 모양이 같아졌다.
- **I3. 활동 미러 2종을 양쪽에(완료).** 미러 본체(약 250줄)를 `vite.config.ts` 플러그인에서 `scripts/lib/activityMirror.mjs` 로 꺼냈다. 이제 세 껍데기가 같은 함수를 부른다: vite(dev·preview)는 node 미들웨어 어댑터로, `oprn-serve` 는 같은 어댑터로, 일렉트론 앱은 `app://` 프로토콜 핸들러에서.
  - 왜 필요했나: 클라이언트는 `/__oprn/ai-activity` 를 **페이지 출처 상대 경로**로 fetch 한다. 그런데 미들웨어가 vite 플러그인 안에만 있어서 앱과 `oprn-serve` 에는 받는 쪽이 없었고, 404 는 fetch 가 throw 하지 않고 클라이언트는 첫 실패에 미러를 스스로 끄므로 **두 껍데기에서 로그가 조용히 0줄**이었다.
  - 로그 자리도 바뀌었다: vite 는 cwd 기준(`output/`), 앱·로컬 서버는 **연 프로젝트 폴더** 기준.
  - 증거: `test/activityMirror.test.ts` 가 임시 폴더에 진짜로 쓰고 다시 읽는다(AI jsonl·index·failedTools, 편집 배치 seq 교체, 빈 배치 204, GET latest, 413 상한, 경로 탈출 방어). 계약 테스트 2종이 `vite.config.ts` 텍스트가 아니라 **공용 본체**를 보도록 옮겼고, 세 껍데기가 모두 `createActivityMirrorMiddleware`/`handleActivityMirror` 를 부르는지 단언한다.
  - 남은 것: 없음 — 앱의 `app://` 경로도 E2E 가 지나간다(`electronBridge.spec.ts` 에서 두 엔드포인트에 POST → 204 → 연 프로젝트 폴더에 `edits.jsonl`·`activity.jsonl` 생성).
  - 함정(실측): 프로토콜 핸들러에서 `new Response("", { status: 204 })` 는 TypeError 를 던지고, 렌더러에는 `TypeError: Failed to fetch` 로만 보인다. 204/205/304 는 본문을 가질 수 없으므로 `body.length > 0 ? body : null` 로 넘겨야 한다.
- **I4. 토큰 잠금(설계 §7.4).** 루프백 동반 서비스와 로컬 서버에 실행별 토큰 + 허용 오리진 검사를 넣는다.
  - 증거: 토큰 없는 요청이 403, 있는 요청이 200.
- **I5. 패키징(P5).** `electron-builder`로 맥 dmg·zip + 리눅스 AppImage, `asar: true`. `src/brand.ts` 상수에서 앱 id·제품명을 만든다.
  - 증거: dmg를 열어 임시 폴더에 새 프로젝트 → 편집 → 저장 → 재시작 후 같은 sha256.

## 이 단계에서 하지 않는 것

- **P6(Supabase 퇴역)** — 하지 않는다. 웹 편집기 유지가 확정이므로 원격 어댑터를 남긴다.
- 인터넷 호스팅(공개 URL·다중 사용자) — 범위 밖. 인증·RLS가 먼저 필요하다.
- 협업(맵 편집 잠금·실시간 병합) — 범위 밖. `mapEditLocks`는 원격 전용으로 남는다.

## 검증 명령

```
npx vitest run test/localStore test/persistence test/serve --reporter=dot
xvfb-run -a npx playwright test -c playwright.electron.config.ts
npm run typecheck:app
node scripts/qa/browserCanonShots.mjs --project-dir <폴더>   # 브라우저 정본 실측 + 스크린샷
```
