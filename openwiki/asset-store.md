# 에셋 스토어 (2026-10-06)

편집기 안에서 공용 에셋을 둘러보고, 받고, 프로젝트에 넣고, 내 것을 올린다. 무료 공유 장터이고 판매·결제는 없다.
설계 기록은 `docs/superpowers/specs/2026-10-06-asset-store-design.md`, 운영 배포 절차는 `store-server/deploy/README.md`.

## 결정 (사용자, 2026-10-06)

- 범위 B: 공식 팩 + 출처·크레딧 + 작가 올리기. 유료 판매 없음.
- 올리기 C: 웹에서 낱장 올리기 + 편집기에서 완성 팩 올리기. 참고문서가 든 팩은 「조수 사용 가능」 배지.
- 공개 A: 자동 검증을 통과하면 바로 공개한다.
  - 서로 다른 신고자 3명이 신고하면 자동으로 숨긴다.
  - 새 작가의 첫 3개는 운영자 확인 뒤 공개한다.
- **Rasak·REFMAP·MV 팩 계열·PAW 는 스토어에 넣지 않는다.** 첫 진열은 직접 만든 번들 4종이다:
  - 버들항
  - 조선 바람의나라풍
  - 손 도트 실내 v5
  - jp_city
- 저작권 신고는 admin@openrpgmaker.com 으로 받는다. 운영자 계정은 하나다.
- 편집기는 **Electron 앱만** 쓴다. 웹 편집기와 팀 호스트 브라우저에는 「데스크톱 앱에서 열 수 있습니다」라고만 보인다.
- **운영: https://store.openrpgmaker.com (2026-10-06 가동, seogo).** 앱의 기본 주소이므로 따로 바꿀 것 없이 바로 보인다.
  절차·위치·운영자 링크는 `store-server/deploy/README.md`를 따른다.
  Google 로그인이 켜져 있다(2026-10-06, state 쿠키 + PKCE S256 + 확인된 이메일만).
- 스테이징은 테일스케일 안의 http://mdc-server:18320 이다
  (`store-server/scripts/install-staging.sh`, systemd --user `oprn-store-staging`).

## 구성 요소

| 층 | 파일 | 하는 일 |
|---|---|---|
| 팩 형식(공용, 순수) | `src/assetStore/format.ts`, `sniff.ts`, `pack.ts` | `oprn-store-pack/1` 매니페스트, 검증, 팩 만들기, 프로젝트에 넣기, 크레딧 |
| 서버 | `store-server/` (Node 24 + Postgres) | 카탈로그·업로드 검증·신뢰/신고·기기 코드 로그인·웹 페이지 |
| Electron 메인 | `electron/main/assetStore.ts`, `assetStoreClient.ts` | 서버 통신 전부, blob 검증·캐시(`userData/store`), 토큰 `safeStorage` |
| 브리지 | `electron/preload/index.ts` `oprn.store`, 타입 `src/assetStore/bridgeTypes.ts` | IPC 채널 `store*` (`electron/shared/channels.ts`, 검증 `schemas.ts`) |
| 편집기 | `src/editor/assetStore/*`, `src/editor/panels/leftStorePane.ts` | 왼쪽 막대 「스토어」, 큰 창(둘러보기·받은 것·이 프로젝트·올리기) |
| 게임 | `src/player/titleLicenseNotice.ts` | 타이틀 「크레딧」 창에 `storeCredits(project)` 를 덧붙인다 |

### 렌더러는 스토어 서버와 직접 통신하지 않는다

CSP 를 넓히지 않으려고 모든 요청을 메인 프로세스가 중계한다. 그림은 IPC 로 받은 바이트를 `blob:` URL 로 보여 준다.
dev 모드의 vite http 오리진에서도 같은 방식이다.
스토어 주소는 기본이 `https://store.openrpgmaker.com` 이고, 환경 변수 `OPRN_STORE_URL` 이나 창 아래 「주소 바꾸기」로 바꾼다.
`http` 는 사설 주소에만 허용한다:
- 점 없는 이름(`mdc-server`)
- 100.64/10
- 루프백
- LAN

## 팩 형식과 프로젝트에 넣기

- 매니페스트는 `content.assets` 와 `content.tilesets` 를 담는다. tilesets 는 편집기 `TilesetDef` 그대로다.
- 그림·소리는 sha256 이름의 blob 이다. 매니페스트 안의 data URL 은 `oprn-blob:<sha>` 자리표시로 바뀐다.
  - 검증은 **선언이 아니라 바이트 서명**(`sniffMime`)으로 형식을 판정한다.
  - 다음은 거절한다: 쓰이지 않는 blob, 팩 밖을 가리키는 그림 id, 남은 `data:`.
- 등급: 참고문서가 하나라도 든 타일셋이 있으면 `pack`(조수 사용 가능), 아니면 `single`.
- 프로젝트에 넣으면 id 를 `store_<slug_밑줄>__<원래 id>` 로 바꾼다.
  - 새 판본은 같은 id 를 덮어쓰므로 맵이 가리키는 타일셋이 그대로 이어진다.
  - 각 `UploadedAsset.origin` 에 출처(slug·판본·작가·라이선스·AI 생성·크레딧)를 남긴다.
  - 이 출처가 「이 프로젝트」 탭과 게임 크레딧의 원천이다.
- Electron 저장소면 바이트를 먼저 `uploadedAssetForImport` 로 프로젝트 assets 에 넣는다. 문서에는 참조만 남는다.
- 라이선스는 CC0, CC-BY-4.0, CC-BY-SA-4.0, OPRN-GAME(게임 안 사용 자유, 원본 재배포 금지) 넷이다.
  AI 생성 여부는 필수로 받는다.

## 올리기 가드

`src/editor/assetStore/storeUpload.ts` `uploadBlockReason` 은 아래 셋을 막는다. 막힌 것은 「올릴 수 없는 것 N개」로 접어서 보여 준다.

- 스토어에서 받은 것(`origin` 있음)
- 공용 자료집(`shared_` 접두)
- 제3자 팩 이름(PAW·Rasak·REFMAP·RTP·RPG Maker·MV/MZ)

이름 기반 안전장치일 뿐이고, 권리 확인 책임은 올리는 사람에게 있다(동의 체크박스, 이용약관).

## 서버


- 데이터:
  - `migrations/001_init.sql`: 사용자·세션·기기 코드·토큰·blob·상품·판본·신고·받기·감사.
  - 판본(`store_versions`)과 판본 blob 연결은 **트리거로 수정·삭제가 막혀 있다.**
- 로그인 수단:
  - Google OAuth(주소는 설정으로 바꿀 수 있고, 테스트는 가짜 공급자로 한다)
  - 편집기용 기기 코드(RFC 8628 형태, `/device` 에서 허락)
  - 스테이징 전용 개발 로그인(`STORE_DEV_LOGIN=1`, 운영 금지)
- 상태 변경 요청은 세션 쿠키 + CSRF 토큰 또는 Bearer 토큰으로 인증한다. 익명 신고 양식은 HMAC 양식 토큰을 쓴다.
- 신뢰: 공개 상품 수가 `STORE_TRUST_THRESHOLD`(3) 미만인 작가의 새 상품은 `pending` 상태로 들어가 운영자 확인을 기다린다.
- 신고: 서로 다른 신고자가 `STORE_REPORT_HIDE_THRESHOLD`(3)명이 되면 자동으로 숨긴다.
  - 신고로 숨겨진 상품은 작가가 다시 공개할 수 없다(409).
  - 운영자 조치는 `/admin` 에서 한다.

### 파일은 Cloudflare R2 로 내보낸다 (2026-10-06)

- `src/r2.ts`: S3 SigV4 를 직접 서명한다(SDK 없음). PUT·HEAD·DELETE 와 읽기용 서명 주소(`presign`).
- `GET /api/v1/blobs/:sha`: `blobServable`(내려지지 않은 상품이 쓰는 파일인가) 확인 → `r2_at` 이 있으면 R2 서명 주소로 303.
  - 서명 주소는 한 시간 단위로 같은 값(브라우저 캐시가 맞는다), 유효 2시간, 303 응답 자체는 5분 캐시.
  - R2 객체는 `cache-control: public, max-age=31536000, immutable` 과 원래 mime 으로 올린다.
  - 아직 R2 에 없으면 디스크에서 내주고 뒤에서 올린다. 올리기(`POST /api/v1/blobs`)도 바로 R2 에 올린다.
- `migrations/005_r2.sql`: `store_blobs.r2_at`. 켜질 때와 매시간 `r2_at is null` 인 파일을 4개씩 병렬로 올린다.
- 웹 화면 CSP 의 `img-src`·`media-src` 에 R2 출처를 더한다(`setFileOrigin`). 편집기(Electron 중계)의 fetch 는 303 을 따라가고 sha256 을 검사한다.
- 설정 `STORE_R2_*` 넷이 없으면 R2 없이 디스크에서 내준다. 운영·스테이징 설정과 토큰 범위는 `store-server/deploy/README.md`.
  - 스테이징은 `~/.config/systemd/user/oprn-store-staging.service.d/r2.conf` → `~/.config/oprn-store-staging-r2.env`(600).
- 토큰은 버킷 하나로만 묶는다. **IP 조건은 걸면 안 된다** — R2 는 서명 주소로 받는 방문자에게도 토큰의 IP 조건을 적용한다(걸었다가 방문자 전원 403).

## 보안 검토 반영 (2026-10-06)

적대적 검토에서 나온 항목과 막은 방법:

- **용량:** 한 사람이 한 시간에 올리는 blob 바이트는 `STORE_UPLOAD_BYTES_PER_HOUR`(기본 1GiB)까지다.
  판본에 들지 않은 채 하루가 지난 blob 은 한 시간마다 지운다(`sweepOrphanBlobs`).
- **신고 남용:** 자동 숨김에는 가입한 지 하루가 지난 로그인 계정의 신고만 센다. 익명 신고는 운영자 목록에만 들어간다.
  IPv6 주소는 /64 단위로 묶는다.
- **판본 바꿔치기:** 아직 신뢰받지 못한 작가가 공개 상품에 새 판본을 올리면 상품이 다시 `pending` 이 된다.
- **로그인 주소:**
  - `next=` 는 같은 사이트 경로만 받는다(`//`, `/\`, 제어 문자는 거절).
  - 기기 코드 확인 화면에는 앱이 스스로 밝힌 이름을 보여 주지 않는다.
  - 허락 요청 횟수를 제한한다.
  - 앱 토큰은 180일 뒤 만료된다(`migrations/002_hardening.sql`).
- **개발 로그인:** `STORE_DEV_LOGIN=1` 은 https 공개 주소에서는 서버가 아예 켜지지 않는다.
- **앱(메인 프로세스):**
  - `shell.openExternal` 은 스토어와 같은 출처 주소만 연다.
  - 서버가 준 판본 번호는 양의 정수만 받는다(캐시 파일 이름에 쓰이기 때문).
  - 응답 본문은 상한까지만 읽는다.
  - `http` 를 허용하는 사설 주소 판정은 IP 전체 모양으로 한다(`10.evil.com` 은 거절).
- **매니페스트:** 타일셋 칸 수는 131,072 칸까지만 받는다.

## 실행·시험

```bash
npm --prefix store-server run build                 # dist/server.mjs, dist/local.mjs
npm --prefix store-server test                      # 서버 통합 12건 (가짜 Google 이 PKCE 를 검사한다) (임시 Postgres 클러스터)
node store-server/scripts/typecheck.mjs             # 이 패키지 파일 오류만
npx vitest run test/assetStorePack.test.ts test/assetStoreClient.test.ts test/titleLicenseNotice.test.ts  # 팩 형식·주소 규칙·크레딧 창 18건
# 실제 앱 e2e — 사전 빌드: npm run build:app && npm run build:electron
xvfb-run -a npx playwright test -c playwright.electron.config.ts electronAssetStore
store-server/scripts/dev-unit.sh start 18391        # 임시 로컬 서버(시드 포함), stop 으로 끔
store-server/scripts/install-staging.sh [--seed]    # 테일스케일 스테이징 설치·갱신
```

e2e(`test/e2e/electronAssetStore.spec.ts`)는 아래 흐름을 한 번에 지난다:

1. 임시 서버에 시드 4종을 올리고 실제 Electron 편집기를 띄운다.
2. 둘러보기 → 상세 → 「이 프로젝트에 넣기」.
3. 파일 → 저장 후 `project.sqlite` 를 export 해서 `store_` 타일셋과 origin 을 확인한다.
4. 앱을 다시 켜 크레딧이 남아 있는지 본다.
5. 기기 코드 로그인을 테스트 브라우저에서 허락한다.
6. 편집기에서 참고문서 있는 타일셋을 올린다. 새 작가라서 확인 대기로 들어간다.
7. 운영자가 승인하면 목록에 보인다.

화면 증거는 `verify-shots/asset-store/` 에 있다.

## 화면 디자인

- 기준 문서는 `store-server/DESIGN.md` 다(2026-10-06 두 번째 개편 「그림이 주인공인 어두운 상점」). 웹(`store-server/public/app.css`)과 편집기 창(`src/styles/database/assetStore/assetStore.css`)이 같은 색·모서리를 쓴다.
- 첫 「밤의 상점 진열대」(도트 글꼴 제목·계단 모서리·도트 그림자)는 사용자가 「허접하다」고 해서 걷어 냈다. 도트 글꼴은 로고 「OPRN」에만 남았다.
- 웹 첫 화면: 추천 진열(조수 사용 가능 팩, 썸네일로 넘김·7초 자동, `public/store.js`) → 소개 → 종류 타일(종류마다 최신 표지) → 선반 넷(조수용 타일셋·캐릭터·얼굴·새로 올라온 것) → 작가 안내.
  - 주소에 `q`·`kind`·`grade`·`sort`·`page` 중 하나라도 있으면 진열 대신 목록 화면(왼쪽 거르기 + 격자)이다. `/?kind=` 이 「모든 에셋」 목록이다.
- 상품 화면: 갤러리(썸네일 고르기) · 받는 법 세 단계 · 정보표(라이선스·내용·판본·크기·지원 언어) · 설명 · **들어 있는 것**(최신 판본 매니페스트의 그림 48장까지, 소리는 재생기) · 크레딧 · 판본 · 신고 · 같은 종류.
- 편집기 창: 왼쪽 막대(화면 넷·종류·「조수 사용 가능만」) + 위 찾기칸 + 추천 진열 + 격자 + 오른쪽 상세(갤러리). testid 는 예전 것을 그대로 쓴다.
- 대표 그림(미리보기 첫 장)이 카드·진열을 정한다. 작업용 글자가 박힌 그림을 첫 장에 두지 않는다(「일본 도시」 판본 2에서 `public/assets/store-covers/jp-city-street.png` 로 바꿈).

## 다국어 (2026-10-06)

- 지원 언어는 편집기와 같은 넷: ko·en·ja·zh(간체). 종류·라이선스 이름은 `src/assetStore/format.ts` 의 `STORE_KIND_NAMES`·`STORE_LICENSE_NAMES` 하나를 웹과 편집기가 같이 쓴다.
  - 편집기 번역 카탈로그의 짧은 낱말(「음악」=Audio, 「전체」=Entire, 「{0}개」={0})은 스토어 문맥과 뜻이 달라서, 스토어 창은 종류 이름을 공용 표에서 고르고 「모든 종류」「에셋 {0}개」처럼 다른 원문을 쓴다.
- 웹 글자: `store-server/src/web/i18n.ts`(문구 표 + 약관·저작권·개인정보 네 언어판, 한국어가 기준). 언어 결정은 `?lang=`(쿠키 `oprn_store_lang` 1년) → 쿠키 → `Accept-Language` → 영어. `hreflang` 대체 링크를 단다. `upload.js` 문구는 양식의 `data-msg-*` 로 받는다.
- 상품 글: 매니페스트 `locales`(언어별 title·summary·description, 선택) → `store_items.locales`(마이그레이션 004). API 는 `?lang=` 또는 `Accept-Language` 로 그 언어판을, 없으면 원문을 준다. `languages` 는 locales 의 키다.
  - 서버 오류 문구는 한국어다. 웹 오류 화면은 한국어가 아니면 상태 번호만 알린다.
  - 다른 언어 화면에서는 한글 태그와 「들어 있는 것」의 한글 그림 이름을 숨긴다(그림 이름은 마우스 제목으로 남는다). 크레딧 문장은 게임에 그대로 들어가는 글이라 원문 그대로 둔다.
- 편집기 창은 `storeBridge().catalog/item` 에 `lang: getLocale()` 을 넘긴다(Electron 스키마·클라이언트까지 통과). 서버가 고른 상품 글은 `translate="no"` 로 DOM 번역기를 막는다. 받은 기록의 원문 제목은 지금 목록에 같은 상품이 있으면 그 언어판으로 보인다.
- 공식 상품 21개의 네 언어 글은 `store-server/scripts/library_locales.py`(한국어 제목이 키). 이미 올린 상품은 `refresh_library.py` 로 새 판본을 낸다 — 글·(캐릭터 상품의) 표지만 바꾸고 내용은 최신 판본 그대로, 같으면 판본을 만들지 않는다. 상품·판본은 분당 20번이 상한이라 3.5초씩 쉰다.
  - 운영 작가 이름은 「OPRN」(예전 「OPRN 운영」, `store_users.display_name` 직접 수정).

## 공용 캐릭터 그림 진열 (2026-10-06)

- `store-server/scripts/seed_library.py` 가 공용 캐릭터 그림을 상품 17개로 올린다. 다시 돌려도 같은 제목은 건너뛴다.
  - 얼굴·흉상·전신 16표정 × 묶음 5개(Actor1·Actor2·People1·People2·Monster) = 15개. 팩 하나의 에셋 상한이 256개라 묶음마다 나눴다.
  - 걷기 칩: 캐릭터 하네스에서 사람이 남긴 26명(`harness-data/charset-actor/accepted/`, 8명씩 RM2K3 시트로 묶음)과 OPRN 몬스터 Monster4~6.
- 라이선스는 CC BY 4.0 이다(원본 얼굴·걷기 칩 뼈대가 EasyRPG RTP CC BY 4.0). 흉상·전신·새 걷기 칩은 「AI 생성」 표시를 단다.
- 흉상·전신 에셋 id 에 `-bust`/`-full` 이 남아 있어 프로젝트에 넣으면 대화창이 그 모양으로 바뀐다(`facePresentationForResource`).
- 운영에 올릴 때는 `admin-link.mjs` 토큰으로 `--link-token`. 분당 blob 상한(1500)에 걸리면 스크립트가 기다렸다가 다시 보낸다.
- 표지(`showcase`)는 4:3 1200×900 격자를 꽉 채우고 가운데 둔다. 얼굴 4×3(정수 배율), 흉상 4×2, 전신 6×2, 걷기 칩은 어두운 바탕에 그림자.
- 아직 안 올린 것: 전투 도트(적 140종·파티 시트). 전투 시트는 런타임이 정해진 칸 규격·리소스 id 로 읽으므로, 스토어로 넣었을 때 전투에서 바로 쓰이는지 먼저 확인해야 한다.

## 함정

- `pkill -f oprn-store` 처럼 셸 명령줄에도 들어가는 패턴으로 죽이면 자기 셸이 죽는다. `dev-unit.sh stop` 을 쓴다.
- 사이드바는 마지막에 연 칸을 기억한다. 이미 열린 「스토어」 버튼을 다시 누르면 닫힌다(`aria-pressed` 로 판단).
- xvfb 처럼 키링이 없는 환경에서는 `safeStorage` 를 못 쓴다. 이때 토큰은 메모리에만 두고, 창 아래에 「다시 로그인해야」 안내가 뜬다.
- 버들항 타일셋 JSON 은 8.7MB 다. 매니페스트 한도는 24MB(`STORE_LIMITS.manifestBytes`)다.
- 한글 제목 slug 는 `romanizeHangul` 로 로마자로 바꾼다(`버들항 — 로마풍 항구 도시` → `beodeulhang-romapung-hanggu-dosi-…`).
- 시드는 같은 제목이 이미 있으면 건너뛴다. 시드 그림을 바꾸려면 데이터 폴더를 새로 만든다.
- R2 서명 주소는 상품을 내린 뒤에도 최대 약 2시간 유효하다. 바로 막아야 하면 R2 객체를 지운다(`R2.remove`).
