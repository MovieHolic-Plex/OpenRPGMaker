# 에셋 스토어 연동

스토어 서버는 [별도 비공개 저장소](https://github.com/MovieHolic-Plex/OpenRPGMaker-store)(`OpenRPGMaker-store`)에서 운영한다.
이 저장소에는 에디터 창, 순수 팩 계약, Electron 중계, 공식 팩 게시기만 남긴다(2026-10-09 분리, 2026-10-20 감사로 정리).

## 어디에 무엇이 있나

| 조각 | 위치 | 하는 일 |
|---|---|---|
| 팩 계약 `oprn-store-pack/1` | `src/assetStore/format.ts` | 매니페스트 형식·한도·`validateManifest`·`storeThirdPartyName`(제3자 팩 이름). 서버 번들에도 그대로 들어간다 |
| 팩 만들기·넣기 | `src/assetStore/pack.ts` | `buildPack`(닫힌 의존 전체 검사)·`applyPackToProject`·OPK1 `encodePackBundle`/`decodePackBundle`·크레딧 |
| 바이트 판정 | `src/assetStore/sniff.ts` | 시그니처로 형식 판정(확장자·선언 mime 은 믿지 않는다) |
| 스토어 창 | `src/editor/assetStore/*` | 둘러보기·받기·넣기·올리기 화면. 올리기 후보는 `storeUpload.ts` |
| Electron 중계 | `electron/main/assetStore.ts`·`assetStoreClient.ts` | 렌더러 대신 요청·해시 확인·디스크 캐시·토큰(safeStorage) |
| 공식 팩 게시기 | `scripts/store/*.mts` | 번들 타일셋·건물 검수 팩을 스토어에 올린다(아래 「게시기」) |
| 컨셉 게시 | `src/harnesses/game-concepts/node/publish.ts` | 사람이 받은 컨셉 카드만 올린다 |
| 서버·DB·검열·R2 | `OpenRPGMaker-store/src/`, `migrations/` | 업로드 검증, 심사, 목록, 파일 제공 |
| 서버 CLI | `OpenRPGMaker-store/scripts/storeCli.ts` | 운영자용 찾기·받기·올리기·숨기기 |

스테이징 실행 상태는 저장소가 아니라 배포가 정한다. 2026-10-20 감사 때 스테이징은 분리 전 10-07 빌드였다
(concepts 경로·`/bundle` 없음). 배포는 스토어 저장소 쪽 일이다.

## 계약 동기화 절차

계약 파일은 `src/assetStore/{format,pack,sniff}.ts`(+ 컨셉 `src/concepts/format.ts`)다. 스토어 저장소는 같은 파일을
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

`install` 은 `/api/v1/items/:slug/versions/:v/bundle`(OPK1 한 덩어리)을 먼저 묻는다. 서버가 404·405·501 이면 이번 실행
동안 그 주소에는 다시 묻지 않고, `/manifest` + blob 8개 병렬로 받는다. 응답 상한은 `8 + manifestBytes + packBytes`,
gzip 은 풀린 크기에도 같은 상한(`maxOutputLength`). 캐시 blob 은 읽을 때마다 sha256 을 다시 보고 깨졌으면 다시 받는다.
`applyPackToProject` 는 프로젝트를 건드리기 전에 그림 규격(캐릭터 시트 등)과 타일셋 칸이 그림 안에 드는지 본다.
`validateManifest` 는 `__proto__`·`constructor`·`prototype` id, `count` 와 통행·층 배열 길이가 다른 타일셋, `--` 든 slug 를 받지 않는다.

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
