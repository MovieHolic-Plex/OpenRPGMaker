# 두 껍데기 동등화(P4.5) 실행 계획 — 앱과 웹이 같은 정본을 같은 기능으로 쓴다

**목표.** 정본은 사용자가 고른 폴더의 `project.sqlite` 하나다(확정, 2026-09-16). Electron 앱과 브라우저 탭이 **같은 정본**을 쓰는 것까지는 끝났다(`oprn-serve` + 공용 미들웨어). 이 단계는 **기능 차이를 없애고** 맥 dmg로 내보낸다.

**근거 문서.** `docs/superpowers/specs/2026-09-15-oprn-local-sqlite-store-design.md` §7(셸)·§8(P4~P6).
**현재 브랜치.** `electron/p4-renderer-wiring` (main 기준).

## 지금 실측된 차이

| 항목 | Electron 앱 | 웹(로컬 서버) |
|---|---|---|
| 정본 접근 | IPC `window.oprn` | HTTP + 토큰 |
| AI 동반 서비스 | 있음(루프백 + `app://oprn` CORS) | 있음(같은 미들웨어) |
| 백업·내보내기·폴더 보기 | **버튼 없음**(채널은 양쪽에 있음) | **버튼 없음** |
| 활동 미러 2종 | 없음 | 없음(vite 전용) |
| 동기 커밋 조회 | `sendSync` 실값 | `[]` → 비동기 폴백 |
| 시작 화면·네이티브 대화상자 | 있음 | 없음(서버 실행 시 폴더 고정) |
| 닫기 절차 | flush 보장(10초 유예) | beforeunload 경고 |
| 토큰 잠금 | 없음 | 없음 |

## 증분 (각 증분은 커밋 하나, 끝났다는 증거가 붙는다)

- **I1. 백업·폴더 보기·내보내기를 렌더러 UI로.** OS 메뉴가 아니라 편집기 UI에 둔다 — 그래야 앱과 웹이 **동시에** 얻는다. 채널(`project.backup`, `projectSeparateMedia`, `assets.*`)은 양쪽에 이미 있다. 폴더 보기는 Electron만 가능하므로(`shell.showItemInFolder`) 브리지에 `project.reveal()`을 더하고 웹은 비활성 표시한다.
  - 증거: 두 껍데기에서 백업 버튼을 눌러 `backups/*.sqlite`가 생기고, 웹은 폴더 보기가 비활성으로 보인다.
- **I2. 동기 커밋 조회 통일.** `commits.listSync`(sendSync)를 없애고 `peekTip`을 비동기 캐시로 바꾼다. Electron의 예외 하나가 사라지고 두 껍데기가 같은 코드를 탄다.
  - 증거: `oprn:commits.listSync` 채널이 사라지고 AI 도구 `list_project_commits`가 비동기 경로로 같은 값을 낸다.
- **I3. 활동 미러 2종을 양쪽에.** `/__oprn/ai-activity`·`/__oprn/edit-activity`를 vite 플러그인에서 `scripts/lib/companion/`으로 꺼내 앱·웹이 같은 핸들러를 쓴다.
  - 증거: 앱·웹 각각에서 편집 한 번 → `output/edit-activity/edits.jsonl`에 같은 모양의 줄이 남는다.
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
