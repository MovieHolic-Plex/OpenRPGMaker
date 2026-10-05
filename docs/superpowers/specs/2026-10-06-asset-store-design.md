# OPRN 에셋 스토어 설계 (2026-10-06)

## 목표

데스크톱 앱(Electron) 안에서 에셋 스토어를 둘러보고, 받고, 프로젝트에 넣고, 내 에셋을 올린다.
범위는 무료 커뮤니티 마켓까지다(공식 팩 + 출처·크레딧 + 크리에이터 업로드). 유료 판매는 하지 않는다.

## 정해진 결정 (사용자, 2026-10-05~06)

| 항목 | 결정 |
|---|---|
| 범위 | 무료 커뮤니티 마켓 (유료 없음) |
| 업로드 입구 | 웹 낱장 업로드 + 에디터 완성 팩 업로드 둘 다 |
| 공개 방식 | 자동 검사 통과 즉시 공개 · 신고 누적 자동 숨김 · 새 계정 첫 3건만 사전 확인 |
| 제외 출처 | Rasak · REFMAP · MV 팩 계열 · PAW 전부 제외 |
| 저작권 신고 | admin@openrpgmaker.com |
| 관리자 | 운영자 계정 하나 |
| 에디터 | 데스크톱 앱만 (웹·팀 호스트 경로 제외) |
| 저장소 | 비공개 유지 → 공개 인터넷 배포는 하지 않고 Tailscale 안 스테이징까지 |

## 구성

```
store-server/ (Node 24 + Postgres)        Electron 메인                  렌더러(에디터)
 웹 화면 SSR  ──┐                          electron/main/assetStore.ts    src/editor/assetStore/*
 /api/v1  ──────┼── HTTPS ──────────────── 중계 + 해시 검증 + 캐시 ─ IPC ─ 둘러보기·받기·넣기·올리기
 blobs/ (sha256)┘                          userData/store/ (설치·캐시·토큰)
                                                                          src/store/* (공용 순수 모듈)
```

- 렌더러는 스토어 서버에 직접 요청하지 않는다. CSP `connect-src` 는 그대로 둔다.
  모든 요청은 IPC → 메인 프로세스가 대신 하고, 받은 바이트의 sha256 을 검증한다.
- 미리보기 그림은 `app:///__oprn/store/blob/<sha>` 로 렌더러에 준다(같은 출처라 CSP 변경 없음).
- 로그인은 기기 코드 방식이다. 에디터가 코드를 띄우고 브라우저에서 승인한다. 토큰은 `safeStorage` 로 암호화해 저장한다.

## 팩 형식 `oprn-store-pack/1`

낱장과 완성 팩이 같은 형식이다. 웹에서 올린 낱장은 서버가 에셋 하나짜리 팩으로 감싼다.

```ts
interface StorePackManifest {
  schema: "oprn-store-pack/1";
  title: string; summary: string; description: string; tags: string[];
  kind: StoreItemKind;            // tileset | character | face | battler | picture | music | sound | pack
  license: StoreLicense;          // CC0 | CC-BY-4.0 | CC-BY-SA-4.0 | OPRN-GAME
  aiGenerated: boolean;
  credits: string;                // 크레딧에 그대로 들어가는 표기
  content: {
    assets: Record<id, { id, name, kind, mime, blob: sha256, meta }>;
    tilesets: Record<id, TilesetDef>;    // image.id 는 같은 팩의 assets 키
  };
  previews: sha256[];             // 1~6장
  blobs: { sha256, mime, bytes }[];
}
```

- 모든 바이트는 sha256 주소의 blob 이다. 매니페스트 안의 `data:` URL(참고문서 그림 등)은
  `oprn-blob:<sha256>` 자리표시로 바뀌어 올라간다. 받을 때 다시 data URL 로 되돌린다.
- 등급(`grade`)은 서버가 판정한다. 타일셋에 참고문서(`referenceDocuments`)가 하나라도 있으면 `pack`(「조수 사용 가능」), 아니면 `single`.
- 실행 코드는 받지 않는다. blob 은 PNG·JPEG·WebP·OGG·MP3·WAV·M4A 시그니처만 통과한다.

## 프로젝트에 넣기와 출처

- 넣을 때 id 를 `store_<slug>__<원래 id>` 로 바꾼다. 같은 상품의 새 판본은 같은 id 를 덮어쓴다 → 맵 참조가 유지된다.
- 넣은 `UploadedAsset` 에 `origin` 을 남긴다: `{ store, itemSlug, version, author, license, aiGenerated, credits, url }`.
- 크레딧: `storeCredits(project)` 가 `origin` 을 모아 문장을 만든다. 출하 플레이어의 타이틀 「크레딧」 창이
  `ATTRIBUTION.md` 뒤에 이 문장을 덧붙인다. 스토어 창의 「이 프로젝트」 탭도 같은 문장을 보여 준다.
- 프로젝트는 스토어 없이 자체완결로 돌아간다(바이트는 프로젝트 assets 에 있다).

## 서버

- 표: `store_users` · `store_sessions` · `store_device_codes` · `store_tokens` · `store_items` · `store_versions`(불변) ·
  `store_blobs` · `store_reports` · `store_audit`. 바이트는 `STORE_BLOB_DIR/ab/cd/<sha>`.
- 로그인: Google OAuth(설정되면) · 개발용 로그인(`STORE_DEV_LOGIN=1`, 스테이징·테스트 전용) · 기기 코드 · API 토큰.
  관리자는 `STORE_ADMIN_EMAILS` 에 든 계정.
- 공개: 업로드 검증 통과 → 작가가 승인된 공개 3건 미만이면 `pending`, 아니면 `visible`.
  서로 다른 신고자 3명이면 `hidden` 으로 자동 전환. 관리자는 visible·hidden·removed 로 바꾼다.
  `removed` 는 blob 제공도 멈춘다(다른 공개 판본이 같은 blob 을 쓰면 계속 준다).
- 판본은 고칠 수 없다. 새로 올리면 번호가 늘어난다. 에디터는 「업데이트 있음」만 알린다.

## 하지 않는 것

유료 판매 · 플러그인/스크립트 배포 · 자동 업데이트 · 웹 편집기·팀 호스트 경로 · 공개 인터넷 배포(이번 작업).

## 검증

- 공용 모듈: vitest(형식 검증·자리표시·id 재작성·크레딧).
- 서버: node:test + 일회용 Postgres 클러스터 + 실제 HTTP(업로드·검증·자동 공개·신고 숨김·기기 코드·제거).
- 앱: Playwright `_electron` 으로 실제 앱을 띄워 둘러보기 → 받기 → 프로젝트에 넣기 → 저장·재로드 → 에디터에서 올리기.
- 스테이징: mdc-server 에 systemd --user 로 띄우고 앱이 그 주소에 붙는 화면 증거.
