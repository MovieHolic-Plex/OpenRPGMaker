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
  `harnesses/_core/registry`를 import해서 `interior-props` 러너(약 243KB)가 내보낸 게임 청크로 나간다 — 미수정.
  그래프 확인: `node scripts/oss/runtime-graph.mjs` — 런타임 소스 수, 외부 패키지, 끌려 들어온 editor·harnesses·testing 파일을 보여 준다.
- **제3자 자료**는 `public/assets/ATTRIBUTION.md`에 적힌 것만 원 라이선스로 남는다. 새로 들이지 않는다(2026-10-07 정리 결정).
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

- 공개 저장소는 비공개 `MovieHolic-Plex/OpenRPGMaker`(2026-10-07 생성, 비어 있음). 이 저장소(rpg-zzu)를 뒤집지 않고 **한 커밋 스냅샷**을 올린다 —
  14GiB 이력에 지운 제3자 그림이 남아 있고, 동시 세션 때문에 이력 재작성이 불가능하다.
- `node scripts/oss/export-public.mjs --ref origin/main --git` → `~/oss-export/OpenRPGMaker`. 제외 목록 `scripts/oss/publicSet.mjs`,
  self-hosted 워크플로 제거, 텍스트 안 내부 호스트·홈 경로·tailnet IP 치환, 기록 `PUBLIC_EXPORT.json`.
- 확인: 저작권 정리(#2335) 뒤 스냅샷 55,916개 파일 · 1.41GB(정리 전 2.4GB), `build:fast`·`build:player` 성공(2026-10-08). 사전 스캔은
  `node scripts/oss/prescan.mjs --ref HEAD`를 스냅샷 폴더에서 돌린다.
- **정리가 끝나기 전 스냅샷을 원격에 푸시하지 말 것.** GitHub 은 강제 푸시로 덮은 커밋도 해시로 한동안 열람할 수 있어서,
  나중에 공개로 돌리면 옛 스냅샷의 제3자 그림이 새어 나간다. 첫 푸시가 곧 최종본이어야 한다.
- 장소 파일(`public/assets/region-references/*.oprn.json`) 46개에는 지운 LPC·Slates 타일셋의 **이름표와 asset id**가 남아 있다
  (그림 데이터는 0). 프로젝트 타일셋 목록을 통째로 저장한 탓이다. 저작권 문제는 아니지만 정리하려면 장소 저장본을 다시 굽는다.
