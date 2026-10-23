# 에셋 스토어 연동

스토어 서버는 [별도 비공개 저장소](https://github.com/MovieHolic-Plex/OpenRPGMaker-store)(`OpenRPGMaker-store`)에서 운영한다.
이 저장소에는 에디터 창, 순수 팩 계약, Electron 중계, 공식 팩 게시기만 남긴다(2026-10-09 분리, 2026-10-20 감사로 정리).

## 어디에 무엇이 있나

| 조각 | 위치 | 하는 일 |
|---|---|---|
| 팩 계약 `oprn-store-pack/1` | `src/assetStore/format.ts` | 매니페스트 형식·한도·`validateManifest`·`storeThirdPartyName`(제3자 팩 이름). 서버 번들에도 그대로 들어간다 |
| 기물 설명서 | `src/project/objectSpec.ts` | ObjectSpec v1(계약 파일, 의존 없음). 팩 `content.objects[]` = `{tileset, kit, spec}`, `buildPack` 이 킷 spec 에서 만든다 — `openwiki/object-spec.md` |
| 팩 만들기·넣기 | `src/assetStore/pack.ts` | `buildPack`(닫힌 의존 전체 검사)·`applyPackToProject`·OPK1 `encodePackBundle`/`decodePackBundle`·크레딧 |
| 바이트 판정 | `src/assetStore/sniff.ts` | 시그니처로 형식 판정(확장자·선언 mime 은 믿지 않는다) |
| 스토어 창 | `src/editor/assetStore/*` | 둘러보기·받기·넣기·올리기 화면. 올리기 후보는 `storeUpload.ts` |
| Electron 중계 | `electron/main/assetStore.ts`·`assetStoreClient.ts` | 렌더러 대신 요청·해시 확인·디스크 캐시·토큰(safeStorage) |
| 공식 팩 게시기 | `scripts/store/*.mts` | 번들 타일셋·건물 검수 팩을 스토어에 올린다(아래 「게시기」) |
| 컨셉 게시 | `src/harnesses/game-concepts/node/publish.ts` | 사람이 받은 컨셉 카드만 올린다 |
| 서버·DB·검열·R2 | `OpenRPGMaker-store/src/`, `migrations/` | 업로드 검증, 심사, 목록, 파일 제공 |
| 서버 CLI | `OpenRPGMaker-store/scripts/storeCli.ts` | 운영자용 찾기·받기·올리기·숨기기 |
| 코딩 에이전트 제출 | `scripts/store/agentStore.mts` (`npm run -s store -- …`) | 주인이 발급한 에이전트 토큰으로 제출 — 항상 확인 대기. `openwiki/store-agent-contribution.md` |

스테이징 실행 상태는 저장소가 아니라 배포가 정한다. 2026-10-20 감사 때 스테이징은 분리 전 10-07 빌드였다
(concepts 경로·`/bundle` 없음). 배포는 스토어 저장소 쪽 일이다.

## 계약 동기화 절차

계약 파일은 `src/assetStore/{format,pack,sniff}.ts` + `src/project/objectSpec.ts`(2026-10-20, 기물 설명서)(+ 컨셉 `src/concepts/format.ts`)다. 스토어 저장소는 같은 파일을
바이트 그대로 들고, CI(`scripts/check-contract.mjs`)가 편집기 커밋 하나에 고정한 해시와 비교한다.

1. 편집기 PR 에서 계약 파일을 바꾼다 — 필드는 **더하기만** 한다(`oprn-store-pack/1` 이름은 그대로). 검증을 조이는 변경은
   지금 올라가 있는 상품이 다 통과하는지 먼저 읽기 전용으로 확인한다.
2. 머지 커밋 sha 를 스토어 저장소 담당에게 알린다. 스토어는 그 sha 로 고정을 갱신하고 같은 파일을 복사한다.
3. **스토어 서버를 먼저 배포**하고, 그다음 편집기(게시기·앱)를 낸다. 서버가 모르는 필드를 앱이 먼저 보내지 않게 한다.

## 올리기(내보내기) 경로

`storeWorkspace`/조수 카드 → `uploadCandidates`(후보·막힌 이유) → `buildPack`(닫힌 의존 + blob 자리표시) →
IPC `oprn:store.upload` → `AssetStoreClient.upload`(검증 → `/api/v1/blobs/check` → 빠진 blob 만 → `/api/v1/items` 또는 `/versions`).

### 제외(Rasak·REFMAP·RPG Maker MV/MZ·PAW) 집행 지점

2026-10-06 결정. 이름으로 막는 안전장치이고, 권리 확인은 올리는 사람 몫이다.

| 지점 | 무엇을 보나 |
|---|---|
| `storeThirdPartyName` (`format.ts`) | 공용 낱말표. rasak·라삭·refmap·rpgmaker·알만툴·쯔꾸르·ツクール 는 붙여 써도, paw·mv·mz·rtp 는 낱말로 떨어질 때만(camelCase·숫자 경계 분리, pawn·mvp 는 통과) |
| `storePublishBlockReason`·`packBlockedItems` (`pack.ts`) | 고른 것 **과 딸려 들어가는 것 전부**(타일셋 그림·이식 원본·참고문서 원본 타일셋·번들 이식 칩셋 이름). 스토어에서 받은 것(`origin`)·공용 자료집(`shared_`)도 막는다 |
| `buildPack` | 하나라도 걸리면 바이트를 읽기 전에 `StorePackBlockedError`(`.blocked` 목록, 한국어 문장) |
| `uploadCandidates` (`storeUpload.ts`) | 같은 판정으로 후보를 막고 「딸려 들어가는 X: …」를 보여 준다 |
| `publishProblems` (`scripts/store/storePublish.mts`) | 공식 팩도 제목·태그·id·이름에서 같은 낱말표 |
| 스토어 서버 검열 | 같은 `storeThirdPartyName` 으로 모든 역할에 422 거절, 다른 작가 상품의 blob 재사용 거절(스토어 저장소 쪽 변경) |

스토어에서 받은 에셋을 다시 올리는 길은 없다 — 원작자·라이선스(`origin`)를 지우고 다시 내보내지 않도록 막는다.

## 받기(가져오기) 경로

`install` 은 `/api/v1/items/:slug/versions/:v/bundle`(OPK1 한 덩어리)을 로그인했으면 토큰을 붙여 먼저 묻는다. 서버가 405·501 이면,
또는 공개 상품(상태 `visible`·상태 없는 옛 서버)이 404 면 이번 실행 동안 그 주소에는 다시 묻지 않는다(`bundleUnsupportedStatus`).
확인 대기·숨김 상품의 404 는 그 상품만 `/manifest` + blob 8개 병렬로 받는다. 응답 상한은 `8 + manifestBytes + packBytes`,
gzip 은 풀린 크기에도 같은 상한(`maxOutputLength`). 캐시 blob 은 읽을 때마다 sha256 을 다시 보고 깨졌으면 다시 받는다.
`applyPackToProject` 는 프로젝트를 건드리기 전에 그림 규격(캐릭터 시트 등)과 타일셋 칸이 그림 안에 드는지 본다.
`validateManifest` 는 `__proto__`·`constructor`·`prototype` id, `count` 와 통행·층 배열 길이가 다른 타일셋, `--` 든 slug 를 받지 않는다.

### 캐릭터 칸의 짝 초상 (char-gen 캐릭터 세트, 2026-10-20)

`content.characters[i].portraits` = `{ face?, bust?: {표정: 에셋 id}, full?: {표정: 에셋 id}, extra? }` — 같은 팩의
faceset(48×48 얼굴)·picture(흉상·전신) 에셋을 가리킨다. 표정 이름은 공용 초상 16표정(`STORE_PORTRAIT_EXPRESSIONS`,
`SHARED_PORTRAIT_EXPRESSIONS` 와 같은 순서)이고 bust/full 은 `base` 가 있어야 한다. `extra`(thinking, hurt …)는 그림으로만 들어온다.
넣으면 칸마다 캐릭터 외형 `storeAppearanceId(slug, 시트, 칸)` 이 생긴다: 칩·얼굴·흉상·전신 base + `portraitExpressions`(표정 짝).
대사 표정은 `faceForDialogueEmotion` / `appearancePortraitForEmotion` 이 같은 모양의 그 표정 그림으로 바꾼다(없으면 base).
되돌리기·빼기(`storeUndo.ts`)는 그 외형도 같이 되돌리고, 쓰는 곳 검색에서 외형 자신은 세지 않는다(액터·이벤트가 그 외형을 쓰면 막는다).
만드는 쪽은 공개 저장소 [char-gen](https://github.com/MovieHolic-Plex/char-gen) `set` 명령·MCP 도구. 양쪽 전신 베일(promoteFaceToFullPortrait)은 아직 공용 초상만 승격한다.

**미리 돌려 보기 문서 주의 (2026-10-21):** `prepareStoreItem`(`src/editor/assetStore/storeApply.ts`)은 저장소 쓰기 전에
`applyPackToProject` 를 빈 문서로 한 번 돌려 에셋 id 를 얻는다. 그 빈 문서에 `charsetLabels`·`database.characterAppearances` 가
없으면 짝 초상이 든 캐릭터 팩(char-gen 묶음)이 `reading 'characterAppearances'` 로 죽는다 — 공방 가져오기·스토어 넣기 모두.
`applyPackToProject` 가 새 문서 칸을 건드리게 되면 이 빈 문서에도 그 칸을 같이 둔다(`pack.ts` 는 계약 고정 파일이라 그쪽에서 막지 않는다).

## 게시기

주소와 토큰은 코드·문서에 두지 않는다. 환경 변수로만 받고, 없으면 아무것도 보내지 않는다(plan 은 `configured:false`).

| 변수 | 쓰임 |
|---|---|
| `STORE_PUBLISH_STAGING_URL` | 스테이징(개발 로그인이 켜진 서버) |
| `STORE_PUBLISH_DEV_EMAIL` | 스테이징 개발 로그인 운영자 이메일(그 서버의 `STORE_ADMIN_EMAILS`) |
| `STORE_PUBLISH_PRODUCTION_URL` | 운영(https 만) |
| `STORE_LINK_TOKEN` | 운영 admin-link 일회용 토큰(15분·한 번). 인자로 받지 않는다 |
| `OPRN_STORE_TOKEN` | 컨셉 게시용 앱 토큰(없으면 `~/.config/oprn-store/cli.json`) |

```bash
# 건물 검수 화면의 「스토어에 올리기」가 부르는 명령(mount.py 가 --profile --target 을 붙인다)
OPRN_STORE_PUBLISHER="npm run -s store:publish-buildings --"
npm run -s store:publish-buildings -- --profile beodeul --target plan          # 대상별 상태·contentHash
npm run -s store:publish-buildings -- --profile beodeul --target staging
STORE_LINK_TOKEN=… npm run -s store:publish-buildings -- --profile beodeul --target production --confirm <contentHash>

npm run -s store:publish-bundle -- --list | --title "<제목>" --dry | --target staging [--new-version]
npm run harness -- game-concepts publish --target staging|prod --yes-prod|http://127.0.0.1:<포트>
```

- 같은 내용은 건너뛰고(`DATA/store-uploads.json`), 내용이 바뀌면 같은 상품에 판본을 더한다. 상품 찾기는 운영자 세션의
  `/api/v1/me` 로 한다(공개 목록 첫 쪽만 보던 옛 방식은 상품이 24개를 넘자 중복을 만들었다).
- 운영은 plan 이 보여 준 `contentHash` 를 `--confirm` 으로 돌려줘야 올라간다.
- **`npm run harness -- beodeul-building-review publish` 는 스토어 게시가 아니다.** 검사를 통과한 후보를 로컬 검수 화면
  (`review.sqlite`)에 내놓는 단계다. 스토어 게시는 위 `OPRN_STORE_PUBLISHER` 경로뿐이다.
- 로컬 시험은 스토어 저장소의 `node dist/local.mjs --data /tmp/<폴더> --port <포트> --host 127.0.0.1` 로 띄운 일회용 서버에만 한다.

## 상태 확인

건강 확인은 `GET /healthz` 다(`/api/v1/healthz` 가 아니다). 목록은 `GET /api/v1/items`, 상세는 `/api/v1/items/:slug`.

## 에디터 첫 진입 화면 (2026-10-12)

왼쪽 활동 막대의 「스토어」는 받은 목록이나 프로젝트별 개수를 보여 주는 화면이 아니다.
「인기 에셋 둘러보기」를 누르면 에셋 스토어가 `browse`·`sort: "popular"`로 열리고,
큰 화면의 제목도 「인기 에셋」으로 시작한다. 최신 목록·받은 것·프로젝트·올리기는 큰 화면의
탭에서 필요할 때 연다. 데스크톱 브리지가 없으면 기존 안내만 보여 준다.

## 스토어 창 UX (2026-10-20, 「사용자들이 매우 쉽게」)

처음 쓰는 사람 기준 감사(로컬 일회용 스토어 + 실제 Electron 창, 증거 `~/claude-viz/store-ux-1.html`) 뒤에 바꾼 계약이다.

| 파일 | 맡는 일 |
|---|---|
| `src/editor/assetStore/storeWorkspace.ts` | 창 껍데기·둘러보기·상세·넣기/되돌리기·받아 둔 것·내 프로젝트·신고 |
| `src/editor/assetStore/storeShare.ts` | 「내 에셋 나누기」 3걸음 마법사(고르기 → 자동 검사·소개 → 미리보기·올리기) |
| `src/editor/assetStore/storeText.ts` | 사람 문장(순수): 라이선스 한 문장, 「들어오는 것」, 크기, 오류 → 제목·고칠 방법·단추 |
| `src/editor/assetStore/storeUndo.ts` | 넣기 직전 모습 캡처·되돌리기·빼기·옛 판본 찌꺼기 정리(순수, `test/assetStoreUndo.test.ts`) |

- **탭 id 는 그대로**(`browse|installed|project|upload`, testid `store-tab-*`), 이름만 쉬운 말: 둘러보기 · 받아 둔 것 · 내 프로젝트 · 내 에셋 나누기.
- **첫 화면**: 종류 큰 칸 6개(`store-category-<kind>`: 땅·건물 타일, 캐릭터, 음악, 효과음, 게임 시작 세트, 얼굴) + 추천 한 개 + 인기 목록. 첫 방문 안내 띠(`store-first-run`, localStorage `oprn:store.firstRunDone`).
- **찾기**: Enter 없이 280ms 뒤 찾는다. 찾기 칸·머리는 열 때 한 번만 만들어 다시 그리지 않는다(한글 IME 조합이 끊기지 않게). 추천 목록(`store-suggest`)은 종류·이미 본 제목·태그에서 고르고 서버를 다시 부르지 않는다. `/` = 찾기 칸, ↑↓ Enter = 추천 고르기, Esc 는 한 겹씩(추천 → 로그인 → 신고 → 상세 → 창).
- **목록**: 24개씩, 끝이 보이면 다음 쪽(IntersectionObserver) + 「더 보기」. 늦게 온 옛 응답은 버린다(`catalogSeq`). 불러오는 동안 뼈대 카드.
- **상세**: 1100px 이상은 오른쪽 기둥, 그 아래(1024 창)는 덮개 패널. 「들어오는 것」 한 문장(`store-contents`), 라이선스·크레딧 한 문장(`store-license-sentence`), 크기(`store-size`, 판본 bytes), 「커뮤니티 작품」 출처 표시, 신고(`store-report` → 사유 5개, `window.oprn.store.report`).
- **넣기는 단추 하나**(`store-add`): 받기 → 넣기를 이어서 하고 진행 막대(`store-progress`, role=progressbar)를 그 자리에서만 고친다. 50MB 넘으면 먼저 묻고, 새 판본으로 바꿀 때도 묻는다. 끝나면 `store-added-panel`: 들어간 곳(타일 N칸 → 팔레트 …), 「새 맵에서 칠해 보기」(`store-open-palette` — 팔레트는 지금 맵의 타일셋만 보이므로 그 타일셋으로 새 맵을 만들어 연다), 「리소스 목록에서 보기」, **「되돌리기」**(`store-undo`).
- **되돌리기 계약**: `addStoreItemToProject` 가 넣기 직전 그 키들(에셋·타일셋·캐릭터 이름표·리소스 줄)을 `snapshot` 으로 돌려주고, `undoStoreItemAdd` 가 그대로 되돌린다(새 판본 넣기면 옛 판본이 돌아온다). 넣은 뒤 맵·이벤트·DB 가 그 id 를 쓰기 시작했으면 바꾸지 않고 쓰는 곳 이름을 알려 준다. 편집기 Ctrl+Z 기록도 그대로 남는다.
- **빼기·정리**: 「내 프로젝트」 탭의 「빼기」, 새 판본에서 빠진 옛 에셋 「정리하기」 — 같은 쓰는 곳 검사를 복제본에 먼저 돌린다.
- **오류**: `humanStoreError` 가 제목(쉬운 말) + 고칠 방법 + 단추(다시 시도·받아 둔 것 보기·신고·프로젝트 열기·로그인)로 바꾼다. 내부 영어 오류는 제목이 되지 않고 「자세히」 안에만. 오프라인은 배너가 아니라 빈 화면 카드(`store-offline`)에 다시 시도·받아 둔 것.
- **나누기**: 로그인은 마지막 걸음에서만. 2걸음의 자동 검사는 `packBlockedItems`(Rasak·REFMAP·RPG Maker MV·PAW·스토어에서 받은 것이 의존으로 딸려 와도 막힘) 결과를 그대로 보여 주고 다음으로 못 가게 한다. 라이선스는 쉬운 말 네 가지(추천 = OPRN-GAME). 내 에셋 새 판본 덮어쓰기는 확인을 받는다.
- **보안**: 상품 글(제목·소개·설명·작가·태그·크레딧)은 전부 `textContent` + `translate="no"` — `innerHTML` 을 쓰지 않는다. 그림은 메인이 sha256 을 확인한 blob 의 `blob:` 주소로만. 토큰은 메인 프로세스(safeStorage)에만 있고 DOM·localStorage·로그에 없다.
- **문구**: 새 문장은 한국어 원문 템플릿 하나로 쓰고 `src/i18n/catalogs/{en,ja,zh}.json` 에 넣었다(종류·라이선스 이름은 `STORE_KIND_NAMES` 그대로).
- **아직 없는 것**: 서버가 「검증된 작가」를 알려 주지 않아 모든 상품이 「커뮤니티 작품」으로 보인다(서버 필드가 생기면 배지만 붙이면 된다). 넣기를 중간에 취소하는 단추는 없다(받기 IPC 에 취소가 없다).

## 에디터에서 열기 링크 (2026-10-20)

스토어 웹사이트의 「에디터에서 열기」 단추는 `oprn://store/install?store=<스토어 출처>&slug=<slug>&version=<판본, 선택>` 를 연다.

| 조각 | 위치 | 하는 일 |
|---|---|---|
| 판정(순수) | `src/assetStore/deepLink.ts` `parseStoreDeepLink` | 경로 `store/install`(`oprn://store/install`·`oprn:store/install` 둘 다), `store` 출처 = 에디터가 쓰는 스토어 주소(`AssetStoreClient.url`)의 출처, slug = `STORE_SLUG`, 판본 = 양의 안전 정수. 틀리면 한국어 사유 |
| OS 등록·받기 | `electron/main/main.ts` | `setAsDefaultProtocolClient("oprn")`(개발 실행은 `OPRN_REGISTER_PROTOCOL=1` 일 때만), 배포 앱만 한 번만 실행 잠금(QA 하니스가 여러 개 띄우므로), `second-instance`(Windows·Linux 인자)·`open-url`(macOS)·첫 실행 인자. 링크 없는 두 번째 실행은 새 창(시작 화면) |
| 맡겨 두기 | `electron/main/assetStore.ts` `acceptStoreDeepLink` | 검사한 요청을 맡겨 두고(10분) 프로젝트가 열린 편집기 창에 `oprn:store.openLink` 로 알린다. 편집기는 `oprn:store.takeOpenLink` 로 꺼낸다(프로젝트 세션이 있는 창만). 편집기가 없으면 「프로젝트를 열면 이어서」 안내 |
| 편집기 | `src/editor/assetStore/storeOpenLink.ts` → `openAssetStoreForLink` | 부팅 뒤 한 번 꺼내고 알림을 듣는다. 스토어 창을 그 상품 상세로 열고 확인 카드(`store-link-confirm`) 「스토어에서 「제목」 vN 을 받아 이 프로젝트에 넣을까요?」. 「받아서 넣기」(`store-link-add`)만 기존 넣기 경로(`addToProject` → 받기 → `addStoreItemToProject`)를 탄다 |

- 링크가 준 주소로는 절대 받지 않는다. 다른 출처면 「다른 스토어 주소의 링크라 열지 않았습니다」 — 받기는 언제나 에디터에 설정된 스토어로 한다.
- 링크만으로는 아무것도 받지 않는다. 확인 카드에서 누른 뒤에만 받고 넣는다(새 판본으로 바꾸는 경우의 확인은 그대로).
- 로그인 없이 상품이 안 보이면(401·403·404, 주인 초안) 기존 기기 코드 로그인을 열고, 승인되면 그 상품을 다시 연다.
- 잘못된 링크는 편집기 알림(+ `console.warn("[store-link]")`), 편집기가 없으면 메인의 메시지 상자.
- 실제 OS 등록은 패키지 앱에서만 확인할 수 있다. `electron-builder.config.mjs` 의 `protocols` 가 macOS Info.plist·Linux .desktop 에 들어가고, Windows 는 첫 실행 때 앱이 등록한다.

## 주인 초안 (D2, 2026-10-20)

에이전트 제출은 승인 전까지 `status: "pending"` 이다. 같은 계정으로 로그인한 주인은 자기 초안을 자기 편집기에서 쓸 수 있다.

- 받기: 상세(`item`)·`/bundle`·`/manifest` 모두 토큰을 붙인다. 받을 때 상세가 `pending` 이면 `installed.json` 기록에 `draft: true`(선택 필드 — 옛 기록은 그대로 읽힌다).
- 표시: 받아 둔 것·상세·내 프로젝트 줄에 배지 「초안 · 나만 보임 · 공유 안 됨」(`store-draft-badge`). 받은 목록을 새로 볼 때(1분에 한 번, 로그인 승인 직후 바로) `refreshDrafts` 가 상태를 다시 보고, 공개(`visible`)되면 `draft` 를 떼어 배지가 사라진다.
- 공유 차단: 넣기는 초안이어도 같은 `applyPackToProject` 라 모든 에셋에 스토어 `origin` 이 남는다. `storePublishBlockReason` 이 `origin` 이 있는 에셋과 그 에셋을 그림으로 쓰는 타일셋을 막으므로 다시 올리거나 나눌 수 없다(`test/assetStoreDeepLink.test.ts` 「keeps store origin on an applied draft」).

## 바로 플레이 게임 (2026-10-23)

스토어의 「게임」 칸(`/games`, `/games/<slug>`, `/games/<slug>/play?v=<판본>`)에서 게임을 브라우저로 바로 플레이한다.
서버 계약은 비공개 저장소 OpenRPGMaker-store `src/games.ts`·`migrations/012_games.sql`, 판본 규칙은 `openwiki/release-and-version.md` 「스토어 바로 플레이 게임 판본」.

**격리(게임 코드는 스토어 출처에서 돌지 않는다).**
- **게임 진열대는 `play.openrpgmaker.com`(2026-10-24~)**, 에셋 스토어는 `store.openrpgmaker.com`. 같은 스토어 앱이 Host 로 나눠 받고
  옛 `store…/games…` 는 301. 로그인은 하나 — 호스트마다 `__Host-` 세션 쿠키, play 의 로그인은 스토어 `/sso/authorize` 의 60초 일회용 코드로 이어 받는다.
  게시 API 는 여전히 스토어 주소(편집기·`store:publish-game`). 새 판본은 play 만 품을 수 있게 굽는다(분리 전 판본은 다시 게시해야 play 에서 열린다).
  상세: 스토어 저장소 `deploy/README.md` 「게임 진열대」.
- 판본 파일은 별도 출처에서 나간다. 운영 스토어가 품는 출처는 2026-10-24 부터 **`games-kr.openrpgmaker.com`**(서울 seogo 직접, Cloudflare 안 거침 —
  KT 회선이 Cloudflare LAX 로 붙어 큰 파일이 300초 넘게 걸린 일이 있었다). `games.openrpgmaker.com`(Cloudflare 경유)은 예비로 그대로 둔다.
  고르는 값은 스토어 env `STORE_GAMES_PUBLIC_BASE`. games-kr 은 엣지 잠금 대신 IP 마다 요청·연결 제한(`deploy/nginx-games-kr.conf.template`).
  경로는 `<출처>/<slug>/<판본>/`. 운영은 seogo 의 nginx 가상 호스트가 디스크
  `/var/lib/oprn-store/games` 를 그대로 내보낸다(스토어 앱으로 가지 않음, 쿠키 없음, nosniff, 확장자별 형식, 판본 파일 immutable,
  html 은 `frame-ancestors` 를 스토어로 제한, Cloudflare 엣지 밖 직접 접속 403). 템플릿: 스토어 저장소 `deploy/nginx-games.conf.template`.
  스테이징은 같은 규칙의 `scripts/games-host.mjs`(http://mdc-server:18322).
- 스토어 쪽은 `<iframe sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-fullscreen">` 으로 품는다. 출처가 달라서
  allow-same-origin 은 게임 출처 자신의 저장소(세이브)만 연다. 스토어 페이지 CSP `frame-src` 는 게임 출처 하나.
- 스토어 세션 쿠키는 https 에서 `__Host-oprn_store_session`(Secure·Path=/·Domain 없음). 옛 이름은 2026-11-23 까지 한 번 받아 새 이름으로 다시 준다.
  상태를 바꾸는 요청은 Origin 이 스토어가 아니면 403(형제 하위 도메인 games.* 포함) + 기존 CSRF 토큰.
- 진입 문서 index.html 은 서버가 공식 플레이어 틀로 쓴다: meta CSP(부팅 스크립트 해시), `__OPENRPG_BOOT__.storeGame`(slug·판본·세이브 이름·품을 수 있는 출처).
  플레이어는 품은 쪽이 스토어가 아니면 부팅하지 않는다(`src/player/storeGameHost.ts`).

**불러오기(2026-10-24).** 웹 판본 부팅(`src/player/exportEntry.ts`)은 화면을 띄우기 전에 받는다:
- 「불러오는 중」 화면(`bootLoader.ts`): 표지·이름·진행 막대(project.json 바이트 → 첫 화면 파일 수), 끝나면 「시작하기」(첫 입력 = 소리 잠금 해제).
- 첫 화면 목록(`scenePreload.ts` `firstPlayableUrls`): 타이틀·오프닝·system 글자·메뉴 효과음 + 엔진 부팅 텍스처(가짜 로더로 `loadBundledAssets` 를 그대로 받아 적음)
  + 시작 맵(타일셋·화자 얼굴·BGM) + 시작 파티. 소리는 받은 바이트를 blob 으로 쥐고 있다(`preloadedAudio.ts`, 큰 WAV 가 캐시에 안 남는 문제).
- 시작한 뒤 뒤에서 **판본의 모든 파일**: 가까운 맵 → 코드 조각·스킬 효과 시트 → 나머지. 목록은 판본에 실린 `preload-files.json`(게시 때 생성).
  맵 이동은 페이드 뒤에서 새 맵 파일을 기다린다(`holdForMapAssets`, 300ms 넘으면 「불러오는 중…」). 전투 첫 화면은 #3306 관문이 기다린다.
- **그림 묶음**(`project/storeGamePacks.ts`·`player/preloadPacks.ts`): 512KB 이하 그림을 2MB 안팎 `packs/pNNN.json`({v:1, files:[[경로, base64]]})
  으로 묶어 싣고(첫 화면 파일 제외, 가까운 맵 순), `preload-files.json` 은 `{v:2, files, packs}`. 플레이어가 묶음을 풀어 Cache Storage
  `oprn-pack:/<slug>/<판본>/` 에 넣고, 판본 폴더 범위 서비스 워커 `preload-sw.js`(공식 파일, 신뢰 해시)가 그림 GET 만 캐시에서 준다.
  요청 3,500 → 약 200, 전체 미리 받기 32~39초 → 13~18초(운영, 서울). 서비스 워커를 못 쓰면(보안 문맥 아님·사파리 일부) 낱개로 받는다.
  보안(적대 검수 반영): 목록에 적힌 그림 경로만·`..`·다른 출처 거부, 매직 넘버 확인, 묶음 4MB 상한, 서비스 워커는 캐시 응답 몸통만 꺼내
  확장자 형식·nosniff·`CSP: sandbox` 로 새로 만든다. 옛 판본 묶음 캐시는 지운다. http 스테이징(mdc-server)은 보안 문맥이 아니라 묶음이 꺼진다 —
  localhost 로 포워딩해 잰다.
- 받기는 파일마다 12초 동안 바이트가 없으면 끊고 다시 받는다(최대 4번). 없는 파일(404)은 건너뛴다.
- 게시 도구(노드)는 2MB 넘는 WAV 를 MP3 192k 로 바꿔 싣고 `loading.json` 의 `aliases` 에 적는다 — 주소를 만드는 `withInlineAsset` 이 바꿔 부른다.
  편집기 안 게시는 아직 원본 WAV 를 싣는다(ffmpeg 없음).
- QA 표지: `<html data-preload-started-at / -background-at / -background-done-at / -background-files>`. 「늦게 뜬 파일」 = 시작 뒤 fetch 가 아닌 네트워크 자원.

**올리기는 데이터만.** 작가 업로드는 그림·소리·글꼴·json·md·txt 뿐이고 파일 앞 바이트(매직 넘버)까지 본다. html·js·css·svg·wasm 은
운영자가 올린 공식 플레이어 빌드의 sha256 만 받는다(`store_game_trusted_files`). project.json 은 모양 검사, 크기·개수·속도 제한, 판본 폴더 덮어쓰기 금지.

**게시.**
- 편집기(데스크톱 앱): 발행 대화상자 「스토어에서 바로 플레이」 칸 — 다음 판본(자동)·「큰 갱신」·바뀐 점(자동으로 채움)·「스토어에 올리기」.
  다리: `window.oprn.store.gameMine/gamePublish/gameCurrent`(`electron/main/assetStoreClient.ts`), 순서는 `src/assetStore/gamePublish.ts`.
- 대표 데모: `npm run store:publish-game -- --demo chrono-bell|emerald-crown|first-love --dry | --target staging | --target production --confirm <contentHash>`,
  되돌리기 `--rollback <slug>@<판본>`. 플레이어는 먼저 `npm run build:player`. 공용 그림·BGM 이 체크아웃 public/ 에 없으면 `OPRN_ASSET_ROOTS`.
