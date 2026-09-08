# 에디터 내 BGM 팩 설치 설계 (2026-09-09)

감독은 2026-09-09 "에디터 내에서 BGM 을 직접 다운받을 수 있게끔 하고, 내 github 에 올라가있는
에셋팩을 바로 다운받을 수 있게끔해" 로 이 기능을 지시했고, 이어 **런타임 감지 · dev+preview 양쪽 ·
팩 통째(1.3GB)** 를 선택했다. 원격 접속(`mdc-server:9888`)을 쓰지만 "나중에 github 에 올릴 것도
고려해야 함, 기본값을 저렇게 하는 건 곤란" 이라 하여 **원격 허용은 기본값이 아니라 opt-in** 으로 확정했다.

## 문제

카탈로그 281곡은 릴리스 `bgm-v1` 의 `rpg-zzu-bgm-v1.tar`(1,304,157,696 B) 에만 있고 레포에는
`.gitignore:211-214` 로 3곡만 남긴다. 지금 설치 경로는 터미널 `npm run bgm:install` 뿐이고, 끝나도
`__OPRN_INSTALLED_BGM_FILES__` 가 서버 기동 시점에 박제돼 있어 **서버 재시작 전까지 UI 가 계속 막는다**.
게다가 `vite preview` 는 `dist/` 를 서빙해서 `public/` 에 설치해도 404 다.

## 결정 (승인됨)

| # | 결정 | 구현 |
|---|---|---|
| D1 | 설치는 서버 미들웨어를 거친다. 비공개 레포라 `gh` 자격증명이 필요하고, 브라우저는 이를 가질 수 없다 | `scripts/lib/bgmInstall.ts` (신규 플러그인) |
| D2 | 안전장치를 새로 만들지 않는다. `installRelease` 를 그대로 호출한다 — 잠금·검증·원자적 교체·정리가 이미 있다 | `bgm-release.mjs:192-240` 재사용 |
| D3 | 진행률은 `.bgm-stage-*` 디렉터리 크기 / `archive.bytes`. `gh` 는 `stdio:'ignore'` 라 자체 진행 정보가 없다 | `GET /api/bgm/status` |
| D4 | `isCatalogBgmAvailable` 은 **동기 시그니처를 유지**한다. 빌드타임 define 은 *부팅 시드* 로 강등하고 가변 Set 을 런타임에 교체 → 소비처 7개 파일 수정 0건 | `src/assets/installedBgm.ts` (신규) |
| D5 | preview 는 `dist/` 에 없는 카탈로그 파일을 `public/` 에서 서빙한다. 재빌드 없이 9888 에서도 들린다 | `audioDelivery.ts` guard 확장 |
| D6 | 접근은 루프백 전용이 기본. 원격은 `RPG_ZZU_BGM_INSTALL_REMOTE=1` opt-in, 403 대신 UI 안내 | `bgmInstall.ts` + 배너 |

## 표면 계약

### HTTP (vite dev + preview 미들웨어 전용 — 빌드 산출물에는 존재하지 않는다)

`GET /api/bgm/status` → 200

```json
{ "expected": 281, "installed": ["rtp-air-001-….mp3"], "installing": false,
  "stagedBytes": 0, "archiveBytes": 1304157696, "remoteAllowed": false, "error": null }
```

- `installed` 는 `verifyInstalled` 가 아니라 **디렉터리 나열**이다(281곡 sha256 재검증은 수십 초 —
  매 폴링마다 돌릴 수 없다). 무결성은 설치 시점에 `installRelease` 가 이미 보증한다.
- 나열 규칙은 빌드타임 시드와 **글자 그대로 같아야 한다**: `audioDelivery.ts:40` 의
  `/\.(?:mp3|wav)$/i` + `size > 0`. 규칙이 어긋나면 시드와 런타임 갱신값이 불일치해
  새로고침만으로 재생 가능 여부가 뒤집히는 버그가 된다. 양쪽이 같은 헬퍼를 부르게 한다.
- `remoteAllowed` 는 opt-in 상태. 클라이언트가 버튼을 비활성화하고 이유를 보여주는 데 쓴다.

`POST /api/bgm/install`
- 202 `{ "started": true }` — 매니페스트 로딩 전부터 작업 예약. 이미 설치된 경우도 같은 경로에서 `installRelease`가 SHA-256 검증 후 다운로드 없이 끝낸다. 파일 개수만 보고 200 complete로 우회하지 않는다.
- 409 `{ "error": "…" }` — 이 서버의 작업이 이미 예약/진행 중. 별도 CLI의 디스크 잠금 충돌은 설치기 실패로 status.error에 나온다.
- 403 `{ "error": "…" }` — 루프백이 아니고 opt-in 도 없음

`DELETE /api/bgm/install` → 202. `AbortSignal` 로 중단. `installRelease` 의 `finally` 가 스테이징과
잠금을 정리하므로 중단 후 재시도가 안전하다.

모든 오류 응답은 `{ "error": string }` 한 형태로 통일한다.

### 클라이언트

- `src/assets/installedBgm.ts` — `installedBgmFiles()` / `isBgmFileInstalled(name)` /
  `setInstalledBgmFiles(names)`. 모듈 로드 시 `__OPRN_INSTALLED_BGM_FILES__` 로 시드.
  `audioResourceCatalog.ts` 는 define 을 직접 읽지 않고 이 모듈만 본다.
- `src/editor/bgmInstallClient.ts` — status 조회, 설치 시작/중단, 설치 중 1000ms 폴링.
- 설치 완료 시 `setInstalledBgmFiles()` 후 `window` 에 `rpgzzu:bgm-installed` 를 디스패치한다.
  **배지 갱신이 아니라 목록 재생성이 필요하다** — `audioResourceCatalog.ts:94` 가 미설치 곡을
  목록에서 아예 제외하므로, 설치 후엔 리소스 목록 자체가 달라진다.

### UI

`src/editor/panels/bgmInstallBanner.ts`. 전량 설치돼 있으면 렌더하지 않는다.

- testid: `bgm-install-banner` `bgm-install-button` `bgm-install-progress`
  `bgm-install-status-text` `bgm-install-cancel` `bgm-install-error`
- 미설치: "카탈로그 281곡 중 3곡 설치됨 · [전체 받기 (1.3GB)]"
- 진행 중: 진행률 바(`stagedBytes/archiveBytes`) + 취소. 다운로드가 끝나고 검증·전개 단계에 들어가면
  진행률은 100% 에서 멈추므로 "검증 중" 문구로 전환한다(실측 다운로드 ~60s, 검증·전개 ~90s).
- 원격 차단: 버튼 비활성 + "원격 접속에서는 `.env.local` 에 `RPG_ZZU_BGM_INSTALL_REMOTE=1` 이 필요합니다."

### 환경변수

`RPG_ZZU_BGM_INSTALL_REMOTE` — 비-VITE(서버 전용, 번들에 인라인되지 않는다). `.env.example` 에는
주석으로만 문서화하고 값은 넣지 않는다. 실제 값은 gitignored `.env.local` 에 둔다.
Vite는 이를 process.env에 복사하지 않으므로 플러그인의 configResolved에서 loadEnv(mode, envDir, "")로 읽는다(dev/preview 공통).

공개 배포 시의 노출면: 이 엔드포인트는 vite 플러그인 미들웨어라 **빌드 산출물에 존재하지 않는다.**
레포를 받아 빌드/배포한 제3자에게는 엔드포인트 자체가 없다. 위험은 `vite preview --host 0.0.0.0`
과 opt-in 을 **동시에** 켠 경우로 한정되며, 그 조합은 명시적 선택이다.

## 테스트

`installRelease({ download })` 가 주입 가능하므로 네트워크 없이 전 구간을 덮는다.

- 서버: status 응답 형태 / 모든 POST의 설치기 검증 경유 / cold manifest 동시 POST 중 하나만 202, 나머지 409 / 루프백 아님+opt-in 없음 → 403 /
  opt-in 시 통과 / 중단 후 잠금·스테이징 정리
- 클라이언트: 시드 → 런타임 교체 후 `isCatalogBgmAvailable` 전환, 설치 후 리소스 목록 재생성
- 전달: preview 에서 `dist/` 에 없는 카탈로그 파일이 `public/` 에서 서빙되는지

## 범위 밖

곡 단위 선택 다운로드(릴리스를 281개 개별 자산으로 재발행해야 함 — 별건), 배포된 정적 에디터에서의
설치(브라우저 저장소/OPFS + 공개 CDN 이 필요한 다른 설계), CDN 경로(`VITE_BGM_CDN_BASE`) 변경,
SE 카탈로그, 기존 `npm run bgm:install` CLI 의 동작 변경.
