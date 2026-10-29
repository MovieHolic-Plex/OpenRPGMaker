# 라이선스 구조

저장소 루트의 네 문서가 정본이다. 이 쪽은 에이전트가 코드를 바꿀 때 지켜야 할 경계만 적는다.

| 대상 | 문서 | 요지 |
|---|---|---|
| 에디터·저장소 소스 | `LICENSE.md` (Sustainable Use License 1.0 + Additional Permissions) | 내부·개인·비상업 사용. 에디터 재판매·유료 배포·서비스화 금지 |
| 만든 게임·산출물 | `LICENSE.md` 「Your Games」「Ownership of Outputs」 | 상업 출시 자유, 산출물(AI 조수 결과 포함)은 사용자 소유 |
| 런타임 | `LICENSE-RUNTIME.md` (MIT) | **컴파일된** 플레이어 빌드 산출물만. 저장소의 원본 소스는 SUL 그대로 |
| 기본 그림·소리 | `ASSET-LICENSE.md` (OPRN 게임 사용) | 게임 안 자유, 소재 단독 재배포 금지. 스토어 `OPRN-GAME`과 같은 문서 |
| 이름·로고 | `TRADEMARKS.md` | 어떤 라이선스에도 안 들어간다 |
| 기여 | `CLA.md` | 재라이선스·승계 가능한 허락. 엑시트 실사 대비 |
| UGC 약관 | `docs/legal/ugc-terms-draft.md` | 초안. 스토어 약관 보강 조항 |

## 코드 경계 (에이전트가 지킬 것)

- **런타임 MIT 고지는 빌드가 붙인다.** `scripts/lib/runtimeLicenseBanner.mjs`가 `vite.player.config.ts`·`vite.standalone.config.ts`
  산출 JS 청크마다 `LICENSE-RUNTIME.md`의 MIT 전문을 `/*! … */`로 붙인다(압축 뒤 `generateBundle`). 문구를 플러그인에 다시 적지 말 것.
  런타임에 실리는 외부 패키지는 Phaser(MIT) 하나다. 같은 플러그인이 플레이어 빌드의 `phaser.min` 자산과, Phaser 를 묶는
  단일 HTML 빌드 청크에 Phaser 고지(`node_modules/phaser/LICENSE.md`)를 붙인다. 외부 패키지가 늘면 여기에 고지를 더한다.
- **내보낸 게임에 실리는 것은 전부 MIT로 공개되는 셈이다.** 플레이어 import 그래프(`src/player/exportEntry.ts`에서 시작)에
  에디터·하네스·프롬프트 코드를 끌어들이지 말 것. 실측(2026-10-07): `src/project/gameDesignBrief.ts`가
  `harnesses/_core/registry`를 import해서 `interior-props` 러너(약 243KB)와 공방 object-gen 키트(`api.openai.com` 주소 포함)가
  내보낸 게임 청크로 나갔다. 2026-10-27 수정: 스키마는 계약만 담은 `src/harnesses/_core/contracts.ts`를 쓴다(계약 있는 하네스를
  추가하면 여기에도 한 줄). 같은 날부터 `scripts/lib/playerBundleGuard.mjs`가
  두 플레이어 빌드에 붙어 `src/ai/`·하네스 레지스트리·하네스 `editor/`·공방 키트 모듈이나 AI 제공자 주소가 들어오면 import 사슬을 찍고
  빌드를 멈춘다.
  그래프 확인: `node scripts/oss/runtime-graph.mjs` — 런타임 소스 수, 외부 패키지, 끌려 들어온 editor·harnesses·testing 파일을 보여 준다.
- **제3자 자료**는 `public/assets/ATTRIBUTION.md`에 적힌 것만 원 라이선스로 남는다. 새로 들이지 않는다(2026-10-07 정리 결정).
  예외(2026-10-28 사용자 결정 「금지 풀고 넣기」): REFMAP 인물을 변형한 걷기 칩 `RefmapDoll<n>`(char-gen `refmap`, ATTRIBUTION 「RefmapDoll」). 변형한 칩만 들이고 원본 시트는 넣지 않는다.
  OPRN 게임 사용 라이선스가 아니라 REFMAP 조건(게임에 무료·유료 모두 사용, 변형 재배포는 표기와 함께, 소재 자체 판매·원본 재배포 금지)을 따른다. 스토어 제외(아래 asset-store.md)는 그대로라 소재로 다시 팔리지 않는다.
- **제3자 글·코드**는 루트 `ATTRIBUTION.md`에 적는다. 2026-10-29 사용자 결정으로 general-good-writing(코드 연규)의 윤문 규칙 문서와
  polish-lint 린터 일부를 들였다(`assistant-skills/dialogue-polish/references/`, `src/vendor/general-good-writing/`). 원본에 라이선스 파일이 없어
  저작자 허락을 받는 중이고, 허락 전에는 공개 origin 에 푸시·머지하지 않는다. 린터는 편집기 조수 도구가 동적 import 로만 부르며 플레이어 그래프에 넣지 않는다.
- **이름:** 공개 저장소 이름은 `OpenRPGMaker`(사용자 결정, 2026-10-07). 제품 표시명은 그대로 `src/brand.ts`의 OPRN 계열이고,
  brand.ts 의 「RPG Maker 계열 표현 금지」는 제품 표시명 규칙이라 그대로 둔다. 무관 고지는 `TRADEMARKS.md` 「RPG Maker」 절.
- 저작권자 표기는 「OPRN」(2026-10-08 사용자 결정, 법인 설립 전 임시). 법인명이 정해지면 `LICENSE.md`·`LICENSE-RUNTIME.md`·`TRADEMARKS.md`·`CLA.md`에서 함께 바꾼다.

## 남의 앱 OAuth 클라이언트 값

Antigravity 데스크톱 앱의 client id·secret 과 Codex CLI 의 client id 는 **저장소에 적지 않는다**(2026-10-08 결정 — 공개 저장소에 남의 앱 자격을 올리지 않는다).
`src/ai/oauth/clientConfig.ts` 의 `oauthClient()` 가 환경변수(`OPRN_ANTIGRAVITY_CLIENT_ID`·`OPRN_ANTIGRAVITY_CLIENT_SECRET`·`OPRN_CODEX_CLIENT_ID`) →
`configureOAuthClients()` 로 넣은 값 → 빌드 주입 `__OPRN_OAUTH_CLIENTS__` 순으로 읽는다.
Node 진입점(`scripts/lib/aiAuthRuntime.ts`, `scripts/verify-ported-oauth-live.mts`)은 설치된 `@oh-my-pi/pi-ai` 소스에서 읽어 넣고
(`scripts/lib/oauthClients.mjs` — pi-ai 의 exports 가 require 를 막아 탐색 경로로 폴더를 찾는다), 배포 Electron 메인은
`scripts/build-electron.mjs` 가 같은 값을 빌드 때 주입한다. 새 진입점이 이 OAuth 모듈을 직접 부르면 같은 설정 한 줄을 넣어야 한다.
테스트는 가짜 값으로 `configureOAuthClients` 를 부른다.

## 공개 저장소 내보내기 (OpenRPGMaker)

- 공식 공개 저장소는 `MovieHolic-Plex/OpenRPGMaker`다. 기존 `rpg-zzu` 저장소를 이름 변경해
  커밋 이력과 협업 기록을 보존했고, 이전에 별도로 생성했던 공개 저장소는
  `OpenRPGMaker-staging-20261009`로 보관한다.
- `node scripts/oss/export-public.mjs --ref origin/main --git` → `~/oss-export/OpenRPGMaker`. 제외 목록 `scripts/oss/publicSet.mjs`,
  self-hosted 워크플로 제거, 텍스트 안 내부 호스트·홈 경로·tailnet IP 치환, 기록 `PUBLIC_EXPORT.json`.
- 확인: 저작권 정리(#2335) 뒤 스냅샷 55,916개 파일 · 1.41GB(정리 전 2.4GB), `build:fast`·`build:player` 성공(2026-10-08). 사전 스캔은
  `node scripts/oss/prescan.mjs --ref HEAD`를 스냅샷 폴더에서 돌린다.
- 공개 전환 뒤에도 라이선스 정리와 배포 전 검수 절차는 기존 계약을 따른다. staging 저장소는
  이전 공개 저장소의 별도 이력을 확인할 때만 사용한다.
- 장소 파일(`public/assets/region-references/*.oprn.json`) 46개에는 지운 LPC·Slates 타일셋의 **이름표와 asset id**가 남아 있다
  (그림 데이터는 0). 프로젝트 타일셋 목록을 통째로 저장한 탓이다. 저작권 문제는 아니지만 정리하려면 장소 저장본을 다시 굽는다.
